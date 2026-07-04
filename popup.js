"use strict";

const DEFAULTS = {
  active: true, // master on/off
  page: true,
  section: true,
  block: true,
  feblock: false,
  image: false,
};

// Plain-language rows. `hint` shows the exact selector/text it copies.
const LAYERS = [
  { key: "page", name: "Page ID", hint: "#collection-…" },
  { key: "section", name: "Section IDs", hint: '[data-section-id="…"]' },
  { key: "block", name: "Block IDs", hint: "#block-…" },
  { key: "feblock", name: "Block class names", hint: ".fe-block-…" },
  { key: "image", name: "Image URLs", hint: "image file links" },
];

const $ = (sel) => document.querySelector(sel);

async function getState() {
  const { sqsfState } = await chrome.storage.local.get("sqsfState");
  return { ...DEFAULTS, ...(sqsfState || {}) };
}
async function setState(state) {
  await chrome.storage.local.set({ sqsfState: state });
}

function showNotice(msg) {
  const n = $("#notice");
  n.textContent = msg;
  n.hidden = false;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Toolbar badge: a small dot whenever IDs are being shown on this tab.
async function setBadge(tabId, on) {
  if (tabId == null) return;
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#2b6ef2" });
    await chrome.action.setBadgeText({ tabId, text: on ? "●" : "" });
  } catch (_) {}
}

// Make sure the overlay script + styles are present on the page.
async function injectOverlay(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
  return res && res.result; // { isSqsp, pageId }
}

function reflectMaster(state) {
  $("#masterToggle").checked = state.active !== false;
  $("#masterState").textContent = state.active !== false ? "On" : "Off";
  document.body.classList.toggle("master-off", state.active === false);
}

function buildToggles(state) {
  const ul = $("#toggles");
  ul.textContent = "";
  for (const layer of LAYERS) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    label.className = "toggle";

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = layer.name;
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = layer.hint;
    meta.append(name, hint);

    const sw = document.createElement("span");
    sw.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!state[layer.key];
    input.dataset.key = layer.key;
    const track = document.createElement("span");
    track.className = "track";
    sw.append(input, track);

    input.addEventListener("change", async () => {
      state[layer.key] = input.checked;
      await setState(state);
    });

    label.append(meta, sw);
    li.append(label);
    ul.append(li);
  }
}

const ICON_COPY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

async function copyAndFlash(el, value, flashText, flashSel) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (_) {}
  el.classList.add("copied");
  let restore = null;
  if (flashSel) {
    const target = el.querySelector(flashSel);
    if (target) {
      const old = target.textContent;
      target.textContent = flashText;
      restore = () => (target.textContent = old);
    }
  }
  setTimeout(() => {
    el.classList.remove("copied");
    if (restore) restore();
  }, 1000);
}

function makeFontRow(label, name, family, copyValue) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.className = "font-btn";
  btn.title = `Copy “${name}”` + (family ? `  (${family})` : "");
  const role = document.createElement("span");
  role.className = "role";
  role.textContent = label;
  const fname = document.createElement("span");
  fname.className = "fname";
  fname.textContent = name;
  btn.append(role, fname);
  btn.addEventListener("click", () =>
    copyAndFlash(btn, copyValue, "✓ Copied!", ".fname")
  );
  li.append(btn);
  return li;
}

function renderTheme(theme) {
  if (!theme) return;
  const wrap = $("#theme");
  let any = false;

  const sw = $("#swatches");
  sw.textContent = "";
  (theme.colors || []).forEach((c) => {
    any = true;
    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.title = `${c.name} — copy ${c.hex}`;

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.background = c.hex;
    const hint = document.createElement("span");
    hint.className = "chip-overlay chip-hint";
    hint.innerHTML = ICON_COPY;
    const check = document.createElement("span");
    check.className = "chip-overlay chip-check";
    check.innerHTML = ICON_CHECK;
    chip.append(hint, check);

    const hex = document.createElement("span");
    hex.className = "hex";
    hex.textContent = c.hex;

    btn.append(chip, hex);
    btn.addEventListener("click", () =>
      copyAndFlash(btn, c.hex, "Copied!", ".hex")
    );
    sw.append(btn);
  });

  const fl = $("#fonts");
  fl.textContent = "";
  (theme.fonts || []).forEach((f) => {
    any = true;
    fl.append(makeFontRow(f.role, f.name, f.family, f.name));
  });

  // custom fonts (detected in use, beyond the theme fonts)
  const cw = $("#customFontsWrap");
  const cl = $("#customFonts");
  cl.textContent = "";
  const customs = theme.customFonts || [];
  if (customs.length) {
    any = true;
    customs.forEach((f) => {
      const li = makeFontRow(f.loaded ? "In use" : "Loaded", f.name, "", f.name);
      if (f.loaded) {
        const dot = document.createElement("span");
        dot.className = "dot-loaded";
        li.querySelector(".font-btn").append(dot);
      }
      cl.append(li);
    });
    cw.hidden = false;
  } else {
    cw.hidden = true;
  }

  if (any) wrap.hidden = false;
}

function wirePageCopy(pageId) {
  const row = $("#pageRow");
  const btn = $("#pageCopy");
  const idEl = $("#pageId");
  const value = "#collection-" + pageId;
  idEl.textContent = value;
  row.hidden = false;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) {}
    btn.classList.add("done");
    const hint = btn.querySelector(".copy-hint");
    const old = hint.textContent;
    hint.textContent = "Copied!";
    setTimeout(() => {
      btn.classList.remove("done");
      hint.textContent = old;
    }, 1000);
  });
}

async function main() {
  const state = await getState();
  reflectMaster(state);
  buildToggles(state);

  const tab = await activeTab();

  // Master switch: flips the whole overlay on/off and updates the badge.
  $("#masterToggle").addEventListener("change", async (e) => {
    state.active = e.target.checked;
    await setState(state);
    reflectMaster(state);
    if (tab) setBadge(tab.id, state.active);
  });

  if (!tab || !/^https?:/.test(tab.url || "")) {
    showNotice("Open a Squarespace website to use this.");
    return;
  }

  let status;
  try {
    status = await injectOverlay(tab.id);
  } catch (e) {
    showNotice("This page can't be inspected (try a normal Squarespace page).");
    return;
  }

  if (!status || !status.isSqsp) {
    showNotice("This doesn't look like a Squarespace page — no IDs found.");
    setBadge(tab.id, false);
    return;
  }

  if (status.pageId) wirePageCopy(status.pageId);
  renderTheme(status.theme);
  setBadge(tab.id, state.active !== false);
}

main();
