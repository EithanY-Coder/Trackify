Trackify is a lightweight personal budget tracker built for students to log income, track daily spending, and calculate net wages without dealing with complicated spreadsheets. It includes an AI parsing feature powered by Google's Gemini API that automatically extracts transaction details from plain text.

Note: Trackify will be hosted live on Render shortly with the Gemini integration built in. Until the live site is up, you will need to provide your own Gemini API key to test the natural language parser locally.

Features
Income & Expense Tracking: Quick logging for daily student expenses and earnings.

Paycheck Calculator: Calculates gross pay, estimated taxes, and take-home pay from hourly wages and hours worked.

Category Tags: Organize transactions with custom labels, colors, and emojis.

Natural Language Parsing: Type entries normally (e.g., "spent $14 on lunch at Subway" or "tutored 3 hours at $20/hr"), and the app extracts the price, category, and date automatically.

Lightweight UI: Vanilla JavaScript and CSS frontend connected to a Flask/SQLite backend.

Tech Stack
Backend: Python, Flask

Database: SQLite

Frontend: Vanilla HTML5, CSS3, JavaScript (ES6+)

API: Google Gemini (gemini-3.1-flash-lite)

Local Setup
Clone the repo:
git clone https://github.com/EithanY-Coder/Trackify.git
cd Trackify

Set up a virtual environment:

macOS/Linux
python3 -m venv .venv
source .venv/bin/activate

Windows
python -m venv .venv
.venv\Scripts\activate

Install packages:
pip install flask requests python-dotenv

Add your API key:
Create a .env file in the root directory and add your free Gemini key from Google AI Studio:
GEMINI_API_KEY="your_api_key_here"

Run the app:
python3 app.py

Open http://127.0.0.1:5001 in your browser.

Project Layout
├── app.py              # Flask routes and Gemini API handler
├── database.py         # SQLite setup and helpers
├── trackify.db         # Local database file
├── .env                # Local API keys (git-ignored)
├── .gitignore
├── static/
│   ├── app.js          # DOM manipulation and fetch requests
│   └── style.css       # Custom styling
└── templates/
└── index.html      # Main dashboard view
