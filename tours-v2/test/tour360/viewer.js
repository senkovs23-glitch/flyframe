/* Fly Frame 360° viewer v2.1 — white-label.
   A tour = tour360.html (any name) + the tour360/ folder next to it; everything that changes lives in tour360/tour.json,
   with paths relative to that folder. Add #edit at the end of the address to load the editor (tour360/editor.js). */
(() => {
  "use strict";
  const VERSION = "2.1";
  const UI = {
    lv: { loading: "Ielādē panorāmu...", map: "Karte un plāni", big: "Palielināt karti", rot: "Automātiskā rotācija", fs: "Pilnekrāns", close: "Aizvērt", hint: "Velciet, lai apskatītos apkārt", info: "Informācija", area: "Zemes gabals", fail: "Neizdevās ielādēt tūri.", file: "Tūri var atvērt tikai no tīmekļa vietnes (http/https), nevis kā failu datorā.", nogl: "Šī pārlūkprogramma neatbalsta WebGL, tāpēc 360° skatu nevar parādīt.", zin: "Pietuvināt", zout: "Attālināt", thumbs: "Skati", lang: "Valoda", empty: "Tūrē vēl nav neviena skata.", dirs: ["Z", "ZA", "A", "DA", "D", "DR", "R", "ZR"] },
    ru: { loading: "Загрузка панорамы...", map: "Карта и планы", big: "Увеличить карту", rot: "Автовращение", fs: "Во весь экран", close: "Закрыть", hint: "Потяните, чтобы осмотреться", info: "Информация", area: "Участок", fail: "Не удалось загрузить тур.", file: "Тур открывается только с сайта (http/https), а не как файл на компьютере.", nogl: "Браузер не поддерживает WebGL, поэтому 360° вид недоступен.", zin: "Приблизить", zout: "Отдалить", thumbs: "Виды", lang: "Язык", empty: "В туре пока нет ни одной точки.", dirs: ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"] },
    lt: { loading: "Įkeliama panorama...", map: "Žemėlapis ir planai", big: "Padidinti žemėlapį", rot: "Automatinis sukimas", fs: "Visas ekranas", close: "Uždaryti", hint: "Tempkite, kad apsižvalgytumėte", info: "Informacija", area: "Sklypas", fail: "Nepavyko įkelti turo.", file: "Turą galima atidaryti tik iš svetainės (http/https), o ne kaip failą kompiuteryje.", nogl: "Ši naršyklė nepalaiko WebGL, todėl 360° vaizdo parodyti negalima.", zin: "Priartinti", zout: "Nutolinti", thumbs: "Vaizdai", lang: "Kalba", empty: "Ture dar nėra nė vieno vaizdo.", dirs: ["Š", "ŠR", "R", "PR", "P", "PV", "V", "ŠV"] },
    en: { loading: "Loading panorama...", map: "Map and floor plans", big: "Enlarge map", rot: "Auto-rotate", fs: "Full screen", close: "Close", hint: "Drag to look around", info: "Information", area: "Plot", fail: "The tour could not be loaded.", file: "The tour opens only from a website (http/https), not as a file on the computer.", nogl: "This browser does not support WebGL, so the 360° view cannot be shown.", zin: "Zoom in", zout: "Zoom out", thumbs: "Scenes", lang: "Language", empty: "The tour has no scenes yet.", dirs: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] }
  };
  const LANGS = ["lv", "ru", "lt", "en"];
  const PRESETS = {
    dark:     { panel: "#0b0b0c", panelOpacity: 0.62, text: "#ffffff", accent: "#ffffff", accent2: "#ffffff", radius: 4, font: "system", loader: "ring" },
    light:    { panel: "#ffffff", panelOpacity: 0.84, text: "#16181c", accent: "#16181c", accent2: "#16181c", radius: 6, font: "system", loader: "ring" },
    flyframe: { panel: "#112642", panelOpacity: 0.82, text: "#ffffff", accent: "#3d8bff", accent2: "#2ed3c3", radius: 14, font: "Manrope", loader: "plane" }
  };
  const FONTS = { system: null, Manrope: "Manrope:wght@400;600;700;800", Inter: "Inter:wght@400;600;700;800", Montserrat: "Montserrat:wght@400;600;700;800", Roboto: "Roboto:wght@400;500;700;900", "Open Sans": "Open+Sans:wght@400;600;700;800", "PT Sans": "PT+Sans:wght@400;700", Raleway: "Raleway:wght@400;600;700;800" };
  const DEF_UI = { thumbs: true, map: true, autorotate: true, zoom: true, fullscreen: true, title: true, compass: true, hint: true, fov: 95, fovMin: 35, fovMax: 110, linkSize: 1, spotSize: 1, langs: ["lv", "ru", "lt"], defaultLang: "lv" };

  // the folder this script lives in; every path in tour.json is relative to it
  const BASE = new URL(".", (document.currentScript && document.currentScript.src) || location.href).href;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = () => innerWidth <= 720;
  const EDIT = location.hash === "#edit";
  const params = new URLSearchParams(location.search);
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => ((a + 180) % 360 + 360) % 360 - 180;
  const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ico = (d, extra = "") => `<svg class="ico" viewBox="0 0 24 24" ${extra}>${d}</svg>`;

  const FFV = window.FFV = window.FFV || {};
  Object.assign(FFV, { version: VERSION, EDIT, PRESETS, FONTS, DEF_UI, LANGS, UI, BASE });
  const baseResolve = (p) => { if (!p) return p; try { return new URL(p, BASE).href; } catch (e) { return p; } };
  let resolve = baseResolve;            // the editor swaps this for local files it holds
  FFV.baseResolve = baseResolve;
  FFV.setResolver = (f) => { resolve = f; };

  let cfg = null, byId = {}, cur = null, tex = null, busy = false, lang = "lv";
  const T = (o) => (o && typeof o === "object") ? (o[lang] || o[cfg && cfg.ui.defaultLang] || o.lv || Object.values(o).find(Boolean) || "") : (o || "");
  const S = () => UI[lang] || UI.en;

  function showMsg(text) { let m = $("#msg"); if (!m) { m = document.createElement("div"); m.id = "msg"; $("#app").appendChild(m); } m.innerHTML = `<div>${esc(text)}</div>`; $("#loader").classList.add("done"); }

  // ---------- colours ----------
  function hexRgb(h) { const m = String(h || "").trim().replace("#", ""); const x = m.length === 3 ? m.split("").map((c) => c + c).join("") : m; const n = parseInt(x, 16); return isNaN(n) || x.length !== 6 ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
  const onColor = (hex) => lum(hexRgb(hex)) > 0.42 ? "#111111" : "#ffffff";
  function themeOf(c) {
    const forced = params.get("theme");
    const t = (c && c.theme) || {};
    if (forced && PRESETS[forced]) return Object.assign({ preset: forced }, PRESETS[forced]);
    return Object.assign({ preset: "dark" }, PRESETS[t.preset] || PRESETS.dark, t);
  }
  FFV.themeOf = themeOf;
  function applyTheme() {
    const t = themeOf(cfg), r = document.documentElement.style;
    r.setProperty("--panel-rgb", hexRgb(t.panel).join(", "));
    r.setProperty("--panel-a", String(clamp(+t.panelOpacity, 0, 1)));
    r.setProperty("--fg-rgb", hexRgb(t.text).join(", "));
    r.setProperty("--acc", t.accent); r.setProperty("--on-acc", onColor(t.accent));
    r.setProperty("--acc2", t.accent2 || t.accent); r.setProperty("--on-acc2", onColor(t.accent2 || t.accent));
    r.setProperty("--r", (+t.radius || 0) + "px");
    if (FONTS[t.font]) r.setProperty("--font", `"${t.font}", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`); else r.removeProperty("--font");
    let link = $("#ffFont");
    if (FONTS[t.font]) {
      const href = `https://fonts.googleapis.com/css2?family=${FONTS[t.font]}&display=swap`;
      if (!link) { link = document.createElement("link"); link.id = "ffFont"; link.rel = "stylesheet"; document.head.appendChild(link); }
      if (link.getAttribute("href") !== href) link.href = href;
    } else if (link) link.remove();
    document.documentElement.style.colorScheme = lum(hexRgb(t.panel)) > 0.5 ? "light" : "dark";
    const ldi = t.loader === "plane" ? `<div class="flight-track"><div class="airplane-animation"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></div></div>`
      : t.loader === "logo" ? `<div class="logo-ld"></div>` : `<div class="ring-ld"></div>`;
    $$(".ldi").forEach((el) => { if (el.dataset.kind !== t.loader) { el.dataset.kind = t.loader; el.innerHTML = ldi; } });
  }

  // ---------- brand ----------
  function applyBrand() {
    const b = cfg.brand || {}, a = $("#brand");
    const logo = b.logo ? `<img src="${esc(resolve(b.logo))}" alt="${esc(b.name || "")}">` : (b.name ? `<span class="bname">${esc(b.name)}</span>` : "");
    a.innerHTML = logo;
    a.hidden = !logo;
    if (b.url) { a.href = b.url; a.style.pointerEvents = ""; } else { a.removeAttribute("href"); a.style.pointerEvents = "none"; }
    const r = document.documentElement.style;
    r.setProperty("--logo-h", clamp(+b.logoHeight || 34, 16, 60) + "px");
    let tone = b.logoTone || "original";
    if (tone === "auto") tone = lum(hexRgb(themeOf(cfg).panel)) > 0.5 ? "dark" : "light";
    r.setProperty("--logo-filter", tone === "light" ? "brightness(0) invert(1)" : tone === "dark" ? "brightness(0)" : "none");
    $("#bsep").hidden = !logo || !cfg.ui.title;
    $("#credit").hidden = b.credit === false;
    $("#loader .lbrand").innerHTML = b.logo ? `<img src="${esc(resolve(b.logo))}" alt="">` : (b.name ? `<span class="bname">${esc(b.name)}</span>` : "");
  }

  // ---------- WebGL ----------
  const canvas = $("#gl");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: EDIT });
  if (!gl) { showMsg(UI.lv.nogl); return; }
  const MAXTEX = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  const VS = "attribute vec3 p; attribute vec2 uv; uniform mat4 m; varying vec2 v; void main(){ v = uv; gl_Position = m * vec4(p, 1.0); }";
  const FS = "precision mediump float; varying vec2 v; uniform sampler2D a; void main(){ gl_FragColor = vec4(texture2D(a, v).rgb, 1.0); }";
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  const U = { m: gl.getUniformLocation(prog, "m"), a: gl.getUniformLocation(prog, "a") };
  const SPH = (() => {
    const LON = 96, LAT = 48, pos = [], uvs = [], idx = [];
    for (let j = 0; j <= LAT; j++) {
      const pt = (0.5 - j / LAT) * Math.PI;
      for (let i = 0; i <= LON; i++) { const yw = (i / LON - 0.5) * 2 * Math.PI; pos.push(Math.cos(pt) * Math.sin(yw), Math.sin(pt), -Math.cos(pt) * Math.cos(yw)); uvs.push(i / LON, j / LAT); }
    }
    for (let j = 0; j < LAT; j++) for (let i = 0; i < LON; i++) { const a = j * (LON + 1) + i, b = a + LON + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const buf = (data, loc, n) => { const bo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); const l = gl.getAttribLocation(prog, loc); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); };
    buf(pos, "p", 3); buf(uvs, "uv", 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return { count: idx.length };
  })();
  function makeTex(img) {
    let w = 1; while (w * 2 <= Math.min(img.naturalWidth, MAXTEX)) w *= 2;
    const h = w / 2;
    let src = img;
    if (img.naturalWidth !== w || img.naturalHeight !== h) {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, w, h); src = c;
    }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  }

  // ---------- camera ----------
  const cam = { yaw: 0, pitch: 0, hfov: 95, vy: 0, vp: 0 };
  let W = 1, H = 1, dirty = true;
  const fovMin = () => clamp(+cfg.ui.fovMin || 35, 20, 120), fovMax = () => clamp(+cfg.ui.fovMax || 110, fovMin() + 5, 130);
  const baseFov = (n) => clamp(+(n && n.start && n.start.fov) || +cfg.ui.fov || 95, fovMin(), fovMax());
  function vfov() { return clamp(2 * Math.atan(Math.tan(cam.hfov * D2R / 2) / (W / H)) / D2R, 25, 115); }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height); dirty = true;
  }
  function toView(x, y, z) {
    const a = cam.yaw * D2R, b = -cam.pitch * D2R;
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    return [x1, y * Math.cos(b) - z1 * Math.sin(b), y * Math.sin(b) + z1 * Math.cos(b)];
  }
  function dir(yaw, pitch) { const y = yaw * D2R, p = pitch * D2R; return [Math.cos(p) * Math.sin(y), Math.sin(p), -Math.cos(p) * Math.cos(y)]; }
  function project(yaw, pitch) {
    const v = toView(...dir(yaw, pitch));
    if (v[2] > -0.05) return null;
    const f = 1 / Math.tan(vfov() * D2R / 2);
    return [((f / (W / H)) * v[0] / -v[2] + 1) / 2 * W, (1 - f * v[1] / -v[2]) / 2 * H];
  }
  function unproject(sx, sy) {
    const f = 1 / Math.tan(vfov() * D2R / 2);
    const x = ((sx / W) * 2 - 1) * (W / H) / f, y = (1 - (sy / H) * 2) / f, z = -1;
    const b = cam.pitch * D2R, y1 = y * Math.cos(b) - z * Math.sin(b), z1 = y * Math.sin(b) + z * Math.cos(b);
    const a = -cam.yaw * D2R, x2 = x * Math.cos(a) + z1 * Math.sin(a), z2 = -x * Math.sin(a) + z1 * Math.cos(a);
    return { yaw: wrap(Math.atan2(x2, -z2) / D2R), pitch: Math.asin(y1 / Math.hypot(x2, y1, z2)) / D2R };
  }
  function matrix() {
    const f = 1 / Math.tan(vfov() * D2R / 2), a = W / H, n = 0.1, fa = 10;
    const P = [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
    const cy = Math.cos(cam.yaw * D2R), sy = Math.sin(cam.yaw * D2R), cp = Math.cos(-cam.pitch * D2R), sp = Math.sin(-cam.pitch * D2R);
    const R = [[cy, 0, sy], [sp * sy, cp, -sp * cy], [-cp * sy, sp, cp * cy]];
    const M = [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, 0, 0, 0, 1];
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + r] * M[c * 4 + k]; out[c * 4 + r] = s; }
    return out;
  }
  const imgCache = {};
  function loadImg(path) {
    const src = resolve(path);
    if (!imgCache[src]) {
      imgCache[src] = new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => res(i));
        i.onerror = () => { delete imgCache[src]; rej(new Error(path)); };
        i.src = src;
      });
    }
    return imgCache[src];
  }
  function draw() {
    const p = hexRgb(themeOf(cfg).panel);
    gl.clearColor(p[0] / 255, p[1] / 255, p[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!tex) return;
    gl.uniformMatrix4fv(U.m, false, matrix());
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.a, 0);
    gl.drawElements(gl.TRIANGLES, SPH.count, gl.UNSIGNED_SHORT, 0);
  }

  // ---------- plans ----------
  const planById = (id) => (cfg.plans || []).find((p) => p.id === id);
  const planIndex = (id) => (cfg.plans || []).findIndex((p) => p.id === id);
  const kindOf = (n) => n.kind || (n.aerial ? "aerial" : "outdoor");
  FFV.kindOf = kindOf;

  // ---------- hotspots ----------
  const spotsEl = $("#spots");
  // "signs" = plaques pinned to a surface of the photo; they live in their own layer with CSS perspective (see placeSigns)
  let signsEl = $("#signs");
  if (!signsEl) { signsEl = document.createElement("div"); signsEl.id = "signs"; spotsEl.parentNode.insertBefore(signsEl, spotsEl); }
  let spotEls = [], signEls = [];
  const ICONS = {
    arrow: ico('<path d="M6 14l6-6 6 6"/>'),
    door: ico('<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><path d="M14.5 12.5v.01"/>'),
    stairs: ico('<path d="M3.5 20.5v-4.5h4.5v-4.5h4.5v-4.5h4.5v-4.5h4v18z"/>'),
    drone: ico('<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7 8l3 3M17 8l-3 3M7 16l3-3M17 16l-3-3"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>')
  };
  FFV.ICON_NAMES = Object.keys(ICONS);
  // v2.1 early drafts had two staircase icons with arrows (up / down); both are now the single "stairs" pictogram
  const iconName = (n) => (n === "up" || n === "down") ? "stairs" : n;
  function linkIcon(l, from, to) {
    const own = iconName(l.icon);
    if (own && own !== "auto" && ICONS[own]) return own;
    const a = kindOf(from), b = kindOf(to);
    if (b === "aerial") return "drone";
    if ((a === "indoor") !== (b === "indoor")) return "door";
    if (a === "indoor" && b === "indoor" && from.plan && to.plan && from.plan !== to.plan) return "stairs";
    return "arrow";
  }
  FFV.linkIcon = linkIcon;
  // size = global slider (ui.linkSize / ui.spotSize) × the item's own size; the button grows around the point it is attached to
  const sizeK = (global, own) => clamp((+global || 1) * (+own || 1), 0.4, 3.2);
  function buildSpots() {
    spotsEl.innerHTML = ""; signsEl.innerHTML = ""; spotEls = []; signEls = [];
    if (!cur) return;
    for (const l of cur.links || []) {
      const t = byId[l.to]; if (!t) continue;
      const b = document.createElement("button");
      b.className = "spot lnk";
      b.innerHTML = `<span class="ring">${ICONS[linkIcon(l, cur, t)]}</span><span class="pill">${esc(T(t.name))}</span>`;
      b.setAttribute("aria-label", T(t.name));
      b.addEventListener("click", (e) => { e.stopPropagation(); go(l.to, l); });
      b.style.transformOrigin = "50% 24px";
      spotsEl.appendChild(b); spotEls.push({ el: b, yaw: l.yaw, pitch: l.pitch, anchor: 24, k: sizeK(cfg.ui.linkSize, l.size) });
    }
    for (const s of cur.spots || []) {
      if (s.kind === "area" && s.pin) {
        const d = document.createElement("div");
        d.className = "sign";
        d.innerHTML = `<b class="sg-t">${esc(T(s.title))}</b>` + (T(s.text) ? `<span class="sg-x">${esc(T(s.text))}</span>` : "");
        signsEl.appendChild(d);
        signEls.push({ el: d, yaw: s.yaw, pitch: s.pitch, w: clamp(+s.w || 20, 4, 70), turn: clamp(+s.turn || 0, -85, 85), tilt: clamp(+s.tilt || 0, -85, 85), roll: clamp(+s.roll || 0, -180, 180) });
        continue;
      }
      const b = document.createElement("button");
      b.className = "spot " + (s.kind === "area" ? "area" : "inf");
      b.innerHTML = s.kind === "area" ? `<span class="pill">${esc(T(s.title))}</span>` : `<span class="dot">i</span><span class="pill">${esc(T(s.title))}</span>`;
      b.setAttribute("aria-label", T(s.title));
      b.addEventListener("click", (e) => { e.stopPropagation(); openCard(s); });
      const anchor = s.kind === "area" ? 17 : 15;
      b.style.transformOrigin = "50% " + anchor + "px";
      spotsEl.appendChild(b); spotEls.push({ el: b, yaw: s.yaw, pitch: s.pitch, anchor, k: sizeK(cfg.ui.spotSize, s.size) });
    }
    placeSpots(); placeSigns();
  }
  function placeSpots() {
    for (const s of spotEls) {
      const p = project(s.yaw, s.pitch), m = 80 * Math.max(1, s.k);
      if (!p || p[0] < -m || p[0] > W + m || p[1] < -m || p[1] > H + m) { s.el.hidden = true; continue; }
      s.el.hidden = false;
      s.el.style.transform = `translate3d(${(p[0] - s.el.offsetWidth / 2).toFixed(1)}px, ${(p[1] - s.anchor).toFixed(1)}px, 0)` + (s.k === 1 ? "" : ` scale(${s.k.toFixed(3)})`);
    }
  }

  // ---------- plaques pinned to the photo ----------
  // A pinned plaque is a flat rectangle that really hangs in the panorama's 3D space: its centre sits on the ray (yaw, pitch) and its
  // plane can be turned (wall angle), tilted and rolled. Every frame it is run through the same camera as the picture itself (toView +
  // the vertical field of view) and handed to the browser as a 3D matrix, so while the picture is dragged it foreshortens exactly like
  // a sign on the wall would. Layout stays in CSS pixels at a fixed design width (340) and is only scaled, so text never reflows.
  const SIGN_R = 1000, SIGN_W = 340;
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mix3 = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  // the world-space frame of a pinned plaque: right, down-the-page, and the normal that faces the viewer
  function signFrame(s) {
    const yw = s.yaw * D2R, pt = s.pitch * D2R, c = dir(s.yaw, s.pitch);
    let X = [Math.cos(yw), 0, Math.sin(yw)], Y = [-Math.sin(pt) * Math.sin(yw), Math.cos(pt), Math.sin(pt) * Math.cos(yw)], Z = [-c[0], -c[1], -c[2]];
    const t = s.turn * D2R, p = s.tilt * D2R, r = s.roll * D2R;
    // turn about the plaque's vertical axis: positive = right edge moves away
    let X1 = mix3(X, Math.cos(t), Z, -Math.sin(t)), Z1 = mix3(X, Math.sin(t), Z, Math.cos(t));
    // tilt about its horizontal axis: positive = top edge moves away
    const Y2 = mix3(Y, Math.cos(p), Z1, -Math.sin(p)), Z2 = mix3(Y, Math.sin(p), Z1, Math.cos(p));
    // roll about the normal: positive = clockwise on screen
    const X3 = mix3(X1, Math.cos(r), Y2, -Math.sin(r)), Y3 = mix3(X1, Math.sin(r), Y2, Math.cos(r));
    return { c, X: X3, Y: Y3, Z: Z2 };
  }
  FFV.signFrame = signFrame;
  function placeSigns() {
    if (!signEls.length) return;
    const P = (H / 2) / Math.tan(vfov() * D2R / 2);
    signsEl.style.perspective = P.toFixed(2) + "px";
    for (const s of signEls) {
      const fr = signFrame(s), cv = toView(fr.c[0] * SIGN_R, fr.c[1] * SIGN_R, fr.c[2] * SIGN_R);
      if (cv[2] > -SIGN_R * 0.3) { s.el.hidden = true; continue; }   // behind or far off to the side: the browser cannot draw it sensibly
      s.el.hidden = false;
      const k = 2 * SIGN_R * Math.tan(s.w * D2R / 2) / SIGN_W;
      const x = toView(...fr.X), y = toView(...fr.Y), n = toView(...fr.Z);
      // CSS axes: x right, y down, z towards the viewer — so view-space y flips; the plaque's own y runs down the page
      const m = [x[0] * k, -x[1] * k, x[2] * k, 0, -y[0] * k, y[1] * k, -y[2] * k, 0, n[0], -n[1], n[2], 0, cv[0], -cv[1], cv[2] + P, 1];
      s.el.style.transform = `matrix3d(${m.map((v) => +v.toFixed(5)).join(",")}) translate(-50%,-50%)`;
    }
  }

  // ---------- card ----------
  const card = $("#card");
  let cardSpot = null;
  function openCard(s) {
    cardSpot = s;
    $("#cardK").textContent = s.kind === "area" ? S().area : S().info;
    $("#cardT").textContent = T(s.title); $("#cardP").textContent = T(s.text);
    card.hidden = !T(s.title) && !T(s.text);
    $("#app").classList.toggle("card-open", !card.hidden);
    turnTo(s.yaw, clamp(s.pitch, -60, 60), 600);
  }
  function closeCard() { card.hidden = true; cardSpot = null; $("#app").classList.remove("card-open"); }
  $("#cardX").addEventListener("click", closeCard);

  // ---------- map + floor plans ----------
  const mapEl = $("#map"), mbox = $("#mbox");
  let mapBtns = [], mapOpen = false, shownPlan = null;
  const hasMap = () => !!(cfg && cfg.ui.map && (cfg.plans || []).some((p) => p.image));
  function buildMap() {
    $("#mapBtn").hidden = !hasMap();
    if (!hasMap()) { mapEl.hidden = true; return; }
    const plans = cfg.plans.filter((p) => p.image);
    if (!plans.some((p) => p.id === shownPlan)) shownPlan = (cur && cur.plan && planById(cur.plan) && planById(cur.plan).image) ? cur.plan : plans[0].id;
    const pl = planById(shownPlan);
    const tabs = $("#planTabs");
    tabs.hidden = plans.length < 2;
    mapEl.classList.toggle("solo", plans.length < 2);
    tabs.innerHTML = plans.map((p) => `<button role="tab" data-plan="${esc(p.id)}" aria-pressed="${p.id === shownPlan}">${esc(T(p.name) || p.id)}</button>`).join("");
    mapEl.hidden = !mapOpen;
    const mi = $("#mapImg"), src = resolve(pl.image);
    mi.onload = () => { if (mi.naturalWidth) mbox.style.aspectRatio = mi.naturalWidth + " / " + mi.naturalHeight; layout(); };
    if (mi.getAttribute("src") !== src) mi.src = src;
    mi.alt = T(pl.name) || "";
    $("#north").hidden = (pl.kind || "map") !== "map";
    mapBtns.forEach((b) => b.remove()); mapBtns = [];
    for (const n of cfg.nodes) {
      if (n.plan !== shownPlan || !n.pos) continue;
      const b = document.createElement("button");
      b.className = "mpt"; b.dataset.id = n.id;
      b.style.left = (n.pos[0] * 100) + "%"; b.style.top = (n.pos[1] * 100) + "%";
      b.innerHTML = `<i></i><span>${esc(T(n.name))}</span>`;
      b.setAttribute("aria-label", T(n.name));
      b.addEventListener("click", (e) => { if (e.detail === 0 && !FFV.onMapPick) { e.stopPropagation(); mapGo(n.id); } });
      mbox.appendChild(b); mapBtns.push(b);
    }
    markMap(); layout(); dirty = true;
  }
  // keep the map box at its image's proportions and inside the space between the strip and the band
  function layout() {
    const top = $("#top");
    const th = top.classList.contains("off") ? 12 : Math.max(12, $("#strip").getBoundingClientRect().bottom);
    document.documentElement.style.setProperty("--top-h", Math.round(th) + "px");
    if (mapEl.hidden) return;
    const mi = $("#mapImg"), ar = mi.naturalWidth ? mi.naturalWidth / mi.naturalHeight : 1;
    const bottom = innerHeight - parseFloat(getComputedStyle(mapEl).bottom || "0");
    const head = mapEl.classList.contains("solo") ? 0 : $(".mhead").getBoundingClientRect().height + 6;
    const avail = bottom - th - 12 - 14 - head;
    mbox.style.maxWidth = Math.max(90, Math.floor(avail * ar)) + "px";
    dirty = true;
  }
  function showPlan(id) { if (id && planById(id)) { shownPlan = id; buildMap(); } }
  $("#planTabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-plan]"); if (b) showPlan(b.dataset.plan); });
  function setMapOpen(v, save) {
    mapOpen = !!v && hasMap();
    mapEl.hidden = !mapOpen;
    $("#mapBtn").setAttribute("aria-pressed", String(mapOpen));
    if (!mapOpen) mapEl.classList.remove("big");
    if (save) store.set("ff2-map", mapOpen ? "1" : "0");
    layout(); dirty = true;
  }
  function mapGo(id) { if (phone() && mapEl.classList.contains("big")) mapEl.classList.remove("big"); go(id); }
  mbox.addEventListener("click", (e) => {
    if (!cfg) return;
    const r = mbox.getBoundingClientRect();
    if (FFV.onMapPick) { FFV.onMapPick(shownPlan, +((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)); return; }
    let best = null, bd = 28;
    for (const n of cfg.nodes) {
      if (n.plan !== shownPlan || !n.pos) continue;
      const d = Math.hypot(r.left + n.pos[0] * r.width - e.clientX, r.top + n.pos[1] * r.height - e.clientY);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) mapGo(best.id);
  });
  function markMap() { if (!cur) return; mapBtns.forEach((b) => { const on = b.dataset.id === cur.id; b.setAttribute("aria-current", String(on)); if (on) mbox.appendChild(b); }); }
  function placeCone() {
    if (!cur || !cur.pos || cur.plan !== shownPlan || mapEl.hidden) { $("#cone").innerHTML = ""; return; }
    const ar = mbox.clientWidth / Math.max(1, mbox.clientHeight);
    const x = cur.pos[0] * 100, y = cur.pos[1] * 100, c = themeOf(cfg).accent;
    const yaw = cam.yaw - (cur.heading || 0), half = Math.min(cam.hfov, 120) / 2, r = 20;
    const a1 = (yaw - half) * D2R, a2 = (yaw + half) * D2R;
    // the svg is stretched to the box; scale x so the cone keeps its angle on non-square plans
    const sx = 1 / ar;
    const p1 = [x + Math.sin(a1) * r * sx, y - Math.cos(a1) * r], p2 = [x + Math.sin(a2) * r * sx, y - Math.cos(a2) * r];
    $("#cone").innerHTML = `<defs><radialGradient id="cg" cx="${x}" cy="${y}" r="${r}" gradientUnits="userSpaceOnUse" gradientTransform="translate(${x} ${y}) scale(${sx} 1) translate(${-x} ${-y})"><stop offset="0" stop-color="${esc(c)}" stop-opacity=".85"/><stop offset="1" stop-color="${esc(c)}" stop-opacity="0"/></radialGradient></defs>` +
      `<path d="M${x} ${y}L${p1[0].toFixed(2)} ${p1[1].toFixed(2)}A${(r * sx).toFixed(2)} ${r} 0 0 1 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}Z" fill="url(#cg)"/>`;
  }
  $("#mapBtn").addEventListener("click", () => setMapOpen(!mapOpen, true));
  $("#mapBig").addEventListener("click", (e) => { e.stopPropagation(); mapEl.classList.toggle("big"); $("#mapBig").setAttribute("aria-pressed", String(mapEl.classList.contains("big"))); layout(); });

  // ---------- strip ----------
  let thumbsOpen = true;
  function buildStrip() {
    const s = $("#strip"); s.innerHTML = "";
    $("#thumbsBtn").hidden = !cfg.ui.thumbs || cfg.nodes.length < 2;
    const grouped = (cfg.plans || []).length > 1;
    let last, row = s;
    for (const n of cfg.nodes) {
      if (grouped && (n.plan || "") !== last) {
        last = n.plan || "";
        const p = planById(n.plan), g = document.createElement("div");
        g.className = "tg";
        g.innerHTML = `<span class="tgl">${esc(p ? T(p.name) : "")}</span><div class="tgr"></div>`;
        s.appendChild(g); row = g.lastChild;
      }
      const b = document.createElement("button");
      b.className = "th"; b.dataset.id = n.id;
      const im = n.thumb || n.pano;
      b.style.backgroundImage = im ? `url("${resolve(im).replace(/"/g, "%22")}")` : "";
      b.innerHTML = `<span>${esc(T(n.name))}</span>`;
      b.title = T(n.name);
      b.addEventListener("click", () => go(n.id));
      row.appendChild(b);
    }
    setThumbs(thumbsOpen);
  }
  function setThumbs(v, save) {
    thumbsOpen = !!v;
    const show = cfg.ui.thumbs && cfg.nodes.length > 1 && thumbsOpen;
    $("#top").classList.toggle("off", !show);
    $("#thumbsBtn").setAttribute("aria-pressed", String(show));
    if (save) store.set("ff2-thumbs", thumbsOpen ? "1" : "0");
    setTimeout(layout, 400); layout();
  }
  $("#thumbsBtn").addEventListener("click", () => setThumbs(!thumbsOpen, true));
  function markStrip() {
    $$(".th").forEach((b) => b.setAttribute("aria-current", String(!!cur && b.dataset.id === cur.id)));
    const a = document.querySelector('.th[aria-current="true"]'); if (a) a.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
  }

  // ---------- text + language ----------
  function updateScene() {
    if (!cur) { $("#scene").textContent = ""; $("#sceneTag").textContent = ""; return; }
    const h = ((Math.round(cam.yaw - (cur.heading || 0)) % 360) + 360) % 360;
    const course = cfg.ui.compass ? `${String(h).padStart(3, "0")}° ${S().dirs[Math.round(h / 45) % 8]}` : "";
    const p = planById(cur.plan), floor = p && (p.kind === "plan") ? T(p.name) : "";
    $("#scene").innerHTML = `<b>${esc(T(cur.name))}</b>` + (floor ? ` · ${esc(floor)}` : "") + (course ? ` · ${course}` : "");
    $("#sceneTag").innerHTML = esc(T(cur.name)) + (floor ? `<small>${esc(floor)}</small>` : "");
  }
  function langs() { const l = (cfg && cfg.ui.langs || DEF_UI.langs).filter((x) => LANGS.includes(x)); return l.length ? l : ["lv"]; }
  function buildLang() {
    const l = langs();
    $("#langWrap").hidden = l.length < 2;
    $("#langBtn").textContent = lang.toUpperCase();
    $("#langMenu").innerHTML = l.map((x) => `<button data-l="${x}" aria-current="${x === lang}">${x.toUpperCase()}</button>`).join("");
  }
  $("#langBtn").addEventListener("click", (e) => { e.stopPropagation(); const m = $("#langMenu"); m.hidden = !m.hidden; $("#langBtn").setAttribute("aria-expanded", String(!m.hidden)); });
  $("#langMenu").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; setLang(b.dataset.l, true); $("#langMenu").hidden = true; });
  document.addEventListener("click", (e) => { if (!e.target.closest("#langWrap")) $("#langMenu").hidden = true; });
  function setLang(l, save) { if (!langs().includes(l)) l = langs()[0]; lang = l; if (save) store.set("ff2-lang", l); applyText(); }
  function applyText() {
    document.documentElement.lang = lang;
    const s = S();
    $("#titleT").textContent = T(cfg.title);
    document.title = T(cfg.title) || "360°";
    $("#badge").textContent = T(cfg.badge); $("#badge").hidden = !T(cfg.badge);
    $("#titles").hidden = !cfg.ui.title;
    for (const [id, k] of [["#rot", "rot"], ["#fs", "fs"], ["#cardX", "close"], ["#zIn", "zin"], ["#zOut", "zout"], ["#thumbsBtn", "thumbs"], ["#mapBtn", "map"], ["#mapBig", "big"], ["#langBtn", "lang"]]) { $(id).title = s[k]; $(id).setAttribute("aria-label", s[k]); }
    $("#hintT").textContent = s.hint;
    $$(".vT").forEach((el) => el.textContent = s.loading);
    buildLang();
    buildStrip(); buildMap(); markStrip(); markMap();
    buildSpots(); placeSpots(); updateScene();
    if (cardSpot) openCard(cardSpot);
    dirty = true;
  }
  function applyUI() {
    const u = cfg.ui;
    $$(".zoom").forEach((el) => el.hidden = !u.zoom);
    $("#fs").hidden = !u.fullscreen || !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }

  // ---------- tweens ----------
  let tweens = [];
  function tween(ms, fn) { return new Promise((res) => { tweens.push({ t0: performance.now(), ms: reduce ? Math.min(ms, 120) : ms, fn, res }); dirty = true; }); }
  function turnTo(yaw, pitch, ms, fov) {
    const y0 = cam.yaw, p0 = cam.pitch, f0 = cam.hfov, dy = wrap(yaw - y0), dp = pitch - p0, df = fov == null ? 0 : fov - f0;
    cam.vy = cam.vp = 0;
    return tween(ms, (k) => { const e = easeInOut(k); cam.yaw = y0 + dy * e; cam.pitch = p0 + dp * e; cam.hfov = f0 + df * e; });
  }
  function zoomBy(d) { const f0 = cam.hfov, f1 = clamp(f0 + d, fovMin(), fovMax()); idleSince = performance.now(); tween(260, (k) => { cam.hfov = f0 + (f1 - f0) * easeOut(k); }); }
  $("#zIn").addEventListener("click", () => zoomBy(-12));
  $("#zOut").addEventListener("click", () => zoomBy(12));

  // ---------- navigation ----------
  const veil = $("#veil");
  async function go(id, link) {
    if (busy || !byId[id] || (cur && id === cur.id)) return;
    busy = true; closeCard(); idleSince = performance.now();
    const next = byId[id];
    const hA = cur ? (cur.heading || 0) : 0, hB = next.heading || 0;
    const y0 = cam.yaw, p0 = cam.pitch, f0 = cam.hfov;
    const ty = link ? link.yaw : y0, tp = link ? clamp(link.pitch, -35, 35) : p0;
    const dy = wrap(ty - y0);
    spotsEl.classList.add("hide"); signsEl.classList.add("hide");
    veil.classList.add("on");
    const move = tween(560, (k) => { const e = easeInOut(k); cam.yaw = y0 + dy * e; cam.pitch = p0 + (tp - p0) * e; cam.hfov = f0 - 14 * e; });
    let img;
    try { [img] = await Promise.all([loadImg(next.pano), move, sleep(reduce ? 200 : 900)]); }
    catch (e) { veil.classList.remove("on"); spotsEl.classList.remove("hide"); signsEl.classList.remove("hide"); await tween(300, (k) => { cam.hfov = f0 - 14 + 14 * easeOut(k); }); busy = false; return; }
    const old = tex;
    tex = makeTex(img);
    if (old) gl.deleteTexture(old);
    cur = next;
    const s = next.start || { yaw: 0, pitch: 0 }, target = baseFov(next);
    cam.yaw = link ? wrap(ty - hA + hB) : s.yaw;
    cam.pitch = s.pitch;
    const zoomIn = Math.max(fovMin(), target - 12);
    cam.hfov = zoomIn;
    if (cur.plan && cur.plan !== shownPlan && planById(cur.plan)) { shownPlan = cur.plan; buildMap(); }
    buildSpots(); markStrip(); markMap(); updateScene(); dirty = true;
    if (FFV.onScene) FFV.onScene(cur);
    await sleep(60);
    veil.classList.remove("on");
    await tween(900, (k) => { cam.hfov = zoomIn + (target - zoomIn) * easeOut(k); });
    spotsEl.classList.remove("hide"); signsEl.classList.remove("hide");
    busy = false; idleSince = performance.now();
    preload();
  }
  function preload() { for (const l of (cur && cur.links) || []) if (byId[l.to]) loadImg(byId[l.to].pano).catch(() => {}); }
  async function reloadPano(node) {
    Object.keys(imgCache).forEach((k) => delete imgCache[k]);
    if (node && cur && node.id === cur.id) {
      try { const img = await loadImg(node.pano); const old = tex; tex = makeTex(img); if (old) gl.deleteTexture(old); dirty = true; } catch (e) {}
    }
  }

  // ---------- input ----------
  let ptrs = new Map(), downAt = null, lastMove = 0, pinch0 = null, idleSince = performance.now();
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    downAt = [e.clientX, e.clientY, performance.now()]; cam.vy = cam.vp = 0; idleSince = performance.now(); canvas.classList.add("drag"); $("#hint").classList.add("off");
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = [Math.hypot(a[0] - b[0], a[1] - b[1]), cam.hfov]; }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId) || busy) return;
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2 && pinch0) {
      const [a, b] = [...ptrs.values()];
      cam.hfov = clamp(pinch0[1] * pinch0[0] / Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), 1), fovMin(), fovMax()); dirty = true; return;
    }
    const k = vfov() / H, dx = (e.clientX - prev[0]) * k, dy = (e.clientY - prev[1]) * k;
    cam.yaw -= dx; cam.pitch = clamp(cam.pitch + dy, -88, 88);
    const now = performance.now(), dt = Math.max(now - lastMove, 8); lastMove = now;
    cam.vy = -dx / dt * 16; cam.vp = dy / dt * 16; dirty = true;
  });
  const up = (e) => {
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; canvas.classList.remove("drag");
    if (performance.now() - lastMove > 60) cam.vy = cam.vp = 0;
    idleSince = performance.now();
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6 && performance.now() - downAt[2] < 450) {
      const r = canvas.getBoundingClientRect(), p = unproject(e.clientX - r.left, e.clientY - r.top);
      if (FFV.onPick) FFV.onPick(+p.yaw.toFixed(2), +p.pitch.toFixed(2), e); else closeCard();
    }
    downAt = null;
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); if (busy) return; cam.hfov = clamp(cam.hfov * Math.exp(e.deltaY * 0.0012), fovMin(), fovMax()); dirty = true; idleSince = performance.now(); }, { passive: false });
  addEventListener("keydown", (e) => {
    if (busy || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName)) return;
    const s = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (s && !(document.activeElement && document.activeElement.tagName === "BUTTON")) { cam.yaw += s[0]; cam.pitch = clamp(cam.pitch + s[1], -88, 88); dirty = true; idleSince = performance.now(); }
    if (e.key === "+" || e.key === "=") zoomBy(-8);
    if (e.key === "-") zoomBy(8);
    if (e.key === "Escape") { closeCard(); mapEl.classList.remove("big"); $("#langMenu").hidden = true; }
  });

  let rotOn = true;
  const rotBtn = $("#rot");
  function setRot(v, save) { rotOn = !!v; rotBtn.setAttribute("aria-pressed", String(rotOn)); if (save) store.set("ff2-rot", rotOn ? "on" : "off"); idleSince = performance.now(); }
  rotBtn.addEventListener("click", () => setRot(!rotOn, true));
  $("#fs").addEventListener("click", () => {
    const el = document.documentElement;
    try {
      if (!(document.fullscreenElement || document.webkitFullscreenElement)) { const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (p && p.catch) p.catch(() => {}); }
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (e) {}
  });

  // ---------- loop ----------
  let lastT = performance.now(), lastScene = "";
  function frame(now) {
    const dt = Math.min(now - lastT, 50); lastT = now;
    if (tweens.length) {
      tweens = tweens.filter((tw) => { const k = clamp((now - tw.t0) / tw.ms, 0, 1); tw.fn(k); if (k === 1) { tw.res(); return false; } return true; });
      dirty = true;
    }
    if (!busy && !ptrs.size && (Math.abs(cam.vy) > 0.01 || Math.abs(cam.vp) > 0.01)) {
      cam.yaw += cam.vy * dt / 16; cam.pitch = clamp(cam.pitch + cam.vp * dt / 16, -88, 88);
      const d = Math.pow(0.9, dt / 16); cam.vy *= d; cam.vp *= d; dirty = true;
    }
    if (rotOn && !EDIT && !busy && !ptrs.size && card.hidden && now - idleSince > 3500 && tex) { cam.yaw += dt * 0.004; dirty = true; }
    if (dirty && cfg) {
      dirty = false; draw(); placeSigns(); placeSpots(); placeCone();
      const s = cam.yaw.toFixed(0) + "|" + cam.pitch.toFixed(1);
      if (s !== lastScene) { lastScene = s; updateScene(); if (FFV.onView) FFV.onView(); }
    }
    requestAnimationFrame(frame);
  }

  // ---------- config ----------
  function normalize(c) {
    c = c || {};
    c.ui = Object.assign({}, DEF_UI, c.ui || {});
    c.theme = c.theme || { preset: "dark" };
    c.brand = c.brand || { credit: true };
    c.nodes = c.nodes || [];
    // v1 / v2.0: one map + node.map → plans[] + node.plan / node.pos
    if (!Array.isArray(c.plans)) {
      c.plans = [];
      if (c.map && c.map.image) {
        c.plans.push({ id: "map", kind: "map", name: { lv: "Karte", ru: "Карта", lt: "Žemėlapis", en: "Map" }, image: c.map.image });
        c.nodes.forEach((n) => { if (n.map && !n.pos) { n.plan = "map"; n.pos = n.map; } });
      }
    }
    delete c.map;
    c.nodes.forEach((n) => {
      delete n.map; if (!n.kind) n.kind = n.aerial ? "aerial" : "outdoor"; n.aerial = n.kind === "aerial";
      (n.links || []).forEach((l) => { if (l.icon) l.icon = iconName(l.icon); });
    });
    return c;
  }
  FFV.normalize = normalize;
  async function setConfig(c, keepView) {
    cfg = normalize(c); byId = {}; cfg.nodes.forEach((n) => byId[n.id] = n);
    applyTheme(); applyBrand(); applyUI();
    const want = params.get("lang"), stored = store.get("ff2-lang");
    if (!keepView) setLang(langs().includes(want) ? want : langs().includes(stored) ? stored : (langs().includes(cfg.ui.defaultLang) ? cfg.ui.defaultLang : langs()[0]));
    else applyText();
    if (cur && !byId[cur.id]) cur = null;
    if (cur) cur = byId[cur.id];
    dirty = true;
  }
  async function showNode(n, keepCam) {
    if (!n) { cur = null; if (tex) { gl.deleteTexture(tex); tex = null; } buildSpots(); updateScene(); dirty = true; return; }
    const img = await loadImg(n.pano);
    const old = tex; tex = makeTex(img); if (old) gl.deleteTexture(old);
    cur = n;
    if (!keepCam) { const s = n.start || { yaw: 0, pitch: 0 }; cam.yaw = s.yaw; cam.pitch = s.pitch; cam.hfov = baseFov(n); }
    if (n.plan && planById(n.plan)) { shownPlan = n.plan; buildMap(); }
    buildSpots(); markStrip(); markMap(); updateScene(); dirty = true;
    if (FFV.onScene) FFV.onScene(cur);
  }

  FFV.api = {
    get cfg() { return cfg; }, get cur() { return cur; }, cam, canvas,
    go, turnTo, project, unproject, draw, showNode, reloadPano, resolve: (p) => resolve(p),
    refresh(keepView = true) { return setConfig(cfg, keepView); },
    setConfig, applyTheme, applyBrand, applyText, applyUI, buildMap, buildStrip, buildSpots, setMapOpen, setThumbs, showPlan,
    get shownPlan() { return shownPlan; }, get mapOpen() { return mapOpen; }, layout,
    baseFov, fovMin, fovMax, T, get lang() { return lang; }, setLang,
    markDirty() { dirty = true; }, closeCard, openCard
  };

  // ---------- boot ----------
  addEventListener("resize", () => { resize(); layout(); });
  resize();
  requestAnimationFrame(frame);
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  (async () => {
    const t0 = performance.now();
    let c = null;
    try { const r = await fetch(BASE + "tour.json", { cache: "no-cache" }); if (!r.ok) throw new Error(r.status); c = await r.json(); }
    catch (e) { if (!EDIT) { showMsg(location.protocol === "file:" ? UI.lv.file + " / " + UI.ru.file : UI.lv.fail); return; } }
    if (EDIT) {
      $("#app").classList.add("editing");
      try { await loadScript(BASE + "editor.js?v=" + VERSION); c = await FFV.editorInit(c); }
      catch (e) { console.error(e); }
    }
    await setConfig(c);
    setRot(cfg.ui.autorotate && !reduce && store.get("ff2-rot") !== "off");
    setThumbs(store.get("ff2-thumbs") !== "0");
    setMapOpen(store.get("ff2-map") === "1" || (store.get("ff2-map") == null && !phone()));
    const start = byId[location.hash.slice(1)] || byId[cfg.start] || cfg.nodes[0];
    if (!start) { $("#loader").classList.add("done"); if (!EDIT) showMsg(S().empty); if (FFV.editorMount) FFV.editorMount(); return; }
    try { await loadImg(start.pano); } catch (e) { showMsg(S().fail); return; }
    await sleep(Math.max(0, (themeOf(cfg).loader === "plane" ? 1200 : 500) - (performance.now() - t0)));
    await showNode(start);
    const target = cam.hfov, z0 = Math.max(fovMin(), target - 12); cam.hfov = z0;
    $("#loader").classList.add("done");
    tween(1400, (k) => { cam.hfov = z0 + (target - z0) * easeOut(k); });
    if (!EDIT && cfg.ui.hint) { $("#hint").classList.remove("off"); setTimeout(() => $("#hint").classList.add("off"), 3200); }
    idleSince = performance.now();
    preload();
    if (FFV.editorMount) FFV.editorMount();
  })();
})();
