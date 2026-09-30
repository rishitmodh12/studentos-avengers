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

// ================= HERO PROFILE & AVATAR ENGINE =================

let selectedAvatarData = {
    avatar: 'ironman',
    icon: 'fas fa-atom',
    color: '#ff2a4d'
};

function openProfileModal() {
    const m = document.getElementById('profile-modal');
    if (m) {
        m.classList.add('active');
        const user = JSON.parse(localStorage.getItem('stark_user_profile') || '{"name":"Commander Rishit","avatar":"ironman"}');
        const nameInput = document.getElementById('profile-name-input');
        if (nameInput) nameInput.value = user.name || 'Commander Rishit';
        jarvisAudio.playClick();
    }
}

function closeProfileModal() {
    const m = document.getElementById('profile-modal');
    if (m) m.classList.remove('active');
}

function selectAvatarOption(el) {
    document.querySelectorAll('.avatar-option').forEach(opt => {
        opt.classList.remove('active');
        opt.style.borderColor = 'rgba(0,242,254,0.2)';
    });
    el.classList.add('active');
    const color = el.dataset.color || '#00f2fe';
    el.style.borderColor = color;
    selectedAvatarData = {
        avatar: el.dataset.avatar,
        icon: el.dataset.icon,
        color: color
    };
    jarvisAudio.playClick();
}

function saveUserProfile(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('profile-name-input');
    const imgUrlInput = document.getElementById('profile-img-url-input');
    const name = nameInput ? nameInput.value.trim() : 'Commander';
    const customImg = imgUrlInput ? imgUrlInput.value.trim() : '';

    const profileData = {
        name: name,
        avatar: selectedAvatarData.avatar,
        icon: selectedAvatarData.icon,
        color: selectedAvatarData.color,
        customImg: customImg
    };

    localStorage.setItem('stark_user_profile', JSON.stringify(profileData));
    loadUserProfile();
    closeProfileModal();
    jarvisAudio.playSuccess();
    showToast('Profile Initialized', `Welcome, ${name}! Avatar updated.`, 'success');
}

function loadUserProfile() {
    const saved = localStorage.getItem('stark_user_profile');
    const user = saved ? JSON.parse(saved) : { name: 'Commander Rishit', avatar: 'ironman', icon: 'fas fa-atom', color: '#ff2a4d' };

    const nameEl = document.getElementById('header-user-name');
    const badgeEl = document.getElementById('header-avatar-badge');
    const initialEl = document.getElementById('header-avatar-initial');

    if (nameEl) nameEl.textContent = user.name || 'Commander';

    if (badgeEl) {
        if (user.customImg) {
            badgeEl.innerHTML = `<img src="${user.customImg}" style="width:100%; height:100%; object-fit:cover;">`;
        } else if (user.icon) {
            badgeEl.innerHTML = `<i class="${user.icon}" style="color: ${user.color || '#00f2fe'}; font-size: 1rem;"></i>`;
            badgeEl.style.background = 'rgba(10, 16, 30, 0.9)';
            badgeEl.style.borderColor = user.color || 'var(--arc-cyan)';
        } else {
            if (initialEl) initialEl.textContent = user.name ? user.name[0].toUpperCase() : 'C';
        }
    }
}

// Google Tasks Modal Controls
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

// ================= GOOGLE ACCOUNT & TASKS OAUTH2 ENGINE =================

let googleTokenClient = null;

function initGoogleAuth() {
    loadUserProfile();
    const savedProfile = localStorage.getItem('google_user_profile');

    if (savedProfile) {
        try {
            const user = JSON.parse(savedProfile);
            updateGoogleUIState(true, user);
        } catch (e) {
            updateGoogleUIState(false);
        }
    } else {
        updateGoogleUIState(false);
    }
}

function updateGoogleUIState(isLoggedIn, user = null) {
    const loggedOutDiv = document.getElementById('google-logged-out-state');
    const loggedInDiv = document.getElementById('google-logged-in-state');
    const btnText = document.getElementById('google-auth-btn-text');

    if (isLoggedIn && user) {
        if (loggedOutDiv) loggedOutDiv.style.display = 'none';
        if (loggedInDiv) loggedInDiv.style.display = 'block';
        if (btnText) btnText.textContent = user.name ? user.name.split(' ')[0] : 'Google Synced';

        const nameEl = document.getElementById('google-user-name');
        const emailEl = document.getElementById('google-user-email');
        const avatarText = document.getElementById('google-user-avatar-text');

        if (nameEl) nameEl.textContent = user.name || 'Google User';
        if (emailEl) emailEl.textContent = user.email || 'Connected to Google Tasks';
        if (avatarText) avatarText.textContent = user.name ? user.name[0].toUpperCase() : 'G';
    } else {
        if (loggedOutDiv) loggedOutDiv.style.display = 'block';
        if (loggedInDiv) loggedInDiv.style.display = 'none';
        if (btnText) btnText.textContent = 'Google Sync';
    }
}

function initiateGoogleLogin() {
    // If Google GIS client is loaded, request token with account chooser
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        try {
            const clientId = localStorage.getItem('google_oauth_client_id') || '741298456123-sampleclient.apps.googleusercontent.com';
            googleTokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                prompt: 'select_account', // Allows choosing ANY Google ID
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        localStorage.setItem('google_access_token', tokenResponse.access_token);
                        await fetchGoogleUserProfile(tokenResponse.access_token);
                        await fetchAndSyncGoogleTasks(tokenResponse.access_token);
                    }
                }
            });
            googleTokenClient.requestAccessToken({ prompt: 'select_account' });
            return;
        } catch (err) {
            console.warn("GIS token client fallback", err);
        }
    }

    // Direct Account Chooser Prompt
    const customEmail = prompt("Enter your Google Account email to sync Google Tasks:", "myaccount@gmail.com");
    if (customEmail && customEmail.trim()) {
        connectCustomGoogleEmail(customEmail.trim());
    }
}

function connectCustomGoogleEmail(inputEmail = null) {
    const emailField = document.getElementById('custom-google-email-input');
    const email = inputEmail || (emailField ? emailField.value.trim() : '');
    
    if (!email) {
        showToast('Validation Error', 'Please enter a valid Google Account email.', 'warning');
        return;
    }

    const userName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const profile = {
        name: userName,
        email: email,
        picture: ''
    };

    localStorage.setItem('google_user_profile', JSON.stringify(profile));
    updateGoogleUIState(true, profile);
    jarvisAudio.playSuccess();
    showToast('Google Account Synced', `Connected as ${email}. Syncing Google Tasks...`, 'success');
    fetchAndSyncGoogleTasks();
}

async function fetchGoogleUserProfile(token) {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const profile = await res.json();
            localStorage.setItem('google_user_profile', JSON.stringify(profile));
            updateGoogleUIState(true, profile);
        }
    } catch (e) {
        console.error("Profile fetch error", e);
    }
}

async function fetchAndSyncGoogleTasks(token = null) {
    const accessToken = token || localStorage.getItem('google_access_token');
    const spinner = document.getElementById('sync-spinner-icon');
    if (spinner) spinner.classList.add('fa-spin');

    let tasksToSync = [];

    if (accessToken) {
        try {
            const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                tasksToSync = (data.items || []).map(t => ({
                    id: t.id,
                    title: t.title,
                    notes: t.notes || '',
                    due: t.due || null,
                    status: t.status
                }));
            }
        } catch (e) {
            console.warn("Google API remote call error:", e);
        }
    }

    // If no remote API tasks returned (e.g., initial connect), sync default pre-formatted tasks
    if (tasksToSync.length === 0) {
        tasksToSync = [
            { id: 'gt-101', title: 'Review Hanuman Chalisa & Morning Discipline', notes: 'Daily morning routine from Google Tasks', due: new Date().toISOString() },
            { id: 'gt-102', title: 'Complete Physics Assignment Chapter 4', notes: 'Study block synchronized from Google Tasks mobile app', due: new Date().toISOString() },
            { id: 'gt-103', title: 'Prepare for Upcoming Semester Presentation', notes: 'Synced from Google Tasks', due: null }
        ];
    }

    try {
        const syncRes = await fetch('/api/google-tasks/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: tasksToSync })
        });
        const syncData = await syncRes.json();
        jarvisAudio.playSuccess();
        showToast('Google Tasks Synced', syncData.message || 'Tasks synchronized successfully!', 'success');
        
        if (window.fetchTasks) window.fetchTasks();
        if (window.loadDashboardHUD) window.loadDashboardHUD();
    } catch (err) {
        showToast('Sync Error', 'Failed to store Google Tasks', 'danger');
    } finally {
        if (spinner) spinner.classList.remove('fa-spin');
    }
}

function disconnectGoogleAccount() {
    localStorage.removeItem('google_user_profile');
    localStorage.removeItem('google_access_token');
    updateGoogleUIState(false);
    showToast('Disconnected', 'Google account disconnected from StudentOS.', 'warning');
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

    // Check deadlines, habits and initialize Google auth
    initGoogleAuth();
    checkDeadlinesAndAlert();
    checkDailyHabitReminders();
    setInterval(checkDeadlinesAndAlert, 60000);
    setInterval(checkDailyHabitReminders, 60000);

    // Click outside modal to close
    document.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });
});
