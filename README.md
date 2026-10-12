# NEXUS: CODE AWAKENING ⚔️

**NEXUS: CODE AWAKENING** is an AI-driven technical-interview prep game. The player logs in with GitHub, uploads a resume, and is "locked in" by an adversarial AI (NEXUS) inside a 30-day series of coding Chambers. A mentor AI (ARIA) gives hints only. Player code is run by Judge0 and graded by an AST analyser. Progress (NXP points) updates a Job-Readiness Matrix radar chart. Chamber 6 is a live interview finale: AI company avatars bid on the player, and NEXUS commits a trophy to the player's GitHub profile README.

## 🌟 Game Overview

* **6 Chambers**: Sequential coding challenges unlocking upon passing the prior chamber.
* **ARIA (Mentor AI)**: Hints only — never full solutions, maximum 3 lines of code in one reply.
* **NEXUS (Adversarial AI)**: Mocks player code and algorithmic performance (villain tone, strictly focused on code quality).
* **Judge0 & AST Evaluation**: Real-time sandboxed code execution and static abstract syntax tree analysis.
* **Job-Readiness Matrix**: Live radar chart scoring across DSA, System Design, and Code Cleanliness (0-100).
* **Finale (Chamber 6)**: Live interview with bidding AI company avatars and an automated trophy commit to GitHub.

---

## 🛠️ Tech Stack

### Frontend
* **Framework**: React 19 (Vite)
* **Styling**: Tailwind CSS 4 + Framer Motion
* **State Management**: Zustand
* **Editor**: Monaco Editor (`@monaco-editor/react`)
* **Visualizations**: Recharts (Job-Readiness Matrix radar chart)

### Backend
* **API Framework**: FastAPI (Python)
* **Database**: SQLite (Parameterised SQL queries)
* **LLM Engine**: OpenAI-compatible client configured via `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`
* **Code Execution**: Judge0 API (`JUDGE0_URL`, `JUDGE0_API_KEY`)
* **Code Evaluation**: Python built-in `ast` module

---

## ⚙️ Setup & Installation

### Prerequisites
* Node.js (v18+)
* Python (v3.10+)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Windows
# source venv/bin/activate  # On Linux/macOS
pip install -r requirements.txt
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```