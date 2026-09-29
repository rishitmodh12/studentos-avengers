/**
 * AVENGERS HQ - PDF Vault Module (Subject-wise & Section-wise Document Organizer)
 */

let allPdfs = [];
let activeSubject = 'All';
let activeSection = 'All';
let pdfSearch = '';

async function fetchPdfs() {
    try {
        const res = await fetch('/api/vault/documents');
        allPdfs = await res.json();
        renderSubjectPills();
        renderPdfs();
    } catch (err) {
        console.error('Error fetching PDFs:', err);
        showToast('Error', 'Unable to access document vault.', 'danger');
    }
}

function renderSubjectPills() {
    const nav = document.getElementById('vault-subject-pills');
    if (!nav) return;

    const subjects = ['All', ...new Set(allPdfs.map(p => p.subject).filter(Boolean))];
    nav.innerHTML = subjects.map(sub => `
        <button class="category-pill ${activeSubject === sub ? 'active' : ''}" onclick="selectSubject('${escapeHtml(sub)}')">
            ${escapeHtml(sub)}
        </button>
    `).join('');
}

function selectSubject(sub) {
    activeSubject = sub;
    renderSubjectPills();
    renderPdfs();
    jarvisAudio.playClick();
}

function renderPdfs() {
    const grid = document.getElementById('pdf-grid');
    const emptyState = document.getElementById('pdf-empty');
    if (!grid) return;

    let filtered = allPdfs.filter(pdf => {
        if (activeSubject !== 'All' && pdf.subject !== activeSubject) return false;
        if (activeSection !== 'All' && pdf.section_tag !== activeSection) return false;
        if (pdfSearch) {
            const q = pdfSearch.toLowerCase();
            const mTitle = pdf.title.toLowerCase().includes(q);
            const mSub = pdf.subject.toLowerCase().includes(q);
            const mSec = pdf.section_tag && pdf.section_tag.toLowerCase().includes(q);
            if (!mTitle && !mSub && !mSec) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = filtered.map(pdf => `
        <div class="stark-card pdf-card" style="display: flex; flex-direction: column; justify-content: space-between; border-left: 4px solid var(--arc-cyan);">
            <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <span class="badge" style="background: rgba(0, 242, 254, 0.15); border: 1px solid var(--arc-cyan); color: var(--arc-cyan);">
                        <i class="fas fa-book"></i> ${escapeHtml(pdf.subject)}
                    </span>
                    <span class="badge" style="background: rgba(255, 183, 3, 0.15); border: 1px solid var(--stark-gold); color: var(--stark-gold);">
                        ${escapeHtml(pdf.section_tag || 'General')}
                    </span>
                </div>
                
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
                    <div style="font-size: 2rem; color: var(--stark-red);">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 1.05rem; font-weight: 600; color: #fff; margin-bottom: 4px; word-break: break-word;">${escapeHtml(pdf.title)}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">${pdf.file_size_kb || 0} KB • ${pdf.upload_date ? pdf.upload_date.split(' ')[0] : 'Today'}</p>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 14px; border-top: 1px solid rgba(0, 242, 254, 0.1); padding-top: 12px;">
                <button class="hud-btn hud-btn-primary" style="flex: 1; justify-content: center; font-size: 0.85rem;" onclick="viewPdfModal('${pdf.file_name}', '${escapeHtml(pdf.title)}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <a href="/api/vault/download/${pdf.file_name}" class="hud-btn" style="text-decoration: none; font-size: 0.85rem;" title="Download PDF">
                    <i class="fas fa-download"></i>
                </a>
                <button class="hud-btn hud-btn-danger" style="font-size: 0.85rem;" onclick="deletePdf(${pdf.id})" title="Delete PDF">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// In-app PDF Viewer Modal
function viewPdfModal(fileName, title) {
    const modal = document.getElementById('pdf-viewer-modal');
    const iframe = document.getElementById('pdf-frame');
    const titleHeader = document.getElementById('pdf-view-title');
    const downloadBtn = document.getElementById('pdf-view-download');

    if (modal && iframe) {
        iframe.src = `/api/vault/view/${fileName}`;
        if (titleHeader) titleHeader.textContent = title;
        if (downloadBtn) downloadBtn.href = `/api/vault/download/${fileName}`;
        modal.classList.add('active');
        jarvisAudio.playClick();
    }
}

function closePdfViewer() {
    const modal = document.getElementById('pdf-viewer-modal');
    const iframe = document.getElementById('pdf-frame');
    if (modal) {
        modal.classList.remove('active');
        if (iframe) iframe.src = '';
    }
}

// Handle PDF Upload Form
async function handlePdfUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('pdf-file-input');
    const titleInput = document.getElementById('pdf-title-input');
    const subjectInput = document.getElementById('pdf-subject-input');
    const sectionInput = document.getElementById('pdf-section-input');

    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Validation Error', 'Please select a PDF file.', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('title', titleInput.value.trim());
    formData.append('subject', subjectInput.value.trim() || 'General');
    formData.append('section_tag', sectionInput.value.trim() || 'General');

    const uploadBtn = document.getElementById('pdf-upload-btn');
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    }

    try {
        const res = await fetch('/api/vault/upload', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            closeUploadModal();
            document.getElementById('upload-pdf-form').reset();
            showToast('Document Stored', 'PDF encrypted and cataloged.', 'success');
            fetchPdfs();
        } else {
            const err = await res.json();
            showToast('Upload Failed', err.error || 'Check PDF format', 'danger');
        }
    } catch (e) {
        showToast('Error', 'Server connection failure during upload.', 'danger');
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload to Vault';
        }
    }
}

async function deletePdf(id) {
    if (!confirm('Are you sure you want to delete this document from the vault?')) return;
    try {
        const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Document Purged', 'File removed from vault storage.', 'warning');
            fetchPdfs();
        }
    } catch (e) {
        showToast('Error', 'Could not delete PDF', 'danger');
    }
}

function openUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (modal) {
        modal.classList.add('active');
        jarvisAudio.playClick();
    }
}

function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (modal) modal.classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchPdfs();

    const form = document.getElementById('upload-pdf-form');
    if (form) form.addEventListener('submit', handlePdfUpload);

    const searchInput = document.getElementById('vault-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            pdfSearch = e.target.value;
            renderPdfs();
        });
    }
});
