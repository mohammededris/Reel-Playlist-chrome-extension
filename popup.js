const QUEUE_KEY = "reelsQueue";
const TAB_KEY = "viewerTabId";

// Helpers for chrome.storage.local using Promises
function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function setStorage(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

async function getQueue() {
  const res = await getStorage([QUEUE_KEY]);
  return res[QUEUE_KEY] || [];
}
async function setQueue(q) {
  await setStorage({ [QUEUE_KEY]: q });
}

async function getViewerTabId() {
  const res = await getStorage([TAB_KEY]);
  return res[TAB_KEY];
}
async function setViewerTabId(id) {
  await setStorage({ [TAB_KEY]: id });
}

function normalizeUrl(url) {
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function renderQueue(items) {
  const ul = document.getElementById("queue");
  ul.innerHTML = "";
  items.forEach((u, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${u}`;
    ul.appendChild(li);
  });
}

async function refreshUI() {
  const q = await getQueue();
  renderQueue(q);
}

async function createOrUpdateViewerTab(url) {
  let tabId = await getViewerTabId();
  if (tabId != null) {
    try {
      // check if tab still exists
      chrome.tabs.get(tabId, function (tab) {
        if (chrome.runtime.lastError || !tab) {
          tabId = null;
          createTab();
        } else {
          chrome.tabs.update(tabId, { url });
          chrome.tabs.update(tabId, { active: true });
        }
      });
    } catch (e) {
      tabId = null;
      await createTab();
    }
  } else {
    await createTab();
  }

  async function createTab() {
    chrome.tabs.create({ url }, function (tab) {
      if (tab && tab.id != null) setViewerTabId(tab.id);
    });
  }
}

async function loadCurrent() {
  const q = await getQueue();
  if (!q || q.length === 0) {
    alert("Queue is empty. Add a reel URL first.");
    return;
  }
  const url = q[0];
  await createOrUpdateViewerTab(url);
}

async function next() {
  const q = await getQueue();
  if (!q || q.length === 0) return;
  if (q.length === 1) {
    // single item: reload same
    await loadCurrent();
    return;
  }
  // rotate
  q.push(q.shift());
  await setQueue(q);
  renderQueue(q);
  await loadCurrent();
}

async function addUrlFromInput() {
  const input = document.getElementById("urlInput");
  let url = input.value;
  if (!url) return;
  url = normalizeUrl(url);
  const q = await getQueue();
  q.push(url);
  await setQueue(q);
  input.value = "";
  renderQueue(q);
}

async function importJsonFile(file) {
  const status = document.getElementById("importStatus");
  status.textContent = "Importing...";
  try {
    const text = await file.text();
    let data = JSON.parse(text);
    // Accept either an array of urls or an object with common keys
    let urls = [];
    if (Array.isArray(data)) {
      // Array may contain strings or objects like { url: '...' }
      urls = data
        .map((item) => {
          if (!item && item !== 0) return "";
          if (typeof item === "string") return item.trim();
          if (typeof item === "object") {
            // prefer common keys
            return (item.url || item.link || item.href || "") + "";
          }
          return String(item).trim();
        })
        .map((u) => (u || "").toString().trim())
        .filter(Boolean);
    } else if (data && typeof data === "object") {
      // Try common keys when the file is an object
      if (Array.isArray(data.urls)) urls = data.urls.map(String);
      else if (Array.isArray(data.list)) urls = data.list.map(String);
      else if (Array.isArray(data.items)) urls = data.items.map(String);
      else {
        // Maybe it's an object with numeric keys
        const maybe = Object.values(data).filter(
          (v) => typeof v === "string" || Array.isArray(v)
        );
        if (maybe.length && Array.isArray(maybe[0])) {
          urls = maybe[0].map(String);
        }
      }
    }
    urls = urls.map(normalizeUrl).filter(Boolean);
    if (urls.length === 0) {
      status.textContent = "No URLs found in JSON.";
      return;
    }
    const q = await getQueue();
    // Append but avoid duplicates (simple)
    const set = new Set(q);
    const added = [];
    for (const u of urls) {
      if (!set.has(u)) {
        q.push(u);
        set.add(u);
        added.push(u);
      }
    }
    await setQueue(q);
    renderQueue(q);
    status.textContent = `Imported ${added.length} URLs.`;
  } catch (e) {
    console.error(e);
    status.textContent = "Failed to parse JSON.";
  }
  setTimeout(() => {
    status.textContent = "";
  }, 3000);
}

async function clearQueue() {
  await setQueue([]);
  renderQueue([]);
}

// DOM wiring
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addBtn").addEventListener("click", addUrlFromInput);
  document
    .getElementById("openViewerBtn")
    .addEventListener("click", loadCurrent);
  document.getElementById("nextBtn").addEventListener("click", next);
  document.getElementById("clearBtn").addEventListener("click", clearQueue);
  // Import JSON wiring
  const importBtn = document.getElementById("importBtn");
  const jsonFileInput = document.getElementById("jsonFileInput");
  if (importBtn && jsonFileInput) {
    importBtn.addEventListener("click", () => jsonFileInput.click());
    jsonFileInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importJsonFile(f);
      // clear input so same file can be re-imported later if needed
      e.target.value = "";
    });
  }
  refreshUI();
  // allow enter key in input
  document.getElementById("urlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addUrlFromInput();
  });
});
