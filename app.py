# pyrefly: ignore [missing-import]
from flask import Flask, render_template, jsonify, request
import database
import sqlite3
import os
import datetime
import requests
import json
import jwt
from dotenv import load_dotenv
import ssl

# Bypass SSL verification for local development (macOS cert issue)
ssl._create_default_https_context = ssl._create_unverified_context

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

# Initialize database
database.init_db()

# JWT Verification helper for Supabase tokens using JWKS endpoint (supports ES256, RS256, etc.)
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
jwks_headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': f'Bearer {SUPABASE_ANON_KEY}'
}
jwks_client = jwt.PyJWKClient(JWKS_URL, headers=jwks_headers)

def get_auth_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ', 1)[1]
    
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get('alg', 'ES256')
        
        # Retrieve public signing key dynamically from JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Decode and verify
        payload = jwt.decode(
            token, 
            signing_key.key, 
            algorithms=[alg], 
            options={"verify_aud": False}
        )
        return payload.get('sub')
    except jwt.ExpiredSignatureError as e:
        print(f"JWT Expired: {e}")
        return None
    except jwt.InvalidTokenError as e:
        print(f"JWT Invalid: {e}")
        return None
    except Exception as e:
        print(f"JWT Verification failed: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

# ----------------- AUTHENTICATION API STATUS -----------------

@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    user_id = get_auth_user()
    if user_id:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user_id
            }
        })
    return jsonify({'authenticated': False})

# ----------------- CATEGORIES API -----------------

@app.route('/api/categories', methods=['GET'])
def get_categories():
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    conn = database.get_db_connection()
    try:
        categories = conn.execute(
            'SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY name ASC',
            (user_id,)
        ).fetchall()
        return jsonify([dict(c) for c in categories])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/categories', methods=['POST'])
def add_category():
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    icon = data.get('icon', '📦').strip()
    color = data.get('color', '#ADB5BD').strip()
    
    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
        
    conn = database.get_db_connection()
    try:
        # Check if already exists for this user or globally
        exists = conn.execute(
            'SELECT id FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name = ?',
            (user_id, name)
        ).fetchone()
        if exists:
            return jsonify({'error': f'Category "{name}" already exists.'}), 400
            
        cursor = conn.execute(
            'INSERT INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, ?)',
            (name, icon, color, user_id)
        )
        conn.commit()
        new_id = cursor.lastrowid
        return jsonify({'id': new_id, 'name': name, 'icon': icon, 'color': color}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/categories/<int:c_id>', methods=['PUT'])
def update_category(c_id):
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    icon = data.get('icon', '📦').strip()
    color = data.get('color', '#ADB5BD').strip()
    
    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
        
    conn = database.get_db_connection()
    try:
        old_cat = conn.execute('SELECT user_id, name FROM categories WHERE id = ?', (c_id,)).fetchone()
        if not old_cat:
            return jsonify({'error': 'Category not found.'}), 404
            
        if old_cat['user_id'] is None:
            return jsonify({'error': 'Default categories cannot be modified.'}), 403
            
        if old_cat['user_id'] != user_id:
            return jsonify({'error': 'Unauthorized.'}), 401
            
        old_name = old_cat['name']
        
        if old_name != name:
            exists = conn.execute(
                'SELECT id FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name = ? AND id != ?',
                (user_id, name, c_id)
            ).fetchone()
            if exists:
                return jsonify({'error': f'Category "{name}" already exists.'}), 400
        
        conn.execute("PRAGMA foreign_keys = OFF;")
        conn.execute('''
            UPDATE categories
            SET name = ?, icon = ?, color = ?
            WHERE id = ? AND user_id = ?
        ''', (name, icon, color, c_id, user_id))
        
        if old_name != name:
            conn.execute('''
                UPDATE transactions
                SET category_name = ?
                WHERE category_name = ? AND user_id = ?
            ''', (name, old_name, user_id))
            
        conn.commit()
        return jsonify({'id': c_id, 'name': name, 'icon': icon, 'color': color})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.close()

@app.route('/api/categories/<int:c_id>', methods=['DELETE'])
def delete_category(c_id):
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    conn = database.get_db_connection()
    try:
        cat = conn.execute('SELECT user_id, name FROM categories WHERE id = ?', (c_id,)).fetchone()
        if not cat:
            return jsonify({'error': 'Category not found.'}), 404
            
        if cat['user_id'] is None:
            return jsonify({'error': 'Default categories cannot be deleted.'}), 403
            
        if cat['user_id'] != user_id:
            return jsonify({'error': 'Unauthorized.'}), 401
            
        cat_name = cat['name']
        if cat_name == 'Miscellaneous':
            return jsonify({'error': 'The "Miscellaneous" category cannot be deleted.'}), 400
            
        misc_exists = conn.execute('SELECT id FROM categories WHERE name = "Miscellaneous" AND user_id IS NULL').fetchone()
        if not misc_exists:
            # Recreate global miscellaneous if needed
            conn.execute('INSERT INTO categories (name, icon, color, user_id) VALUES ("Miscellaneous", "📦", "#ADB5BD", NULL)')
            
        conn.execute("PRAGMA foreign_keys = OFF;")
        conn.execute('''
            UPDATE transactions
            SET category_name = "Miscellaneous"
            WHERE category_name = ? AND user_id = ?
        ''', (cat_name, user_id))
        
        conn.execute('DELETE FROM categories WHERE id = ? AND user_id = ?', (c_id, user_id))
        conn.commit()
        
        return jsonify({'success': True, 'message': f'Category "{cat_name}" deleted. Transactions reassigned to Miscellaneous.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.close()

# ----------------- TRANSACTIONS API -----------------

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    conn = database.get_db_connection()
    try:
        transactions = conn.execute(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
            (user_id,)
        ).fetchall()
        return jsonify([dict(t) for t in transactions])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    data = request.get_json() or {}
    t_type = data.get('type') # 'income' or 'expense'
    description = data.get('description', '').strip()
    category_name = data.get('category_name', 'Miscellaneous').strip()
    date = data.get('date', '')
    
    if t_type not in ['income', 'expense']:
        return jsonify({'error': 'Invalid transaction type.'}), 400
    if not date:
        return jsonify({'error': 'Date is required.'}), 400
        
    amount = 0.0
    hours_worked = None
    hourly_wage = None
    tax_rate = None
    gross_amount = None
    
    if t_type == 'income':
        hours_worked_raw = data.get('hours_worked')
        hourly_wage_raw = data.get('hourly_wage')
        
        if hours_worked_raw is not None and hourly_wage_raw is not None and hours_worked_raw != '' and hourly_wage_raw != '':
            try:
                hours_worked = float(hours_worked_raw)
                hourly_wage = float(hourly_wage_raw)
            except ValueError:
                return jsonify({'error': 'Hours worked and hourly wage must be numbers.'}), 400
        
        try:
            amount = float(data.get('amount', 0))
        except ValueError:
            return jsonify({'error': 'Amount must be a number.'}), 400
            
        tax_rate_raw = data.get('tax_rate')
        if tax_rate_raw is not None and tax_rate_raw != '':
            try:
                tax_rate = float(tax_rate_raw)
            except ValueError:
                return jsonify({'error': 'Tax rate must be a number.'}), 400
                
        gross_amount_raw = data.get('gross_amount')
        if gross_amount_raw is not None and gross_amount_raw != '':
            try:
                gross_amount = float(gross_amount_raw)
            except ValueError:
                return jsonify({'error': 'Gross amount must be a number.'}), 400
    else:
        try:
            amount = float(data.get('amount', 0))
        except ValueError:
            return jsonify({'error': 'Amount must be a number.'}), 400
            
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than zero.'}), 400
        
    category_icon = data.get('category_icon', '📦').strip()
    category_color = data.get('category_color', '#ADB5BD').strip()

    conn = database.get_db_connection()
    try:
        # Check if category exists for this user or globally
        cat = conn.execute(
            'SELECT name FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name = ?',
            (user_id, category_name)
        ).fetchone()
        if not cat:
            if category_name.lower() == 'income':
                conn.execute(
                    'INSERT OR IGNORE INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, NULL)',
                    ('Income', '💵', '#2B8A3E')
                )
                conn.commit()
            else:
                conn.execute(
                    'INSERT OR IGNORE INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, ?)',
                    (category_name, category_icon, category_color, user_id)
                )
                conn.commit()
            
        cursor = conn.execute('''
            INSERT INTO transactions (user_id, type, amount, description, category_name, date, hours_worked, hourly_wage, tax_rate, gross_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, t_type, amount, description, category_name, date, hours_worked, hourly_wage, tax_rate, gross_amount))
        
        conn.commit()
        new_id = cursor.lastrowid
        
        return jsonify({
            'id': new_id,
            'type': t_type,
            'amount': amount,
            'description': description,
            'category_name': category_name,
            'date': date,
            'hours_worked': hours_worked,
            'hourly_wage': hourly_wage,
            'tax_rate': tax_rate,
            'gross_amount': gross_amount
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/transactions/<int:t_id>', methods=['DELETE'])
def delete_transaction(t_id):
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    conn = database.get_db_connection()
    try:
        # Check if exists and belongs to this user
        exists = conn.execute('SELECT id FROM transactions WHERE id = ? AND user_id = ?', (t_id, user_id)).fetchone()
        if not exists:
            return jsonify({'error': 'Transaction not found.'}), 404
            
        conn.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (t_id, user_id))
        conn.commit()
        return jsonify({'success': True, 'message': 'Transaction deleted.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/transactions/<int:t_id>', methods=['PUT'])
def update_transaction(t_id):
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    data = request.get_json() or {}
    t_type = data.get('type') # 'income' or 'expense'
    description = data.get('description', '').strip()
    category_name = data.get('category_name', 'Miscellaneous').strip()
    date = data.get('date', '')
    
    if t_type not in ['income', 'expense']:
        return jsonify({'error': 'Invalid transaction type.'}), 400
    if not date:
        return jsonify({'error': 'Date is required.'}), 400
        
    amount = 0.0
    hours_worked = None
    hourly_wage = None
    tax_rate = None
    gross_amount = None
    
    if t_type == 'income':
        hours_worked_raw = data.get('hours_worked')
        hourly_wage_raw = data.get('hourly_wage')
        
        if hours_worked_raw is not None and hourly_wage_raw is not None and hours_worked_raw != '' and hourly_wage_raw != '':
            try:
                hours_worked = float(hours_worked_raw)
                hourly_wage = float(hourly_wage_raw)
            except ValueError:
                return jsonify({'error': 'Hours worked and hourly wage must be numbers.'}), 400
        
        try:
            amount = float(data.get('amount', 0))
        except ValueError:
            return jsonify({'error': 'Amount must be a number.'}), 400
            
        tax_rate_raw = data.get('tax_rate')
        if tax_rate_raw is not None and tax_rate_raw != '':
            try:
                tax_rate = float(tax_rate_raw)
            except ValueError:
                return jsonify({'error': 'Tax rate must be a number.'}), 400
                
        gross_amount_raw = data.get('gross_amount')
        if gross_amount_raw is not None and gross_amount_raw != '':
            try:
                gross_amount = float(gross_amount_raw)
            except ValueError:
                return jsonify({'error': 'Gross amount must be a number.'}), 400
    else:
        try:
            amount = float(data.get('amount', 0))
        except ValueError:
            return jsonify({'error': 'Amount must be a number.'}), 400
            
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than zero.'}), 400
        
    category_icon = data.get('category_icon', '📦').strip()
    category_color = data.get('category_color', '#ADB5BD').strip()

    conn = database.get_db_connection()
    try:
        # Check if transaction exists and belongs to this user
        exists = conn.execute('SELECT id FROM transactions WHERE id = ? AND user_id = ?', (t_id, user_id)).fetchone()
        if not exists:
            return jsonify({'error': 'Transaction not found.'}), 404
            
        # Check if category exists for this user or globally
        cat = conn.execute(
            'SELECT name FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name = ?',
            (user_id, category_name)
        ).fetchone()
        if not cat:
            if category_name.lower() == 'income':
                conn.execute(
                    'INSERT OR IGNORE INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, NULL)',
                    ('Income', '💵', '#2B8A3E')
                )
                conn.commit()
            else:
                conn.execute(
                    'INSERT OR IGNORE INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, ?)',
                    (category_name, category_icon, category_color, user_id)
                )
                conn.commit()
                
        conn.execute('''
            UPDATE transactions
            SET type = ?, amount = ?, description = ?, category_name = ?, date = ?, 
                hours_worked = ?, hourly_wage = ?, tax_rate = ?, gross_amount = ?
            WHERE id = ? AND user_id = ?
        ''', (t_type, amount, description, category_name, date, hours_worked, hourly_wage, tax_rate, gross_amount, t_id, user_id))
        
        conn.commit()
        return jsonify({
            'id': t_id,
            'type': t_type,
            'amount': amount,
            'description': description,
            'category_name': category_name,
            'date': date,
            'hours_worked': hours_worked,
            'hourly_wage': hourly_wage,
            'tax_rate': tax_rate,
            'gross_amount': gross_amount
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ----------------- AI PARSING API -----------------

@app.route('/api/ai/parse-transaction', methods=['POST'])
def parse_transaction_ai():
    user_id = get_auth_user()
    if not user_id:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        
    # Load API Key
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key:
        api_key = api_key.strip().strip('"').strip("'")
    
    if not api_key:
        return jsonify({
            'error': 'Gemini API key is not configured. Please add a `GEMINI_API_KEY=your_key` line to your `.env` file.'
        }), 400

    data = request.get_json() or {}
    user_prompt = data.get('prompt', '').strip()
    if not user_prompt:
        return jsonify({'error': 'Prompt is required.'}), 400

    # Get categories to guide the AI matching
    conn = database.get_db_connection()
    try:
        categories = conn.execute(
            'SELECT name FROM categories WHERE user_id IS NULL OR user_id = ?',
            (user_id,)
        ).fetchall()
        category_names = [c['name'] for c in categories]
    except Exception as e:
        category_names = ['Fast Food', 'Clothes', 'Technology', 'Flowers/Gifts', 'Education', 'Entertainment', 'Miscellaneous']
    finally:
        conn.close()

    current_date = datetime.date.today().strftime('%Y-%m-%d')
    
    # Call Gemini API
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
    
    system_instruction = (
        f"You are a helpful assistant for Trackify, a Student Budget Tracker. "
        f"Analyze the user's natural language input and extract transaction details. "
        f"The current date is {current_date} (today). "
        f"Available categories are: {', '.join(category_names)}. "
        f"If the transaction is an expense, check if it maps well to one of the available categories. "
        f"If none of the available categories fit, suggest a new broad, general category name "
        f"(e.g., 'Groceries', 'Transportation', 'Subscriptions', 'Rent', 'Dining Out') that fits the transaction. "
        f"Do not default to 'Miscellaneous' if you can suggest a reasonable general category instead. "
        f"If the transaction is income, category_name MUST be 'Income'. "
        f"If the prompt describes hourly work (e.g., 'worked 5 hours at $15/hr'), calculate the net amount (and gross amount), and also fill hours_worked and hourly_wage. "
        f"Always return structured JSON matching the schema."
    )
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"System Instruction: {system_instruction}\n\nUser Input: {user_prompt}"
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "type": {
                        "type": "STRING",
                        "enum": ["income", "expense"]
                    },
                    "amount": {
                        "type": "NUMBER",
                        "description": "Calculated amount. For hourly income, this is the net amount if tax is specified, or gross amount."
                    },
                    "description": {
                        "type": "STRING",
                        "description": "Brief description of the transaction (e.g., Burger, Wages, Tutoring)."
                    },
                    "category_name": {
                        "type": "STRING",
                        "description": "If expense, the matched available category name, or a new suggested general category name if none fit (e.g., 'Groceries', 'Transportation'). If income, must be 'Income'."
                    },
                    "category_icon": {
                        "type": "STRING",
                        "description": "A single emoji representing the category if a new category is suggested (e.g., '🛒', '🚗', '🏠'), otherwise return null or omit."
                    },
                    "category_color": {
                        "type": "STRING",
                        "description": "A Hex color string (e.g., '#4DABF7') representing the category if a new category is suggested, matching a modern pastel/vibrant aesthetic, otherwise return null or omit."
                    },
                    "date": {
                        "type": "STRING",
                        "description": "Date in YYYY-MM-DD format. Resolve relative dates like 'today', 'yesterday', 'last Monday' based on current date."
                    },
                    "hours_worked": {
                        "type": "NUMBER",
                        "description": "Only for hourly income: number of hours worked."
                    },
                    "hourly_wage": {
                        "type": "NUMBER",
                        "description": "Only for hourly income: hourly rate."
                    },
                    "tax_rate": {
                        "type": "NUMBER",
                        "description": "Optional tax rate percentage (e.g. 15 for 15%)."
                    },
                    "gross_amount": {
                        "type": "NUMBER",
                        "description": "Only if tax or hourly calculations are used: gross amount before taxes."
                    }
                },
                "required": ["type", "amount", "description", "category_name", "date"]
            }
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=15)
        if response.status_code != 200:
            return jsonify({'error': f'Gemini API error: {response.text}'}), response.status_code
            
        result_json = response.json()
        candidates = result_json.get('candidates', [])
        if not candidates:
            return jsonify({'error': 'No response candidate returned from Gemini.'}), 500
            
        text_content = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
        parsed_data = json.loads(text_content)
        
        return jsonify(parsed_data)
    except Exception as e:
        return jsonify({'error': f'Failed to process with AI: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
