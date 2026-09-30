/**
 * AVENGERS HQ - Tasks & Subtasks Management Module (Google Tasks Inspired)
 */

let allTasks = [];
let activeCategory = 'All';
let activeFilter = 'all'; // all, pending, completed, urgent
let searchQuery = '';

function saveTasksToLocalStorage(tasks) {
    const key = typeof getUserStorageKey === 'function' ? getUserStorageKey('tasks') : 'stark_user_tasks';
    localStorage.setItem(key, JSON.stringify(tasks));
}

function loadTasksFromLocalStorage() {
    const key = typeof getUserStorageKey === 'function' ? getUserStorageKey('tasks') : 'stark_user_tasks';
    const saved = localStorage.getItem(key) || localStorage.getItem('stark_user_tasks');
    if (saved) {
        try { return JSON.parse(saved); } catch(e) { return []; }
    }
    return [];
}

// Load tasks from API with instant cache fallback
async function fetchTasks() {
    const cached = loadTasksFromLocalStorage();
    if (cached) {
        allTasks = cached;
        renderCategories();
        renderTasks();
    }

    try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
            const serverTasks = await res.json();
            if (serverTasks && serverTasks.length > 0) {
                allTasks = serverTasks;
                saveTasksToLocalStorage(allTasks);
            }
            renderCategories();
            renderTasks();
            checkDeadlinesAndAlert();
        }
    } catch (err) {
        console.warn('Network offline, using cached tasks:', err);
    }
}

// Render dynamic category chips
function renderCategories() {
    const categoryNav = document.getElementById('category-pills');
    if (!categoryNav) return;

    const categories = ['All', ...new Set(allTasks.map(t => t.category).filter(Boolean))];
    categoryNav.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-pill ${activeCategory === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => {
            activeCategory = cat;
            renderCategories();
            renderTasks();
            jarvisAudio.playClick();
        };
        categoryNav.appendChild(btn);
    });
}

// Compute deadline status badge
function getDeadlineBadge(dueDate, dueTime) {
    if (!dueDate) return '';

    const now = new Date();
    const taskDate = new Date(`${dueDate}T${dueTime || '23:59'}:00`);
    const diffMs = taskDate - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
        return `<span class="badge badge-urgent"><i class="fas fa-exclamation-circle"></i> OVERDUE (${dueDate})</span>`;
    } else if (diffHours <= 24) {
        const hoursLeft = Math.max(1, Math.ceil(diffHours));
        return `<span class="badge badge-urgent"><i class="fas fa-fire"></i> DUE IN ${hoursLeft}h (${dueTime || 'Today'})</span>`;
    } else if (diffHours <= 48) {
        return `<span class="badge badge-warning"><i class="fas fa-clock"></i> DUE TOMORROW</span>`;
    } else {
        return `<span class="badge badge-safe"><i class="fas fa-calendar-alt"></i> ${dueDate}</span>`;
    }
}

// Render task list
function renderTasks() {
    const listContainer = document.getElementById('tasks-container');
    const emptyState = document.getElementById('tasks-empty');
    updateTaskMetrics();
    if (!listContainer) return;

    let filtered = allTasks.filter(task => {
        // Category filter
        if (activeCategory !== 'All' && task.category !== activeCategory) return false;
        // Status filter
        if (activeFilter === 'pending' && task.completed) return false;
        if (activeFilter === 'completed' && !task.completed) return false;
        if (activeFilter === 'urgent') {
            if (task.completed || !task.due_date) return false;
            const diffHours = (new Date(`${task.due_date}T${task.due_time || '23:59'}:00`) - new Date()) / (1000 * 60 * 60);
            if (diffHours > 24) return false;
        }
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchTitle = task.title.toLowerCase().includes(q);
            const matchDesc = task.description && task.description.toLowerCase().includes(q);
            const matchSub = task.subtasks && task.subtasks.some(s => s.title.toLowerCase().includes(q));
            if (!matchTitle && !matchDesc && !matchSub) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    listContainer.innerHTML = filtered.map(task => {
        const subtasks = task.subtasks || [];
        const completedSubtasks = subtasks.filter(s => s.completed).length;
        const subtasksProgress = subtasks.length > 0 
            ? `<div class="subtask-progress-bar"><div class="subtask-fill" style="width: ${(completedSubtasks / subtasks.length) * 100}%"></div></div>`
            : '';

        let priorityBadge = '';
        if (task.priority === 'High') priorityBadge = '<span class="badge badge-priority-high"><i class="fas fa-bolt"></i> High</span>';
        else if (task.priority === 'Medium') priorityBadge = '<span class="badge badge-priority-medium">Medium</span>';
        else priorityBadge = '<span class="badge badge-priority-low">Low</span>';

        const deadlineHtml = getDeadlineBadge(task.due_date, task.due_time);

        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" id="task-card-${task.id}">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px;">
                    <div style="display: flex; align-items: flex-start; gap: 14px; flex: 1;">
                        <input type="checkbox" class="task-checkbox-custom" ${task.completed ? 'checked' : ''} onchange="toggleTaskStatus(${task.id})">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px;">
                                <h4 class="task-title" style="font-size: 1.1rem; font-weight: 600; color: #fff;">${escapeHtml(task.title)}</h4>
                                ${priorityBadge}
                                ${deadlineHtml}
                                <span class="badge" style="background: rgba(157, 78, 221, 0.2); border: 1px solid var(--vibranium-purple); color: #d8b4fe;">${escapeHtml(task.category)}</span>
                            </div>
                            ${task.description ? `<p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 8px;">${escapeHtml(task.description)}</p>` : ''}
                            
                            ${subtasks.length > 0 ? `
                                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--arc-cyan); margin-bottom: 8px;">
                                    <i class="fas fa-tasks"></i> Subtasks: ${completedSubtasks}/${subtasks.length} completed
                                </div>
                                ${subtasksProgress}
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="hud-btn" style="padding: 6px 10px; font-size: 0.85rem;" title="Add Subtask" onclick="showInlineSubtaskInput(${task.id})">
                            <i class="fas fa-plus"></i> Subtask
                        </button>
                        <button class="hud-btn hud-btn-danger" style="padding: 6px 10px; font-size: 0.85rem;" title="Delete Task" onclick="deleteTask(${task.id})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>

                <!-- Subtasks Container -->
                <div class="subtask-list" id="subtask-container-${task.id}">
                    ${subtasks.map(st => `
                        <div class="subtask-item">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
                                <input type="checkbox" class="task-checkbox-custom" style="width: 16px; height: 16px;" ${st.completed ? 'checked' : ''} onchange="toggleSubtaskStatus(${st.id})">
                                <span style="font-size: 0.9rem; ${st.completed ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: #e2e8f0;'}">${escapeHtml(st.title)}</span>
                            </label>
                            <button onclick="deleteSubtask(${st.id})" style="background: none; border: none; color: #ff5252; cursor: pointer; font-size: 0.8rem; opacity: 0.6;" title="Remove subtask">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}

                    <!-- Inline Subtask Input Form (Hidden by default) -->
                    <div id="inline-subtask-form-${task.id}" style="display: none; margin-top: 6px;">
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="inline-subtask-input-${task.id}" class="form-control" style="padding: 6px 12px; font-size: 0.85rem;" placeholder="Enter tactical subtask...">
                            <button class="hud-btn hud-btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="submitSubtask(${task.id})">Add</button>
                            <button class="hud-btn" style="padding: 6px 10px; font-size: 0.85rem;" onclick="hideInlineSubtaskInput(${task.id})"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Inline Subtask Controls
function showInlineSubtaskInput(taskId) {
    const form = document.getElementById(`inline-subtask-form-${taskId}`);
    if (form) {
        form.style.display = 'block';
        const input = document.getElementById(`inline-subtask-input-${taskId}`);
        if (input) input.focus();
    }
}

function hideInlineSubtaskInput(taskId) {
    const form = document.getElementById(`inline-subtask-form-${taskId}`);
    if (form) form.style.display = 'none';
}

async function submitSubtask(taskId) {
    const input = document.getElementById(`inline-subtask-input-${taskId}`);
    if (!input || !input.value.trim()) return;

    try {
        const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: input.value.trim() })
        });
        if (res.ok) {
            jarvisAudio.playSuccess();
            showToast('Subtask Assigned', 'Tactical subtask appended to protocol.', 'success');
            fetchTasks();
        }
    } catch (e) {
        showToast('Error', 'Could not add subtask', 'danger');
    }
}

// Toggle Task
async function toggleTaskStatus(taskId) {
    try {
        const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'POST' });
        if (res.ok) {
            jarvisAudio.playTaskComplete();
            fetchTasks();
        }
    } catch (e) {
        showToast('Error', 'Failed to update task state', 'danger');
    }
}

// Toggle Subtask
async function toggleSubtaskStatus(subtaskId) {
    try {
        const res = await fetch(`/api/subtasks/${subtaskId}/toggle`, { method: 'POST' });
        if (res.ok) {
            jarvisAudio.playClick();
            fetchTasks();
        }
    } catch (e) {
        showToast('Error', 'Failed to update subtask state', 'danger');
    }
}

// Delete Task
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to abort and delete this mission task?')) return;
    try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (res.ok) {
            jarvisAudio.playClick();
            showToast('Mission Deleted', 'Task removed from protocol database.', 'warning');
            fetchTasks();
        }
    } catch (e) {
        showToast('Error', 'Could not delete task', 'danger');
    }
}

// Delete Subtask
async function deleteSubtask(subtaskId) {
    try {
        const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
        if (res.ok) {
            jarvisAudio.playClick();
            fetchTasks();
        }
    } catch (e) {
        showToast('Error', 'Could not delete subtask', 'danger');
    }
}

// Create New Task via Modal
async function handleCreateTask(e) {
    e.preventDefault();
    const title = document.getElementById('task-title-input').value.trim();
    const description = document.getElementById('task-desc-input').value.trim();
    const category = document.getElementById('task-cat-input').value.trim() || 'General';
    const priority = document.getElementById('task-priority-input').value;
    const dueDate = document.getElementById('task-date-input').value;
    const dueTime = document.getElementById('task-time-input').value;

    const subtasksText = document.getElementById('task-subtasks-input').value;
    const subtasks = subtasksText.split('\n').map(s => s.trim()).filter(Boolean);

    if (!title) {
        showToast('Validation Error', 'Task title is required.', 'warning');
        return;
    }

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, description, category, priority,
                due_date: dueDate || null,
                due_time: dueTime || null,
                subtasks
            })
        });

        if (res.ok) {
            closeTaskModal();
            document.getElementById('new-task-form').reset();
            showToast('Mission Initialized', 'New task added to JARVIS records.', 'success');
            fetchTasks();
        }
    } catch (e) {
        showToast('Error', 'Failed to create task.', 'danger');
    }
}

// Modal Toggle Helpers
function openTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) {
        modal.classList.add('active');
        jarvisAudio.playClick();
    }
}

function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('active');
}

// Helper escape html
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update Side HUD Task Metrics
function updateTaskMetrics() {
    const totalEl = document.getElementById('metric-total-tasks');
    const pendingEl = document.getElementById('metric-pending-tasks');
    const urgentEl = document.getElementById('metric-urgent-tasks');
    const pctEl = document.getElementById('metric-completion-pct');
    const barEl = document.getElementById('metric-progress-bar');
    const googlePill = document.getElementById('side-google-status-pill');

    const total = allTasks.length;
    const completed = allTasks.filter(t => t.completed).length;
    const pending = total - completed;

    const urgent = allTasks.filter(t => {
        if (t.completed || !t.due_date) return false;
        const diffHours = (new Date(`${t.due_date}T${t.due_time || '23:59'}:00`) - new Date()) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 24;
    }).length;

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (urgentEl) urgentEl.textContent = urgent;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;

    if (googlePill) {
        const user = localStorage.getItem('google_user_profile');
        if (user) {
            googlePill.textContent = 'Synced';
            googlePill.style.background = 'rgba(0, 230, 118, 0.2)';
            googlePill.style.borderColor = 'var(--hulk-green)';
            googlePill.style.color = '#86efac';
        } else {
            googlePill.textContent = 'Not Connected';
            googlePill.style.background = 'rgba(255, 183, 3, 0.15)';
            googlePill.style.borderColor = 'var(--stark-gold)';
            googlePill.style.color = '#fde047';
        }
    }
}

// Quick 1-Click Task Add
async function handleQuickAddTask(e) {
    e.preventDefault();
    const input = document.getElementById('quick-task-input');
    const prioritySelect = document.getElementById('quick-task-priority');
    const title = input ? input.value.trim() : '';
    const priority = prioritySelect ? prioritySelect.value : 'Medium';

    if (!title) return;

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                description: 'Fast directive launched from sidebar HUD',
                category: activeCategory !== 'All' ? activeCategory : 'Studies',
                priority: priority,
                due_date: new Date().toISOString().split('T')[0],
                due_time: '23:59',
                subtasks: []
            })
        });

        if (res.ok) {
            const created = await res.json();
            allTasks.unshift(created);
            saveTasksToLocalStorage(allTasks);
            renderCategories();
            renderTasks();
            input.value = '';
            jarvisAudio.playSuccess();
            showToast('Quick Directive Added', `"${title}" added to active missions.`, 'success');
        }
    } catch (err) {
        showToast('Error', 'Failed to add quick task', 'danger');
    }
}

// Quick Import Google Tasks Modal Controls
function openGoogleTasksImportModal() {
    const m = document.getElementById('google-import-modal');
    if (m) {
        m.classList.add('active');
        jarvisAudio.playClick();
    }
}

function closeGoogleTasksImportModal() {
    const m = document.getElementById('google-import-modal');
    if (m) m.classList.remove('active');
}

async function submitImportedTasks() {
    const textEl = document.getElementById('import-tasks-text');
    const catEl = document.getElementById('import-category-input');
    const prioEl = document.getElementById('import-priority-input');

    const text = textEl ? textEl.value.trim() : '';
    const category = catEl ? catEl.value.trim() || 'Google Tasks' : 'Google Tasks';
    const priority = prioEl ? prioEl.value : 'Medium';

    if (!text) {
        showToast('Validation Error', 'Please paste or write task lines to import.', 'warning');
        return;
    }

    const lines = text.split('\n').map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean);
    if (lines.length === 0) return;

    let importedCount = 0;
    for (const line of lines) {
        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: line,
                    description: 'Imported via Google Tasks / Text Bridge',
                    category: category,
                    priority: priority,
                    due_date: new Date().toISOString().split('T')[0],
                    subtasks: []
                })
            });
            if (res.ok) {
                const newTask = await res.json();
                allTasks.unshift(newTask);
                importedCount++;
            }
        } catch(e) {}
    }

    saveTasksToLocalStorage(allTasks);
    renderCategories();
    renderTasks();
    closeGoogleTasksImportModal();
    if (textEl) textEl.value = '';
    jarvisAudio.playSuccess();
    showToast('Import Complete', `${importedCount} tasks successfully imported and synced!`, 'success');
}

// Export Tasks in Google Tasks format (JSON download / clipboard copy)
function exportTasksToGoogle() {
    const exportData = allTasks.map(t => ({
        id: `gt-${t.id}`,
        title: t.title,
        notes: t.description || '',
        status: t.completed ? 'completed' : 'needsAction',
        due: t.due_date ? `${t.due_date}T${t.due_time || '23:59'}:00.000Z` : null,
        subtasks: (t.subtasks || []).map(st => ({
            title: st.title,
            status: st.completed ? 'completed' : 'needsAction'
        }))
    }));

    const jsonStr = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
        jarvisAudio.playSuccess();
        showToast('Export Copied', 'Google Tasks formatted JSON copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback file download
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Google_Tasks_Export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        showToast('Export Downloaded', 'Google Tasks file downloaded.', 'info');
    });
}

// Global hook
window.fetchTasks = fetchTasks;

// Initial binding
document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();

    const form = document.getElementById('new-task-form');
    if (form) form.addEventListener('submit', handleCreateTask);

    const searchInput = document.getElementById('task-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderTasks();
        });
    }

    // Filter Buttons
    document.querySelectorAll('[data-task-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-task-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.taskFilter;
            renderTasks();
            jarvisAudio.playClick();
        });
    });
});
