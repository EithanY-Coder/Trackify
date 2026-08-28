Trackify
Trackify is a lightweight personal budget tracker designed for students to log income, track daily spending, and calculate net wages without complicated spreadsheets. It includes an AI parsing feature powered by Google's Gemini API to extract transaction details directly from natural language.

🌐 Live Demo: Trackify will be hosted live on Render shortly with the Gemini integration built in. Until the live site is live, you can supply your own Gemini API key to test the parser locally.

🌟 Features
Income & Expense Tracking: Log and organize daily student expenses and cash flow.

Paycheck Calculator: Computes gross pay, estimated tax withholdings, and take-home pay from hourly wages and shifts worked.

Category Tags: Organize transactions with custom labels, colors, and emojis.

Natural Language Parsing: Type plain-text entries (e.g., "spent $14 on lunch at Subway" or "tutored 3 hours at $20/hr"), and Gemini automatically extracts amounts, categories, and dates.

Lightweight UI: Vanilla JavaScript and CSS frontend connected to a Flask/SQLite backend.

🛠️ Tech Stack
Backend: Python, Flask

Database: SQLite

Frontend: Vanilla HTML5, CSS3, JavaScript (ES6+)

AI: Google Gemini API (gemini-3.1-flash-lite)

🚀 Local Setup
1. Clone the repo

Bash
git clone https://github.com/EithanY-Coder/Trackify.git
cd Trackify
2. Set up a virtual environment

Bash
# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows
python -m venv .venv
.venv\Scripts\activate
3. Install dependencies

Bash
pip install flask requests python-dotenv
4. Add your API key

Create a .env file in the root directory and add your key from Google AI Studio:

Code snippet
GEMINI_API_KEY="your_api_key_here"
5. Run the application

Bash
python3 app.py
Open [http://127.0.0.1:5001](http://127.0.0.1:5001) in your browser.

📁 Project Layout
Plaintext
├── app.py              # Flask routes and Gemini API handler
├── database.py         # SQLite setup and schema helpers
├── trackify.db         # Local database file (auto-generated)
├── .env                # Local secrets (git-ignored)
├── .gitignore
├── static/
│   ├── app.js          # DOM manipulation and fetch handlers
│   └── style.css       # Layout and design
└── templates/
    └── index.html      # Main dashboard interface
🗺️ Roadmap
Visual Analytics: Spending charts and monthly category breakdowns.

Recurring Logs: Automatic tracking for subscriptions and rent.

Data Export: Download transaction logs directly to .csv.

📄 License
Distributed under the MIT License.
