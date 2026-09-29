/**
 * AVENGERS HQ - Academic Marks & Results Analytics Module
 */

let allResults = [];
let marksChart = null;

async function fetchResults() {
    try {
        const res = await fetch('/api/results');
        allResults = await res.json();
        renderResultsStats();
        renderResultsTable();
        renderPerformanceChart();
    } catch (err) {
        console.error('Error loading results:', err);
        showToast('Error', 'Unable to retrieve academic records.', 'danger');
    }
}

function renderResultsStats() {
    if (allResults.length === 0) {
        document.getElementById('marks-avg-pct').textContent = '0%';
        document.getElementById('marks-total-exams').textContent = '0';
        document.getElementById('marks-highest').textContent = 'N/A';
        return;
    }

    let totalPct = 0;
    let maxPct = 0;
    let highestSubject = 'N/A';

    allResults.forEach(r => {
        const pct = (r.marks_obtained / r.max_marks) * 100;
        totalPct += pct;
        if (pct > maxPct) {
            maxPct = pct;
            highestSubject = `${r.subject} (${pct.toFixed(1)}%)`;
        }
    });

    const avg = (totalPct / allResults.length).toFixed(1);
    document.getElementById('marks-avg-pct').textContent = `${avg}%`;
    document.getElementById('marks-total-exams').textContent = allResults.length;
    document.getElementById('marks-highest').textContent = highestSubject;
}

function renderResultsTable() {
    const tbody = document.getElementById('results-tbody');
    const emptyState = document.getElementById('results-empty');
    if (!tbody) return;

    if (allResults.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = allResults.map(res => {
        const pct = ((res.marks_obtained / res.max_marks) * 100).toFixed(1);
        let gradeBadge = `<span class="badge badge-safe">${res.grade || 'A'}</span>`;
        if (pct < 60) gradeBadge = `<span class="badge badge-urgent">${res.grade || 'F'}</span>`;
        else if (pct < 80) gradeBadge = `<span class="badge badge-warning">${res.grade || 'B'}</span>`;

        return `
            <tr style="border-bottom: 1px solid rgba(0, 242, 254, 0.1); transition: background 0.2s;" onmouseenter="this.style.background='rgba(0, 242, 254, 0.05)'" onmouseleave="this.style.background='transparent'">
                <td style="padding: 14px 16px; font-weight: 600; color: #fff;">${escapeHtml(res.exam_name)}</td>
                <td style="padding: 14px 16px; color: var(--arc-cyan);">${escapeHtml(res.subject)}</td>
                <td style="padding: 14px 16px;">
                    <span class="badge" style="background: rgba(157, 78, 221, 0.2); border: 1px solid var(--vibranium-purple); color: #d8b4fe;">${escapeHtml(res.semester_term || 'Semester 1')}</span>
                </td>
                <td style="padding: 14px 16px; font-weight: 700; color: #fff;">
                    ${res.marks_obtained} <span style="color: var(--text-muted); font-size: 0.85rem;">/ ${res.max_marks}</span>
                </td>
                <td style="padding: 14px 16px; font-weight: 700; color: ${pct >= 85 ? 'var(--hulk-green)' : pct >= 65 ? 'var(--stark-gold)' : 'var(--stark-red)'};">
                    ${pct}%
                </td>
                <td style="padding: 14px 16px;">${gradeBadge}</td>
                <td style="padding: 14px 16px; font-size: 0.85rem; color: var(--text-muted);">${res.exam_date || '-'}</td>
                <td style="padding: 14px 16px; font-size: 0.85rem; color: #cbd5e1;">${escapeHtml(res.remarks || '-')}</td>
                <td style="padding: 14px 16px; text-align: right;">
                    <button class="hud-btn hud-btn-danger" style="padding: 6px 10px; font-size: 0.85rem;" onclick="deleteResult(${res.id})" title="Delete Record">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPerformanceChart() {
    const ctx = document.getElementById('marksChart');
    if (!ctx) return;

    if (marksChart) {
        marksChart.destroy();
    }

    if (allResults.length === 0) return;

    // Sort chronologically for chart
    const sorted = [...allResults].reverse();
    const labels = sorted.map(r => `${r.subject} (${r.exam_name})`);
    const percentages = sorted.map(r => ((r.marks_obtained / r.max_marks) * 100).toFixed(1));

    marksChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score Percentage (%)',
                data: percentages,
                borderColor: '#00f2fe',
                backgroundColor: 'rgba(0, 242, 254, 0.12)',
                borderWidth: 3,
                pointBackgroundColor: '#ffb703',
                pointBorderColor: '#fff',
                pointRadius: 6,
                pointHoverRadius: 9,
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#f0f6fc',
                        font: { family: 'Rajdhani', size: 14 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 16, 30, 0.95)',
                    titleColor: '#00f2fe',
                    bodyColor: '#fff',
                    borderColor: '#00f2fe',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(0, 242, 254, 0.1)' },
                    ticks: {
                        color: '#8b9bb4',
                        callback: val => val + '%'
                    }
                },
                x: {
                    grid: { color: 'rgba(0, 242, 254, 0.05)' },
                    ticks: {
                        color: '#8b9bb4',
                        font: { size: 11 },
                        maxRotation: 45,
                        minRotation: 25
                    }
                }
            }
        }
    });
}

async function handleAddResult(e) {
    e.preventDefault();
    const exam_name = document.getElementById('exam-name-input').value.trim();
    const subject = document.getElementById('subject-name-input').value.trim();
    const semester_term = document.getElementById('semester-input').value.trim() || 'Semester 1';
    const marks_obtained = parseFloat(document.getElementById('marks-obtained-input').value);
    const max_marks = parseFloat(document.getElementById('max-marks-input').value) || 100;
    const grade = document.getElementById('grade-input').value.trim();
    const exam_date = document.getElementById('exam-date-input').value;
    const remarks = document.getElementById('remarks-input').value.trim();

    if (!exam_name || !subject || isNaN(marks_obtained)) {
        showToast('Validation Error', 'Please complete all required fields.', 'warning');
        return;
    }

    try {
        const res = await fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exam_name, subject, semester_term, marks_obtained, max_marks, grade, exam_date, remarks
            })
        });

        if (res.ok) {
            closeResultModal();
            document.getElementById('new-result-form').reset();
            showToast('Record Archiving Complete', 'Academic results securely synced.', 'success');
            fetchResults();
        }
    } catch (e) {
        showToast('Error', 'Failed to store result.', 'danger');
    }
}

async function deleteResult(id) {
    if (!confirm('Are you sure you want to delete this result record?')) return;
    try {
        const res = await fetch(`/api/results/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Deleted', 'Result record wiped from archive.', 'warning');
            fetchResults();
        }
    } catch (e) {
        showToast('Error', 'Could not delete result record.', 'danger');
    }
}

function openResultModal() {
    const modal = document.getElementById('result-modal');
    if (modal) {
        modal.classList.add('active');
        jarvisAudio.playClick();
    }
}

function closeResultModal() {
    const modal = document.getElementById('result-modal');
    if (modal) modal.classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchResults();
    const form = document.getElementById('new-result-form');
    if (form) form.addEventListener('submit', handleAddResult);
});
