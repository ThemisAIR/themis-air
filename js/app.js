// ============================================================
//  Themis AIR — Home Page Logic (app.js)
// ============================================================

let currentTag = 'all';
let searchQuery = '';
let allArticles = [];

// ── Init ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 顯示載入中
  const grid = document.getElementById('articles-grid');
  grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)">載入中…</div>';

  try {
    allArticles = await getArticles();
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span>
      <h3>無法載入文章</h3><p>${e.message}</p></div>`;
    return;
  }

  renderTagFilters();
  renderArticles();

  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderArticles();
  });
});

// ── Tag Filters ──────────────────────────────────────────────

function renderTagFilters() {
  const container = document.getElementById('tag-filters');
  const usedTags = [...new Set(allArticles.flatMap(a => a.tags || []))];

  const allBtn = document.createElement('button');
  allBtn.className = 'tag-btn all-btn active';
  allBtn.dataset.tag = 'all';
  allBtn.id = 'tag-all';
  allBtn.textContent = '全部';
  allBtn.addEventListener('click', () => setTag('all'));
  container.appendChild(allBtn);

  usedTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.dataset.tag = tag;
    btn.id = `tag-${tag}`;
    btn.textContent = `# ${tag}`;
    btn.addEventListener('click', () => setTag(tag));
    container.appendChild(btn);
  });
}

function setTag(tag) {
  currentTag = tag;
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tag === tag);
  });
  renderArticles();
}

// ── Articles ─────────────────────────────────────────────────

function renderArticles() {
  const grid = document.getElementById('articles-grid');
  grid.innerHTML = '';

  let filtered = allArticles;

  // Tag filter
  if (currentTag !== 'all') {
    filtered = filtered.filter(a => (a.tags || []).includes(currentTag));
  }

  // Search filter
  if (searchQuery) {
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(searchQuery) ||
      (a.content || '').toLowerCase().includes(searchQuery) ||
      (a.tags || []).some(t => t.toLowerCase().includes(searchQuery))
    );
  }

  // Sort newest first
  filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📖</span>
        <h3>${searchQuery ? '找不到符合的日誌' : '還沒有任何日誌'}</h3>
        <p>${searchQuery ? '試試其他關鍵字吧' : '前往後台新增第一篇日誌'}</p>
      </div>`;
    return;
  }

  filtered.forEach(article => {
    grid.appendChild(createCard(article));
  });
}

function createCard(article) {
  const a = document.createElement('a');
  a.className = 'article-card';
  a.href = `post.html?id=${encodeURIComponent(article.id)}`;
  a.setAttribute('aria-label', article.title);

  const tagsHtml = (article.tags || [])
    .map(t => `<span class="tag" data-char="${t}"># ${t}</span>`)
    .join('');

  a.innerHTML = `
    <div class="card-date">📅 ${formatDate(article.date)}</div>
    <div class="card-title">${escHtml(article.title)}</div>
    <div class="card-summary">${escHtml(article.summary || '')}</div>
    <div class="card-tags">${tagsHtml}</div>
  `;
  return a;
}

// ── Utilities ────────────────────────────────────────────────

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
