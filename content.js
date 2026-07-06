(() => {
  "use strict";

  const ROOT_ID = "__sqsfRoot__";
  const SECTION_ID_RE = /^[0-9a-f]{24}$/; // real Squarespace section ids only
  const DEFAULTS = {
    active: true, // master on/off — hides everything when false
    page: true,
    section: true,
    block: true,
    feblock: false,
    image: false,
    sectiontheme: false, // section colour-theme labels
    contrast: false, // WCAG contrast badges
    colorFormat: "hex", // palette copy format: hex | rgb | hsl
  };

  // ---- helpers ------------------------------------------------------------

  function getPageId() {
    const b = document.body && document.body.id;
    if (b && /^collection-/.test(b)) return b.slice("collection-".length);
    const dc = document.querySelector("[data-collection-id]");
    if (dc && dc.getAttribute("data-collection-id")) {
      return dc.getAttribute("data-collection-id");
    }
    const el = document.querySelector('[id^="collection-"]');
    if (el) return el.id.slice("collection-".length);
    return null;
  }

  function cleanImageUrl(img) {
    const raw =
      img.getAttribute("data-src") || img.currentSrc || img.src || "";
    return raw.split("?")[0];
  }

  function isSquarespacePage() {
    return !!(
      document.querySelector("[data-section-id]") ||
      document.querySelector('[id^="block-"]') ||
      getPageId()
    );
  }

  // Returns the element's viewport rect IF it is genuinely visible right now
  // (not display:none, visibility:hidden, opacity:0 on it or an ancestor, not
  // zero-size, and at least partly inside the viewport). Otherwise null — so a
  // label only appears once its element is actually shown (tab click, hover
  // reveal, accordion open, scroll-in animation, …).
  function visibleRect(el) {
    if (
      el.checkVisibility &&
      !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    ) {
      return null;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    if (
      r.bottom <= 0 ||
      r.top >= window.innerHeight ||
      r.right <= 0 ||
      r.left >= window.innerWidth
    ) {
      return null;
    }
    return r;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_) {}
      ta.remove();
      return ok;
    }
  }

  // ---- site theme (palette + fonts) --------------------------------------

  function hslToRgb(hslStr) {
    const p = hslStr.split(",").map((x) => parseFloat(x));
    if (p.length < 3 || p.some(isNaN)) return null;
    const h = p[0],
      s = p[1] / 100,
      l = p[2] / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }
  function rgbToHex([r, g, b]) {
    const t = (v) => ("0" + Math.round(v).toString(16)).slice(-2);
    return "#" + t(r) + t(g) + t(b);
  }
  function fmtHsl(hslStr) {
    const p = hslStr.split(",").map((x) => parseFloat(x));
    return `hsl(${Math.round(p[0])}, ${Math.round(p[1])}%, ${Math.round(p[2])}%)`;
  }

  // Squarespace stores its 5-colour palette and the theme fonts as CSS custom
  // properties. Read them straight off the page.
  function readTheme() {
    const cs = getComputedStyle(document.body);
    const g = (n) => cs.getPropertyValue(n).trim();

    const colors = [];
    [
      ["White", "white"],
      ["Black", "black"],
      ["Light accent", "lightAccent"],
      ["Dark accent", "darkAccent"],
      ["Accent", "accent"],
    ].forEach(([name, key]) => {
      const hsl = g("--" + key + "-hsl");
      const rgb = hsl && hslToRgb(hsl);
      if (rgb) {
        colors.push({
          name,
          hex: rgbToHex(rgb),
          rgb: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
          hsl: fmtHsl(hsl),
        });
      }
    });

    const fonts = [];
    [
      ["Heading", ["--heading-font-font-family"]],
      ["Body", ["--body-font-font-family"]],
      // Squarespace's "Miscellaneous" font drives meta / buttons / navigation.
      [
        "Miscellaneous",
        [
          "--meta-font-font-family",
          "--button-font-font-family",
          "--navigation-font-font-family",
        ],
      ],
    ].forEach(([role, vars]) => {
      let family = "";
      for (const v of vars) {
        family = g(v);
        if (family) break;
      }
      if (family) {
        const primary = family.split(",")[0].replace(/["']/g, "").trim();
        fonts.push({ role, name: primary, family });
      }
    });

    return { colors, fonts, customFonts: detectCustomFonts(fonts) };
  }

  // Fonts actually loaded on the page (via the FontFaceSet API — works even for
  // cross-origin @font-face) that aren't the assigned theme fonts or one of
  // Squarespace's system/icon fonts. These are the "extra" fonts added on top,
  // e.g. via Custom CSS / code injection or an uploaded font used directly.
  const SYSTEM_FONTS =
    /^(squarespace-ui-font|social-icon-font|swiper-icons|sqs-.*|.*[-\s]icons?|fontawesome|font\s?awesome.*|ionicons|dashicons|material\s?icons.*|genericons|slick|revicons)$/i;

  function detectCustomFonts(themeFonts) {
    const theme = new Set(
      themeFonts.map((f) => f.name.toLowerCase())
    );
    const map = new Map();
    try {
      document.fonts.forEach((face) => {
        const fam = (face.family || "").replace(/["']/g, "").trim();
        if (!fam || SYSTEM_FONTS.test(fam)) return;
        if (theme.has(fam.toLowerCase())) return;
        const cur = map.get(fam) || { name: fam, loaded: false };
        if (face.status === "loaded") cur.loaded = true;
        map.set(fam, cur);
      });
    } catch (_) {}
    // Loaded (in-use) fonts first.
    return [...map.values()].sort((a, b) => b.loaded - a.loaded);
  }

  // ---- section colour theme + WCAG contrast ------------------------------

  function relLuminance([r, g, b]) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrastRatio(c1, c2) {
    const l1 = relLuminance(c1),
      l2 = relLuminance(c2);
    const hi = Math.max(l1, l2),
      lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Parse any CSS colour string (rgb/rgba/hsl/hsla/hex) to [r,g,b], or null if
  // fully transparent / unparseable.
  function parseColor(str) {
    if (!str) return null;
    str = str.trim();
    let m = str.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const p = m[1].split(",").map((x) => parseFloat(x));
      if (p.length >= 4 && p[3] === 0) return null;
      return [p[0], p[1], p[2]];
    }
    m = str.match(/hsla?\(([^)]+)\)/i);
    if (m) {
      const p = m[1].split(",").map((x) => parseFloat(x));
      if (p.length >= 4 && p[3] === 0) return null;
      return hslToRgb(`${p[0]},${p[1]}%,${p[2]}%`);
    }
    m = str.match(/^#([0-9a-f]{6})$/i);
    if (m)
      return [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16));
    m = str.match(/^#([0-9a-f]{3})$/i);
    if (m)
      return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16));
    return null;
  }

  // Squarespace section backgrounds (images/videos) live in a `.section-background`
  // layer — text over media can't be judged from CSS, so detect + skip it.
  function sectionHasMediaBg(sec) {
    const sb = sec.querySelector(".section-background");
    if (!sb) return false;
    if (sb.querySelector("img,video,canvas,svg")) return true;
    const bi = getComputedStyle(sb).backgroundImage;
    return !!(bi && bi !== "none");
  }

  // The section colour theme's own text colour vs background colour — the
  // authoritative pair for "is this theme readable". Text = the section's
  // computed `color`; background = the theme's `--siteBackgroundColor` variable.
  // Skips sections whose visible background is media.
  function sectionThemeColors(sec) {
    if (sectionHasMediaBg(sec)) return null;
    const cs = getComputedStyle(sec);
    const text = parseColor(cs.color);
    const bg = parseColor(cs.getPropertyValue("--siteBackgroundColor"));
    if (!text || !bg) return null;
    return { text, bg };
  }

  function makeSwatch(hex, title) {
    const s = document.createElement("span");
    s.className = "sqsf-mini-sw";
    s.style.background = hex;
    s.title = title + ": " + hex;
    return s;
  }

  function makeLabel(tag, value) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sqsf-label";
    el.title = "Click to copy:  " + value;

    const t = document.createElement("span");
    t.className = "sqsf-tag";
    t.textContent = tag;

    const v = document.createElement("span");
    v.className = "sqsf-val";
    v.textContent = value;

    el.append(t, v);

    el.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ok = await copyText(value);
      // Pin the label where it is for the duration of the flash so its position
      // can't be re-clamped when the text width changes (reposition() skips
      // frozen nodes). The "Copied!" text keeps its own natural width — no shift,
      // no empty space, no re-expansion when the value returns.
      if (el._sqsfTimer) clearTimeout(el._sqsfTimer);
      el.dataset.sqsfFrozen = "1";
      el.classList.add(ok ? "sqsf-copied" : "sqsf-failed");
      v.textContent = ok ? "Copied!" : "Copy failed";
      el._sqsfTimer = setTimeout(() => {
        el.classList.remove("sqsf-copied", "sqsf-failed");
        v.textContent = value; // always restore the true value, never a stale label
        delete el.dataset.sqsfFrozen;
        el._sqsfTimer = null;
      }, 1000);
    });

    return el;
  }

  // ---- the overlay --------------------------------------------------------

  class Finder {
    constructor() {
      this.items = []; // { el|null, node, layer, yOff, pairLeft }
      this.raf = false;
      this.state = { ...DEFAULTS };
    }

    init() {
      this.root = document.createElement("div");
      this.root.id = ROOT_ID;
      document.documentElement.appendChild(this.root);

      this.hl = document.createElement("div");
      this.hl.className = "sqsf-highlight";
      this.hl.style.display = "none";
      this.root.appendChild(this.hl);

      this.build();

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.sqsfState) {
          this.render(changes.sqsfState.newValue);
        }
      });

      // Re-check positions AND visibility on anything that can reveal content.
      const bump = () => this.requestReposition();
      window.addEventListener("scroll", bump, true);
      window.addEventListener("resize", bump, true);
      document.addEventListener("mouseover", bump, true); // hover reveals
      document.addEventListener("click", bump, true); // tab switches
      document.addEventListener("transitionend", bump, true);
      document.addEventListener("animationend", bump, true);
      this.interval = setInterval(bump, 700); // safety net

      chrome.storage.local.get("sqsfState").then(({ sqsfState }) => {
        this.render(sqsfState);
      });
    }

    add(targetEl, layer, tag, value, yOff = 0) {
      const node = makeLabel(tag, value);
      this.root.appendChild(node);
      const item = { el: targetEl, node, layer, yOff, value, pairLeft: null };
      this.items.push(item);
      if (targetEl) {
        node.addEventListener("mouseenter", () => this.showHighlight(targetEl));
        node.addEventListener("mouseleave", () => this.hideHighlight());
      }
      return item;
    }

    build() {
      // Page — pinned to the top of the page content (scrolls away, not sticky).
      const pid = getPageId();
      if (pid) this.add(document.body, "page", "PAGE", "#collection-" + pid);

      // Sections — the data-section-id label must only ever describe a real
      // <section> element, never some other node that also carries the
      // attribute (e.g. the nested <ul> that "user items list" sections stamp
      // with the same data-section-id). So we scan only <section> elements and
      // require a genuine 24-hex id. If the section also has a custom id (set in
      // the editor), show it as a second box to the left:
      //   [ ID #first-section ] [ SECTION [data-section-id="…"] ]
      const seenSections = new Set();
      document.querySelectorAll("section[data-section-id]").forEach((el) => {
        const id = el.getAttribute("data-section-id");
        if (!id || !SECTION_ID_RE.test(id)) return;
        // Guard against the same id appearing on more than one <section>.
        if (seenSections.has(id)) return;
        seenSections.add(id);
        let custom = null;
        // Show the editor-set section id, but skip framework runtime ids that
        // carry a long hex hash (e.g. Swiper's `swiper-wrapper-a1b2…`) — those
        // are auto-generated and not reusable selectors.
        if (el.id && !/[0-9a-f]{12,}/i.test(el.id)) {
          custom = this.add(el, "section", "ID", "#" + el.id);
        }
        const data = this.add(
          el,
          "section",
          "SECTION",
          `[data-section-id="${id}"]`
        );
        data.pairLeft = custom;

        // Section colour theme (off by default): the theme name Squarespace
        // stores on the section, plus swatches for its background + text colour.
        const themeName = el.getAttribute("data-section-theme");
        const tc = sectionThemeColors(el);
        const themeItem = this.add(
          el,
          "sectiontheme",
          "THEME",
          themeName || "—",
          26
        );
        if (tc) {
          themeItem.node.append(makeSwatch(rgbToHex(tc.bg), "background"));
          themeItem.node.append(makeSwatch(rgbToHex(tc.text), "text"));

          // WCAG contrast badge (off by default) — the theme's body text on its
          // background, using normal-text thresholds (AA≥4.5, AAA≥7). "PASS" =
          // meets AA (the baseline requirement).
          const ratio = contrastRatio(tc.text, tc.bg);
          const aa = ratio >= 4.5,
            aaa = ratio >= 7;
          const label = `${aa ? "PASS" : "FAIL"} · ${ratio.toFixed(
            1
          )}:1 · AA ${aa ? "✓" : "✗"} AAA ${aaa ? "✓" : "✗"}`;
          const cItem = this.add(el, "contrast", "CONTRAST", label, 52);
          cItem.node.classList.add(aa ? "sqsf-pass" : "sqsf-fail");
        }
      });

      // Blocks + their Fluid-Engine class (`.fe-<blockId>`, on the parent).
      document.querySelectorAll('[id^="block-"]').forEach((el) => {
        const id = el.id;
        if (!id) return;
        this.add(el, "block", "BLOCK", "#" + id);
        this.add(el, "feblock", "CLASS", ".fe-" + id, 24);
      });

      // Squarespace-CDN images.
      const seen = new Set();
      document.querySelectorAll("img").forEach((img) => {
        const url = cleanImageUrl(img);
        if (!url || !/squarespace-cdn|images\.squarespace/.test(url)) return;
        const key = url + Math.round(img.getBoundingClientRect().top);
        if (seen.has(key)) return;
        seen.add(key);
        this.add(img, "image", "IMAGE", url);
      });
    }

    render(state) {
      this.state = { ...DEFAULTS, ...(state || {}) };
      const master = this.state.active !== false;
      for (const it of this.items) it.on = master && !!this.state[it.layer];
      this.reposition();
    }

    showHighlight(el) {
      const r = el.getBoundingClientRect();
      Object.assign(this.hl.style, {
        display: "block",
        left: r.left + "px",
        top: r.top + "px",
        width: r.width + "px",
        height: r.height + "px",
      });
    }
    hideHighlight() {
      this.hl.style.display = "none";
    }

    requestReposition() {
      if (this.raf) return;
      this.raf = true;
      requestAnimationFrame(() => this.reposition());
    }

    reposition() {
      this.raf = false;
      const vw = window.innerWidth;
      for (const it of this.items) {
        if (!it.on) {
          it.node.style.display = "none";
          continue;
        }

        // While a copy flash is showing, leave the label exactly where it is so
        // the text swap can't move it. It stays visible; position resumes after.
        if (it.node.dataset.sqsfFrozen) {
          it.node.style.display = "";
          continue;
        }

        // Page label: anchored to the top of the document (scrolls away with it,
        // never sticky) and centered horizontally so it doesn't collide with the
        // section labels that hug the top-left corner.
        if (it.layer === "page") {
          const r = document.body.getBoundingClientRect();
          const bh = it.node.offsetHeight || 22;
          const bw = it.node.offsetWidth || 200;
          const top = r.top + 6;
          if (top + bh < 0) {
            it.node.style.display = "none";
            continue;
          }
          it.node.style.display = "";
          it.node.style.left = Math.max(2, (vw - bw) / 2) + "px";
          it.node.style.top = top + "px";
          continue;
        }

        const r = visibleRect(it.el);
        if (!r) {
          it.node.style.display = "none";
          continue;
        }
        it.node.style.display = "";
        const bw = it.node.offsetWidth || 80;

        // Custom-section box sits at the corner; the data-section box sits to
        // its right so the pair reads left-to-right.
        let left = r.left + 4;
        if (it.pairLeft && it.pairLeft.node.style.display !== "none") {
          left = r.left + 4 + it.pairLeft.node.offsetWidth + 6;
        }
        let top = r.top + 4 + it.yOff;

        // Keep horizontally on-screen (readability), but never vertically
        // clamp — labels must scroll naturally with their element.
        left = Math.max(2, Math.min(left, vw - bw - 2));
        it.node.style.left = left + "px";
        it.node.style.top = top + "px";
      }
    }

    status() {
      return {
        isSqsp: isSquarespacePage(),
        pageId: getPageId(),
        theme: readTheme(),
      };
    }
  }

  // ---- bootstrap (idempotent across repeated injections) ------------------

  if (!window.__sqsfFinder) {
    window.__sqsfFinder = new Finder();
    window.__sqsfFinder.init();
  } else {
    window.__sqsfFinder.render(window.__sqsfFinder.state);
  }
  return window.__sqsfFinder.status();
})();
