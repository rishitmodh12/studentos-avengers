/**
 * AVENGERS HQ / StudentOS - Global Audio, Notifications, Habits & Google Tasks Sync
 */

// Web Audio API Synthesizer for JARVIS Interface Sounds
class JarvisSoundEngine {
    constructor() {
        this.enabled = localStorage.getItem('jarvis_sound_enabled') !== 'false';
        this.ctx = null;
    }

    initCtx() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('jarvis_sound_enabled', this.enabled);
        if (this.enabled) {
            this.playSuccess();
        }
        return this.enabled;
    }

    playTone(freq, type, duration, delay = 0) {
        if (!this.enabled) return;
        this.initCtx();
        setTimeout(() => {
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {
                console.error("Audio error", e);
            }
        }, delay * 1000);
    }

    playClick() {
        this.playTone(800, 'sine', 0.05);
    }

    playSuccess() {
        this.playTone(523.25, 'sine', 0.1, 0);       // C5
        this.playTone(659.25, 'sine', 0.1, 0.08);    // E5
        this.playTone(783.99, 'sine', 0.18, 0.16);   // G5
    }

    playAlert() {
        this.playTone(880, 'triangle', 0.15, 0);     // A5
        this.playTone(440, 'sawtooth', 0.25, 0.18);  // A4
    }

    playTaskComplete() {
        this.playTone(600, 'sine', 0.08, 0);
        this.playTone(1200, 'sine', 0.2, 0.07);
    }
}

const jarvisAudio = new JarvisSoundEngine();

// UI Toast Notification System
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'danger' ? 'toast-danger' : type === 'warning' ? 'toast-warning' : ''}`;
    
    let icon = '<i class="fas fa-robot text-cyan" style="color: var(--arc-cyan);"></i>';
    if (type === 'danger') {
        icon = '<i class="fas fa-exclamation-triangle" style="color: var(--stark-red);"></i>';
        jarvisAudio.playAlert();
    } else if (type === 'warning') {
        icon = '<i class="fas fa-bell" style="color: var(--stark-gold);"></i>';
        jarvisAudio.playAlert();
    } else if (type === 'success') {
        icon = '<i class="fas fa-check-circle" style="color: var(--hulk-green);"></i>';
        jarvisAudio.playSuccess();
    } else {
        jarvisAudio.playClick();
    }

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-body">
            <h5>${title}</h5>
            <p>${message}</p>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// Global Deadline Proximity Checker
async function checkDeadlinesAndAlert() {
    try {
        const res = await fetch('/api/tasks');
        if (!res.ok) return;
        const tasks = await res.json();
        
        const now = new Date();
        let urgentCount = 0;

        tasks.forEach(task => {
            if (!task.completed && task.due_date) {
                const taskDate = new Date(`${task.due_date}T${task.due_time || '23:59'}:00`);
                const diffHours = (taskDate - now) / (1000 * 60 * 60);

                if (diffHours <= 24) {
                    urgentCount++;
                }
            }
        });

        // Update Bell Badge
        const bellBadge = document.getElementById('bell-count');
        if (bellBadge) {
            if (urgentCount > 0) {
                bellBadge.textContent = urgentCount;
                bellBadge.style.display = 'flex';
            } else {
                bellBadge.style.display = 'none';
            }
        }
    } catch (e) {
        console.error("Deadline check failed", e);
    }
}

// Daily Habit & Hanuman Chalisa Reminder Checker
async function checkDailyHabitReminders() {
    try {
        const res = await fetch('/api/habits');
        if (!res.ok) return;
        const habits = await res.json();
        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMins = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMins}`;
        const todayStr = now.toISOString().split('T')[0];

        habits.forEach(h => {
            if (!h.done_today && h.reminder_time) {
                const notifyKey = `notified_habit_${h.id}_${todayStr}`;
                // Check if current time is within or past reminder time
                if (currentTimeStr >= h.reminder_time && !localStorage.getItem(notifyKey)) {
                    localStorage.setItem(notifyKey, 'true');
                    showToast('Daily Habit Reminder', `Time for: ${h.name}! Keep your discipline streak alive 🔥`, 'warning');
                    if (Notification.permission === 'granted') {
                        new Notification(`⚡ Habit Reminder: ${h.name}`, {
                            body: `Time to complete your daily routine and protect your ${h.current_streak}-day streak!`,
                        });
                    }
                }
            }
        });
    } catch (e) {
        console.error("Habit check error", e);
    }
}

// Hanuman Chalisa Modal Controls
function openChalisaModal() {
    const m = document.getElementById('chalisa-modal');
    if (m) {
        m.classList.add('active');
        jarvisAudio.playClick();
    }
}

function closeChalisaModal() {
    const m = document.getElementById('chalisa-modal');
    if (m) m.classList.remove('active');
}

async function markChalisaDoneToday() {
    try {
        const res = await fetch('/api/habits');
        const habits = await res.json();
        const hc = habits.find(h => h.name.toLowerCase().includes('hanuman'));
        if (hc) {
            const todayStr = new Date().toISOString().split('T')[0];
            await fetch(`/api/habits/${hc.id}/toggle-today`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: todayStr })
            });
            jarvisAudio.playSuccess();
            showToast('॥ जय श्री राम ॥', 'Hanuman Chalisa recitation logged! Streak updated 🔥', 'success');
            closeChalisaModal();
            setTimeout(() => location.reload(), 1000);
        }
    } catch (e) {
        showToast('Error', 'Failed to log Hanuman Chalisa', 'danger');
    }
}

// Google Tasks Modal Controls & Sync
function openGoogleTasksModal() {
    const m = document.getElementById('google-tasks-modal');
    if (m) {
        m.classList.add('active');
        jarvisAudio.playClick();
    }
}

function closeGoogleTasksModal() {
    const m = document.getElementById('google-tasks-modal');
    if (m) m.classList.remove('active');
}

async function triggerGoogleTasksSync() {
    const input = document.getElementById('gtasks-json-input');
    let tasksPayload = [];

    if (input && input.value.trim()) {
        try {
            const parsed = JSON.parse(input.value.trim());
            tasksPayload = Array.isArray(parsed) ? parsed : (parsed.items || []);
        } catch (e) {
            showToast('JSON Warning', 'Could not parse JSON. Running default cloud sync protocol.', 'warning');
        }
    }

    try {
        const res = await fetch('/api/google-tasks/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: tasksPayload })
        });
        const data = await res.json();
        showToast('Google Tasks Synced', data.message || 'Tasks synchronized successfully!', 'success');
        closeGoogleTasksModal();
        if (window.fetchTasks) window.fetchTasks();
    } catch (e) {
        showToast('Sync Error', 'Failed to connect to Google Tasks API', 'danger');
    }
}

// Helper escape html
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Sound Toggle Button
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
        const updateSoundBtn = () => {
            soundBtn.innerHTML = jarvisAudio.enabled 
                ? '<i class="fas fa-volume-up"></i>' 
                : '<i class="fas fa-volume-mute"></i>';
        };
        updateSoundBtn();
        soundBtn.addEventListener('click', () => {
            jarvisAudio.toggle();
            updateSoundBtn();
        });
    }

    // Bell Notification Trigger
    const bellBtn = document.getElementById('bell-btn');
    if (bellBtn) {
        bellBtn.addEventListener('click', () => {
            jarvisAudio.playAlert();
            checkDeadlinesAndAlert();
            showToast('Mission Protocol', 'Checking for imminent deadlines...', 'warning');
        });
    }

    // Check deadlines and habits periodically
    checkDeadlinesAndAlert();
    checkDailyHabitReminders();
    setInterval(checkDeadlinesAndAlert, 60000);
    setInterval(checkDailyHabitReminders, 60000);
});
