// ============================================================
//  Themis AIR — Data Management (localStorage)
// ============================================================

const DB_KEY = 'themisair_articles';

const DEFAULT_TAGS = ['夏彥', '左然', '莫弈', '陸景和', '活動', '思緒', '主線', 'ThemisAIR'];

// Sample articles so the site isn't empty on first load
const SAMPLE_ARTICLES = [
  {
    id: 'sample-1',
    title: '夏彥路線第一章通關——律法之外，人情之內',
    date: '2026-06-28',
    tags: ['夏彥', '主線'],
    content: `# 夏彥路線第一章通關

今天終於把夏彥的第一章跑完了，感想比預期複雜很多。

## 劇情印象

夏彥這個角色乍看之下冷淡，但隨著劇情推進，他對真相的執著讓我覺得很有共鳴。有一幕他獨自在辦公室看案件資料的場景，背景音樂配得恰到好處，整個氛圍就到位了。

> 「律法是底線，不是上限。」

這句台詞印象超深刻，之後應該會回想很多次。

## 推理環節

這章的推理謎題難度適中，沒有卡太久。有個現場還原的部分設計得很聰明，需要注意環境細節才能找到關鍵線索。

## 心得總結

- 人物塑造細膩，情緒層次豐富
- BGM 選曲完美，氣氛帶得很好
- 期待看到更多夏彥的過去背景故事

下次目標：解鎖夏彥第二章的記憶碎片。`,
  },
  {
    id: 'sample-2',
    title: '深夜思緒——為什麼我喜歡未定的故事敘事方式',
    date: '2026-07-01',
    tags: ['思緒', 'ThemisAIR'],
    content: `# 深夜思緒

最近熬夜玩了好幾個小時，腦袋停不下來，就來寫點感想。

## 關於敘事節奏

未定最厲害的地方在於它不急。它讓你慢慢認識每個角色，而不是一開始就把所有背景資訊塞給你。這種漸進式的揭露讓我每次開啟遊戲都有新的期待感。

## 關於選項設計

大多數選項並不是「好結局/壞結局」的二元對立，而是讓你選擇以什麼**態度**去面對一個情境。這讓我覺得自己真的在做選擇，而不只是在找「正確答案」。

## 雜想

有時候在日常中突然會想到某個劇情片段，然後會有一種「啊，原來那個場景是在說這個」的後知後覺感。

這種餘韻是很難得的。

---

*繼續努力刷好感度中...*`,
  },
  {
    id: 'sample-3',
    title: '【活動紀錄】律師事務所支線任務攻略',
    date: '2026-07-03',
    tags: ['左然', '活動'],
    content: `# 律師事務所支線任務攻略

最近跑了左然的活動支線，記錄一下流程和注意事項。

## 觸發條件

- 好感度需達到 Lv.5 以上
- 完成主線第三章後解鎖

## 任務流程

### 第一段：接受委託

前往律師事務所，與左然對話。這段劇情比較輕鬆，主要建立背景。

**推薦選項：**
- 選擇「我相信你的判斷」（+10 好感）
- 不要選「這件事我不確定」（-5 好感）

### 第二段：現場調查

需要在時限內找到三個關鍵線索：

1. 辦公桌上的合約文件（右側抽屜）
2. 監視器盲區的地板痕跡
3. 廁所外走廊的氣味描述

### 第三段：法庭辯護

這段是整個支線的高潮，需要正確選擇三輪的反駁論點。

**第一輪：** 選「時間線矛盾」
**第二輪：** 選「目擊者證詞漏洞」
**第三輪：** 選「現場物證不符」

## 最終獎勵

- 左然限定語音 ×3
- 親密道具「律師事務所鑰匙圈」
- 記憶碎片解鎖

---

整體難度不高，但法庭辯護那段如果選錯會卡關，要注意。`,
  },
];

// ------------------------------------------------------------------
//  Core functions
// ------------------------------------------------------------------

function getAllArticles() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null; // null = never initialized
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function initDB() {
  const existing = getAllArticles();
  if (existing === null) {
    // First time: seed with sample articles
    const seeded = SAMPLE_ARTICLES.map(a => ({
      ...a,
      summary: generateSummary(a.content),
    }));
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return existing;
}

function getArticles() {
  const data = getAllArticles();
  if (data === null) return initDB();
  return data;
}

function saveArticles(articles) {
  localStorage.setItem(DB_KEY, JSON.stringify(articles));
}

function getArticleById(id) {
  return getArticles().find(a => a.id === id) || null;
}

function saveArticle(article) {
  const articles = getArticles();
  const idx = articles.findIndex(a => a.id === article.id);
  const now = Date.now();

  article.summary = generateSummary(article.content);

  if (idx >= 0) {
    articles[idx] = { ...articles[idx], ...article, updatedAt: now };
  } else {
    articles.unshift({ ...article, id: article.id || String(now), createdAt: now });
  }
  saveArticles(articles);
  return article;
}

function deleteArticle(id) {
  const articles = getArticles().filter(a => a.id !== id);
  saveArticles(articles);
}

// ------------------------------------------------------------------
//  Helpers
// ------------------------------------------------------------------

function generateSummary(content = '', maxLen = 120) {
  const stripped = content
    .replace(/!\[[^\]]*\]\(idb:\/\/[^)]+\)/g, '[\u5716\u7247]')  // strip IDB refs
    .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[\u5716\u7247]')       // strip base64
    .replace(/#+\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '\u2026' : stripped;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getAllTags() {
  const articles = getArticles();
  const used = new Set(articles.flatMap(a => a.tags || []));
  // merge with default tags
  DEFAULT_TAGS.forEach(t => used.add(t));
  return [...used];
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ------------------------------------------------------------------
//  IndexedDB — Image Storage
//  圖片 base64 存 IndexedDB（容量遠大於 localStorage）
//  文章內容用 idb://IMGID 參照，顯示時自動还原
// ------------------------------------------------------------------

const IDB_NAME = 'themisair_idb';
let _idb = null;

function _openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('images');
    req.onsuccess  = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror    = () => reject(req.error);
  });
}

async function storeImageIDB(id, dataUrl) {
  const db = await _openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite');
    tx.objectStore('images').put(dataUrl, id);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function loadImageIDB(id) {
  const db = await _openIDB();
  return new Promise(resolve => {
    const req = db.transaction('images').objectStore('images').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => resolve(null);
  });
}

function genImgId() {
  return 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// 把文章內 idb://ID 參照全部還原為實際 base64 dataUrl
async function resolveImageRefs(content) {
  if (!content || !content.includes('idb://')) return content;
  const ids = [...new Set([...content.matchAll(/\(idb:\/\/([^)]+)\)/g)].map(m => m[1]))];
  const pairs = await Promise.all(ids.map(async id => [id, await loadImageIDB(id)]));
  const map = Object.fromEntries(pairs);
  return content.replace(/\(idb:\/\/([^)]+)\)/g, (_, id) =>
    map[id] ? `(${map[id]})` : `(idb://${id})`
  );
}

// ------------------------------------------------------------------
//  Toast helper (used across pages)
// ------------------------------------------------------------------

function showToast(message, type = 'success', duration = 3000) {
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
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}
