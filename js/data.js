// ============================================================
//  Themis AIR — Data (GitHub API + localStorage cache)
//  v2: 文章存 GitHub repo，圖片存 data/images/，跨裝置同步
// ============================================================

const DEFAULT_TAGS = ['夏彥', '左然', '莫弈', '陸景和', '活動', '思緒', '主線', 'ThemisAIR'];

// ── GitHub Config ──────────────────────────────────────────────
const GH_OWNER    = 'ThemisAIR';
const GH_REPO     = 'themis-air';
const GH_BRANCH   = 'main';
const GH_ARTICLES = 'data/articles.json';
const GH_IMAGES   = 'data/images';
const GH_SETTINGS = 'data/settings.json';

const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents`;
const GH_RAW = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}`;

// ── PAT (Personal Access Token) ────────────────────────────────
const PAT_KEY = 'themisair_pat';
const getPAT  = ()  => localStorage.getItem(PAT_KEY) || '';
const setPAT  = t   => localStorage.setItem(PAT_KEY, t);
const hasPAT  = ()  => !!getPAT();

function _ghHeaders() {
  const h = { 'Accept': 'application/vnd.github.v3+json' };
  const pat = getPAT();
  if (pat) h['Authorization'] = `token ${pat}`;
  return h;
}

// ── Local Cache ────────────────────────────────────────────────
const CACHE_KEY = 'themisair_cache';
const _getCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } };
const _setCache = a  => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(a)); } catch {} };

// ── Read Articles ──────────────────────────────────────────────

// Public pages: 先回傳 cache，背景刷新
async function getArticles() {
  const cached = _getCache();
  _refreshFromGH().catch(() => {});  // background refresh
  if (cached && cached.length > 0) return cached;
  return _refreshFromGH();
}

async function _refreshFromGH() {
  const url = `${GH_RAW}/${GH_ARTICLES}?_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const c = _getCache();
    if (c) return c;
    throw new Error('無法從 GitHub 載入文章');
  }
  const articles = await res.json();
  _setCache(articles);
  return articles;
}

async function getArticleById(id) {
  const articles = await getArticles();
  return articles.find(a => a.id === id) || null;
}

// Admin 專用：從 API 取得最新資料（含 SHA，供寫入用）
async function _fetchWithSHA() {
  const res = await fetch(`${GH_API}/${GH_ARTICLES}`, { headers: _ghHeaders() });
  if (res.status === 404) return { articles: [], sha: null };
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `GitHub API 錯誤 ${res.status}`);
  }
  const data = await res.json();
  const text = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
  return { articles: JSON.parse(text), sha: data.sha };
}

// ── Write Articles ─────────────────────────────────────────────

async function saveArticle(article) {
  if (!hasPAT()) throw new Error('請先在後台設定 GitHub Token');
  const { articles, sha } = await _fetchWithSHA();

  article.summary = generateSummary(article.content);
  const now = Date.now();
  const idx = articles.findIndex(a => a.id === article.id);

  if (idx >= 0) {
    articles[idx] = { ...articles[idx], ...article, updatedAt: now };
  } else {
    articles.unshift({ ...article, id: article.id || generateId(), createdAt: now });
  }

  await _pushJSON(GH_ARTICLES, articles, sha, `update articles ${new Date().toISOString().slice(0, 10)}`);
  _setCache(articles);
  return article;
}

async function deleteArticle(id) {
  if (!hasPAT()) throw new Error('請先在後台設定 GitHub Token');
  const { articles, sha } = await _fetchWithSHA();
  const filtered = articles.filter(a => a.id !== id);
  await _pushJSON(GH_ARTICLES, filtered, sha, `delete article ${id}`);
  _setCache(filtered);
}

// ── Upload Image to GitHub ─────────────────────────────────────

async function uploadImage(filename, dataUrl) {
  if (!hasPAT()) throw new Error('請先在後台設定 GitHub Token');

  const ext = filename.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || 'jpg';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}.${ext}`;
  const path = `${GH_IMAGES}/${safeName}`;
  const base64 = dataUrl.split(',')[1];

  const res = await fetch(`${GH_API}/${path}`, {
    method: 'PUT',
    headers: { ..._ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `upload image ${safeName}`,
      content: base64,
      branch: GH_BRANCH
    })
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    let msg = e.message || `上傳失敗 ${res.status}`;
    if (res.status === 401) msg = 'Token 無效或已過期，請重新建立 Token';
    else if (res.status === 403) msg = '權限不足：Token 需要 repo 權限';
    else if (res.status === 404) msg = 'Token 沒有此倉庫的寫入權限（請確認 Token 是用「ThemisAIR 帳號」建立，且有勾選 repo 權限）';
    else if (res.status === 409) msg = '衝突，請稍後重試';
    throw new Error(msg);
  }

  return `${GH_RAW}/${path}`;
}

// 驗證 Token 是否有寫入權限
async function verifyToken(token) {
  const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (res.status === 401) return { ok: false, msg: 'Token 無效或已過期' };
  if (res.status === 404) return { ok: false, msg: '找不到倉庫，請確認 Token 屬於有存取權限的帳號' };
  if (!res.ok)            return { ok: false, msg: `GitHub API 錯誤 ${res.status}` };
  const data = await res.json();
  const canWrite = data.permissions?.push || data.permissions?.admin || data.permissions?.maintain;
  if (!canWrite) return { ok: false, msg: 'Token 對此倉庫沒有寫入(push)權限' };
  return { ok: true, msg: `驗證成功 ✓（倉庫：${data.full_name}）` };
}

// ── GitHub Write Helper ────────────────────────────────────────

async function _pushJSON(path, data, sha, message) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const body = { message, content, branch: GH_BRANCH };
  if (sha) body.sha = sha;

  const res = await fetch(`${GH_API}/${path}`, {
    method: 'PUT',
    headers: { ..._ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `GitHub API 錯誤 ${res.status}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────

function generateSummary(content = '', maxLen = 120) {
  const stripped = content
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, '[圖片]')
    .replace(/#+\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^[-*>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function getAllTags() {
  const articles = await getArticles();
  const used = new Set(articles.flatMap(a => a.tags || []));
  DEFAULT_TAGS.forEach(t => used.add(t));
  return [...used];
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Site Settings ─────────────────────────────────────────────

const SETTINGS_CACHE = 'themisair_settings';
const SETTINGS_DEFAULT = { heroTitle: '遊戲日誌', heroSubtitle: '記錄每一個值得留念的故事瞬間' };

async function getSettings() {
  const cached = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_CACHE)); } catch { return null; } })();
  _refreshSettings().catch(() => {});
  return cached || _refreshSettings();
}

async function _refreshSettings() {
  const res = await fetch(`${GH_RAW}/${GH_SETTINGS}?_=${Date.now()}`);
  if (!res.ok) return SETTINGS_DEFAULT;
  const s = await res.json();
  try { localStorage.setItem(SETTINGS_CACHE, JSON.stringify(s)); } catch {}
  return s;
}

async function saveSettings(settings) {
  if (!hasPAT()) throw new Error('請先設定 GitHub Token');
  const res = await fetch(`${GH_API}/${GH_SETTINGS}`, { headers: _ghHeaders() });
  const sha = res.ok ? (await res.json()).sha : null;
  await _pushJSON(GH_SETTINGS, settings, sha, 'update site settings');
  try { localStorage.setItem(SETTINGS_CACHE, JSON.stringify(settings)); } catch {}
}

// ── Toast ──────────────────────────────────────────────────────

function showToast(message, type = 'success', duration = 3500) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  const icons = { success: '✓', error: '✕', info: '✦' };
  toast.innerHTML = `<span>${icons[type] || '✦'}</span> ${message}`;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}
