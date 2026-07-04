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
    throw new Error(e.message || `圖片上傳失敗 ${res.status}`);
  }

  // 回傳公開 URL（raw.githubusercontent.com）
  return `${GH_RAW}/${path}`;
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
