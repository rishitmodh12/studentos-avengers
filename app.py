import os
import json
import sqlite3
from datetime import datetime, date, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory, redirect, url_for
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'avengers-studentos-secret-2026'

# Support both local and Vercel/Serverless read-write paths
IS_VERCEL = bool(os.environ.get('VERCEL'))
if IS_VERCEL:
    UPLOAD_BASE = '/tmp/uploads'
    DB_PATH = '/tmp/avengers_hq.db'
else:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    UPLOAD_BASE = os.path.join(BASE_DIR, 'uploads')
    DB_PATH = os.path.join(BASE_DIR, 'avengers_hq.db')

app.config['UPLOAD_FOLDER'] = os.path.join(UPLOAD_BASE, 'pdfs')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'pdf'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Tasks & Subtasks
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT DEFAULT 'General',
                priority TEXT DEFAULT 'Medium',
                due_date TEXT,
                due_time TEXT,
                completed INTEGER DEFAULT 0,
                google_task_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subtasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        ''')

        # 2. Events & Schedule (Separate from study tasks)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                event_type TEXT DEFAULT 'Class', -- Class, Event, Study Block, Meeting, Workshop
                subject TEXT DEFAULT 'General',
                event_date TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                location TEXT,
                notes TEXT,
                completed INTEGER DEFAULT 0,
                color_code TEXT DEFAULT '#00f2fe',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 3. Habits & Daily Streaks (e.g. Hanuman Chalisa)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                reminder_time TEXT DEFAULT '07:30',
                target_days TEXT DEFAULT 'Everyday',
                category TEXT DEFAULT 'Spiritual & Focus',
                active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS habit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER NOT NULL,
                log_date TEXT NOT NULL, -- YYYY-MM-DD
                completed INTEGER DEFAULT 1,
                notes TEXT,
                FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
                UNIQUE(habit_id, log_date)
            )
        ''')

        # 4. Quotes & Feedback Engine
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quote TEXT NOT NULL,
                author TEXT NOT NULL,
                category TEXT DEFAULT 'Virat Kohli',
                rating INTEGER DEFAULT 5,
                feedback TEXT,
                is_user_added INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 5. Goals Tracker
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT DEFAULT 'Academic',
                target_date TEXT,
                progress INTEGER DEFAULT 0,
                status TEXT DEFAULT 'In Progress',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 6. Notes Module
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                subject TEXT DEFAULT 'General',
                tags TEXT DEFAULT '',
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 7. Exams & Syllabus
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS exams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                subject TEXT NOT NULL,
                exam_date TEXT NOT NULL,
                exam_time TEXT,
                syllabus_checklist TEXT,
                target_grade TEXT DEFAULT 'A+',
                status TEXT DEFAULT 'Upcoming',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 8. Results & Marks
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exam_name TEXT NOT NULL,
                subject TEXT NOT NULL,
                marks_obtained REAL NOT NULL,
                max_marks REAL NOT NULL,
                grade TEXT,
                semester_term TEXT,
                exam_date TEXT,
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 9. PDF Documents
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pdf_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                subject TEXT NOT NULL,
                section_tag TEXT DEFAULT 'General',
                file_name TEXT NOT NULL,
                file_size_kb REAL,
                upload_date TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()

        # Seed initial content if fresh database
        cursor.execute('SELECT COUNT(*) FROM quotes')
        if cursor.fetchone()[0] == 0:
            seed_initial_data(cursor)
            conn.commit()

def seed_initial_data(cursor):
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    two_days_ago = (date.today() - timedelta(days=2)).isoformat()
    three_days_ago = (date.today() - timedelta(days=3)).isoformat()

    # 1. Quotes (Virat Kohli, Raj Shamani, Tony Stark, Spiritual & Legends)
    quotes = [
        ("Self-belief and hard work will always earn you success. Whatever you want to do, do with full passion.", "Virat Kohli", "Virat Kohli"),
        ("If you are not making sacrifices for what you want, what you want will become the sacrifice.", "Virat Kohli", "Virat Kohli"),
        ("The biggest risk in life is not taking any risk. Keep taking chances and building your compounding skills.", "Raj Shamani", "Raj Shamani"),
        ("You don't get opportunities in life, you create them by staying consistent when nobody is watching.", "Raj Shamani", "Raj Shamani"),
        ("Sometimes you gotta run before you can walk. Build the future with relentless engineering.", "Tony Stark", "Tony Stark"),
        ("You have the right to work, but never to the fruit of work. Focus on full dedication today.", "Bhagavad Gita", "Spiritual"),
        ("Consistency is the DNA of mastery. Start your day with devotion and discipline.", "Daily Wisdom", "Habit"),
        ("Dream is not that which you see while sleeping, it is something that does not let you sleep.", "Dr. APJ Abdul Kalam", "Inspirational")
    ]
    for q, a, cat in quotes:
        cursor.execute('INSERT INTO quotes (quote, author, category) VALUES (?, ?, ?)', (q, a, cat))

    # 2. Habit: Hanuman Chalisa Daily
    cursor.execute('''
        INSERT INTO habits (name, description, reminder_time, target_days, category, active)
        VALUES 
        ('Read Hanuman Chalisa', 'Daily recitation for mental strength, focus, courage and positive aura.', '07:30', 'Everyday', 'Spiritual & Focus', 1),
        ('Morning Deep Workout', 'Cardio, strength training and posture building.', '06:30', 'Everyday', 'Physical', 1),
        ('Read 10 Pages of Book/Notes', 'Continuous daily learning and knowledge enhancement.', '21:30', 'Everyday', 'Study', 1)
    ''')
    
    cursor.execute('SELECT id FROM habits WHERE name = "Read Hanuman Chalisa"')
    hc_id = cursor.fetchone()[0]
    # Seed streaks for Hanuman Chalisa (past 3 days completed)
    for past_d in [three_days_ago, two_days_ago, yesterday, today]:
        cursor.execute('INSERT OR IGNORE INTO habit_logs (habit_id, log_date, completed, notes) VALUES (?, ?, 1, ?)', 
                       (hc_id, past_d, 'Recited with full devotion'))

    # 3. Events & Schedule (Separate from tasks)
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    cursor.execute('''
        INSERT INTO events (title, event_type, subject, event_date, start_time, end_time, location, notes, color_code)
        VALUES
        ('Quantum Mechanics Lecture', 'Class', 'Physics', ?, '09:00', '10:30', 'Hall A-102', 'Bring notebook & formula sheet', '#00f2fe'),
        ('AI & Machine Learning Lab', 'Class', 'Computer Science', ?, '11:00', '13:00', 'Lab 4', 'Hands-on neural network practice', '#ffb703'),
        ('Annual Tech Hackathon Briefing', 'Event', 'Extracurricular', ?, '15:00', '16:30', 'Auditorium', 'Team strategy discussion', '#ff2a4d'),
        ('Discrete Math Group Study Block', 'Study Block', 'Mathematics', ?, '17:30', '19:00', 'Library 2nd Floor', 'Solve problem sets together', '#9d4edd')
    ''', (today, today, tomorrow, tomorrow))

    # 4. Goals
    cursor.execute('''
        INSERT INTO goals (title, category, target_date, progress, status)
        VALUES
        ('Maintain 90%+ CGPA in Semester', 'Academic', '2026-12-31', 85, 'In Progress'),
        ('Complete 100-Day Hanuman Chalisa & Focus Streak', 'Personal & Spiritual', '2026-12-31', 40, 'In Progress'),
        ('Deploy StudentOS on Vercel with Google Tasks Sync', 'Project & Career', '2026-10-15', 95, 'In Progress')
    ''')

    # 5. Exams
    cursor.execute('''
        INSERT INTO exams (title, subject, exam_date, exam_time, syllabus_checklist, target_grade)
        VALUES
        ('Physics Semester End Exam', 'Physics', '2026-11-20', '10:00', 'Wave Mechanics, Thermodynamics, Quantum Basics', 'A+'),
        ('Data Structures & Algorithms Mid-Term', 'Computer Science', '2026-10-25', '14:00', 'Trees, Graphs, Dynamic Programming', 'O')
    ''')

    # 6. Sample Tasks
    cursor.execute('''
        INSERT INTO tasks (title, description, category, priority, due_date, due_time, completed)
        VALUES
        ('Submit Physics Lab Assignment', 'Write up observations on quantum spin measurements.', 'Studies', 'High', ?, '18:00', 0),
        ('Prepare Hackathon Architecture', 'Design database schemas and API endpoints.', 'Project', 'High', ?, '22:00', 0),
        ('Review Daily Notes & Hanuman Chalisa', 'Check daily streak and organize notes by subject.', 'Personal', 'Medium', ?, '21:00', 0)
    ''', (today, today, today))

    cursor.execute('SELECT id FROM tasks LIMIT 2')
    t_ids = [r[0] for r in cursor.fetchall()]
    if len(t_ids) >= 1:
        cursor.execute('INSERT INTO subtasks (task_id, title, completed) VALUES (?, ?, 1)', (t_ids[0], 'Export graph plots'))
        cursor.execute('INSERT INTO subtasks (task_id, title, completed) VALUES (?, ?, 0)', (t_ids[0], 'Write conclusion & references'))

    # 7. Sample Notes
    cursor.execute('''
        INSERT INTO notes (title, content, subject, tags)
        VALUES
        ('Quantum Mechanics Core Equations', 'Schrodinger Wave Equation: H|psi> = E|psi>\nKey principles: Superposition, Uncertainty Principle (dx*dp >= hbar/2).', 'Physics', 'formula,exam,quantum'),
        ('Raj Shamani Podcast Takeaways', '1. Execution beats perfection every single day.\n2. Learn to communicate your thoughts with clarity.\n3. Build your daily discipline muscle.', 'Wisdom', 'motivation,habits')
    ''')

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ================= PAGES ROUTES =================

@app.route('/')
def dashboard():
    return render_template('dashboard.html', active_page='dashboard')

@app.route('/tasks')
def tasks_page():
    return render_template('tasks.html', active_page='tasks')

@app.route('/events')
def events_page():
    return render_template('events.html', active_page='events')

@app.route('/habits')
def habits_page():
    return render_template('habits.html', active_page='habits')

@app.route('/notes')
def notes_page():
    return render_template('notes.html', active_page='notes')

@app.route('/results')
def results_page():
    return render_template('results.html', active_page='results')

@app.route('/vault')
def vault_page():
    return render_template('pdf_vault.html', active_page='vault')

@app.route('/focus')
def focus_page():
    return render_template('focus_timer.html', active_page='focus')

@app.route('/goals')
def goals_page():
    return render_template('goals.html', active_page='goals')

# ================= API: DASHBOARD & STATS =================

@app.route('/api/stats', methods=['GET'])
def get_stats():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM tasks WHERE completed = 0')
        pending_tasks = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM tasks WHERE completed = 1')
        completed_tasks = cursor.fetchone()[0]
        
        today = date.today().isoformat()
        cursor.execute('SELECT COUNT(*) FROM events WHERE event_date = ?', (today,))
        today_events_count = cursor.fetchone()[0]

        # Calculate Hanuman Chalisa streak
        cursor.execute('SELECT id FROM habits WHERE name LIKE "%Hanuman Chalisa%" LIMIT 1')
        hc_row = cursor.fetchone()
        streak_count = 0
        if hc_row:
            hc_id = hc_row[0]
            cursor.execute('SELECT log_date FROM habit_logs WHERE habit_id = ? AND completed = 1 ORDER BY log_date DESC', (hc_id,))
            dates = [datetime.strptime(r[0], '%Y-%m-%d').date() for r in cursor.fetchall()]
            check_date = date.today()
            if dates and dates[0] == check_date:
                pass
            elif dates and dates[0] == check_date - timedelta(days=1):
                check_date = check_date - timedelta(days=1)
            else:
                dates = []

            for d in dates:
                if d == check_date:
                    streak_count += 1
                    check_date -= timedelta(days=1)
                else:
                    break

        # Upcoming urgent tasks (<24h)
        cursor.execute('''
            SELECT id, title, priority, due_date, due_time, category 
            FROM tasks 
            WHERE completed = 0 AND due_date IS NOT NULL AND due_date <= ? 
            ORDER BY due_date ASC, due_time ASC LIMIT 5
        ''', (today,))
        urgent_tasks = [dict(row) for row in cursor.fetchall()]

        # Today's events
        cursor.execute('''
            SELECT id, title, event_type, subject, start_time, end_time, location, color_code
            FROM events
            WHERE event_date = ?
            ORDER BY start_time ASC
        ''', (today,))
        today_events = [dict(row) for row in cursor.fetchall()]

        # Random or daily quote
        cursor.execute('SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1')
        quote_row = cursor.fetchone()
        quote = dict(quote_row) if quote_row else None

    return jsonify({
        'pending_tasks': pending_tasks,
        'completed_tasks': completed_tasks,
        'today_events_count': today_events_count,
        'study_streak': streak_count,
        'urgent_tasks': urgent_tasks,
        'today_events': today_events,
        'quote': quote
    })

# ================= API: TASKS & SUBTASKS (with Google Tasks Connector) =================

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM tasks ORDER BY completed ASC, due_date ASC, id DESC')
        tasks = [dict(row) for row in cursor.fetchall()]
        for task in tasks:
            cursor.execute('SELECT * FROM subtasks WHERE task_id = ? ORDER BY id ASC', (task['id'],))
            task['subtasks'] = [dict(sub) for sub in cursor.fetchall()]
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400
        
    description = data.get('description', '').strip()
    category = data.get('category', 'General').strip() or 'General'
    priority = data.get('priority', 'Medium')
    due_date = data.get('due_date', None)
    due_time = data.get('due_time', None)
    subtasks = data.get('subtasks', [])

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO tasks (title, description, category, priority, due_date, due_time, completed)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        ''', (title, description, category, priority, due_date, due_time))
        task_id = cursor.lastrowid
        
        for st_title in subtasks:
            if isinstance(st_title, str) and st_title.strip():
                cursor.execute('INSERT INTO subtasks (task_id, title, completed) VALUES (?, ?, 0)', (task_id, st_title.strip()))
        conn.commit()

    return jsonify({'message': 'Task created', 'id': task_id}), 201

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT completed FROM tasks WHERE id = ?', (task_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Task not found'}), 404
        new_status = 0 if row['completed'] else 1
        cursor.execute('UPDATE tasks SET completed = ? WHERE id = ?', (new_status, task_id))
        conn.commit()
    return jsonify({'message': 'Toggled task status', 'completed': new_status})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM subtasks WHERE task_id = ?', (task_id,))
        cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        conn.commit()
    return jsonify({'message': 'Task deleted'})

@app.route('/api/tasks/<int:task_id>/subtasks', methods=['POST'])
def add_subtask(task_id):
    data = request.json or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Subtask title required'}), 400
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO subtasks (task_id, title, completed) VALUES (?, ?, 0)', (task_id, title))
        subtask_id = cursor.lastrowid
        conn.commit()
    return jsonify({'id': subtask_id, 'title': title, 'completed': 0})

@app.route('/api/subtasks/<int:subtask_id>/toggle', methods=['POST'])
def toggle_subtask(subtask_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT completed FROM subtasks WHERE id = ?', (subtask_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Subtask not found'}), 404
        new_status = 0 if row['completed'] else 1
        cursor.execute('UPDATE subtasks SET completed = ? WHERE id = ?', (new_status, subtask_id))
        conn.commit()
    return jsonify({'message': 'Subtask status toggled', 'completed': new_status})

@app.route('/api/subtasks/<int:subtask_id>', methods=['DELETE'])
def delete_subtask(subtask_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM subtasks WHERE id = ?', (subtask_id,))
        conn.commit()
    return jsonify({'message': 'Subtask deleted'})

# Google Tasks Sync / Import / Export Integration API
@app.route('/api/google-tasks/sync', methods=['POST'])
def sync_google_tasks():
    # Sync or import tasks payload from Google Tasks
    data = request.json or {}
    tasks_imported = 0
    incoming_tasks = data.get('tasks', [])

    with get_db() as conn:
        cursor = conn.cursor()
        for item in incoming_tasks:
            title = item.get('title', '').strip()
            if not title:
                continue
            notes = item.get('notes', '')
            due = item.get('due', '')
            due_date = due.split('T')[0] if due and 'T' in due else due
            google_id = item.get('id', '')

            # Check if exists
            cursor.execute('SELECT id FROM tasks WHERE google_task_id = ? OR title = ?', (google_id, title))
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO tasks (title, description, category, priority, due_date, completed, google_task_id)
                    VALUES (?, ?, 'Google Tasks', 'Medium', ?, 0, ?)
                ''', (title, notes, due_date or None, google_id))
                tasks_imported += 1
        conn.commit()

    return jsonify({
        'message': f'Synced successfully. {tasks_imported} new Google Tasks imported.',
        'imported_count': tasks_imported
    })

@app.route('/api/google-tasks/export', methods=['GET'])
def export_google_tasks_format():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM tasks WHERE completed = 0')
        tasks = [dict(r) for r in cursor.fetchall()]
        google_format = [{
            'id': f"gt-{t['id']}",
            'title': t['title'],
            'notes': t['description'] or '',
            'due': f"{t['due_date']}T{t['due_time'] or '23:59'}:00.000Z" if t['due_date'] else None,
            'status': 'completed' if t['completed'] else 'needsAction'
        } for t in tasks]
    return jsonify({'kind': 'tasks#tasks', 'items': google_format})

# ================= API: EVENTS & SCHEDULE =================

@app.route('/api/events', methods=['GET'])
def get_events():
    event_date = request.args.get('date')
    with get_db() as conn:
        cursor = conn.cursor()
        if event_date:
            cursor.execute('SELECT * FROM events WHERE event_date = ? ORDER BY start_time ASC', (event_date,))
        else:
            cursor.execute('SELECT * FROM events ORDER BY event_date ASC, start_time ASC')
        events = [dict(r) for r in cursor.fetchall()]
    return jsonify(events)

@app.route('/api/events', methods=['POST'])
def add_event():
    data = request.json or {}
    title = data.get('title', '').strip()
    event_type = data.get('event_type', 'Class')
    subject = data.get('subject', 'General').strip()
    event_date = data.get('event_date', date.today().isoformat())
    start_time = data.get('start_time', '')
    end_time = data.get('end_time', '')
    location = data.get('location', '').strip()
    notes = data.get('notes', '').strip()
    color_code = data.get('color_code', '#00f2fe')

    if not title or not event_date:
        return jsonify({'error': 'Title and Date are required'}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO events (title, event_type, subject, event_date, start_time, end_time, location, notes, color_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (title, event_type, subject, event_date, start_time, end_time, location, notes, color_code))
        conn.commit()
        event_id = cursor.lastrowid

    return jsonify({'message': 'Event created', 'id': event_id}), 201

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM events WHERE id = ?', (event_id,))
        conn.commit()
    return jsonify({'message': 'Event deleted'})

# ================= API: HABITS & STREAKS (Hanuman Chalisa) =================

@app.route('/api/habits', methods=['GET'])
def get_habits():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM habits WHERE active = 1 ORDER BY id ASC')
        habits = [dict(r) for r in cursor.fetchall()]
        
        today = date.today().isoformat()
        
        # Calculate streaks & last 60 days grid logs for each habit
        for h in habits:
            cursor.execute('SELECT log_date FROM habit_logs WHERE habit_id = ? AND completed = 1 ORDER BY log_date ASC', (h['id'],))
            log_dates = [r[0] for r in cursor.fetchall()]
            h['logged_dates'] = log_dates
            h['done_today'] = today in log_dates

            # Compute streak
            current_streak = 0
            check = date.today()
            date_set = set(log_dates)
            if today not in date_set:
                check = date.today() - timedelta(days=1)
            while check.isoformat() in date_set:
                current_streak += 1
                check -= timedelta(days=1)
            h['current_streak'] = current_streak

    return jsonify(habits)

@app.route('/api/habits/<int:habit_id>/toggle-today', methods=['POST'])
def toggle_habit_today(habit_id):
    data = request.json or {}
    target_date = data.get('date', date.today().isoformat())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM habit_logs WHERE habit_id = ? AND log_date = ?', (habit_id, target_date))
        row = cursor.fetchone()
        if row:
            cursor.execute('DELETE FROM habit_logs WHERE id = ?', (row['id'],))
            done = False
        else:
            cursor.execute('INSERT INTO habit_logs (habit_id, log_date, completed) VALUES (?, ?, 1)', (habit_id, target_date))
            done = True
        conn.commit()
    return jsonify({'message': 'Habit status updated', 'done': done, 'date': target_date})

@app.route('/api/habits', methods=['POST'])
def create_habit():
    data = request.json or {}
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    reminder_time = data.get('reminder_time', '07:30')
    category = data.get('category', 'Spiritual & Focus')
    if not name:
        return jsonify({'error': 'Habit name is required'}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO habits (name, description, reminder_time, category)
            VALUES (?, ?, ?, ?)
        ''', (name, description, reminder_time, category))
        conn.commit()
        hid = cursor.lastrowid
    return jsonify({'message': 'Habit registered', 'id': hid}), 201

# ================= API: MOTIVATIONAL QUOTES & FEEDBACK ENGINE =================

@app.route('/api/quotes/daily', methods=['GET'])
def get_daily_quote():
    author_filter = request.args.get('author')
    with get_db() as conn:
        cursor = conn.cursor()
        if author_filter:
            cursor.execute('SELECT * FROM quotes WHERE category = ? OR author LIKE ? ORDER BY RANDOM() LIMIT 1', 
                           (author_filter, f"%{author_filter}%"))
        else:
            cursor.execute('SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1')
        row = cursor.fetchone()
        quote = dict(row) if row else {
            'quote': 'Self-belief and hard work will always earn you success.',
            'author': 'Virat Kohli',
            'category': 'Virat Kohli',
            'id': 1
        }
    return jsonify(quote)

@app.route('/api/quotes/feedback', methods=['POST'])
def submit_quote_feedback():
    data = request.json or {}
    quote_id = data.get('quote_id')
    rating = data.get('rating', 5)
    feedback = data.get('feedback', '').strip()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE quotes SET rating = ?, feedback = ? WHERE id = ?', (rating, feedback, quote_id))
        conn.commit()
    return jsonify({'message': 'Feedback received! JARVIS learning algorithm updated.'})

@app.route('/api/quotes/suggest', methods=['POST'])
def suggest_quote():
    data = request.json or {}
    quote = data.get('quote', '').strip()
    author = data.get('author', '').strip() or 'Favorite Leader'
    category = data.get('category', 'Inspirational')
    if not quote:
        return jsonify({'error': 'Quote text is required'}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO quotes (quote, author, category, is_user_added)
            VALUES (?, ?, ?, 1)
        ''', (quote, author, category))
        conn.commit()
        qid = cursor.lastrowid
    return jsonify({'message': 'Quote added to your personal motivation vault!', 'id': qid}), 201

# ================= API: GOALS & NOTES =================

@app.route('/api/goals', methods=['GET'])
def get_goals():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM goals ORDER BY progress ASC, id DESC')
        goals = [dict(r) for r in cursor.fetchall()]
    return jsonify(goals)

@app.route('/api/goals', methods=['POST'])
def add_goal():
    data = request.json or {}
    title = data.get('title', '').strip()
    category = data.get('category', 'Academic')
    target_date = data.get('target_date', '')
    progress = int(data.get('progress', 0))
    if not title:
        return jsonify({'error': 'Title required'}), 400
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO goals (title, category, target_date, progress) VALUES (?, ?, ?, ?)',
                       (title, category, target_date, progress))
        conn.commit()
        gid = cursor.lastrowid
    return jsonify({'message': 'Goal created', 'id': gid}), 201

@app.route('/api/goals/<int:goal_id>/progress', methods=['POST'])
def update_goal_progress(goal_id):
    data = request.json or {}
    progress = min(100, max(0, int(data.get('progress', 0))))
    status = 'Completed' if progress == 100 else 'In Progress'
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE goals SET progress = ?, status = ? WHERE id = ?', (progress, status, goal_id))
        conn.commit()
    return jsonify({'message': 'Goal updated', 'progress': progress, 'status': status})

@app.route('/api/notes', methods=['GET'])
def get_notes():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM notes ORDER BY id DESC')
        notes = [dict(r) for r in cursor.fetchall()]
    return jsonify(notes)

@app.route('/api/notes', methods=['POST'])
def add_note():
    data = request.json or {}
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    subject = data.get('subject', 'General')
    tags = data.get('tags', '')
    if not title or not content:
        return jsonify({'error': 'Title and content required'}), 400
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO notes (title, content, subject, tags) VALUES (?, ?, ?, ?)', (title, content, subject, tags))
        conn.commit()
        nid = cursor.lastrowid
    return jsonify({'message': 'Note saved', 'id': nid}), 201

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM notes WHERE id = ?', (note_id,))
        conn.commit()
    return jsonify({'message': 'Note deleted'})

# ================= API: RESULTS & MARKS =================

@app.route('/api/results', methods=['GET'])
def get_results():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM results ORDER BY semester_term ASC, exam_date DESC, id DESC')
        results = [dict(row) for row in cursor.fetchall()]
    return jsonify(results)

@app.route('/api/results', methods=['POST'])
def add_result():
    data = request.json or {}
    exam_name = data.get('exam_name', '').strip()
    subject = data.get('subject', '').strip()
    marks_obtained = float(data.get('marks_obtained', 0))
    max_marks = float(data.get('max_marks', 100))
    grade = data.get('grade', '').strip()
    semester_term = data.get('semester_term', 'Semester 1').strip()
    exam_date = data.get('exam_date', '')
    remarks = data.get('remarks', '').strip()

    if not exam_name or not subject:
        return jsonify({'error': 'Exam name and subject are required'}), 400

    if not grade:
        pct = (marks_obtained / max_marks) * 100
        if pct >= 90: grade = 'A+'
        elif pct >= 80: grade = 'A'
        elif pct >= 70: grade = 'B'
        elif pct >= 60: grade = 'C'
        elif pct >= 50: grade = 'D'
        else: grade = 'F'

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO results (exam_name, subject, marks_obtained, max_marks, grade, semester_term, exam_date, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (exam_name, subject, marks_obtained, max_marks, grade, semester_term, exam_date, remarks))
        conn.commit()
        res_id = cursor.lastrowid

    return jsonify({'message': 'Result recorded', 'id': res_id}), 201

@app.route('/api/results/<int:result_id>', methods=['DELETE'])
def delete_result(result_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM results WHERE id = ?', (result_id,))
        conn.commit()
    return jsonify({'message': 'Result deleted'})

# ================= API: PDF VAULT =================

@app.route('/api/vault/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    title = request.form.get('title', '').strip() or os.path.splitext(file.filename)[0]
    subject = request.form.get('subject', 'General').strip()
    section_tag = request.form.get('section_tag', 'General').strip()

    if file and allowed_file(file.filename):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        original_name = secure_filename(file.filename)
        unique_filename = f"{timestamp}_{original_name}"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(save_path)
        
        file_size_kb = round(os.path.getsize(save_path) / 1024, 1)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO pdf_documents (title, subject, section_tag, file_name, file_size_kb)
                VALUES (?, ?, ?, ?, ?)
            ''', (title, subject, section_tag, unique_filename, file_size_kb))
            conn.commit()
            doc_id = cursor.lastrowid

        return jsonify({'message': 'PDF uploaded', 'id': doc_id, 'file_name': unique_filename}), 201
    
    return jsonify({'error': 'Only PDF files are supported'}), 400

@app.route('/api/vault/documents', methods=['GET'])
def get_pdf_documents():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM pdf_documents ORDER BY subject ASC, section_tag ASC, id DESC')
        docs = [dict(row) for row in cursor.fetchall()]
    return jsonify(docs)

@app.route('/api/vault/download/<filename>')
def download_pdf(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/api/vault/view/<filename>')
def view_pdf(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, mimetype='application/pdf')

@app.route('/api/vault/<int:doc_id>', methods=['DELETE'])
def delete_pdf_document(doc_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT file_name FROM pdf_documents WHERE id = ?', (doc_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Document not found'}), 404
        
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], row['file_name'])
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

        cursor.execute('DELETE FROM pdf_documents WHERE id = ?', (doc_id,))
        conn.commit()

    return jsonify({'message': 'Document deleted'})

# Auto initialize database on module load (vital for serverless Vercel & local)
init_db()

if __name__ == '__main__':
    print("=== AVENGERS HQ PORTAL INITIALIZED: http://127.0.0.1:5000 ===")
    app.run(debug=True, port=5000)
