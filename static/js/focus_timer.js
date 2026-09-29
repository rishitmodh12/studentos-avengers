/**
 * AVENGERS HQ - Arc Reactor Pomodoro Focus Timer Module
 */

let focusTimeLeft = 25 * 60;
let focusTotalTime = 25 * 60;
let focusTimerInterval = null;
let focusMode = 'work'; // 'work' or 'break'

function updateTimerDisplay() {
    const minutes = Math.floor(focusTimeLeft / 60);
    const seconds = focusTimeLeft % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const display = document.getElementById('timer-display');
    if (display) display.textContent = formatted;

    const modeText = document.getElementById('timer-mode-label');
    if (modeText) {
        modeText.textContent = focusMode === 'work' ? 'ARC CORE: MAXIMUM POWER (FOCUS)' : 'COOLDOWN PROTOCOL (BREAK)';
        modeText.style.color = focusMode === 'work' ? 'var(--arc-cyan)' : 'var(--hulk-green)';
    }
}

function startFocusTimer() {
    if (focusTimerInterval) return;
    jarvisAudio.playSuccess();
    
    focusTimerInterval = setInterval(() => {
        if (focusTimeLeft > 0) {
            focusTimeLeft--;
            updateTimerDisplay();
        } else {
            clearInterval(focusTimerInterval);
            focusTimerInterval = null;
            jarvisAudio.playAlert();
            
            if (focusMode === 'work') {
                showToast('Focus Session Complete!', 'Time for a 5-minute tactical cooldown.', 'success');
                setTimerMode('break');
            } else {
                showToast('Cooldown Complete', 'Ready to engage next mission protocol.', 'warning');
                setTimerMode('work');
            }
        }
    }, 1000);

    const startBtn = document.getElementById('timer-start-btn');
    if (startBtn) startBtn.style.display = 'none';
    const pauseBtn = document.getElementById('timer-pause-btn');
    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
}

function pauseFocusTimer() {
    if (focusTimerInterval) {
        clearInterval(focusTimerInterval);
        focusTimerInterval = null;
        jarvisAudio.playClick();
    }
    const startBtn = document.getElementById('timer-start-btn');
    if (startBtn) startBtn.style.display = 'inline-flex';
    const pauseBtn = document.getElementById('timer-pause-btn');
    if (pauseBtn) pauseBtn.style.display = 'none';
}

function resetFocusTimer() {
    pauseFocusTimer();
    focusTimeLeft = focusMode === 'work' ? 25 * 60 : 5 * 60;
    updateTimerDisplay();
}

function setTimerMode(mode) {
    pauseFocusTimer();
    focusMode = mode;
    if (mode === 'work') {
        focusTimeLeft = 25 * 60;
        focusTotalTime = 25 * 60;
    } else {
        focusTimeLeft = 5 * 60;
        focusTotalTime = 5 * 60;
    }
    updateTimerDisplay();
}

document.addEventListener('DOMContentLoaded', () => {
    updateTimerDisplay();

    const startBtn = document.getElementById('timer-start-btn');
    if (startBtn) startBtn.addEventListener('click', startFocusTimer);

    const pauseBtn = document.getElementById('timer-pause-btn');
    if (pauseBtn) pauseBtn.addEventListener('click', pauseFocusTimer);

    const resetBtn = document.getElementById('timer-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetFocusTimer);

    const workBtn = document.getElementById('mode-work-btn');
    if (workBtn) workBtn.addEventListener('click', () => setTimerMode('work'));

    const breakBtn = document.getElementById('mode-break-btn');
    if (breakBtn) breakBtn.addEventListener('click', () => setTimerMode('break'));
});
