# ⚡ AVENGERS HQ - Mission Tasks & Academic Vault ⚡

An Avengers / Stark Tech themed personal management web application built with **Python (Flask)**, **SQLite**, **Chart.js**, and custom **Web Audio API** sound synthesis.

---

## 🌟 Key Features

### 1. 🛡️ Google Tasks HQ (with Subtasks & Proximity Deadlines)
- **Subtask Checklist**: Break missions into tactical subtasks with a visual progress bar.
- **Deadline Proximity Engine**: 
  - 🔴 **Overdue / Imminent Alert** (Due in <24h with glowing pulse)
  - 🟡 **Due Tomorrow**
  - 🟢 **Safe / Upcoming**
- **Priority Tags**: High (Red), Medium (Gold), Low (Blue).
- **Categories / Sectors**: Filter by *Studies*, *Assignments*, *Coding & AI*, *Exams*, *Personal*, or custom tags.
- **Real-Time Search**: Instant filter across task titles, descriptions, and subtasks.

### 2. 🎓 Academic Results & Marks Collector
- Record examination scores with marks obtained, maximum marks, and auto-computed grades (A+, A, B, etc.).
- **Live Statistics**: Overall percentage, total exams cataloged, and highest performing subject.
- **Interactive Trajectory Graph**: Visual **Chart.js** curve tracking score progression over time.
- Semester & Term tagging with custom remarks.

### 3. 📂 Subject & Section-Wise PDF Vault
- **Subject Categorization**: Filter documents by Physics, Mathematics, AI, Computer Science, etc.
- **Section / Module Tags**: Organize notes by Unit 1, Lab Manual, Previous Year Questions, etc.
- **In-Browser PDF Viewer Modal**: Preview PDF files directly inside the HUD without leaving the page.
- **Drag-and-Drop Uploader**: Fast file upload with automatic file size calculations.

### 4. ⚛️ Stark Arc Reactor Focus Timer (Bonus Feature)
- Pomodoro-inspired deep work timer (25 min Focus / 5 min Cooldown).
- Animated spinning Arc Reactor core with visual energy pulsing.
- Audio cues for work completion and cooldown periods.

### 5. 🔊 J.A.R.V.I.S. Audio Synthesizer & Visual Hover Effects
- Synthesized sci-fi interface audio (Web Audio API) for button clicks, mission completions, and alerts.
- Toggle sound ON/OFF anytime from the top bar.
- Glassmorphism HUD styling with neon cyan, gold, crimson, and vibranium purple accents.

---

## 🚀 How to Run the Website

1. Open PowerShell or Terminal in this folder (`c:\Users\DELL\Desktop\First_project`).
2. Run the application:
   ```bash
   python app.py
   ```
3. Open your browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```

---

## 📁 Project Structure

```
First_project/
├── app.py                     # Flask REST API & SQLite Database Backend
├── requirements.txt           # Python dependencies
├── avengers_hq.db             # Local SQLite Database (auto-generated)
├── static/
│   ├── css/
│   │   ├── style.css          # Stark-Tech theme, glassmorphism, responsive grid
│   │   └── animations.css     # Hover glows, Arc Reactor spinning animations, pulses
│   └── js/
│       ├── app.js             # JARVIS Sound Engine & Deadline Proximity Checker
│       ├── tasks.js           # Google Tasks logic, subtask checklists, filtering
│       ├── marks.js           # Academic records, GPA calculations, Chart.js graphs
│       ├── pdf_vault.js       # Section-wise PDF vault, in-browser PDF modal
│       └── focus_timer.js     # Arc Reactor Pomodoro focus timer
├── templates/
│   ├── base.html              # Core Avengers HUD layout & navigation
│   ├── dashboard.html         # Main Command Center overview
│   ├── tasks.html             # Google Tasks HQ page
│   ├── results.html           # Marks & Results page
│   ├── pdf_vault.html         # Section-wise PDF vault page
│   └── focus_timer.html       # Arc Reactor timer page
└── uploads/
    └── pdfs/                  # Uploaded PDF documents
```
