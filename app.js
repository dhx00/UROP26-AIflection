const EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "disgust", "love"];
const STORAGE_KEY = "emotion_chat_by_model_v1";
const LAYOUT_PANES_KEY = "emotion_layout_panes_v2";
const RESIZE_HANDLE_PX = 9;
const PANE_MIN_TOP = 100;
const PANE_MIN_BOTTOM = 170;
const PANE_MIN_CHAT = 120;

const state = {
  currentModel: "chatgpt",
  mode: "normal",
  chats: loadChats()
};

const el = {
  modelList: document.getElementById("model-list"),
  currentModelTitle: document.getElementById("current-model-title"),
  chatWindow: document.getElementById("chat-window"),
  inputMode: document.getElementById("input-mode"),
  normalWrap: document.getElementById("normal-input-wrap"),
  dialogueWrap: document.getElementById("dialogue-input-wrap"),
  normalInput: document.getElementById("normal-input"),
  dialogueLines: document.getElementById("dialogue-lines"),
  addDialogueLine: document.getElementById("add-dialogue-line"),
  sendBtn: document.getElementById("send-btn"),
  copyLinkBtn: document.getElementById("copy-link-btn"),
  toggleQrBtn: document.getElementById("toggle-qr-btn"),
  qrWrap: document.getElementById("qr-wrap"),
  qrImage: document.getElementById("qr-image")
};

init();

function init() {
  renderModelButtons();
  ensureModelChatBucket();
  renderMessages();
  addDialogueLine("A", "");
  addDialogueLine("B", "");

  el.inputMode.addEventListener("change", onModeChange);
  el.addDialogueLine.addEventListener("click", () => addDialogueLine("A", ""));
  el.sendBtn.addEventListener("click", onSend);
  el.copyLinkBtn.addEventListener("click", onCopyLink);
  el.toggleQrBtn.addEventListener("click", onToggleQr);
  el.qrImage.src = buildQrUrl(window.location.href);
  initPaneResize();
}

function getPaneClampBounds(mainEl) {
  const h = mainEl.getBoundingClientRect().height;
  const chrome = RESIZE_HANDLE_PX * 2;
  const maxTop = Math.max(PANE_MIN_TOP, h - chrome - PANE_MIN_BOTTOM - PANE_MIN_CHAT);
  const maxBottom = Math.max(PANE_MIN_BOTTOM, h - chrome - PANE_MIN_TOP - PANE_MIN_CHAT);
  return { maxTop, maxBottom };
}

function applyPaneHeights(mainEl, topPx, bottomPx) {
  const { maxTop, maxBottom } = getPaneClampBounds(mainEl);
  const t = Math.round(Math.max(PANE_MIN_TOP, Math.min(topPx, maxTop)));
  const b = Math.round(Math.max(PANE_MIN_BOTTOM, Math.min(bottomPx, maxBottom)));
  mainEl.style.setProperty("--pane-top-h", `${t}px`);
  mainEl.style.setProperty("--pane-bottom-h", `${b}px`);
  return { t, b };
}

function initPaneResize() {
  const mainEl = document.getElementById("main-pane");
  const handleTop = document.getElementById("resize-after-top");
  const handleBot = document.getElementById("resize-before-bottom");
  if (!mainEl || !handleTop || !handleBot) return;

  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(LAYOUT_PANES_KEY) || "null");
  } catch (_e) {
    saved = null;
  }
  const top0 = typeof saved?.top === "number" ? saved.top : 260;
  const bottom0 = typeof saved?.bottom === "number" ? saved.bottom : 300;
  const applied = applyPaneHeights(mainEl, top0, bottom0);
  localStorage.setItem(LAYOUT_PANES_KEY, JSON.stringify({ top: applied.t, bottom: applied.b }));

  let active = null;
  let startY = 0;
  let startTop = 0;
  let startBottom = 0;

  function persistFromComputed() {
    const cs = getComputedStyle(mainEl);
    const t = parseFloat(cs.getPropertyValue("--pane-top-h")) || PANE_MIN_TOP;
    const b = parseFloat(cs.getPropertyValue("--pane-bottom-h")) || PANE_MIN_BOTTOM;
    const next = applyPaneHeights(mainEl, t, b);
    localStorage.setItem(LAYOUT_PANES_KEY, JSON.stringify({ top: next.t, bottom: next.b }));
  }

  function begin(which, clientY) {
    active = which;
    startY = clientY;
    const cs = getComputedStyle(mainEl);
    startTop = parseFloat(cs.getPropertyValue("--pane-top-h")) || 260;
    startBottom = parseFloat(cs.getPropertyValue("--pane-bottom-h")) || 300;
    document.body.classList.add("is-resizing-panes");
  }

  function move(clientY) {
    if (!active) return;
    const dy = clientY - startY;
    if (active === "top") {
      applyPaneHeights(mainEl, startTop + dy, startBottom);
    } else {
      // Bottom handle: drag down → grow bottom pane (boundary moves down with cursor)
      applyPaneHeights(mainEl, startTop, startBottom - dy);
    }
  }

  function end() {
    if (!active) return;
    active = null;
    document.body.classList.remove("is-resizing-panes");
    persistFromComputed();
  }

  function bindDrag(handle, which) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      begin(which, e.clientY);
      const onMove = (ev) => move(ev.clientY);
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        end();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });

    handle.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 24 : 12;
      const cs = getComputedStyle(mainEl);
      let t = parseFloat(cs.getPropertyValue("--pane-top-h")) || 260;
      let b = parseFloat(cs.getPropertyValue("--pane-bottom-h")) || 300;
      if (which === "top") {
        if (e.key === "ArrowUp") t -= step;
        else if (e.key === "ArrowDown") t += step;
        else return;
      } else {
        if (e.key === "ArrowUp") b += step;
        else if (e.key === "ArrowDown") b -= step;
        else return;
      }
      e.preventDefault();
      const next = applyPaneHeights(mainEl, t, b);
      localStorage.setItem(LAYOUT_PANES_KEY, JSON.stringify({ top: next.t, bottom: next.b }));
    });
  }

  bindDrag(handleTop, "top");
  bindDrag(handleBot, "bottom");

  window.addEventListener("resize", () => {
    persistFromComputed();
  });
}

function loadChats() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats));
}

function ensureModelChatBucket() {
  if (!state.chats[state.currentModel]) {
    state.chats[state.currentModel] = [];
  }
}

function renderModelButtons() {
  const providers = window.APP_CONFIG?.providers || {};
  el.modelList.innerHTML = "";

  Object.entries(providers).forEach(([key, cfg]) => {
    const btn = document.createElement("button");
    btn.className = `model-btn ${state.currentModel === key ? "active" : ""}`;
    btn.textContent = cfg.label;
    btn.type = "button";
    btn.addEventListener("click", () => {
      state.currentModel = key;
      ensureModelChatBucket();
      renderModelButtons();
      renderMessages();
      el.currentModelTitle.textContent = cfg.label;
    });
    el.modelList.appendChild(btn);
  });
}

function onModeChange() {
  state.mode = el.inputMode.value;
  const isNormal = state.mode === "normal";
  el.normalWrap.classList.toggle("hidden", !isNormal);
  el.dialogueWrap.classList.toggle("hidden", isNormal);
}

function addDialogueLine(speaker, text) {
  const row = document.createElement("div");
  row.className = "dialogue-line";
  row.innerHTML = `
    <select class="speaker-select">
      <option value="A" ${speaker === "A" ? "selected" : ""}>Speaker A</option>
      <option value="B" ${speaker === "B" ? "selected" : ""}>Speaker B</option>
    </select>
    <input class="line-input" placeholder="Line text..." value="${escapeHtml(text)}" />
    <button class="remove-btn" type="button">Remove</button>
  `;
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
  el.dialogueLines.appendChild(row);
}

async function onSend() {
  const userText = collectUserInput();
  if (!userText) {
    alert("Please enter some text first.");
    return;
  }

  const userMessage = {
    role: "user",
    mode: state.mode,
    content: userText
  };
  state.chats[state.currentModel].push(userMessage);
  saveChats();
  renderMessages();
  clearInput();

  const waitingMessage = {
    role: "assistant",
    content: "Analyzing..."
  };
  state.chats[state.currentModel].push(waitingMessage);
  renderMessages();

  try {
    const aiResult = await analyzeEmotionWithModel(state.currentModel, userText, state.mode);
    waitingMessage.content = aiResult.displayText;
    waitingMessage.analysis = aiResult.json;
  } catch (error) {
    waitingMessage.content = `Request failed: ${error.message}`;
  }

  saveChats();
  renderMessages();
}

function collectUserInput() {
  if (state.mode === "normal") {
    return el.normalInput.value.trim();
  }

  const rows = [...el.dialogueLines.querySelectorAll(".dialogue-line")];
  const lines = rows
    .map((row) => {
      const speaker = row.querySelector(".speaker-select").value;
      const text = row.querySelector(".line-input").value.trim();
      if (!text) return null;
      return `${speaker}: ${text}`;
    })
    .filter(Boolean);

  return lines.join("\n");
}

function clearInput() {
  if (state.mode === "normal") {
    el.normalInput.value = "";
    return;
  }

  const rows = [...el.dialogueLines.querySelectorAll(".dialogue-line")];
  rows.forEach((row, i) => {
    row.querySelector(".line-input").value = "";
    row.querySelector(".speaker-select").value = i % 2 === 0 ? "A" : "B";
  });
}

function renderMessages() {
  const messages = state.chats[state.currentModel] || [];
  el.chatWindow.innerHTML = "";

  messages.forEach((msg) => {
    const node = document.createElement("article");
    node.className = `msg ${msg.role}`;

    const role = msg.role === "assistant" ? "AI" : "You";
    node.innerHTML = `
      <div class="msg-role">${role}</div>
      <div class="msg-content">${escapeHtml(msg.content || "")}</div>
    `;

    if (msg.analysis) {
      const card = renderAnalysisCard(msg.analysis);
      node.appendChild(card);
    }
    el.chatWindow.appendChild(node);
  });

  el.chatWindow.scrollTop = el.chatWindow.scrollHeight;
}

function renderAnalysisCard(analysisJson) {
  const wrap = document.createElement("div");
  wrap.className = "analysis-card";

  const sentenceItems = Array.isArray(analysisJson.sentence_analysis)
    ? analysisJson.sentence_analysis
    : [];

  const overall = analysisJson.overall_emotion_factors || {};
  const resultSummary = analysisJson.final_result || "";
  const extra = analysisJson.extra_analysis || "";

  const sentenceHtml = sentenceItems
    .map((item, idx) => {
      const sentenceText = escapeHtml(item.sentence || `Sentence ${idx + 1}`);
      return `
        <div class="analysis-title">Sentence ${idx + 1}: ${sentenceText}</div>
        ${factorRowsHtml(item.emotion_factors || {})}
      `;
    })
    .join("");

  wrap.innerHTML = `
    ${sentenceHtml}
    <div class="analysis-title">Overall emotion factors</div>
    ${factorRowsHtml(overall)}
    <div class="analysis-title">Additional analysis</div>
    <div class="msg-content">${escapeHtml(extra)}</div>
    <div class="analysis-title">Summary</div>
    <div class="msg-content">${escapeHtml(resultSummary)}</div>
  `;

  return wrap;
}

function factorRowsHtml(factors) {
  return EMOTIONS.map((emotion) => {
    const raw = Number(factors[emotion] ?? 0);
    const val = Number.isFinite(raw) ? clamp(raw, 0, 1) : 0;
    const percent = Math.round(val * 100);
    return `
      <div class="factor-row">
        <span>${emotion}</span>
        <div class="bar"><span style="width:${percent}%"></span></div>
        <span>${val.toFixed(2)}</span>
      </div>
    `;
  }).join("");
}

async function analyzeEmotionWithModel(modelKey, userInput, mode) {
  const cfg = window.APP_CONFIG.providers[modelKey];
  if (!cfg) throw new Error(`Provider not configured: ${modelKey}`);

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: modelKey,
      mode,
      userInput,
      model: cfg.model
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const json = normalizeAnalysisJson(data?.analysis || {});
  if (!json) {
    throw new Error("Model output was not valid JSON. Retry or switch models.");
  }

  return {
    json,
    displayText: "Analysis complete (per sentence + overall)."
  };
}

function normalizeAnalysisJson(raw) {
  const out = {
    sentence_analysis: [],
    overall_emotion_factors: emptyFactors(),
    extra_analysis: String(raw?.extra_analysis || ""),
    final_result: String(raw?.final_result || "")
  };

  if (Array.isArray(raw?.sentence_analysis)) {
    out.sentence_analysis = raw.sentence_analysis.map((item) => ({
      sentence: String(item?.sentence || ""),
      emotion_factors: normalizeFactors(item?.emotion_factors || {})
    }));
  }

  out.overall_emotion_factors = normalizeFactors(raw?.overall_emotion_factors || {});
  return out;
}

function normalizeFactors(input) {
  const factors = {};
  EMOTIONS.forEach((emotion) => {
    factors[emotion] = clamp(Number(input?.[emotion] ?? 0), 0, 1);
  });
  return factors;
}

function emptyFactors() {
  return normalizeFactors({});
}

function clamp(val, min, max) {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function onCopyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("URL copied to clipboard.");
  } catch (_e) {
    alert("Could not copy. Copy the address from the browser bar manually.");
  }
}

function onToggleQr() {
  const isHidden = el.qrWrap.classList.contains("hidden");
  el.qrWrap.classList.toggle("hidden", !isHidden);
  el.toggleQrBtn.textContent = isHidden ? "Hide QR code" : "Show QR code";
}

function buildQrUrl(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
}
