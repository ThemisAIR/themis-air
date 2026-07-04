// ============================================================
//  Themis AIR — Post Detail Page (post.js)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const root = document.getElementById('post-root');

  if (!id) { renderNotFound(root); return; }

  const article = getArticleById(id);
  if (!article) { renderNotFound(root); return; }

  document.title = `${article.title} — Themis AIR`;
  if (typeof marked !== 'undefined') marked.setOptions({ breaks: true, gfm: true });

  await renderPost(root, article);
});

async function renderPost(root, article) {
  const tagsHtml = (article.tags || [])
    .map(t => `<span class="tag" data-char="${t}"># ${t}</span>`)
    .join('');

  // 先從 IndexedDB 還原圖片參照，再產生 HTML
  const resolvedContent = await resolveImageRefs(article.content || '');
  const contentHtml = typeof marked !== 'undefined'
    ? marked.parse(resolvedContent)
    : `<pre>${escHtml(resolvedContent)}</pre>`;

  root.innerHTML = `
    <a href="index.html" class="post-back">← 返回日誌列表</a>

    <article>
      <header class="post-header">
        <div class="post-date">📅 ${formatDate(article.date)}</div>
        <h1 class="post-title">${escHtml(article.title)}</h1>
        <div class="post-tags">${tagsHtml}</div>
      </header>

      <div class="post-content" id="post-body">
        ${contentHtml}
      </div>

      <div class="post-actions" id="post-actions">
        <a href="admin.html?edit=${encodeURIComponent(article.id)}" class="btn btn-primary" id="btn-edit">
          ✏️ 編輯此篇
        </a>
        <button class="btn btn-danger" id="btn-delete" onclick="confirmDelete('${article.id}')">
          🗑 刪除
        </button>
        <a href="index.html" class="btn btn-secondary">← 回列表</a>
      </div>
    </article>
  `;
}

function renderNotFound(root) {
  root.innerHTML = `
    <a href="index.html" class="post-back">← 返回日誌列表</a>
    <div class="empty-state" style="margin-top:3rem">
      <span class="empty-icon">🔍</span>
      <h3>找不到這篇日誌</h3>
      <p>它可能已被刪除，或連結有誤</p>
    </div>
  `;
}

function confirmDelete(id) {
  // Build a nice confirm dialog
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog-box">
      <h4>確定要刪除嗎？</h4>
      <p>這個動作無法復原，該篇日誌將永久消失。</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary btn-sm" id="dialog-cancel">取消</button>
        <button class="btn btn-danger btn-sm" id="dialog-confirm">確定刪除</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('dialog-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('dialog-confirm').addEventListener('click', () => {
    deleteArticle(id);
    overlay.remove();
    showToast('日誌已刪除', 'info');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
