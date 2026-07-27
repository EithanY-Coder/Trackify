# Trackify 📊

**Trackify** is a smart, interactive Student Budget Tracker designed to help students easily manage their income, expenses, and savings. Built with a Flask backend, SQLite database, and an intuitive, modern frontend, Trackify features **Gemini AI Integration** to automatically parse transactions from natural language.

---

## ✨ Features

- **Double-Entry Ledger:** Easily log income and expenses.
- **Hourly Income Calculator:** Automatically calculate net/gross pay and tax deductions based on hours worked and hourly wage.
- **Smart Category Management:** Group transactions with custom icons (emojis) and hex colors.
- **AI Transaction Parser (Gemini Beta):** Simply type in natural language (e.g., *"worked 5 hours at $15/hr"* or *"spent $12.50 on a burger today"*) and let the AI extract all details, calculate amounts, and assign categories automatically.
- **Clean Interactive UI:** View analytics, log logs, and interact with a premium, responsive dashboard.

---

## 🛠️ Tech Stack

- **Backend:** Python (Flask)
- **Database:** SQLite3
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **AI Integration:** Google Gemini API (`gemini-3.1-flash-lite`)

---

## ⚙️ Getting Started

### 1. Prerequisites
Make sure you have Python 3.8+ installed on your machine.

### 2. Installation
Clone this repository (or navigate to your local copy) and set up a virtual environment:

```bash
# Navigate to the project directory
cd "Trackify V1"

# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install dependencies (Flask, requests, etc.)
pip install flask requests python-dotenv
```

### 3. Setup Environment Variables
Create a file named `.env` in the root directory (do not commit this file to Git):

```env
GEMINI_API_KEY="your_actual_gemini_api_key_here"
```

*Note: `.env` is already configured in `.gitignore` to protect your API keys from leaking online.*

### 4. Running the Application
Launch the Flask development server:

```bash
python3 app.py
```

The application will start running at `http://127.0.0.1:5001/` (or your configured port). Open this address in your web browser.

---

## 📁 Project Structure

```
├── app.py              # Main Flask application and API endpoints
├── database.py         # Database initialization and connection helpers
├── trackify.db         # SQLite Database (generated locally)
├── .env                # Local secrets/keys (ignored by Git)
├── .gitignore          # File specifying ignored items in Git
├── static/
│   ├── app.js          # Core frontend application logic
│   └── style.css       # Premium responsive design system
└── templates/
    └── index.html      # Dashboard layout and controls
```

---

## 🔒 Security & Privacy Reminder
Never commit or upload your `.env` file or local databases (`trackify.db`) to GitHub. These files are listed in `.gitignore` to keep your credentials and personal information private.
