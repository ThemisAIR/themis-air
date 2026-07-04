// ============================================================
//  Themis AIR — Admin Page (admin.js)
// ============================================================

const ADMIN_PASSWORD = 'admin123';

let isLoggedIn = false;
let editingId = null;        // null = new article
let selectedTags = [];

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  marked.setOptions({ breaks: true, gfm: true });

  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // New article button
  document.getElementById('btn-new-article').addEventListener('click', () => {
    openEditor(null);
  });

  // Logout
  document.getElementById('nav-logout').addEventListener('click', e => {
    e.preventDefault();
    logout();
  });

  // Check if we came from post page with ?edit=id
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (editId) {
    // Auto-show login; after login, open editor for this id
    window._pendingEdit = editId;
  }
});

// ── Auth ─────────────────────────────────────────────────────

function handleLogin(e) {
  e.preventDefault();
  const pw = document.getElementById('pw-input').value;
  const err = document.getElementById('pw-error');

  if (pw === ADMIN_PASSWORD) {
    err.textContent = '';
    isLoggedIn = true;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-main').style.display = 'block';
    document.getElementById('nav-logout').style.display = 'inline-flex';
    loadAdminPanel();

    // If came from post page, open editor
    if (window._pendingEdit) {
      openEditor(window._pendingEdit);
      window._pendingEdit = null;
    }
  } else {
    err.textContent = '密碼錯誤，請再試一次';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
  }
}

function logout() {
  isLoggedIn = false;
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('admin-main').style.display = 'none';
  document.getElementById('nav-logout').style.display = 'none';
  document.getElementById('pw-input').value = '';
}

// ── Admin Panel ───────────────────────────────────────────────

function loadAdminPanel() {
  renderStats();
  renderAdminList();
}

function renderStats() {
  const articles = getArticles();
  const tagCounts = {};
  articles.forEach(a => (a.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTag = Object.entries(tagCounts).sort((a,b) => b[1]-a[1])[0];

  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-pill">
      <div class="stat-number">${articles.length}</div>
      <div class="stat-label">篇日誌</div>
    </div>
    <div class="stat-pill">
      <div class="stat-number">${Object.keys(tagCounts).length}</div>
      <div class="stat-label">個標籤</div>
    </div>
    <div class="stat-pill">
      <div class="stat-number" style="font-size:1.1rem">${topTag ? '#' + topTag[0] : '—'}</div>
      <div class="stat-label">最常用標籤</div>
    </div>
  `;
}

function renderAdminList() {
  const articles = getArticles().slice().sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  const list = document.getElementById('admin-list');

  if (articles.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:2rem">
        <span class="empty-icon" style="font-size:2rem">📖</span>
        <p>還沒有任何日誌，點上方按鈕新增吧</p>
      </div>`;
    return;
  }

  list.innerHTML = articles.map(a => `
    <div class="admin-item" id="item-${a.id}">
      <div class="admin-item-info">
        <div class="admin-item-title">${escHtml(a.title)}</div>
        <div class="admin-item-meta">
          <span>📅 ${formatDate(a.date)}</span>
          ${(a.tags || []).map(t => `<span># ${escHtml(t)}</span>`).join(' ')}
        </div>
      </div>
      <div class="admin-item-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditor('${a.id}')">✏️ 編輯</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteAdmin('${a.id}', '${escAttr(a.title)}')">🗑</button>
      </div>
    </div>
  `).join('');
}

// ── Editor ───────────────────────────────────────────────────

function openEditor(id) {
  editingId = id;
  selectedTags = [];

  const article = id ? getArticleById(id) : null;
  if (id && !article) {
    showToast('找不到該篇日誌', 'error');
    return;
  }

  if (article) {
    selectedTags = [...(article.tags || [])];
  }

  const wrap = document.getElementById('edit-panel-wrap');
  wrap.style.display = 'block';
  wrap.innerHTML = buildEditorHTML(article);

  // Scroll to editor
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Init tag input
  initTagInput();

  // Live markdown preview
  const contentArea = document.getElementById('editor-content');
  const previewBox = document.getElementById('preview-box');
  const updatePreview = () => {
    previewBox.innerHTML = marked.parse(contentArea.value || '');
  };
  contentArea.addEventListener('input', updatePreview);
  updatePreview();

  // Cancel
  document.getElementById('btn-cancel-edit').addEventListener('click', closeEditor);

  // Save
  document.getElementById('form-edit').addEventListener('submit', handleSave);
}

function buildEditorHTML(article) {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="edit-panel">
      <div class="edit-panel-header">
        <h3>${article ? '✏️ 編輯日誌' : '✦ 新增日誌'}</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-cancel-edit">✕ 取消</button>
      </div>

      <form id="form-edit" novalidate>
        <div class="form-row">
          <div class="form-group" style="grid-column: 1 / -1">
            <label for="editor-title">標題 *</label>
            <input
              type="text"
              id="editor-title"
              placeholder="輸入日誌標題…"
              value="${escAttr(article ? article.title : '')}"
              required
            >
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="editor-date">日期</label>
            <input type="date" id="editor-date" value="${article ? article.date : today}">
          </div>
          <div class="form-group">
            <label>標籤</label>
            <div class="tags-field" id="tags-field">
              <input
                type="text"
                class="tag-chip-input"
                id="tag-chip-input"
                placeholder="輸入或點選標籤…"
                autocomplete="off"
              >
            </div>
            <div class="tag-suggestions" id="tag-suggestions">
              ${DEFAULT_TAGS.map(t =>
                `<span class="tag-sugg" data-tag="${escAttr(t)}"># ${escHtml(t)}</span>`
              ).join('')}
            </div>
          </div>
        </div>

        <div class="editor-wrap">
          <div class="editor-pane">
            <label for="editor-content">內容（支援 Markdown）</label>

            <!-- Toolbar -->
            <div class="editor-toolbar" id="editor-toolbar">
              <button type="button" class="toolbar-btn" onclick="wrapText('**','**')" title="粗體"><b>B</b></button>
              <button type="button" class="toolbar-btn" onclick="wrapText('*','*')" title="斜體"><i>I</i></button>
              <div class="toolbar-sep"></div>
              <button type="button" class="toolbar-btn" onclick="insertLine('## ')" title="標題">H2</button>
              <button type="button" class="toolbar-btn" onclick="insertLine('### ')" title="小標題">H3</button>
              <div class="toolbar-sep"></div>
              <button type="button" class="toolbar-btn" onclick="insertLine('> ')" title="引言">❝</button>
              <button type="button" class="toolbar-btn" onclick="insertLine('- ')" title="清單">☰</button>
              <button type="button" class="toolbar-btn" onclick="insertLine('---')" title="分隔線">—</button>
              <div class="toolbar-sep"></div>
              <button type="button" class="toolbar-btn" onclick="openImageDialog()" title="插入圖片">📷 插入圖片</button>
            </div>

            <textarea
              id="editor-content"
              class="has-toolbar"
              placeholder="在這裡寫日誌內容…&#10;&#10;支援 **粗體**、*斜體*、## 標題、> 引言、- 清單等 Markdown 語法"
            >${article ? escHtml(article.content || '') : ''}</textarea>
          </div>
          <div>
            <span class="preview-pane-label">預覽</span>
            <div class="preview-box post-content" id="preview-box"></div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="btn-cancel-edit-bottom">取消</button>
          <button type="submit" class="btn btn-primary">💾 儲存日誌</button>
        </div>
      </form>
    </div>
  `;
}


function closeEditor() {
  const wrap = document.getElementById('edit-panel-wrap');
  wrap.style.display = 'none';
  wrap.innerHTML = '';
  editingId = null;
  selectedTags = [];
}

function handleSave(e) {
  e.preventDefault();

  const title = document.getElementById('editor-title').value.trim();
  if (!title) {
    showToast('請填寫標題', 'error');
    document.getElementById('editor-title').focus();
    return;
  }

  const article = {
    id: editingId || generateId(),
    title,
    date: document.getElementById('editor-date').value || new Date().toISOString().slice(0, 10),
    tags: [...selectedTags],
    content: document.getElementById('editor-content').value,
  };

  saveArticle(article);
  closeEditor();
  loadAdminPanel();
  showToast(editingId ? '日誌已更新 ✓' : '新增成功！日誌已儲存 ✓', 'success');
}

// ── Tag Input ─────────────────────────────────────────────────

function initTagInput() {
  renderTagChips();

  // Suggestion clicks
  document.querySelectorAll('.tag-sugg').forEach(el => {
    el.addEventListener('click', () => {
      addTag(el.dataset.tag);
    });
  });

  // Typing in the input
  const input = document.getElementById('tag-chip-input');
  input.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      addTag(input.value.trim());
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && selectedTags.length) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  });

  // Click on field = focus input
  document.getElementById('tags-field').addEventListener('click', () => {
    document.getElementById('tag-chip-input').focus();
  });
}

function addTag(tag) {
  tag = tag.replace(/^#+\s*/, '').trim();
  if (!tag || selectedTags.includes(tag)) return;
  selectedTags.push(tag);
  renderTagChips();
}

function removeTag(tag) {
  selectedTags = selectedTags.filter(t => t !== tag);
  renderTagChips();
}

function renderTagChips() {
  const field = document.getElementById('tags-field');
  if (!field) return;
  const input = field.querySelector('.tag-chip-input') || document.getElementById('tag-chip-input');
  field.innerHTML = '';
  selectedTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escHtml(tag)} <span class="rm" role="button" aria-label="移除 ${escAttr(tag)}">×</span>`;
    chip.querySelector('.rm').addEventListener('click', () => removeTag(tag));
    field.appendChild(chip);
  });
  field.appendChild(input || createTagInput());
  document.getElementById('tag-chip-input')?.focus();
}

function createTagInput() {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-chip-input';
  input.id = 'tag-chip-input';
  input.placeholder = selectedTags.length ? '' : '輸入或點選標籤…';
  input.autocomplete = 'off';
  return input;
}

// ── Delete ───────────────────────────────────────────────────

function confirmDeleteAdmin(id, title) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog-box">
      <h4>確定要刪除嗎？</h4>
      <p>「${escHtml(title)}」將被永久刪除，無法復原。</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary btn-sm" id="dlg-cancel">取消</button>
        <button class="btn btn-danger btn-sm" id="dlg-confirm">確定刪除</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('dlg-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('dlg-confirm').addEventListener('click', () => {
    deleteArticle(id);
    overlay.remove();
    // If currently editing this article, close editor
    if (editingId === id) closeEditor();
    loadAdminPanel();
    showToast('日誌已刪除', 'info');
  });
}

// ── Utilities ────────────────────────────────────────────────

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Toolbar helpers ───────────────────────────────────────────

function getEditorTextarea() {
  return document.getElementById('editor-content');
}

// Wrap selected text with before/after markers (e.g. **bold**)
function wrapText(before, after) {
  const ta = getEditorTextarea();
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const selected = ta.value.slice(start, end) || '文字';
  const replacement = before + selected + after;
  ta.setRangeText(replacement, start, end, 'select');
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

// Insert a line prefix at cursor (e.g. ## , - , > )
function insertLine(prefix) {
  const ta = getEditorTextarea();
  if (!ta) return;
  const pos = ta.selectionStart;
  // Find start of current line
  const before = ta.value.lastIndexOf('\n', pos - 1) + 1;
  const lineStart = ta.value.slice(before, pos);
  // If line is empty or we're at start, just insert prefix
  const insert = (lineStart.trim() === '') ? prefix : '\n' + prefix;
  ta.setRangeText(insert, pos, pos, 'end');
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

// Insert arbitrary text at cursor
function insertAtCursor(text) {
  const ta = getEditorTextarea();
  if (!ta) return;
  const pos = ta.selectionStart;
  ta.setRangeText(text, pos, pos, 'end');
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

// ── Image Dialog ─────────────────────────────────────────────

function openImageDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'img-dialog-overlay';
  overlay.id = 'img-dialog-overlay';
  overlay.innerHTML = `
    <div class="img-dialog">
      <h4>📷 插入圖片</h4>

      <div class="img-tabs">
        <button class="img-tab active" data-panel="upload">本地上傳</button>
        <button class="img-tab" data-panel="url">圖片網址</button>
      </div>

      <!-- Tab: 本地上傳 -->
      <div class="img-tab-panel active" id="panel-upload">
        <div class="img-upload-area" id="upload-area">
          <span class="upload-icon">🖼️</span>
          點此選擇圖片，或直接拖曳到此處
          <input type="file" id="img-file-input" accept="image/*" style="display:none">
        </div>
        <div class="img-preview" id="img-preview">
          <img id="img-preview-img" src="" alt="預覽">
        </div>
        <p class="img-note">⚠️ 圖片將以 base64 格式嵌入文章。建議單張圖片不超過 1MB，以免影響效能。</p>
      </div>

      <!-- Tab: 圖片網址 -->
      <div class="img-tab-panel" id="panel-url">
        <div class="form-group">
          <label for="img-url-input">圖片網址（URL）</label>
          <input type="url" id="img-url-input" placeholder="https://example.com/image.jpg">
        </div>
        <div class="form-group">
          <label for="img-alt-input">圖片說明（選填）</label>
          <input type="text" id="img-alt-input" placeholder="圖片說明文字">
        </div>
        <p class="img-note">💡 可將圖片上傳到 Imgur、Google 相簿等圖床後，貼上連結。</p>
      </div>

      <div class="dialog-actions" style="margin-top:1.25rem">
        <button class="btn btn-secondary btn-sm" id="img-cancel">取消</button>
        <button class="btn btn-primary btn-sm" id="img-confirm">插入圖片</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Tab switching
  let activePanel = 'upload';
  overlay.querySelectorAll('.img-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activePanel = tab.dataset.panel;
      overlay.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
      overlay.querySelectorAll('.img-tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${activePanel}`).classList.add('active');
    });
  });

  // Upload area click & drag
  let base64Data = '';
  const uploadArea = document.getElementById('upload-area');
  const fileInput  = document.getElementById('img-file-input');

  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadImageFile(fileInput.files[0]);
  });

  function loadImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('請選擇圖片檔案', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      base64Data = e.target.result; // data:image/...;base64,...
      const preview = document.getElementById('img-preview');
      const previewImg = document.getElementById('img-preview-img');
      previewImg.src = base64Data;
      preview.style.display = 'block';
      uploadArea.innerHTML = `<span class="upload-icon">✅</span>${escHtml(file.name)}`;
    };
    reader.readAsDataURL(file);
  }

  // Cancel
  document.getElementById('img-cancel').addEventListener('click', () => overlay.remove());

  // Confirm
  document.getElementById('img-confirm').addEventListener('click', () => {
    if (activePanel === 'upload') {
      if (!base64Data) {
        showToast('請先選擇一張圖片', 'error');
        return;
      }
      insertAtCursor(`\n![圖片](${base64Data})\n`);
    } else {
      const url = document.getElementById('img-url-input').value.trim();
      if (!url) {
        showToast('請輸入圖片網址', 'error');
        return;
      }
      const alt = document.getElementById('img-alt-input').value.trim() || '圖片';
      insertAtCursor(`\n![${alt}](${url})\n`);
    }
    overlay.remove();
    showToast('圖片已插入 ✓', 'success');
  });

  // Click outside to close
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
}
