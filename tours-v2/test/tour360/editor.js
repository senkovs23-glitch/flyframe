/* Fly Frame 360° v2.1 — tour editor. Loaded by viewer.js only when the address ends with #edit.
   Everything stays in this browser (settings in localStorage, photos in IndexedDB) until you download the tour archive. */
(() => {
  "use strict";
  const FFV = window.FFV;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => ((a + 180) % 360 + 360) % 360 - 180;
  const KEY = location.pathname.replace(/[^/]*$/, "");
  const DRAFT = "ff21-draft:" + KEY;
  const IDBP = KEY + "v21|";
  const LANG_NAMES = { lv: "LV", ru: "RU", lt: "LT", en: "EN" };
  const PAGE = decodeURIComponent(location.pathname.split("/").pop() || "") || "tour360.html";
  let api, cfg;

  // ---------- local files (IndexedDB) ----------
  const files = new Map(); // tour path (relative to tour360/) -> { blob, url }
  let db = null;
  function idb() {
    if (db) return Promise.resolve(db);
    return new Promise((res) => {
      try {
        const r = indexedDB.open("ff360-v2", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("files");
        r.onsuccess = () => { db = r.result; res(db); };
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  async function idbAll() {
    const d = await idb(); if (!d) return [];
    return new Promise((res) => {
      const out = [], rq = d.transaction("files", "readonly").objectStore("files").openCursor();
      rq.onsuccess = () => { const c = rq.result; if (!c) return res(out); if (String(c.key).startsWith(IDBP)) out.push([String(c.key).slice(IDBP.length), c.value]); c.continue(); };
      rq.onerror = () => res(out);
    });
  }
  async function idbPut(path, blob) { const d = await idb(); if (!d) return; try { d.transaction("files", "readwrite").objectStore("files").put(blob, IDBP + path); } catch (e) {} }
  async function idbDel(path) { const d = await idb(); if (!d) return; try { d.transaction("files", "readwrite").objectStore("files").delete(IDBP + path); } catch (e) {} }
  async function idbClear() { for (const [p] of await idbAll()) await idbDel(p); }
  function putFile(path, blob) { const old = files.get(path); if (old) URL.revokeObjectURL(old.url); files.set(path, { blob, url: URL.createObjectURL(blob) }); idbPut(path, blob); }
  function dropFile(path) { const old = files.get(path); if (old) URL.revokeObjectURL(old.url); files.delete(path); idbDel(path); }
  const resolver = (p) => (p && files.has(p)) ? files.get(p).url : FFV.baseResolve(p);

  // ---------- helpers ----------
  const TR = { "ā": "a", "č": "c", "ē": "e", "ģ": "g", "ī": "i", "ķ": "k", "ļ": "l", "ņ": "n", "š": "s", "ū": "u", "ž": "z", "ą": "a", "ę": "e", "ė": "e", "į": "i", "ų": "u", "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ы": "y", "э": "e", "ю": "yu", "я": "ya" };
  const slug = (s) => String(s || "").toLowerCase().split("").map((c) => TR[c] != null ? TR[c] : c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const extOf = (name, blob) => { const m = /\.([a-z0-9]{2,4})$/i.exec(name || ""); if (m) return m[1].toLowerCase().replace("jpeg", "jpg"); const t = (blob && blob.type) || ""; return t.includes("png") ? "png" : t.includes("svg") ? "svg" : t.includes("webp") ? "webp" : "jpg"; };
  const MIME = { jpg: "image/jpeg", png: "image/png", svg: "image/svg+xml", webp: "image/webp", json: "application/json", html: "text/html", css: "text/css", js: "text/javascript", txt: "text/plain" };
  const trio0 = () => Object.fromEntries(cfg.ui.langs.map((l) => [l, ""]));
  const trioOf = (text) => Object.fromEntries(cfg.ui.langs.map((l) => [l, text]));
  const uniqueId = (base, list) => { let id = slug(base) || "skats"; const b = id; let i = 2; while (list.some((n) => n.id === id)) id = b + "-" + i++; return id; };
  const blobOf = (p) => files.get(p) && files.get(p).blob;
  function pickFiles(accept, multiple, dir) {
    return new Promise((res) => {
      const i = document.createElement("input"); i.type = "file"; if (accept) i.accept = accept; i.multiple = !!multiple; if (dir) { i.webkitdirectory = true; i.setAttribute("webkitdirectory", ""); }
      i.style.display = "none"; document.body.appendChild(i);
      i.addEventListener("change", () => { res([...(i.files || [])]); i.remove(); }, { once: true });
      i.click();
    });
  }
  function save() { try { localStorage.setItem(DRAFT, JSON.stringify(cfg)); } catch (e) { status("Черновик не сохранился: в браузере нет места"); } }
  let msg = "Изменения сохраняются в этом браузере автоматически.";
  function status(t) { msg = t; const el = $("#edStatus"); if (el) el.textContent = t; }
  function changed(opts = {}) {
    save();
    if (opts.theme) { api.applyTheme(); api.applyBrand(); api.markDirty(); }
    if (opts.brand) api.applyBrand();
    if (opts.ui) { api.applyUI(); api.applyBrand(); }
    if (opts.full) return api.refresh(true);
    api.applyText();
  }
  function download(name, blob) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // ---------- thumbnails (rendered from the panorama at its start view) ----------
  function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  async function makeThumb(node, w = 480, h = 300) {
    const img = await loadImage(resolver(node.pano));
    const sw = Math.min(2048, img.naturalWidth), sh = sw / 2;
    const c = document.createElement("canvas"); c.width = sw; c.height = sh;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, sw, sh);
    const src = x.getImageData(0, 0, sw, sh).data;
    const out = new ImageData(w, h), D2R = Math.PI / 180;
    const yaw = ((node.start && node.start.yaw) || 0) * D2R, pitch = clamp((node.start && node.start.pitch) || 0, -60, 60) * D2R;
    const f = (w / 2) / Math.tan(80 * D2R / 2), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = i - w / 2 + 0.5, dy = -(j - h / 2 + 0.5), dz = f;
      const y1 = dy * cp + dz * sp, z1 = -dy * sp + dz * cp;
      const wx = dx * cy + z1 * sy, wz = -dx * sy + z1 * cy;
      const lon = Math.atan2(wx, wz), lat = Math.atan2(y1, Math.hypot(wx, wz));
      let u = Math.floor((lon / (2 * Math.PI) + 0.5) * sw); u = ((u % sw) + sw) % sw;
      const v = clamp(Math.floor((0.5 - lat / Math.PI) * sh), 0, sh - 1);
      const si = (v * sw + u) * 4, di = (j * w + i) * 4;
      out.data[di] = src[si]; out.data[di + 1] = src[si + 1]; out.data[di + 2] = src[si + 2]; out.data[di + 3] = 255;
    }
    const o = document.createElement("canvas"); o.width = w; o.height = h; o.getContext("2d").putImageData(out, 0, 0);
    return new Promise((res) => o.toBlob(res, "image/jpeg", 0.86));
  }

  // ---------- zip (store) writer + reader ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(list) {
    const enc = new TextEncoder(), parts = [], cd = [], d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let off = 0;
    for (const f of list) {
      const nm = enc.encode(f.name), crc = crc32(f.data), len = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
      h.setUint32(14, crc, true); h.setUint32(18, len, true); h.setUint32(22, len, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, nm, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
      c.setUint32(16, crc, true); c.setUint32(20, len, true); c.setUint32(24, len, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cd.push(c.buffer, nm);
      off += 30 + nm.length + len;
    }
    const size = cd.reduce((s, b) => s + (b.byteLength || b.length), 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, list.length, true); e.setUint16(10, list.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cd, e.buffer], { type: "application/zip" });
  }
  async function unzip(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(buf.buffer), dec = new TextDecoder();
    let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("not a zip");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + xlen + clen;
      if (name.endsWith("/") || name.startsWith("__MACOSX/")) continue;
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = buf.subarray(start, start + csize);
      let data;
      if (method === 0) data = raw;
      else if (method === 8 && typeof DecompressionStream !== "undefined") data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      else continue;
      out.push({ name, blob: new Blob([data], { type: MIME[extOf(name)] || "" }) });
    }
    return out;
  }

  // ---------- open a tour from the computer (zip or folder) ----------
  async function openTour(entries) {
    const tj = entries.filter((f) => /(^|\/)tour\.json$/.test(f.name)).sort((a, b) => a.name.length - b.name.length)[0];
    if (!tj) { status("В архиве нет файла tour.json"); return; }
    const prefix = tj.name.slice(0, tj.name.length - "tour.json".length);
    let c;
    try { c = JSON.parse(await tj.blob.text()); } catch (e) { status("tour.json повреждён"); return; }
    for (const [p] of [...files]) dropFile(p);
    for (const f of entries) {
      if (!f.name.startsWith(prefix)) continue;
      const rel = f.name.slice(prefix.length);
      if (!rel || !/\.(jpe?g|png|webp|svg)$/i.test(rel)) continue;
      putFile(rel, f.blob);
    }
    cfg = c; await api.setConfig(cfg); cfg = api.cfg; save();
    await api.showNode(cfg.nodes.find((n) => n.id === cfg.start) || cfg.nodes[0]);
    edSpot = null; edPlan = null; mode = null; render(); status(`Открыт тур «${api.T(cfg.title) || "без названия"}»: точек ${cfg.nodes.length}, планов ${cfg.plans.length}`);
  }

  // ---------- export ----------
  async function bytesOf(path, absolute) {
    if (!absolute && files.has(path)) return new Uint8Array(await files.get(path).blob.arrayBuffer());
    const r = await fetch(absolute ? path : FFV.baseResolve(path), { cache: "no-cache" }); if (!r.ok) throw new Error(path);
    return new Uint8Array(await r.arrayBuffer());
  }
  const enc = new TextEncoder();
  async function exportZip(withEditor) {
    const out = JSON.parse(JSON.stringify(cfg)), list = [], problems = [];
    const add = (name, data) => list.push({ name, data });
    const D = "tour360/";
    status("Собираю архив…");
    try { add(PAGE.endsWith(".html") ? PAGE : "tour360.html", await bytesOf(location.href.split("#")[0].split("?")[0], true)); } catch (e) { problems.push(PAGE); }
    for (const f of ["viewer.css", "viewer.js"].concat(withEditor ? ["editor.js"] : [])) {
      try { add(D + f, await bytesOf(FFV.BASE + f, true)); } catch (e) { problems.push(f); }
    }
    for (let i = 0; i < cfg.nodes.length; i++) {
      const n = cfg.nodes[i], o = out.nodes[i];
      status(`Собираю архив… точка ${i + 1} из ${cfg.nodes.length}`);
      try { const name = `panos/${n.id}.${extOf(n.pano, blobOf(n.pano))}`; add(D + name, await bytesOf(n.pano)); o.pano = name; } catch (e) { problems.push(n.pano); }
      try { const t = await makeThumb(n); add(D + `thumbs/${n.id}.jpg`, new Uint8Array(await t.arrayBuffer())); o.thumb = `thumbs/${n.id}.jpg`; } catch (e) { o.thumb = ""; }
    }
    for (let i = 0; i < cfg.plans.length; i++) {
      const p = cfg.plans[i], o = out.plans[i]; if (!p.image) continue;
      try { const name = `plans/${p.id}.${extOf(p.image, blobOf(p.image))}`; add(D + name, await bytesOf(p.image)); o.image = name; } catch (e) { problems.push(p.image); }
    }
    if (cfg.brand && cfg.brand.logo) {
      try { const name = `brand/logo.${extOf(cfg.brand.logo, blobOf(cfg.brand.logo))}`; add(D + name, await bytesOf(cfg.brand.logo)); out.brand.logo = name; } catch (e) { problems.push(cfg.brand.logo); }
    }
    out.generator = "Fly Frame 360° v" + FFV.version;
    add(D + "tour.json", enc.encode(JSON.stringify(out, null, 1)));
    add("LASIMANI.txt", enc.encode(readme(PAGE.endsWith(".html") ? PAGE : "tour360.html")));
    const name = (slug(api.T(cfg.title)) || "tour") + ".zip";
    download(name, zip(list));
    status(problems.length ? `Архив ${name} скачан, но не найдены файлы: ${problems.join(", ")}` : `Архив ${name} скачан: ${list.length} файлов`);
  }
  function readme(page) {
    return [
      "360° tūre / 360° тур — Fly Frame (flyframe.lv)",
      "",
      `Saturs / Состав: ${page} (ieeja / вход) + mape tour360/ (programma, tour.json, panorāmas, plāni, logo).`,
      "",
      `LV: Augšupielādējiet ${page} un mapi tour360/ vienā mapē savā vietnē (piemēram, /360/) un ievietojiet lapā:`,
      `RU: Загрузите ${page} и папку tour360/ в одну папку на сайте (например, /360/) и вставьте на страницу:`,
      "",
      `<iframe src="https://JUSU-VIETNE.lv/360/${page}" allow="fullscreen; gyroscope; accelerometer" loading="lazy" style="width:100%;height:75vh;min-height:420px;border:0"></iframe>`,
      "",
      `LV: Failu ${page} drīkst pārdēvēt; mapes nosaukumu tour360 — nē.`,
      `RU: Файл ${page} можно переименовать; папку tour360 — нельзя.`,
      "LV: Tūre darbojas tikai no tīmekļa vietnes (http/https), ne kā fails datorā.",
      "RU: Тур открывается только с сайта (http/https), а не двойным щелчком по файлу.",
      `LV: Rediģēt: atveriet ${page}#edit. / RU: Редактировать: откройте ${page}#edit.`
    ].join("\r\n");
  }

  // ---------- panel ----------
  const CSS = `
#ed{position:absolute;z-index:30;right:max(12px,env(safe-area-inset-right,0px));top:12px;width:340px;max-height:calc(100% - var(--band) - var(--sb) - 24px);display:flex;flex-direction:column;background:#17191d;color:#e9ebee;border:1px solid #2c3037;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color-scheme:dark}
#ed.min .tabs,#ed.min .eb,#ed.min .ef{display:none}
#ed .eh{display:flex;justify-content:space-between;align-items:center;padding:10px 12px 8px 14px;border-bottom:1px solid #2c3037}
#ed .eh b{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ffb44a}
#ed .eh button{appearance:none;border:0;background:#252930;color:#e9ebee;width:28px;height:28px;border-radius:7px;cursor:pointer}
#ed .tabs{display:flex;gap:4px;padding:8px 12px 0}
#ed .tabs button{flex:1;appearance:none;border:1px solid #2c3037;background:#1f2228;color:#c9cdd4;border-radius:8px;padding:7px 6px;font:600 12px/1 inherit;cursor:pointer}
#ed .tabs button[aria-pressed=true]{background:#e9ebee;color:#17191d;border-color:#e9ebee}
#ed .eb{overflow:auto;padding:10px 14px 12px;display:grid;gap:9px;min-height:0}
#ed .ef{border-top:1px solid #2c3037;padding:10px 12px 12px;display:grid;gap:8px;background:#141619;border-radius:0 0 12px 12px}
#ed .st{color:#ffb44a;font-size:12px;font-weight:600;min-height:1.4em}
#ed .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#ed .row>select,#ed .row>input[type=text]{flex:1;min-width:0}
#ed button.b{appearance:none;border:1px solid #343944;background:#232730;color:#e9ebee;border-radius:8px;padding:7px 10px;font:600 12px/1.15 inherit;cursor:pointer}
#ed button.b:hover{background:#2c313b}
#ed button.b[aria-pressed=true]{background:#3d8bff;border-color:#3d8bff;color:#fff}
#ed button.p{background:#3d8bff;border-color:#3d8bff;color:#fff}
#ed button.p:hover{background:#2f7af0}
#ed .k{margin-top:4px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8ea0b8}
#ed .nm{font-weight:700;font-size:14px;overflow-wrap:anywhere}
#ed small,#ed .note{display:block;color:#8b929c;font-size:11.5px;font-weight:500}
#ed label.l{display:grid;gap:4px;font-size:11.5px;font-weight:600;color:#a7adb6}
#ed input[type=text],#ed input[type=url],#ed textarea,#ed select{width:100%;box-sizing:border-box;background:#0f1113;color:#eef0f2;border:1px solid #30353e;border-radius:7px;padding:6px 8px;font:500 12.5px/1.35 inherit}
#ed textarea{resize:vertical}
#ed input:focus,#ed textarea:focus,#ed select:focus{outline:none;border-color:#3d8bff}
#ed input[type=range]{width:100%;accent-color:#3d8bff}
#ed input[type=color]{width:38px;height:28px;padding:0 2px;border:1px solid #30353e;border-radius:6px;background:#0f1113;cursor:pointer}
#ed .ck{display:inline-flex;gap:7px;align-items:center;font-size:12.5px;cursor:pointer}
#ed .ck input{accent-color:#3d8bff;width:15px;height:15px}
#ed .grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}
#ed .item{display:flex;align-items:center;gap:3px;padding:5px 5px 5px 10px;border-radius:8px;background:#1f2228}
#ed .item.on{outline:1px solid #3d8bff}
#ed .item span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ed .item select{width:auto;flex:none;padding:3px 4px;font-size:11.5px}
#ed .item button{appearance:none;border:0;background:transparent;color:#9aa1ab;width:27px;height:27px;border-radius:6px;cursor:pointer;font:700 13px/1 inherit;flex:none}
#ed .item button:hover{color:#fff;background:#2c313b}
#ed .form{display:grid;gap:8px;padding:10px;border-radius:10px;background:#101215;border:1px solid #2a2e35}
#ed .clr{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px}
#ed .presets{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#ed .presets button{appearance:none;border:1px solid #343944;border-radius:9px;padding:0;overflow:hidden;cursor:pointer;background:#1f2228;color:#e9ebee;font:600 11.5px/1 inherit;text-align:left}
#ed .presets button i{display:block;height:34px;border-bottom:1px solid #343944}
#ed .presets button span{display:block;padding:6px 8px}
#ed .presets button[aria-pressed=true]{outline:2px solid #3d8bff}
#ed .logo-prev{display:flex;align-items:center;justify-content:center;height:56px;border-radius:8px;background:repeating-conic-gradient(#2a2e35 0 25%,#1f2228 0 50%) 0 0/14px 14px;border:1px solid #30353e}
#ed .logo-prev img{max-height:44px;max-width:90%}
#edCross{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;z-index:3;pointer-events:none}
#gl.placing{cursor:copy!important}
#app.editing #top{padding-right:368px}
#app.editing #map{z-index:31}
@media (max-width:720px){#ed{left:8px;right:8px;top:auto;bottom:calc(var(--band) + var(--sb) + 8px);width:auto;max-height:50%}#app.editing #top{padding-right:var(--gap-r)}}
`;
  let tab = "point", mode = null, target = null, edSpot = null, edPlan = null;
  const MODE_TEXT = { link: "Нажмите на панораму там, где должна стоять кнопка перехода", spot: "Нажмите на панораму там, где должна стоять метка", move: "Нажмите на панораму в новом месте", map: "Выберите вкладку плана и нажмите на него в месте этой точки" };
  function setMode(m, t) {
    mode = m; target = t || null; api.canvas.classList.toggle("placing", !!m && m !== "map");
    FFV.onMapPick = m === "map" ? onMapPick : null;
    if (m === "map") { api.setMapOpen(true); if (api.cur && api.cur.plan) api.showPlan(api.cur.plan); }
    render();
  }

  const trioInputs = (path, obj, label, area) => `<label class="l">${label}` + cfg.ui.langs.map((l) =>
    area ? `<textarea rows="2" data-p="${path}.${l}" placeholder="${LANG_NAMES[l]}">${esc(obj && obj[l])}</textarea>`
         : `<input type="text" data-p="${path}.${l}" placeholder="${LANG_NAMES[l]}" value="${esc(obj && obj[l])}">`).join("") + `</label>`;
  const ck = (key, label, on) => `<label class="ck"><input type="checkbox" data-ck="${key}" ${on ? "checked" : ""}> ${label}</label>`;
  const KINDS = [["outdoor", "Снаружи"], ["indoor", "Внутри помещения"], ["aerial", "Аэро (дрон)"]];
  const ICON_LABEL = { auto: "авто", arrow: "стрелка", door: "дверь", up: "лестница ↑", down: "лестница ↓", drone: "дрон" };
  const PLAN_KINDS = [["map", "Карта участка"], ["plan", "План этажа"]];

  function render() {
    const body = $("#ed .eb"); if (!body) return;
    const cur = api.cur, th = FFV.themeOf(cfg);
    $("#ed .tabs").innerHTML = [["point", "Точка"], ["tour", "Тур"], ["plans", "Планы"], ["design", "Дизайн"]].map(([k, v]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${v}</button>`).join("");
    let h = "";
    if (tab === "point") {
      if (!cur) h += `<div class="note">В туре нет точек. Откройте вкладку «Тур» и нажмите «+ Точки из фото».</div>`;
      else {
        const others = cfg.nodes.filter((n) => n.id !== cur.id);
        h += `<div><div class="nm">${esc(api.T(cur.name) || cur.id)}</div><small>${esc(cur.id)} · ${esc(files.has(cur.pano) ? "фото с компьютера" : cur.pano)}</small></div>`;
        h += trioInputs("node.name", cur.name, "Название точки");
        h += `<div class="row"><label class="l" style="flex:1">Тип точки<select id="edKindN">${KINDS.map(([k, v]) => `<option value="${k}" ${FFV.kindOf(cur) === k ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>`;
        h += `<div class="row"><button class="b" data-a="photo">Заменить фото</button></div>`;
        h += `<div class="k">Вид</div><div class="row"><button class="b" data-a="start">Стартовый вид = сейчас</button><button class="b" data-a="north">Север = сейчас</button></div>`;
        const sf = cur.start && cur.start.fov;
        h += `<small>Старт: ${cur.start ? `${(+cur.start.yaw).toFixed(0)}°, наклон ${(+cur.start.pitch).toFixed(0)}°, обзор ${sf ? Math.round(sf) + "°" : "по умолчанию"}` : "не задан"}. Угол обзора — колесо мыши или щипок, затем «Стартовый вид = сейчас». «Север» — повернитесь так, как «вверх» на карте/плане.</small>`;
        h += `<div class="k">На карте / плане</div>`;
        if (!cfg.plans.length) h += `<small>Планов пока нет — добавьте их во вкладке «Планы».</small>`;
        else {
          h += `<div class="row"><select id="edNodePlan"><option value="">— не показывать —</option>${cfg.plans.map((p) => `<option value="${esc(p.id)}" ${cur.plan === p.id ? "selected" : ""}>${esc(api.T(p.name) || p.id)}</option>`).join("")}</select><button class="b" data-a="map" aria-pressed="${mode === "map"}">Отметить место</button></div>`;
          h += `<small>${cur.plan && cur.pos ? "Место отмечено." : "Место не отмечено."}</small>`;
        }
        h += `<div class="k">Переходы</div>`;
        h += (cur.links || []).map((l, i) => {
          const t = cfg.nodes.find((n) => n.id === l.to);
          const auto = t ? FFV.linkIcon(Object.assign({}, l, { icon: "auto" }), cur, t) : "arrow";
          return `<div class="item"><span>→ ${esc(t ? api.T(t.name) || t.id : l.to)}</span><select data-li="${i}" title="Значок">${Object.keys(ICON_LABEL).map((k) => `<option value="${k}" ${(l.icon || "auto") === k ? "selected" : ""}>${k === "auto" ? "авто: " + ICON_LABEL[auto] : ICON_LABEL[k]}</option>`).join("")}</select><button data-a="mvlink" data-i="${i}" title="Перенести">⤧</button><button data-a="dellink" data-i="${i}" title="Удалить">✕</button></div>`;
        }).join("") || `<small>Пока нет переходов.</small>`;
        if (others.length) h += `<div class="row"><select id="edLinkTo">${others.map((n) => `<option value="${esc(n.id)}">${esc(api.T(n.name) || n.id)}</option>`).join("")}</select><button class="b" data-a="addlink" aria-pressed="${mode === "link"}">+ Переход</button></div>`;
        h += `<small>Значок «авто»: дрон — к аэроточке; дверь — между улицей и помещением; лестница — между этажами (по порядку планов).</small>`;
        h += `<div class="k">Метки и плашки</div>`;
        h += (cur.spots || []).map((s, i) => `<div class="item${edSpot === s ? " on" : ""}"><span>${s.kind === "area" ? "▭" : "ⓘ"} ${esc(api.T(s.title) || "без названия")}</span><button data-a="editspot" data-i="${i}" title="Изменить">✎</button><button data-a="mvspot" data-i="${i}" title="Перенести">⤧</button><button data-a="delspot" data-i="${i}" title="Удалить">✕</button></div>`).join("") || `<small>Пока нет меток.</small>`;
        h += `<div class="row"><button class="b" data-a="addspot" aria-pressed="${mode === "spot"}">+ Метка</button></div>`;
        if (edSpot) h += `<div class="form"><div class="row"><label class="ck"><input type="radio" name="edKind" value="info" ${edSpot.kind !== "area" ? "checked" : ""}> Инфо «i»</label><label class="ck"><input type="radio" name="edKind" value="area" ${edSpot.kind === "area" ? "checked" : ""}> Плашка</label></div>` +
          trioInputs("spot.title", edSpot.title, "Заголовок") + trioInputs("spot.text", edSpot.text, "Текст в карточке", true) + `<div class="row"><button class="b" data-a="closespot">Готово</button></div></div>`;
      }
    } else if (tab === "tour") {
      h += trioInputs("tour.title", cfg.title, "Название тура");
      h += trioInputs("tour.badge", cfg.badge, "Значок у названия (пусто — нет)");
      h += `<label class="l">Первая точка<select id="edStart">${cfg.nodes.map((n) => `<option value="${esc(n.id)}" ${n.id === cfg.start ? "selected" : ""}>${esc(api.T(n.name) || n.id)}</option>`).join("")}</select></label>`;
      h += `<div class="k">Точки (${cfg.nodes.length})</div>`;
      h += cfg.nodes.map((n, i) => { const p = cfg.plans.find((x) => x.id === n.plan); return `<div class="item${api.cur && n.id === api.cur.id ? " on" : ""}"><span>${esc(api.T(n.name) || n.id)}${p ? ` <small style="display:inline">· ${esc(api.T(p.name))}</small>` : ""}</span><button data-a="up" data-i="${i}" title="Выше">↑</button><button data-a="open" data-i="${i}" title="Открыть">↗</button><button data-a="delnode" data-i="${i}" title="Удалить">✕</button></div>`; }).join("");
      h += `<div class="row"><button class="b p" data-a="addphotos">+ Точки из фото</button></div><small>Одна или несколько панорам 2:1 (JPG). Имя файла станет id точки. Порядок точек = порядок миниатюр; в ленте они группируются по планам.</small>`;
      h += `<div class="k">Угол обзора</div>`;
      h += `<label class="l">По умолчанию: <b id="vFov">${cfg.ui.fov}°</b><input type="range" min="50" max="120" step="1" data-r="ui.fov" value="${cfg.ui.fov}"></label>`;
      h += `<div class="grid2"><label class="l">Мин. (приближение): <b id="vFovMin">${cfg.ui.fovMin}°</b><input type="range" min="20" max="80" data-r="ui.fovMin" value="${cfg.ui.fovMin}"></label><label class="l">Макс.: <b id="vFovMax">${cfg.ui.fovMax}°</b><input type="range" min="90" max="130" data-r="ui.fovMax" value="${cfg.ui.fovMax}"></label></div>`;
      h += `<div class="k">Языки</div><div class="row">${FFV.LANGS.map((l) => `<label class="ck"><input type="checkbox" data-lang="${l}" ${cfg.ui.langs.includes(l) ? "checked" : ""}> ${LANG_NAMES[l]}</label>`).join("")}</div>`;
      h += `<label class="l">Язык по умолчанию<select id="edDefLang">${cfg.ui.langs.map((l) => `<option value="${l}" ${l === cfg.ui.defaultLang ? "selected" : ""}>${LANG_NAMES[l]}</option>`).join("")}</select></label>`;
      h += `<div class="k">Новый тур</div><div class="row"><button class="b" data-a="newtour">Начать новый тур</button></div><small>Удаляет все точки и планы, дизайн сохраняется.</small>`;
    } else if (tab === "plans") {
      h += `<div class="note">Карта участка (вид сверху) и планы этажей. Порядок — снизу вверх: карта, 1 этаж, 2 этаж… От него зависит значок лестницы ↑/↓. В туре планы показываются вкладками в панели карты.</div>`;
      h += cfg.plans.map((p, i) => `<div class="item${edPlan === p ? " on" : ""}"><span>${p.kind === "plan" ? "▦" : "◩"} ${esc(api.T(p.name) || p.id)} <small style="display:inline">· точек ${cfg.nodes.filter((n) => n.plan === p.id).length}</small></span><button data-a="planup" data-i="${i}" title="Ниже по порядку">↑</button><button data-a="planedit" data-i="${i}" title="Изменить">✎</button><button data-a="planshow" data-i="${i}" title="Показать">◉</button><button data-a="plandel" data-i="${i}" title="Удалить">✕</button></div>`).join("") || `<small>Планов пока нет.</small>`;
      h += `<div class="row"><button class="b p" data-a="planadd">+ Карта или план</button></div><small>JPG/PNG: снимок участка строго сверху или чертёж этажа, север — вверху.</small>`;
      if (edPlan) {
        h += `<div class="form">` + trioInputs("plan.name", edPlan.name, "Название (на вкладке)") +
          `<label class="l">Тип<select id="edPlanKind">${PLAN_KINDS.map(([k, v]) => `<option value="${k}" ${(edPlan.kind || "map") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>` +
          `<div class="row"><button class="b" data-a="planimg">Заменить изображение</button><button class="b" data-a="planclose">Готово</button></div></div>`;
      }
      h += ck("ui.map", "Показывать карту и планы в туре", cfg.ui.map);
    } else {
      const pv = (p) => { const t = FFV.PRESETS[p]; return `<i style="background:linear-gradient(180deg,${t.panel} 0 62%,${t.accent} 62% 70%,${t.panel} 70%)"></i>`; };
      h += `<div class="k">Тема</div><div class="presets">${[["dark", "Тёмная"], ["light", "Светлая"], ["flyframe", "Fly Frame"]].map(([k, v]) => `<button data-preset="${k}" aria-pressed="${th.preset === k}">${pv(k)}<span>${v}</span></button>`).join("")}</div>`;
      h += `<small>${th.preset === "custom" ? "Свои цвета." : "Любое изменение ниже переводит тему в «свои цвета»."}</small>`;
      h += `<div class="k">Цвета</div>`;
      h += `<div class="clr">Фон панелей<input type="color" data-c="panel" value="${esc(th.panel)}"></div>`;
      h += `<label class="l">Прозрачность панелей: <b id="vOp">${Math.round(th.panelOpacity * 100)}%</b><input type="range" min="0.2" max="1" step="0.02" data-t="panelOpacity" value="${th.panelOpacity}"></label>`;
      h += `<div class="clr">Текст и значки<input type="color" data-c="text" value="${esc(th.text)}"></div>`;
      h += `<div class="clr">Кнопки переходов, активный вид<input type="color" data-c="accent" value="${esc(th.accent)}"></div>`;
      h += `<div class="clr">Инфо-метки «i»<input type="color" data-c="accent2" value="${esc(th.accent2 || th.accent)}"></div>`;
      h += `<label class="l">Скругление углов: <b id="vRad">${th.radius}px</b><input type="range" min="0" max="24" step="1" data-t="radius" value="${th.radius}"></label>`;
      h += `<label class="l">Шрифт<select id="edFont">${Object.keys(FFV.FONTS).map((f) => `<option value="${esc(f)}" ${th.font === f ? "selected" : ""}>${f === "system" ? "Системный (нейтральный)" : f}</option>`).join("")}</select></label>`;
      h += `<label class="l">Анимация загрузки<select id="edLoader">${[["ring", "Кольцо"], ["logo", "Полоса под логотипом"], ["plane", "Самолётик Fly Frame"]].map(([k, v]) => `<option value="${k}" ${th.loader === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
      h += `<div class="k">Логотип клиента</div>`;
      const b = cfg.brand || {};
      if (b.logo) h += `<div class="logo-prev"><img src="${esc(resolver(b.logo))}" alt=""></div>`;
      h += `<div class="row"><button class="b" data-a="logo">${b.logo ? "Заменить логотип" : "Загрузить логотип"}</button>${b.logo ? `<button class="b" data-a="logodel">Убрать</button>` : ""}</div><small>PNG с прозрачным фоном или SVG. Без логотипа можно написать название.</small>`;
      if (b.logo) h += `<label class="l">Высота логотипа: <b id="vLogo">${b.logoHeight || 34}px</b><input type="range" min="18" max="56" data-b="logoHeight" value="${b.logoHeight || 34}"></label>` +
        `<label class="l">Цвет логотипа<select id="edTone">${[["original", "Как в файле"], ["auto", "Авто: белый на тёмном, тёмный на светлом"], ["light", "Белый"], ["dark", "Тёмный"]].map(([k, v]) => `<option value="${k}" ${(b.logoTone || "original") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
      else h += `<label class="l">Название вместо логотипа<input type="text" data-bt="name" value="${esc(b.name)}" placeholder="например, Agentūra"></label>`;
      h += `<label class="l">Ссылка с логотипа<input type="url" data-bt="url" value="${esc(b.url)}" placeholder="https://…"></label>`;
      h += ck("brand.credit", "Подпись «360° · Fly Frame»", b.credit !== false);
      h += `<div class="k">Элементы</div><div class="grid2">` +
        ck("ui.thumbs", "Миниатюры", cfg.ui.thumbs) + ck("ui.title", "Название тура", cfg.ui.title) +
        ck("ui.zoom", "Кнопки зума", cfg.ui.zoom) + ck("ui.fullscreen", "Полный экран", cfg.ui.fullscreen) +
        ck("ui.compass", "Курс (компас)", cfg.ui.compass) + ck("ui.hint", "Подсказка «потяните»", cfg.ui.hint) +
        ck("ui.autorotate", "Автовращение", cfg.ui.autorotate) + ck("ui.map", "Карта и планы", cfg.ui.map) + `</div>`;
      h += `<small>Быстрый просмотр темы без сохранения: добавьте к адресу ?theme=light, ?theme=dark или ?theme=flyframe.</small>`;
    }
    body.innerHTML = h;
    $("#edStatus").textContent = mode ? MODE_TEXT[mode] : msg;
  }

  function setPath(p, v) {
    const [root, key, l] = p.split(".");
    const cur = api.cur;
    if (root === "node" && cur) { cur[key] = cur[key] || {}; cur[key][l] = v; }
    else if (root === "spot" && edSpot) { edSpot[key] = edSpot[key] || {}; edSpot[key][l] = v; }
    else if (root === "plan" && edPlan) { edPlan[key] = edPlan[key] || {}; edPlan[key][l] = v; }
    else if (root === "tour") { cfg[key] = cfg[key] || {}; cfg[key][l] = v; }
  }
  function themeSet(k, v) { const t = FFV.themeOf(cfg); delete t.preset; cfg.theme = Object.assign(t, { preset: "custom", [k]: v }); }

  function onPick(yaw, pitch) {
    const cur = api.cur; if (!cur || !mode || mode === "map") return;
    if (mode === "link") { (cur.links = cur.links || []).push({ to: target, yaw, pitch }); status("Переход добавлен"); }
    else if (mode === "move") { Object.assign(target, { yaw, pitch }); status("Перенесено"); }
    else if (mode === "spot") { const s = { kind: "info", yaw, pitch, title: trio0(), text: trio0() }; (cur.spots = cur.spots || []).push(s); edSpot = s; status("Метка добавлена — заполните текст"); }
    setMode(null); changed();
  }
  function onMapPick(planId, x, y) {
    const cur = api.cur; if (!cur || !planId) return;
    cur.plan = planId; cur.pos = [x, y];
    const p = cfg.plans.find((q) => q.id === planId);
    status(`Место точки отмечено на «${p ? api.T(p.name) : planId}»`); setMode(null); changed(); api.buildMap();
  }

  async function addPhotos() {
    const list = await pickFiles("image/jpeg,image/png,image/webp", true);
    if (!list.length) return;
    let first = null;
    const plan = api.cur && api.cur.plan, kind = api.cur ? FFV.kindOf(api.cur) : "outdoor";
    for (const f of list) {
      const base = f.name.replace(/\.[^.]+$/, ""), id = uniqueId(base, cfg.nodes), path = `panos/${id}.${extOf(f.name, f)}`;
      putFile(path, f);
      const n = { id, name: trioOf(base.replace(/[_-]+/g, " ")), pano: path, thumb: "", heading: 0, start: { yaw: 0, pitch: 0 }, kind: kind === "aerial" ? "outdoor" : kind, plan: plan || "", pos: null, links: [], spots: [] };
      cfg.nodes.push(n); if (!first) first = n;
    }
    if (!cfg.start || !cfg.nodes.some((n) => n.id === cfg.start)) cfg.start = cfg.nodes[0].id;
    await changed({ full: true });
    await api.showNode(first);
    tab = "point"; render(); status(`Добавлено точек: ${list.length}. Задайте тип, стартовый вид, место на плане и переходы.`);
  }

  async function onClick(e) {
    const b = e.target.closest("button"); if (!b || !b.closest("#ed")) return;
    if (b.dataset.tab) { tab = b.dataset.tab; setMode(null); return; }
    if (b.dataset.preset) { cfg.theme = Object.assign({ preset: b.dataset.preset }, FFV.PRESETS[b.dataset.preset]); changed({ theme: true }); render(); return; }
    const a = b.dataset.a, i = +b.dataset.i, cur = api.cur;
    if (a === "min") { $("#ed").classList.toggle("min"); b.textContent = $("#ed").classList.contains("min") ? "+" : "—"; return; }
    if (a === "start" && cur) { cur.start = { yaw: +wrap(api.cam.yaw).toFixed(1), pitch: +api.cam.pitch.toFixed(1), fov: Math.round(api.cam.hfov) }; changed(); status("Стартовый вид сохранён вместе с углом обзора"); render(); }
    if (a === "north" && cur) { cur.heading = +wrap(api.cam.yaw).toFixed(1); changed(); status("Север задан"); }
    if (a === "map") {
      if (mode === "map") { setMode(null); return; }
      const sel = $("#edNodePlan"); if (sel && sel.value) { cur.plan = sel.value; save(); }
      if (!cur.plan) { status("Сначала выберите план в списке"); return; }
      setMode("map");
    }
    if (a === "photo" && cur) {
      const [f] = await pickFiles("image/jpeg,image/png,image/webp"); if (!f) return;
      const path = `panos/${cur.id}.${extOf(f.name, f)}`; if (cur.pano !== path && files.has(cur.pano)) dropFile(cur.pano);
      putFile(path, f); cur.pano = path; cur.thumb = ""; changed(); await api.reloadPano(cur); api.buildStrip(); render(); status("Фото заменено");
    }
    if (a === "addlink") setMode("link", $("#edLinkTo").value);
    if (a === "dellink") { cur.links.splice(i, 1); changed(); render(); }
    if (a === "mvlink") setMode("move", cur.links[i]);
    if (a === "addspot") setMode("spot");
    if (a === "editspot") { edSpot = cur.spots[i]; render(); api.turnTo(edSpot.yaw, clamp(edSpot.pitch, -60, 60), 500); }
    if (a === "mvspot") setMode("move", cur.spots[i]);
    if (a === "delspot") { if (edSpot === cur.spots[i]) edSpot = null; cur.spots.splice(i, 1); changed(); render(); }
    if (a === "closespot") { edSpot = null; changed(); render(); }
    if (a === "open") { edSpot = null; await api.go(cfg.nodes[i].id); }
    if (a === "up" && i > 0) { const [n] = cfg.nodes.splice(i, 1); cfg.nodes.splice(i - 1, 0, n); changed(); render(); }
    if (a === "delnode") {
      const n = cfg.nodes[i];
      if (cur && n.id === cur.id && cfg.nodes.length > 1) { status("Сначала откройте другую точку, потом удаляйте эту"); return; }
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "?"; status(`Нажмите «?» ещё раз, чтобы удалить «${api.T(n.name) || n.id}» и переходы на неё`); return; }
      cfg.nodes.splice(i, 1); cfg.nodes.forEach((m) => m.links = (m.links || []).filter((l) => l.to !== n.id));
      if (files.has(n.pano)) dropFile(n.pano);
      if (cfg.start === n.id) cfg.start = cfg.nodes[0] ? cfg.nodes[0].id : "";
      await changed({ full: true }); if (!cfg.nodes.length) await api.showNode(null); render(); status("Точка удалена");
    }
    if (a === "addphotos") await addPhotos();
    // ---- plans ----
    if (a === "planadd") {
      const [f] = await pickFiles("image/jpeg,image/png,image/webp"); if (!f) return;
      const base = f.name.replace(/\.[^.]+$/, ""), id = uniqueId(base, cfg.plans), path = `plans/${id}.${extOf(f.name, f)}`;
      putFile(path, f);
      const p = { id, kind: cfg.plans.some((q) => q.kind === "map") ? "plan" : "map", name: trioOf(base.replace(/[_-]+/g, " ")), image: path };
      cfg.plans.push(p); cfg.ui.map = true; edPlan = p;
      changed(); api.buildMap(); api.setMapOpen(true); api.showPlan(id); render(); status("План добавлен. Дайте ему название; затем во вкладке «Точка» отметьте точки на нём.");
    }
    if (a === "planedit") { edPlan = edPlan === cfg.plans[i] ? null : cfg.plans[i]; if (edPlan) { api.setMapOpen(true); api.showPlan(edPlan.id); } render(); }
    if (a === "planclose") { edPlan = null; render(); }
    if (a === "planshow") { api.setMapOpen(true); api.showPlan(cfg.plans[i].id); }
    if (a === "planup" && i > 0) { const [p] = cfg.plans.splice(i, 1); cfg.plans.splice(i - 1, 0, p); changed(); api.buildMap(); render(); }
    if (a === "planimg" && edPlan) {
      const [f] = await pickFiles("image/jpeg,image/png,image/webp"); if (!f) return;
      const path = `plans/${edPlan.id}.${extOf(f.name, f)}`; if (edPlan.image !== path && files.has(edPlan.image)) dropFile(edPlan.image);
      putFile(path, f); edPlan.image = path; changed(); api.buildMap(); render(); status("Изображение плана заменено. Проверьте места точек.");
    }
    if (a === "plandel") {
      const p = cfg.plans[i];
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "?"; status(`Нажмите «?» ещё раз, чтобы удалить «${api.T(p.name) || p.id}». Точки останутся, но без места на плане.`); return; }
      cfg.plans.splice(i, 1); if (files.has(p.image)) dropFile(p.image);
      cfg.nodes.forEach((n) => { if (n.plan === p.id) { n.plan = ""; n.pos = null; } });
      if (edPlan === p) edPlan = null;
      changed(); api.buildMap(); render(); status("План удалён");
    }
    // ---- brand ----
    if (a === "logo") {
      const [f] = await pickFiles("image/png,image/svg+xml,image/webp,image/jpeg"); if (!f) return;
      const path = `brand/logo.${extOf(f.name, f)}`; if (cfg.brand.logo && files.has(cfg.brand.logo) && cfg.brand.logo !== path) dropFile(cfg.brand.logo);
      putFile(path, f); cfg.brand.logo = path; changed({ brand: true }); render(); status("Логотип загружен");
    }
    if (a === "logodel") { if (files.has(cfg.brand.logo)) dropFile(cfg.brand.logo); cfg.brand.logo = ""; changed({ brand: true }); render(); }
    if (a === "newtour") {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Точно? Нажмите ещё раз"; return; }
      for (const n of cfg.nodes) if (files.has(n.pano)) dropFile(n.pano);
      for (const p of cfg.plans) if (files.has(p.image)) dropFile(p.image);
      cfg.nodes = []; cfg.plans = []; cfg.start = ""; cfg.title = trio0(); cfg.badge = trio0();
      await changed({ full: true }); await api.showNode(null); tab = "tour"; render(); status("Новый тур начат. Добавьте точки из фото.");
    }
    if (a === "zip") exportZip($("#edWithEd") ? $("#edWithEd").checked : true);
    if (a === "json") {
      download("tour.json", new Blob([JSON.stringify(cfg, null, 1)], { type: "application/json" }));
      status(files.size ? `tour.json скачан. Новые файлы (${files.size}) есть только в этом браузере — для них скачайте архив` : "tour.json скачан — положите его в папку tour360");
    }
    if (a === "openzip") { const [f] = await pickFiles(".zip,application/zip"); if (!f) return; status("Открываю архив…"); try { await openTour(await unzip(f)); } catch (err) { status("Не удалось открыть архив: " + err.message); } }
    if (a === "opendir") { const list = await pickFiles("", true, true); if (!list.length) return; await openTour(list.map((f) => ({ name: f.webkitRelativePath || f.name, blob: f }))); }
    if (a === "reset") {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Точно?"; status("Черновик и загруженные фото будут удалены из браузера; откроется тур с сервера"); return; }
      try { localStorage.removeItem(DRAFT); } catch (err) {}
      await idbClear(); location.reload();
    }
  }

  function onInput(e) {
    const el = e.target; if (!el.closest || !el.closest("#ed")) return;
    const cur = api.cur;
    if (el.dataset.p) { setPath(el.dataset.p, el.value); save(); api.applyText(); return; }
    if (el.name === "edKind" && edSpot) { edSpot.kind = el.value; changed(); return; }
    if (el.dataset.li != null && cur) { const l = cur.links[+el.dataset.li]; if (l) { if (el.value === "auto") delete l.icon; else l.icon = el.value; changed(); } return; }
    if (el.id === "edKindN" && cur) { cur.kind = el.value; cur.aerial = el.value === "aerial"; changed(); render(); return; }
    if (el.id === "edNodePlan" && cur) { cur.plan = el.value; if (!el.value) cur.pos = null; else if (cur.pos == null) status("Теперь нажмите «Отметить место» и укажите точку на плане"); changed(); api.buildMap(); if (el.value) api.showPlan(el.value); render(); return; }
    if (el.id === "edPlanKind" && edPlan) { edPlan.kind = el.value; changed(); api.buildMap(); render(); return; }
    if (el.id === "edStart") { cfg.start = el.value; save(); return; }
    if (el.id === "edDefLang") { cfg.ui.defaultLang = el.value; save(); return; }
    if (el.id === "edTone") { cfg.brand.logoTone = el.value; changed({ brand: true }); return; }
    if (el.id === "edFont") { themeSet("font", el.value); changed({ theme: true }); return; }
    if (el.id === "edLoader") { themeSet("loader", el.value); changed({ theme: true }); return; }
    if (el.dataset.c) { themeSet(el.dataset.c, el.value); changed({ theme: true }); api.buildSpots(); markPreset(); return; }
    if (el.dataset.t) { const v = +el.value; themeSet(el.dataset.t, v); changed({ theme: true }); const o = $(el.dataset.t === "radius" ? "#vRad" : "#vOp"); if (o) o.textContent = el.dataset.t === "radius" ? v + "px" : Math.round(v * 100) + "%"; markPreset(); return; }
    if (el.dataset.b) { cfg.brand[el.dataset.b] = +el.value; changed({ brand: true }); const o = $("#vLogo"); if (o) o.textContent = el.value + "px"; return; }
    if (el.dataset.bt) { cfg.brand[el.dataset.bt] = el.value.trim(); changed({ brand: true }); return; }
    if (el.dataset.r) {
      const k = el.dataset.r.split(".")[1], v = +el.value; cfg.ui[k] = v;
      if (k === "fovMin" && cfg.ui.fov < v) cfg.ui.fov = v;
      const o = { fov: "#vFov", fovMin: "#vFovMin", fovMax: "#vFovMax" }[k]; if ($(o)) $(o).textContent = v + "°";
      if (k === "fov" && !(cur && cur.start && cur.start.fov)) api.cam.hfov = clamp(v, api.fovMin(), api.fovMax());
      save(); api.markDirty(); return;
    }
    if (el.dataset.ck) {
      const [root, k] = el.dataset.ck.split(".");
      if (root === "brand") { cfg.brand[k] = el.checked; changed({ brand: true }); return; }
      cfg.ui[k] = el.checked; changed({ ui: true });
      if (k === "map") { api.buildMap(); api.setMapOpen(el.checked); }
      if (k === "thumbs") api.setThumbs(el.checked);
      render(); return;
    }
    if (el.dataset.lang) {
      const set = new Set(cfg.ui.langs); el.checked ? set.add(el.dataset.lang) : set.delete(el.dataset.lang);
      if (!set.size) { el.checked = true; return; }
      cfg.ui.langs = FFV.LANGS.filter((l) => set.has(l));
      if (!cfg.ui.langs.includes(cfg.ui.defaultLang)) cfg.ui.defaultLang = cfg.ui.langs[0];
      changed(); api.setLang(api.lang); render();
    }
  }
  function markPreset() { document.querySelectorAll("#ed .presets button").forEach((b) => b.setAttribute("aria-pressed", "false")); }

  // ---------- init / mount ----------
  FFV.editorInit = async (c0) => {
    for (const [p, blob] of await idbAll()) files.set(p, { blob, url: URL.createObjectURL(blob) });
    FFV.setResolver(resolver);
    let c = null;
    try { c = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (c && c.nodes) msg = "Открыт сохранённый черновик. «Сброс» вернёт тур с сервера."; else c = null; } catch (e) { c = null; }
    c = c || c0 || { title: { lv: "Jauna tūre" }, nodes: [], plans: [], start: "" };
    cfg = c; return c;
  };
  FFV.editorMount = () => {
    api = FFV.api; cfg = api.cfg;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const cross = document.createElement("div"); cross.innerHTML = `<svg id="edCross" viewBox="0 0 22 22"><path d="M11 1v7M11 14v7M1 11h7M14 11h7" stroke="#ffb44a" stroke-width="1.6"/></svg>`; $("#app").appendChild(cross.firstChild);
    const p = document.createElement("section"); p.id = "ed";
    p.innerHTML = `<div class="eh"><b>Редактор тура · v${FFV.version}</b><button data-a="min" title="Свернуть">—</button></div><div class="tabs"></div><div class="eb"></div>
      <div class="ef"><div class="st" id="edStatus"></div>
        <div class="row"><button class="b p" data-a="zip">Скачать архив тура (.zip)</button><button class="b" data-a="json">tour.json</button></div>
        <label class="ck"><input type="checkbox" id="edWithEd" checked> С редактором в архиве (для правок позже)</label>
        <div class="row"><button class="b" data-a="openzip">Открыть архив</button><button class="b" data-a="opendir">Открыть папку</button><button class="b" data-a="reset">Сброс</button></div></div>`;
    $("#app").appendChild(p);
    p.addEventListener("click", onClick);
    p.addEventListener("input", onInput);
    FFV.onPick = onPick;
    FFV.onScene = () => { edSpot = null; if (mode && mode !== "map") setMode(null); else render(); };
    render();
  };
})();
