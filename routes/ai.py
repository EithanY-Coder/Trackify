import os
import json
import datetime
import requests

from flask import Blueprint, request, jsonify, g

from helpers import require_auth, get_db, limiter

bp = Blueprint('ai', __name__)


@bp.route('/api/ai/parse-transaction', methods=['POST'])
@require_auth
@limiter.limit("10 per minute")
def parse_transaction_ai():
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
    conn = get_db()
    try:
        categories = conn.execute(
            'SELECT name FROM categories WHERE user_id IS NULL OR user_id = ?',
            (g.user_id,)
        ).fetchall()
        category_names = [c['name'] for c in categories]
    except Exception:
        category_names = ['Fast Food', 'Clothes', 'Technology', 'Flowers/Gifts', 'Education', 'Entertainment', 'Miscellaneous']

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
