// ============================================================
//  Themis AIR — Admin Page  [v2: GitHub API]
// ============================================================

const ADMIN_PASSWORD = 'admin123';

let isLoggedIn  = false;
let editingId   = null;
let selectedTags = [];

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  marked.setOptions({ breaks: true, gfm: true });

  // Pre-fill saved token
  const ti = document.getElementById('token-input');
  if (ti && getPAT()) ti.value = getPAT();

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('btn-new-article').addEventListener('click', () => openEditor(null));
  document.getElementById('btn-site-settings').addEventListener('click', openSiteSettings);
  document.getElementById('nav-logout').addEventListener('click', e => { e.preventDefault(); logout(); });

  const params = new URLSearchParams(window.location.search);
  const editId  = params.get('edit');
  if (editId) window._pendingEdit = editId;
});

// ── Auth ─────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const pw    = document.getElementById('pw-input').value;
  const token = document.getElementById('token-input')?.value?.trim() || '';
  const err   = document.getElementById('pw-error');

  if (pw !== ADMIN_PASSWORD) {
    err.textContent = '密碼錯誤，請再試一次';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
    return;
  }

  // 驗證密碼通過，檢查 Token
  if (token) {
    const loginBtn = e.target.querySelector('button[type="submit"]');
    loginBtn.disabled = true;
    loginBtn.textContent = '驗證 Token 中…';
    
    try {
      const res = await verifyToken(token);
      if (!res.ok) {
        err.textContent = 'Token 驗證失敗：' + res.msg;
        loginBtn.disabled = false;
        loginBtn.textContent = '進入後台';
        return;
      }
      setPAT(token);
    } catch (e) {
      err.textContent = '驗證 Token 時發生網路錯誤，請重試。';
      loginBtn.disabled = false;
      loginBtn.textContent = '進入後台';
      return;
    }
    
    loginBtn.disabled = false;
    loginBtn.textContent = '進入後台';
  }

  err.textContent = '';
  isLoggedIn = true;
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('admin-main').style.display   = 'block';
  document.getElementById('nav-logout').style.display    = 'inline-flex';
  loadAdminPanel();
  if (window._pendingEdit) {
    openEditor(window._pendingEdit);
    window._pendingEdit = null;
  }
}

function logout() {
  isLoggedIn = false;
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('admin-main').style.display    = 'none';
  document.getElementById('nav-logout').style.display     = 'none';
  document.getElementById('pw-input').value = '';
}

// ── Admin Panel ───────────────────────────────────────────────

async function loadAdminPanel() {
  const listEl = document.getElementById('admin-list');
  listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">載入中…</div>';
  try {
    const articles = await getArticles();
    renderStats(articles);
    renderAdminList(articles);
    if (!hasPAT()) showToast('尚未設定 GitHub Token，無法儲存或上傳圖片', 'info', 6000);
  } catch (e) {
    listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>${escHtml(e.message)}</p></div>`;
    showToast('載入失敗：' + e.message, 'error', 5000);
  }
}

function renderStats(articles) {
  const tagCounts = {};
  articles.forEach(a => (a.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];

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
    <div class="stat-pill" style="cursor:pointer" onclick="openTokenSettings()" title="點此設定 GitHub Token">
      <div class="stat-number" style="font-size:1.1rem">${hasPAT() ? '✓' : '!'}</div>
      <div class="stat-label" style="color:${hasPAT() ? 'var(--text-muted)' : '#AA7020'}">
        ${hasPAT() ? 'Token 已設定' : '需設定 Token'}
      </div>
    </div>
  `;
}

function renderAdminList(articles) {
  const sorted = articles.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const list   = document.getElementById('admin-list');

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:2rem">
        <span class="empty-icon" style="font-size:2rem">📖</span>
        <p>還沒有任何日誌，點上方按鈕新增吧</p>
      </div>`;
    return;
  }

  list.innerHTML = sorted.map(a => `
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

// ── Token Settings ────────────────────────────────────────────

function openTokenSettings() {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog-box" style="max-width:500px">
      <h4>🔑 GitHub Token 設定</h4>
      <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.6">
        需要具有 <code>repo</code> 權限的 Personal Access Token 才能儲存文章與上傳圖片。<br>
        <a href="https://github.com/settings/tokens/new?description=ThemisAIR&scopes=repo"
           target="_blank" rel="noopener" style="color:var(--lavender-dark)">
          → 點此前往 GitHub 建立新 Token（記得勾選 repo）
        </a>
      </p>
      <div class="form-group">
        <label for="settings-token">Personal Access Token</label>
        <input type="password" id="settings-token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
               value="${escAttr(getPAT())}" autocomplete="off">
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary btn-sm" id="ts-cancel">取消</button>
        <button class="btn btn-primary btn-sm" id="ts-save">儲存 Token</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('settings-token').focus();
  document.getElementById('ts-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('ts-save').addEventListener('click', async () => {
    const val = document.getElementById('settings-token').value.trim();
    if (!val) { showToast('請輸入 Token', 'error'); return; }
    
    const saveBtn = document.getElementById('ts-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '驗證中…';
    
    try {
      const res = await verifyToken(val);
      if (!res.ok) {
        showToast('驗證失敗：' + res.msg, 'error', 6000);
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存 Token';
        return;
      }
      setPAT(val);
      overlay.remove();
      showToast(res.msg, 'success');
      loadAdminPanel();
    } catch (err) {
      showToast('驗證出錯：' + err.message, 'error', 6000);
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存 Token';
    }
  });
}

// ── Editor ───────────────────────────────────────────────────

async function openEditor(id) {
  editingId    = id;
  selectedTags = [];

  const article = id ? await getArticleById(id) : null;
  if (id && !article) { showToast('找不到該篇日誌', 'error'); return; }
  if (article) selectedTags = [...(article.tags || [])];

  const wrap = document.getElementById('edit-panel-wrap');
  wrap.style.display = 'block';
  wrap.innerHTML     = buildEditorHTML(article);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

  initTagInput();

  const contentArea  = document.getElementById('editor-content');
  const previewBox   = document.getElementById('preview-box');
  const updatePreview = () => { previewBox.innerHTML = marked.parse(contentArea.value || ''); };
  contentArea.addEventListener('input', updatePreview);
  updatePreview();

  document.getElementById('btn-cancel-edit').addEventListener('click', closeEditor);
  document.getElementById('btn-cancel-edit-bottom')?.addEventListener('click', closeEditor);
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
            <input type="text" id="editor-title"
                   placeholder="輸入日誌標題…"
                   value="${escAttr(article ? article.title : '')}" required>
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
              <input type="text" class="tag-chip-input" id="tag-chip-input"
                     placeholder="輸入或點選標籤…" autocomplete="off">
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
              <button type="button" class="toolbar-btn" onclick="openYoutubeDialog()" title="插入 YouTube 影片">▶ YouTube</button>
            </div>

            <textarea id="editor-content" class="has-toolbar"
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
          <button type="submit" class="btn btn-primary" id="btn-save">💾 儲存日誌</button>
        </div>
      </form>
    </div>
  `;
}

function closeEditor() {
  const wrap = document.getElementById('edit-panel-wrap');
  wrap.style.display = 'none';
  wrap.innerHTML = '';
  editingId    = null;
  selectedTags = [];
}

async function handleSave(e) {
  e.preventDefault();

  const title = document.getElementById('editor-title').value.trim();
  if (!title) {
    showToast('請填寫標題', 'error');
    document.getElementById('editor-title').focus();
    return;
  }

  if (!hasPAT()) {
    showToast('請先設定 GitHub Token（點後台右上角的 Token 設定）', 'error', 6000);
    openTokenSettings();
    return;
  }

  const isNew = !editingId;
  const article = {
    id:      editingId || generateId(),
    title,
    date:    document.getElementById('editor-date').value || new Date().toISOString().slice(0, 10),
    tags:    [...selectedTags],
    content: document.getElementById('editor-content').value,
  };

  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }

  try {
    await saveArticle(article);
    closeEditor();
    await loadAdminPanel();
    showToast(isNew ? '新增成功！已儲存至 GitHub ✓' : '日誌已更新至 GitHub ✓', 'success');
  } catch (err) {
    console.error('[Themis AIR] 儲存失敗：', err);
    showToast('儲存失敗：' + (err.message || '請確認 GitHub Token 是否正確'), 'error', 6000);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 儲存日誌'; }
  }
}

// ── Tag Input ─────────────────────────────────────────────────

function initTagInput() {
  renderTagChips();

  document.querySelectorAll('.tag-sugg').forEach(el => {
    el.addEventListener('click', () => addTag(el.dataset.tag));
  });

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
  field.appendChild(input || _createTagInput());
  document.getElementById('tag-chip-input')?.focus();
}

function _createTagInput() {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-chip-input';
  input.id = 'tag-chip-input';
  input.placeholder = selectedTags.length ? '' : '輸入或點選標籤…';
  input.autocomplete = 'off';
  return input;
}

// ── Delete ────────────────────────────────────────────────────

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
  document.getElementById('dlg-confirm').addEventListener('click', async () => {
    const btn = document.getElementById('dlg-confirm');
    btn.disabled = true; btn.textContent = '刪除中…';
    try {
      await deleteArticle(id);
      overlay.remove();
      if (editingId === id) closeEditor();
      await loadAdminPanel();
      showToast('日誌已刪除', 'info');
    } catch (err) {
      showToast('刪除失敗：' + err.message, 'error');
      btn.disabled = false; btn.textContent = '確定刪除';
    }
  });
}

// ── Toolbar Helpers ───────────────────────────────────────────

function getEditorTextarea() { return document.getElementById('editor-content'); }

function wrapText(before, after) {
  const ta = getEditorTextarea(); if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end) || '文字';
  ta.setRangeText(before + selected + after, start, end, 'select');
  ta.focus(); ta.dispatchEvent(new Event('input'));
}

function insertLine(prefix) {
  const ta = getEditorTextarea(); if (!ta) return;
  const pos = ta.selectionStart;
  const lineStart = ta.value.slice(ta.value.lastIndexOf('\n', pos - 1) + 1, pos);
  const insert = lineStart.trim() === '' ? prefix : '\n' + prefix;
  ta.setRangeText(insert, pos, pos, 'end');
  ta.focus(); ta.dispatchEvent(new Event('input'));
}

function insertAtCursor(text) {
  const ta = getEditorTextarea(); if (!ta) return;
  const pos = ta.selectionStart;
  ta.setRangeText(text, pos, pos, 'end');
  ta.focus(); ta.dispatchEvent(new Event('input'));
}

// ── Image Dialog ─────────────────────────────────────────────

function openImageDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'img-dialog-overlay';
  overlay.innerHTML = `
    <div class="img-dialog">
      <h4>📷 插入圖片</h4>

      <div class="img-tabs">
        <button class="img-tab active" data-panel="upload">本地上傳</button>
        <button class="img-tab" data-panel="url">圖片網址</button>
      </div>

      <!-- 本地上傳（多選）-->
      <div class="img-tab-panel active" id="panel-upload">
        <div class="img-upload-area" id="upload-area">
          <span class="upload-icon">🖼️</span>
          點此選擇圖片，或直接拖曳（可多選）
          <input type="file" id="img-file-input" accept="image/*" multiple style="display:none">
        </div>
        <div id="img-thumb-grid" style="display:none;margin-top:.75rem"></div>
        <p class="img-note">圖片將上傳至 GitHub repo，完成後以正常網址插入文章。</p>
      </div>

      <!-- 圖片網址 -->
      <div class="img-tab-panel" id="panel-url">
        <div class="form-group">
          <label for="img-url-input">圖片網址（URL）</label>
          <input type="url" id="img-url-input" placeholder="https://example.com/image.jpg">
        </div>
        <div class="form-group">
          <label for="img-alt-input">圖片說明（選填）</label>
          <input type="text" id="img-alt-input" placeholder="圖片說明文字">
        </div>
        <p class="img-note">💡 也可以使用 Imgur、Google 相簿等圖床的分享連結。</p>
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

  // 上傳區 click & drag
  let loadedImages = [];
  const uploadArea = document.getElementById('upload-area');
  const fileInput  = document.getElementById('img-file-input');
  const thumbGrid  = document.getElementById('img-thumb-grid');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('dragover');
    processFiles([...e.dataTransfer.files]);
  });
  fileInput.addEventListener('change', () => processFiles([...fileInput.files]));

  function processFiles(files) {
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (!imgs.length) { showToast('請選擇圖片檔案', 'error'); return; }
    loadedImages = [];
    thumbGrid.innerHTML = '<p style="font-size:.8rem;color:var(--text-muted)">讀取中…</p>';
    thumbGrid.style.display = 'block';
    let done = 0;
    const results = new Array(imgs.length);
    imgs.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = ev => {
        results[i] = { name: file.name, dataUrl: ev.target.result };
        if (++done === imgs.length) { loadedImages = results; renderThumbs(); }
      };
      reader.readAsDataURL(file);
    });
    uploadArea.innerHTML = `<span class="upload-icon">✅</span>已選取 ${imgs.length} 張圖片
      <input type="file" id="img-file-input" accept="image/*" multiple style="display:none">`;
    document.getElementById('img-file-input').addEventListener('change', ev => processFiles([...ev.target.files]));
  }

  function renderThumbs() {
    thumbGrid.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:.5rem';
    loadedImages.forEach((img, i) => {
      const cell = document.createElement('div');
      cell.style.cssText = 'position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden;aspect-ratio:1';
      cell.innerHTML = `<img src="${img.dataUrl}" style="width:100%;height:100%;object-fit:cover" alt="${escHtml(img.name)}">
        <button type="button" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);color:#fff;
          border:none;border-radius:50%;width:18px;height:18px;font-size:.75rem;cursor:pointer;
          display:flex;align-items:center;justify-content:center">×</button>`;
      cell.querySelector('button').addEventListener('click', () => { loadedImages.splice(i, 1); renderThumbs(); });
      grid.appendChild(cell);
    });
    thumbGrid.appendChild(grid);
    const p = document.createElement('p');
    p.className = 'img-note'; p.style.marginTop = '.4rem';
    p.textContent = `共 ${loadedImages.length} 張，將上傳至 GitHub 並依序插入`;
    thumbGrid.appendChild(p);
  }

  // Cancel
  document.getElementById('img-cancel').addEventListener('click', () => overlay.remove());

  // Confirm — 上傳到 GitHub repo
  document.getElementById('img-confirm').addEventListener('click', async () => {
    if (activePanel === 'upload') {
      if (!loadedImages.length) { showToast('請先選擇圖片', 'error'); return; }
      if (!hasPAT()) {
        showToast('請先設定 GitHub Token 才能上傳圖片', 'error', 5000);
        overlay.remove();
        openTokenSettings();
        return;
      }

      const btn = document.getElementById('img-confirm');
      btn.disabled = true;
      const refs = [];
      try {
        for (let i = 0; i < loadedImages.length; i++) {
          btn.textContent = `上傳中 ${i + 1}/${loadedImages.length}…`;
          const img = loadedImages[i];
          const url = await uploadImage(img.name, img.dataUrl);
          refs.push(`![${escHtml(img.name)}](${url})`);
        }
        insertAtCursor('\n\n' + refs.join('\n\n') + '\n\n');
        showToast(`已上傳並插入 ${refs.length} 張圖片 ✓`, 'success');
        overlay.remove();
      } catch (err) {
        showToast('圖片上傳失敗：' + err.message, 'error', 6000);
        btn.disabled = false; btn.textContent = '插入圖片';
      }
    } else {
      const url = document.getElementById('img-url-input').value.trim();
      if (!url) { showToast('請輸入圖片網址', 'error'); return; }
      const alt = document.getElementById('img-alt-input').value.trim() || '圖片';
      insertAtCursor(`\n\n![${alt}](${url})\n\n`);
      showToast('圖片已插入 ✓', 'success');
      overlay.remove();
    }
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Utilities ────────────────────────────────────────────────

function escHtml(str) {
  const d = document.createElement('div'); d.textContent = String(str); return d.innerHTML;
}
function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Site Settings Dialog ─────────────────────────────────────────

async function openSiteSettings() {
  const settings = await getSettings().catch(() => ({ heroTitle: '遊戲日誌', heroSubtitle: '記錄每一個值得留念的故事瞬間' }));

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog-box" style="max-width:480px">
      <h4>⚙️ 網站設定</h4>
      <p style="font-size:.82rem;color:var(--text-muted);margin:.4rem 0 1rem">設定首頁顯示的標題與副標題文字。</p>
      <div class="form-group">
        <label for="ss-title">首頁大標題</label>
        <input type="text" id="ss-title" value="${escAttr(settings.heroTitle || '遊戲日誌')}">
      </div>
      <div class="form-group">
        <label for="ss-subtitle">首頁副標題</label>
        <input type="text" id="ss-subtitle" value="${escAttr(settings.heroSubtitle || '')}">
      </div>
      <div class="dialog-actions" style="margin-top:1.25rem">
        <button class="btn btn-secondary btn-sm" id="ss-cancel">取消</button>
        <button class="btn btn-primary btn-sm" id="ss-save">儲存設定</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('ss-title').focus();

  document.getElementById('ss-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('ss-save').addEventListener('click', async () => {
    const btn = document.getElementById('ss-save');
    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      const newSettings = {
        heroTitle:    document.getElementById('ss-title').value.trim() || '遊戲日誌',
        heroSubtitle: document.getElementById('ss-subtitle').value.trim()
      };
      await saveSettings(newSettings);
      overlay.remove();
      showToast('網站設定已更新 ✓', 'success');
    } catch (err) {
      showToast('儲存失敗：' + err.message, 'error');
      btn.disabled = false; btn.textContent = '儲存設定';
    }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── YouTube Dialog ────────────────────────────────────────────

function openYoutubeDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'img-dialog-overlay';
  overlay.innerHTML = `
    <div class="img-dialog">
      <h4>▶ 插入 YouTube 影片</h4>
      <div class="form-group" style="margin-top:.75rem">
        <label for="yt-url-input">YouTube 影片連結</label>
        <input type="url" id="yt-url-input"
               placeholder="https://www.youtube.com/watch?v=...">
      </div>
      <p class="img-note">💡 支援 youtube.com/watch、youtu.be 短網址、youtube.com/shorts 等格式。</p>
      <div class="dialog-actions" style="margin-top:1.25rem">
        <button class="btn btn-secondary btn-sm" id="yt-cancel">取消</button>
        <button class="btn btn-primary btn-sm" id="yt-confirm">插入影片</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('yt-url-input').focus();

  function extractVideoId(url) {
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,     // watch?v=
      /youtu\.be\/([a-zA-Z0-9_-]{11})/, // youtu.be/
      /\/shorts\/([a-zA-Z0-9_-]{11})/,  // shorts/
      /\/embed\/([a-zA-Z0-9_-]{11})/,   // embed/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  const confirm = () => {
    const url = document.getElementById('yt-url-input').value.trim();
    if (!url) { showToast('請輸入 YouTube 連結', 'error'); return; }
    const videoId = extractVideoId(url);
    if (!videoId) { showToast('無法識別 YouTube 連結格式，請確認網址是否正確', 'error'); return; }
    const embed = `\n\n<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen loading="lazy" title="YouTube video"></iframe></div>\n\n`;
    insertAtCursor(embed);
    showToast('YouTube 影片已插入 ✓', 'success');
    overlay.remove();
  };

  document.getElementById('yt-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('yt-confirm').addEventListener('click', confirm);
  document.getElementById('yt-url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirm();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
