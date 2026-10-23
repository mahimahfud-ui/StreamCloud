/* StreamCloud Admin Ultra — additive layer on top of admin-listings.js.
   DOM-only: no secrets, no innerHTML with data. Adds: +/- steppers,
   Catalogue Pro (organized catalogue, health score, bulk, quick edit) and AI tools. */
(function () {
  "use strict";
  var CFG = window.STREAMCLOUD_SUPABASE || {}, BASE = String(CFG.url || "").replace(/\/+$/, "");
  var SECTIONS = { movie: "Movies", series: "Web Series", sites: "Websites", apps: "Movie Apps", music: "Music Apps" };
  var PK = "scx-ultra-prefs", prefs = (function () { try { return JSON.parse(localStorage.getItem(PK) || "{}") || {}; } catch (e) { return {}; } })();
  function savePrefs() { try { localStorage.setItem(PK, JSON.stringify(prefs)); } catch (e) { /* ignore */ } }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, a, kids) {
    var n = document.createElement(tag); a = a || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (k === "text") n.textContent = v; else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function isHttps(v) { return /^https:\/\/[^\s]+$/i.test(String(v || "").trim()); }
  function clamp(v, lo, hi, d) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
  function api(fn, body) {
    var s = null; try { s = JSON.parse(sessionStorage.getItem("streamcloud-admin-session") || "null"); } catch (e) { /* ignore */ }
    var hd = { "Content-Type": "application/json", apikey: CFG.anonKey }; if (s && s.token) hd["x-admin-token"] = s.token;
    return fetch(BASE + "/functions/v1/" + fn, { method: "POST", headers: hd, credentials: "omit", body: JSON.stringify(body || {}) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status >= 400) { var e = new Error(d.error || "Request failed (" + r.status + ")."); e.status = r.status; throw e; }
          return d;
        });
      });
  }
  function toast(text, kind) {
    var t = h("div", { class: "ux-toast " + (kind || ""), role: "status", text: text }); document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function refreshPublic() { if (typeof window.STREAMCLOUD_RELOAD_TITLES === "function") { try { window.STREAMCLOUD_RELOAD_TITLES(); } catch (e) { /* ignore */ } } }

  /* ---------- styles ---------- */
  document.head.appendChild(h("style", { text:
    ".ux-step{display:flex;width:100%}.ux-step input{flex:1;min-width:0;border-radius:0!important;text-align:center;-moz-appearance:textfield}.ux-step input::-webkit-inner-spin-button,.ux-step input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}" +
    ".ux-step button{width:40px;flex:none;border:1px solid var(--border,#343434);background:var(--card,#242424);color:var(--text,#fff);font-size:19px;line-height:1;cursor:pointer;user-select:none;touch-action:manipulation}.ux-step button:first-child{border-radius:8px 0 0 8px}.ux-step button:last-child{border-radius:0 8px 8px 0}.ux-step button:hover,.ux-step button:active{background:var(--red,#e50914);border-color:var(--red,#e50914)}" +
    ".ux-tools{display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap}.ux-tbtn{border:1px solid var(--border,#343434);background:var(--card,#242424);color:var(--text,#fff);border-radius:999px;padding:6px 11px;font-size:12px;cursor:pointer}.ux-tbtn.on{background:var(--red,#e50914);border-color:var(--red,#e50914)}" +
    ".ux-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin:0 0 12px}.ux-stat{padding:10px 12px;border:1px solid var(--border,#343434);border-radius:12px;background:var(--card,#242424)}.ux-stat b{display:block;font-size:21px}.ux-stat small{color:var(--dim,#a7a7a7);font-size:11px}" +
    ".ux-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.ux-bar .scx-in{width:auto;flex:1 1 150px}.ux-sticky{position:sticky;top:-1px;z-index:5;background:var(--panel,#181818);padding:8px 0}" +
    ".ux-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.ux-listv{display:flex;flex-direction:column;gap:8px}.ux-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--border,#343434);border-radius:12px;background:var(--card,#242424)}.ux-card.hid{opacity:.62}.ux-listv .ux-card{flex-direction:row;align-items:center}" +
    ".ux-thumb{flex:none;width:100%;aspect-ratio:16/10;border-radius:8px;background:rgba(255,255,255,.04);display:grid;place-items:center;overflow:hidden;font-size:26px;font-weight:700;color:var(--dim,#a7a7a7)}.ux-thumb img{width:100%;height:100%;object-fit:contain}.ux-listv .ux-thumb{width:64px;aspect-ratio:1/1}" +
    ".ux-cb{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}.ux-cb b{overflow-wrap:anywhere}.ux-cb small{color:var(--dim,#a7a7a7)}.ux-meter{height:5px;border-radius:9px;background:rgba(255,255,255,.1);overflow:hidden}.ux-meter i{display:block;height:100%;background:#46d369}.ux-meter.mid i{background:#f5a623}.ux-meter.low i{background:#e5484d}" +
    ".ux-iss{display:flex;gap:4px;flex-wrap:wrap}.ux-iss span,.ux-pill{font-size:10.5px;padding:2px 7px;border-radius:999px;border:1px solid var(--border,#343434);color:var(--dim,#a7a7a7);background:transparent}button.ux-pill{cursor:pointer;color:var(--text,#fff)}button.ux-pill.on{background:var(--red,#e50914);border-color:var(--red,#e50914)}.ux-sel{position:absolute;top:8px;left:8px;z-index:2;background:rgba(0,0,0,.55);border-radius:6px;padding:3px}.ux-listv .ux-sel{position:static;background:none}" +
    ".ux-acts{display:flex;gap:6px;flex-wrap:wrap}.ux-acts .scx-btn{padding:5px 10px;font-size:12px}.ux-panel{margin:0 0 12px;padding:12px;border:1px solid var(--border,#343434);border-radius:12px;background:rgba(255,255,255,.025)}.ux-panel h3{margin:0 0 8px;font-size:14px}.ux-prog{height:6px;border-radius:9px;background:rgba(255,255,255,.1);overflow:hidden;margin:6px 0}.ux-prog i{display:block;height:100%;width:0;background:var(--red,#e50914);transition:width .2s}" +
    ".ux-fillrow{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--border,#343434);font-size:13px}.ux-fillrow img{width:34px;height:50px;object-fit:cover;border-radius:4px}.ux-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:900;background:#111;color:#fff;border:1px solid #444;border-radius:10px;padding:10px 16px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.5)}.ux-toast.err{border-color:#e5484d}.ux-toast.ok{border-color:#46d369}"
  }));

  /* ---------- number steppers (+ / -) ---------- */
  function dec(s) { var m = String(s).split("."); return m[1] ? m[1].length : 0; }
  function bump(inp, dir) {
    var st = parseFloat(inp.step) || 1, mn = inp.min !== "" ? parseFloat(inp.min) : -Infinity, mx = inp.max !== "" ? parseFloat(inp.max) : Infinity, v = parseFloat(inp.value);
    if (isNaN(v)) v = isFinite(mn) ? mn : 0; else v = Math.min(mx, Math.max(mn, v + dir * st));
    inp.value = v.toFixed(Math.max(dec(st), dec(inp.value)));
    inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function stepBtn(inp, dir) {
    var timer, iv;
    function stop() { clearTimeout(timer); clearInterval(iv); }
    var b = h("button", { type: "button", tabindex: "-1", "aria-label": dir > 0 ? "Increase" : "Decrease", text: dir > 0 ? "+" : "−" });
    b.addEventListener("pointerdown", function (e) { e.preventDefault(); bump(inp, dir); timer = setTimeout(function () { iv = setInterval(function () { bump(inp, dir); }, 70); }, 420); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, stop); });
    b.addEventListener("click", function (e) { if (e.detail === 0) bump(inp, dir); });
    return b;
  }
  function addSteppers() {
    $$(".scx-box input[type=number]").forEach(function (inp) {
      if (inp.dataset.ux || !inp.parentNode) return; inp.dataset.ux = "1";
      var wrap = h("div", { class: "ux-step" }); inp.parentNode.replaceChild(wrap, inp);
      wrap.appendChild(stepBtn(inp, -1)); wrap.appendChild(inp); wrap.appendChild(stepBtn(inp, 1));
    });
  }

  /* ---------- Catalogue Pro ---------- */
  var KEYS = ["section", "category", "name", "url", "description", "logo_url", "poster_url", "official_url", "download_url", "platform", "version", "imdb_id", "year", "imdb_rating", "season_count", "episode_count", "genres", "ads"];
  var NUM = { year: 1, imdb_rating: 1, season_count: 1, episode_count: 1 };
  var pro = { rows: [], view: prefs.view || "grid", sec: "all", sort: "new", q: "", attn: false, issue: "", sel: {}, root: null };
  function isRec(r) { return r.section === "movie" || r.section === "series"; }
  function health(r, dupes) {
    var s = 0, tot = 0, iss = [];
    function chk(ok, w, m) { tot += w; if (ok) s += w; else iss.push(m); }
    chk(r.name && r.name.length > 1, 10, "Name"); chk(isHttps(r.url), 15, "HTTPS link"); chk(r.poster_url || r.logo_url, 20, "Image");
    chk((r.description || "").length >= 60, 20, "Description"); chk(r.category, 5, "Category");
    if (isRec(r)) { chk(r.year, 10, "Year"); chk(r.imdb_rating != null, 10, "Rating"); chk(r.genres && r.genres.length, 10, "Genres"); }
    var dk = String(r.url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();
    if (dk && dupes[dk] > 1) iss.push("Duplicate link");
    return { score: Math.round(s / tot * 100), iss: iss };
  }
  function scoreAll() {
    var dupes = {}; pro.rows.forEach(function (r) { var k = String(r.url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase(); if (k) dupes[k] = (dupes[k] || 0) + 1; });
    pro.rows.forEach(function (r) { r._h = health(r, dupes); });
  }
  function injectProTab() {
    var tabs = $(".scx-tabs"); if (!tabs || $(".ux-protab", tabs)) return; var anchor = null;
    $$(".scx-tab", tabs).forEach(function (b) { if (b.textContent === "Content") anchor = b; });
    if (anchor) anchor.after(h("button", { class: "scx-tab ux-protab", type: "button", text: "Catalogue Pro ✦", onclick: openPro }));
  }
  function openPro() {
    var tabs = $(".scx-tabs"), body = tabs && tabs.parentNode; if (!body) return;
    while (tabs.nextSibling) body.removeChild(tabs.nextSibling);
    $$(".scx-tab", tabs).forEach(function (t) { var on = t.classList.contains("ux-protab"); t.classList.toggle("on", on); t.setAttribute("aria-selected", String(on)); });
    var ttl = $("#scxTitle"); if (ttl) ttl.textContent = "Catalogue Pro";
    pro.root = h("div", { class: "ux-pro" }, [h("p", { class: "scx-help", text: "Loading catalogue…" })]); body.appendChild(pro.root); pro.sel = {};
    loadPro();
  }
  function loadPro() {
    return api("admin-listings", { action: "list" }).then(function (d) { pro.rows = d.listings || []; scoreAll(); renderPro(); })
      .catch(function (e) { pro.root.textContent = e.message || "Could not load the catalogue."; });
  }
  function filtered() {
    var q = pro.q.toLowerCase();
    var out = pro.rows.filter(function (r) {
      if (pro.sec !== "all" && r.section !== pro.sec) return false;
      if (pro.attn && r._h.score >= 80) return false;
      if (pro.issue && r._h.iss.indexOf(pro.issue) < 0) return false;
      return !q || [r.name, r.category, r.url, r.description].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    out.sort(function (a, b) {
      if (pro.sort === "name") return String(a.name).localeCompare(String(b.name));
      if (pro.sort === "health") return a._h.score - b._h.score;
      if (pro.sort === "section") return String(a.section).localeCompare(String(b.section)) || String(a.name).localeCompare(String(b.name));
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return out;
  }
  function stat(label, value) { return h("div", { class: "ux-stat" }, [h("b", { text: String(value) }), h("small", { text: label })]); }
  function renderPro() {
    var root = pro.root; root.textContent = ""; var rows = pro.rows;
    var avg = rows.length ? Math.round(rows.reduce(function (s, r) { return s + r._h.score; }, 0) / rows.length) : 0;
    root.appendChild(h("div", { class: "ux-stats" }, [stat("Total", rows.length), stat("Published", rows.filter(function (r) { return r.published; }).length),
      stat("Hidden", rows.filter(function (r) { return !r.published; }).length), stat("Need attention", rows.filter(function (r) { return r._h.score < 80; }).length), stat("Avg health", avg + "%")]));
    var aiBox = h("div", {}); pro.aiBox = aiBox;
    root.appendChild(h("div", { class: "ux-bar" }, [
      h("button", { class: "scx-btn pri", type: "button", text: "✦ Catalogue audit", onclick: showAudit }),
      h("button", { class: "scx-btn pri", type: "button", text: "✦ Fill missing details", onclick: runFill }),
      h("button", { class: "scx-btn", type: "button", text: "↻ Refresh", onclick: loadPro })]));
    root.appendChild(aiBox);
    var chips = h("div", { class: "ux-bar" }); pro.chips = chips; root.appendChild(chips);
    var search = h("input", { class: "scx-in", type: "search", placeholder: "Search name, category, link…", "aria-label": "Search", value: pro.q });
    search.addEventListener("input", function () { pro.q = search.value; renderItems(); });
    var sort = h("select", { class: "scx-in", "aria-label": "Sort" });
    [["new", "Newest first"], ["name", "Name A–Z"], ["health", "Lowest health first"], ["section", "By section"]].forEach(function (o) { sort.appendChild(h("option", { value: o[0], text: o[1], selected: pro.sort === o[0] })); });
    sort.addEventListener("change", function () { pro.sort = sort.value; renderItems(); });
    var attn = h("input", { type: "checkbox", checked: pro.attn }); attn.addEventListener("change", function () { pro.attn = attn.checked; renderItems(); });
    var vg = h("button", { class: "ux-tbtn" + (pro.view === "grid" ? " on" : ""), type: "button", text: "▦ Grid" }), vl = h("button", { class: "ux-tbtn" + (pro.view === "list" ? " on" : ""), type: "button", text: "☰ List" });
    function setView(v) { pro.view = v; prefs.view = v; savePrefs(); vg.classList.toggle("on", v === "grid"); vl.classList.toggle("on", v === "list"); renderItems(); }
    vg.addEventListener("click", function () { setView("grid"); }); vl.addEventListener("click", function () { setView("list"); });
    root.appendChild(h("div", { class: "ux-bar ux-sticky" }, [search, sort, h("label", { class: "scx-help" }, [attn, " Needs attention"]), vg, vl]));
    pro.bulk = h("div", { class: "ux-bar" }); root.appendChild(pro.bulk);
    pro.edBox = h("div", {}); root.appendChild(pro.edBox);
    pro.list = h("div", {}); root.appendChild(pro.list); renderItems();
  }
  function renderChips() {
    pro.chips.textContent = "";
    [["all", "All"]].concat(Object.keys(SECTIONS).map(function (k) { return [k, SECTIONS[k]]; })).forEach(function (s) {
      var n = s[0] === "all" ? pro.rows.length : pro.rows.filter(function (r) { return r.section === s[0]; }).length;
      pro.chips.appendChild(h("button", { class: "ux-pill" + (pro.sec === s[0] ? " on" : ""), type: "button", text: s[1] + " · " + n, onclick: function () { pro.sec = s[0]; renderItems(); } }));
    });
    if (pro.issue) pro.chips.appendChild(h("button", { class: "ux-pill on", type: "button", text: "Issue: " + pro.issue + " ✕", onclick: function () { pro.issue = ""; renderItems(); } }));
  }
  function updBulk() {
    var ids = Object.keys(pro.sel).filter(function (k) { return pro.sel[k]; }), b = pro.bulk; b.textContent = ""; if (!ids.length) return;
    var sec = h("select", { class: "scx-in", "aria-label": "Move to section" }); Object.keys(SECTIONS).forEach(function (k) { sec.appendChild(h("option", { value: k, text: SECTIONS[k] })); });
    var cat = h("input", { class: "scx-in", type: "text", value: "General", maxlength: "60", "aria-label": "Category" });
    function run(op) {
      if (op === "delete" && !confirm("Permanently delete " + ids.length + " item(s)?")) return;
      var p = { action: "bulk", operation: op, ids: ids }; if (op === "move") { p.section = sec.value; p.category = cat.value.trim() || "General"; }
      api("admin-listings", p).then(function () { toast("Done · " + ids.length + " item(s)", "ok"); pro.sel = {}; refreshPublic(); return loadPro(); }).catch(function (e) { toast(e.message, "err"); });
    }
    b.appendChild(h("b", { text: ids.length + " selected" }));
    [["publish", "Publish"], ["hide", "Hide"]].forEach(function (o) { b.appendChild(h("button", { class: "scx-btn", type: "button", text: o[1], onclick: function () { run(o[0]); } })); });
    b.appendChild(sec); b.appendChild(cat); b.appendChild(h("button", { class: "scx-btn", type: "button", text: "Move", onclick: function () { run("move"); } }));
    b.appendChild(h("button", { class: "scx-btn dng", type: "button", text: "Delete", onclick: function () { run("delete"); } }));
    b.appendChild(h("button", { class: "scx-btn", type: "button", text: "Clear", onclick: function () { pro.sel = {}; renderItems(); } }));
  }
  function renderItems() {
    renderChips(); var list = pro.list, rows = filtered(); list.textContent = ""; list.className = pro.view === "grid" ? "ux-grid" : "ux-listv";
    if (!rows.length) { list.className = ""; list.appendChild(h("p", { class: "scx-help", text: pro.rows.length ? "Nothing matches these filters." : "No database listings yet. Use Add item or Title lookup." })); updBulk(); return; }
    rows.forEach(function (r) {
      var img = r.poster_url || r.logo_url, th = h("div", { class: "ux-thumb", text: isHttps(img) ? "" : String(r.name || "?").charAt(0).toUpperCase() });
      if (isHttps(img)) { var im = h("img", { src: img, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }); im.onerror = function () { im.remove(); th.textContent = String(r.name || "?").charAt(0).toUpperCase(); }; th.appendChild(im); }
      var sc = r._h.score, ck = h("input", { type: "checkbox", "aria-label": "Select " + r.name, checked: !!pro.sel[r.id] });
      ck.addEventListener("change", function () { pro.sel[r.id] = ck.checked; updBulk(); });
      var iss = h("div", { class: "ux-iss" }); r._h.iss.slice(0, 4).forEach(function (m) { iss.appendChild(h("span", { text: m })); });
      var vis = h("button", { class: "scx-btn", type: "button", text: r.published ? "Hide" : "Publish" });
      vis.addEventListener("click", function () { api("admin-listings", { action: "bulk", operation: r.published ? "hide" : "publish", ids: [r.id] }).then(function () { r.published = !r.published; refreshPublic(); renderItems(); }).catch(function (e) { toast(e.message, "err"); }); });
      var del = h("button", { class: "scx-btn dng", type: "button", text: "Delete" });
      del.addEventListener("click", function () { if (!confirm("Delete “" + r.name + "” permanently?")) return; api("admin-listings", { action: "delete", id: r.id }).then(function () { pro.rows = pro.rows.filter(function (x) { return x.id !== r.id; }); refreshPublic(); renderItems(); toast("Deleted", "ok"); }).catch(function (e) { toast(e.message, "err"); }); });
      var edit = h("button", { class: "scx-btn", type: "button", text: "Edit", onclick: function () { openEditor(r); } });
      list.appendChild(h("div", { class: "ux-card" + (r.published ? "" : " hid") }, [h("label", { class: "ux-sel" }, [ck]), th,
        h("div", { class: "ux-cb" }, [h("b", { text: r.name }), h("small", { text: (r.category || "—") + " · " + (SECTIONS[r.section] || r.section) + (r.published ? "" : " · Hidden") }),
          h("div", { class: "ux-meter " + (sc < 50 ? "low" : sc < 80 ? "mid" : "") }, [h("i", { style: "width:" + sc + "%" })]), h("small", { text: "Health " + sc + "%" }), iss]),
        h("div", { class: "ux-acts" }, [edit, vis, del])]));
    });
    updBulk();
  }
  function fld(label, tag, attrs, val) {
    var c = h(tag, Object.assign({ class: "scx-in" }, attrs)); if (tag === "textarea") c.value = val || ""; else if (val != null && val !== "") c.value = val;
    return { wrap: h("label", { class: "scx-f" }, [label, c]), c: c };
  }
  function listingFrom(r, patch) {
    var o = {}; KEYS.forEach(function (k) { var v = patch && k in patch ? patch[k] : r[k]; if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length && k !== "genres")) return; o[k] = NUM[k] ? String(v) : v; });
    return o;
  }
  function openEditor(r) {
    var rec = isRec(r), box = pro.edBox; box.textContent = "";
    var F = { name: fld("Name", "input", { type: "text", maxlength: "160" }, r.name), category: fld("Category", "input", { type: "text", maxlength: "60" }, r.category),
      url: fld("Link (https://…)", "input", { type: "url" }, r.url), img: fld(rec ? "Poster image URL" : "Logo image URL", "input", { type: "url" }, rec ? r.poster_url : r.logo_url),
      desc: fld("Description", "textarea", { rows: "3", maxlength: "1500" }, r.description) };
    var kids = [F.name.wrap, F.category.wrap, F.url.wrap, F.img.wrap, F.desc.wrap];
    if (rec) {
      F.year = fld("Release year", "input", { type: "number", min: "1870", max: "2100" }, r.year); F.rating = fld("IMDb rating", "input", { type: "number", min: "0", max: "10", step: "0.1" }, r.imdb_rating);
      F.genres = fld("Genres (comma-separated)", "input", { type: "text", maxlength: "500" }, (r.genres || []).join(", ")); kids.push(F.year.wrap, F.rating.wrap, F.genres.wrap);
      if (r.section === "series") { F.seasons = fld("Season count", "input", { type: "number", min: "1", max: "5000" }, r.season_count); F.eps = fld("Episode count", "input", { type: "number", min: "1", max: "100000" }, r.episode_count); kids.push(F.seasons.wrap, F.eps.wrap); }
    }
    var panel = h("div", { class: "ux-panel" }, [h("h3", { text: "Quick edit · " + r.name })]), grid = h("div", { class: "scx-grid" }, kids);
    panel.appendChild(grid);
    var save = h("button", { class: "scx-btn pri", type: "button", text: "Save changes" });
    save.addEventListener("click", function () {
      var patch = { name: F.name.c.value.trim(), category: F.category.c.value.trim(), url: F.url.c.value.trim(), description: F.desc.c.value.trim() }; patch[rec ? "poster_url" : "logo_url"] = F.img.c.value.trim();
      if (rec) { patch.year = F.year.c.value.trim(); patch.imdb_rating = F.rating.c.value.trim(); patch.genres = F.genres.c.value.split(",").map(function (g) { return g.trim(); }).filter(Boolean); if (F.seasons) { patch.season_count = F.seasons.c.value.trim(); patch.episode_count = F.eps.c.value.trim(); } }
      save.disabled = true;
      api("admin-listings", { action: "update", id: r.id, listing: listingFrom(r, patch), keepUnverifiedDownload: true }).then(function (d) {
        var i = pro.rows.indexOf(r); if (d.listing && i >= 0) pro.rows[i] = d.listing; scoreAll(); box.textContent = ""; refreshPublic(); renderItems(); toast("Saved", "ok");
      }).catch(function (e) { save.disabled = false; toast(e.message || "Save failed", "err"); });
    });
    panel.appendChild(h("div", { class: "scx-actions" }, [save, h("button", { class: "scx-btn", type: "button", text: "Cancel", onclick: function () { box.textContent = ""; } })]));
    box.appendChild(panel); box.scrollIntoView({ block: "nearest" });
  }

  /* ---------- AI tools ---------- */
  function showAudit() {
    var box = pro.aiBox; box.textContent = ""; var counts = {};
    pro.rows.forEach(function (r) { r._h.iss.forEach(function (m) { counts[m] = (counts[m] || 0) + 1; }); });
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var panel = h("div", { class: "ux-panel" }, [h("h3", { text: "✦ Catalogue audit — data quality" })]);
    if (!keys.length) panel.appendChild(h("p", { class: "scx-help", text: "Everything looks complete. Great catalogue!" }));
    else {
      var potential = pro.rows.filter(function (r) { return r._h.score < 80; }).length;
      panel.appendChild(h("p", { class: "scx-help", text: potential + " of " + pro.rows.length + " items score below 80%. Tap an issue to filter the catalogue, then fix items in bulk or fill missing details (movies/series)." }));
      var row = h("div", { class: "ux-iss" }); keys.forEach(function (k) { row.appendChild(h("button", { class: "ux-pill", type: "button", text: k + " · " + counts[k], onclick: function () { pro.issue = k; renderItems(); } })); }); panel.appendChild(row);
    }
    box.appendChild(panel);
  }
  function runFill() {
    var box = pro.aiBox; box.textContent = "";
    var cands = pro.rows.filter(function (r) { return isRec(r) && (!r.poster_url || !r.year || r.imdb_rating == null || (r.description || "").length < 40 || !(r.genres || []).length); }).slice(0, 20);
    var panel = h("div", { class: "ux-panel" }, [h("h3", { text: "✦ Fill missing details — missing metadata only (never overwrites)" })]); box.appendChild(panel);
    if (!cands.length) { panel.appendChild(h("p", { class: "scx-help", text: "All movies/series already have poster, year, rating, genres and a description." })); return; }
    var prog = h("div", { class: "ux-prog" }, [h("i")]), status = h("p", { class: "scx-help", text: "Looking up 0 / " + cands.length + "…" }); panel.appendChild(status); panel.appendChild(prog);
    var results = [], i = 0;
    function next() {
      if (i >= cands.length) { status.textContent = "Review the suggestions, then apply."; return showResults(); }
      var r = cands[i]; status.textContent = "Looking up " + (i + 1) + " / " + cands.length + ": " + r.name; prog.firstChild.style.width = Math.round(i / cands.length * 100) + "%";
      api("admin-detect", { mode: "title-lookup", title: r.name, year: r.year ? Number(r.year) : null, section: r.section, generateSummary: true }).then(function (d) {
        var f = d.detected || {}, p = {};
        if (!r.poster_url && isHttps(f.poster_url)) p.poster_url = f.poster_url; if (!r.year && f.year) p.year = f.year;
        if (r.imdb_rating == null && f.imdb_rating != null) p.imdb_rating = f.imdb_rating; if (!(r.genres || []).length && f.genres && f.genres.length) p.genres = f.genres;
        if ((r.description || "").length < 40 && f.description) p.description = f.description; if (!r.imdb_id && f.imdb_id) p.imdb_id = f.imdb_id;
        if (r.section === "series") { if (!r.season_count && f.season_count) p.season_count = f.season_count; if (!r.episode_count && f.episode_count) p.episode_count = f.episode_count; }
        results.push({ r: r, p: p, on: Object.keys(p).length > 0 });
      }).catch(function () { results.push({ r: r, p: {}, on: false, err: true }); }).then(function () { i++; next(); });
    }
    function showResults() {
      prog.firstChild.style.width = "100%"; var list = h("div", {}); panel.appendChild(list);
      results.forEach(function (x) {
        var ck = h("input", { type: "checkbox", checked: x.on, disabled: !Object.keys(x.p).length }); ck.addEventListener("change", function () { x.on = ck.checked; });
        var fills = Object.keys(x.p).map(function (k) { return k.replace("_url", "").replace("imdb_", "").replace("_", " "); }).join(", ");
        list.appendChild(h("div", { class: "ux-fillrow" }, [ck, x.p.poster_url ? h("img", { src: x.p.poster_url, alt: "", referrerpolicy: "no-referrer" }) : null,
          h("div", {}, [h("b", { text: x.r.name }), h("br"), h("small", { text: x.err ? "No verified match" : fills ? "Will fill: " + fills : "Nothing new found" })])]));
      });
      var apply = h("button", { class: "scx-btn pri", type: "button", text: "Apply selected" });
      apply.addEventListener("click", function () {
        var todo = results.filter(function (x) { return x.on; }), n = 0; apply.disabled = true;
        (function go() {
          if (n >= todo.length) { toast("Auto-Fill applied to " + todo.length + " item(s)", "ok"); refreshPublic(); return loadPro(); }
          var x = todo[n]; apply.textContent = "Saving " + (n + 1) + " / " + todo.length + "…";
          api("admin-listings", { action: "update", id: x.r.id, listing: listingFrom(x.r, x.p), keepUnverifiedDownload: true }).catch(function (e) { toast(x.r.name + ": " + e.message, "err"); }).then(function () { n++; go(); });
        })();
      });
      panel.appendChild(h("div", { class: "scx-actions" }, [apply]));
    }
    next();
  }

  /* ---------- observer ---------- */
  var queued = false;
  function pass() {
    queued = false; var ov = $(".scx-ov"); if (!ov || ov.hidden) return;
    addSteppers(); injectProTab();
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(pass); } }
  function start() {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    schedule();
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();

/* StreamCloud Admin Quick Bar — floating shortcut pill, visible ONLY while an admin session is active.
   Added as an isolated additive layer; the existing Admin Ultra implementation above remains unchanged. */
(function () {
  "use strict";
  function $(s) { return document.querySelector(s); }
  function sessionOk() {
    try { var s = JSON.parse(sessionStorage.getItem("streamcloud-admin-session") || "null"); return !!(s && s.token && s.expiresAt > Date.now()); }
    catch (e) { return false; }
  }
  function waitFor(fn, cb, tries) {
    var r = fn(); if (r) return cb(r);
    if ((tries || 0) > 40) return; setTimeout(function () { waitFor(fn, cb, (tries || 0) + 1); }, 60);
  }
  function tabBtn(label) {
    var out = null; document.querySelectorAll(".scx-tab").forEach(function (b) { if (!out && b.textContent.indexOf(label) === 0) out = b; });
    return out;
  }
  function openTab(label) {
    var ov = $(".scx-ov"), icon = $("#adminIcon");
    if ((!ov || ov.hidden) && icon) icon.click();
    waitFor(function () { return tabBtn(label); }, function (b) { b.click(); });
  }
  var ICON = {
    cat: "M4 6h16M4 12h16M4 18h10", add: "M12 5v14M5 12h14"
  };
  function btn(key, label, title, onclick) {
    var b = document.createElement("button"); b.type = "button"; b.title = title; b.setAttribute("aria-label", title);
    b.innerHTML = "<svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='" + ICON[key] + "'/></svg><span>" + label + "</span>";
    b.addEventListener("click", onclick); return b;
  }
  var style = document.createElement("style");
  style.textContent =
    ".ux-qbar{position:fixed;left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));z-index:250;display:flex;gap:4px;padding:5px;border-radius:999px;background:rgba(20,20,20,.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 34px rgba(0,0,0,.5)}" +
    ".ux-qbar[hidden]{display:none}.ux-qbar button{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#fff;border-radius:999px;padding:9px 13px;font-size:12px;font-weight:700;cursor:pointer;transition:background .2s}" +
    ".ux-qbar button:hover,.ux-qbar button:focus-visible{background:var(--red,#e50914);outline:0}@media(max-width:560px){.ux-qbar button span{display:none}.ux-qbar button{padding:11px}}";
  document.head.appendChild(style);
  var bar = document.createElement("div"); bar.className = "ux-qbar"; bar.hidden = true; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Admin quick actions");
  bar.appendChild(btn("cat", "Catalogue", "Open Catalogue Pro", function () { openTab("Catalogue Pro"); }));
  bar.appendChild(btn("add", "Add item", "Add a new item", function () { openTab("Add item"); }));
  function mount() { document.body.appendChild(bar); bar.hidden = !sessionOk(); setInterval(function () { bar.hidden = !sessionOk(); }, 1500); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
