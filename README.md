# Sentinel (Career AI) 🌱

**Sentinel** is an AI-Powered Career Acceleration Ecosystem designed to bridge the gap between learning and industry readiness. It uses a multi-agent AI system to assess skills, generate personalized portfolio projects, and verify work through simulated code reviews and vision analysis.

## 🌟 Key Features

### 1. 🧠 AI Career Mentor
*   **Resume Scanner**: Instant SWOT analysis of your technical profile using LLMs.
*   **Smart Chat**: Context-aware career guidance that remembers your history (persistent sessions).
*   **Strategy**: Personalized learning path suggestions based on your resume gaps.

### 2. 🏗️ The Foundry (Project Lab)
*   **AI-Generated Projects**: Dynamic project briefs generated based on your skill level and market demand.
*   **"The Architect" (AI Mentor)**: Real-time coding guidance and unblocking within the built-in Monaco Editor.
*   **Automated Verification**: Uses Vision AI ("The Auditor") to verify screenshots of your completed work before unlocking the next milestone.

### 3. 📄 Resume Architect AI (New!)
*   **A4 Professional Template**: Automatically formats your profile into a clean, side-by-side (Gray/White) A4 resume.
*   **Smart Content**: Uses AI to convert your Sentinel Lab projects into professional "STAR" method bullet points.
*   **Native PDF Export**: High-fidelity PDF export (using browser print) that supports multi-page resumes without breaking layout.

### 4. 🌏 Multilingual Support (New!)
*   **Tamil Mode (தமிழ்)**: Toggle the entire AI persona to speak in Tamil (using Tamil script) mixed with English technical terms.
*   **Cultural Context**: Designed to help rural students bridge the language gap without losing technical precision.

### 5. 💼 Job Hub
*   **Daily Scraper**: Automatically scrapes and caches fresh job listings from LinkedIn and Indeed every 24 hours.
*   **Smart Match**: Filters jobs based on your current skill set and project portfolio.

### 6. 👥 Collaborative Squad Mode
*   **Team Projects**: Join "Squads" to work on larger, complex projects.
*   **Gamified Growth**: Watch your "Sprout" grow into a tree as you complete milestones.

---

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React (Vite)
*   **Styling**: Tailwind CSS + Framer Motion
*   **State Management**: Zustand
*   **Editor**: Monaco Editor (VS Code web)
*   **PDF Generation**: Native Browser Print (CSS Media Queries)

### Backend
*   **API**: FastAPI (Python)
*   **Database**: SQLite (Local persistence for Profiles, Projects, Chat History, and Job Cache)
*   **AI Agents**: 
    *   `Llama-3.3-70b` (Logic & Chat)
    *   `Llama-3.2-90b-vision` (Image Verification)
    *   `Tavily API` (Live Web Search & Job Scraping)

---

## ⚙️ Setup & Installation

### Prerequisites
*   Node.js (v16+)
*   Python (v3.9+)
*   API Keys for **Groq/OpenAI** and **Tavily**.

### 1. Clone the Repository
```bash
git clone https://github.com/<YOUR_USERNAME>/SENTINEL.git
cd SENTINEL
```

### 2. Backend Setup
Navigate to the backend folder and set up the Python environment.

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Environment Variables**:
Create a `.env` file in the `backend/` folder:
```env
GROQ_API_KEY=your_groq_key_here
OPENAI_API_KEY=your_openai_key_here
TAVILY_API_KEY=your_tavily_key_here
```

### 3. Frontend Setup
Open a new terminal and navigate to the frontend folder.

```bash
cd frontend

# Install dependencies
npm install
```

---

## 🚀 Usage Guide

### Starting the Application
You need to run both the backend and frontend servers simultaneously.

**Terminal 1 (Backend):**
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
# Server running at http://localhost:8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
# App running at http://localhost:5173
```

### Workflow
1.  **Onboarding**: Upload your Resume PDF on the landing page.
2.  **Dashboard**: View your "Sprout" status and current skill gaps.
3.  **Project Lab**: Select a generated project (e.g., "Crypto Tracker").
4.  **The Foundry**: 
    *   Chat with "The Architect" for guidance.
    *   Write code in the editor.
    *   Upload screenshots of your progress to unlock the next phase.
5.  **Job Hub**: As you skill up, view AI-matched job opportunities (updated daily).
6.  **Resume Architect**: Generate a professional PDF resume citing your Sentinel projects.

---

## 🤝 Contribution
1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request