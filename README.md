<div align="center">

# 📊 Trackify
### *Smart, AI-Powered Budget Tracking for Students*

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://aistudio.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Log expenses with natural language. Calculate net pay automatically. Ditch manual spreadsheets.</b>
</p>

---

</div>

> 🌐 **Live Demo Coming Soon:** Trackify is currently being prepared for deployment on **Render** (with the Gemini AI integration pre-configured). In the meantime, you can run the full project locally using your own free API key!

---

### ⚡ Overview

Trackify removes the friction from personal finance management. Instead of entering amounts into rigid form inputs, users can write plain conversational entries like *"spent $14 on lunch at Subway"* or *"worked 6 hours at $17/hr"*. Trackify extracts key details, tags categories, calculates taxes/wages, and updates your ledger in real time.

---

### ✨ Core Features

* 💬 **Natural Language AI Parsing:** Log transactions effortlessly using Google's `gemini-3.1-flash-lite` model.
* 💼 **Hourly Income & Tax Calculator:** Input hours worked and hourly pay to automatically compute gross earnings, estimated tax withholdings, and take-home pay.
* 🏷️ **Smart Categorization:** Organize spending with customizable labels, color accents, and emoji tags.
* ⚡ **Zero-Bloat UI:** Built entirely with vanilla ES6+ JavaScript and modern CSS for instant load times and responsive desktop/mobile views.
* 🔒 **Local & Private:** Transaction records stay in your local SQLite instance.

---

### 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.9+, Flask |
| **Database** | SQLite3 |
| **Frontend** | Vanilla HTML5, Modern CSS3, JavaScript (ES6+) |
| **AI Integration** | Google Gemini API (`gemini-3.1-flash-lite`) |

---

### 🚀 Quick Start (Local Setup)

#### 1. Clone the Repository
```bash
git clone [https://github.com/EithanY-Coder/Trackify.git](https://github.com/EithanY-Coder/Trackify.git)
cd Trackify
