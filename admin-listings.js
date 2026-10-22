/* StreamCloud secure AI auto-listing.
   - Public: loads published listings from Supabase (read-only, row-level security) and adds them
     to the existing sections / card designs.
   - Admin: floating "+" -> PIN (verified server-side) -> add / edit / delete listings through
     Supabase Edge Functions. No PIN, API key or secret exists in this file. */
(function () {
  "use strict";
  var CFG = window.STREAMCLOUD_SUPABASE || {};
  var BASE = String(CFG.url || "").replace(/\/+$/, "");
  var configured = /^https:\/\//.test(BASE) && !!CFG.anonKey && String(CFG.anonKey).trim() !== "এপিয়াই";
  var SESSION_KEY = "streamcloud-admin-session";
  var SECTION_LABEL = { movie: "Movies", series: "Web Series", sites: "Websites", apps: "Movie Apps", music: "Music Apps" };
  var CATEGORIES = [
    { label: "Movie", section: "movie" }, { label: "Web Series", section: "series" },
    { label: "Movie App", section: "apps" }, { label: "Music App", section: "music" },
    { label: "Movie Website", section: "sites" }, { label: "Music Website", section: "music" },
    { label: "Anime App/Website", section: "sites" }, { label: "Streaming/Live TV", section: "sites" },
    { label: "Other App", section: "apps" }, { label: "Other Website", section: "sites" },
    { label: "Custom Category", section: "sites", custom: true }
  ];

  /* ---------- helpers ---------- */
  function h(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return node;
  }
  function isHttps(v) { try { var u = new URL(String(v).trim()); return u.protocol === "https:" && !u.username && !u.password; } catch (e) { return false; } }
  function urlKey(raw) {
    try {
      var u = new URL(raw), p = [];
      u.searchParams.forEach(function (v, k) { if (!/^(utm_|fbclid$|gclid$|ref$|mc_)/i.test(k)) p.push([k, v]); });
      p.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
      return u.hostname.toLowerCase().replace(/^www\./, "") + u.pathname.replace(/\/+$/, "") + (p.length ? "?" + p.map(function (x) { return x[0] + "=" + x[1]; }).join("&") : "");
    } catch (e) { return ""; }
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  /* ---------- public side: load + show published listings ---------- */
  var rows = [];
  function fetchRows() {
    return fetch(BASE + "/rest/v1/listings?select=*&published=eq.true&order=created_at.desc&limit=1000", { headers: { apikey: CFG.anonKey } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (list) { return Array.isArray(list) ? list.filter(function (r) { return isHttps(r.url); }) : []; });
  }
  function toTitle(r) {
    return {
      key: "db-" + r.id, title: r.name, year: r.year || undefined, poster: r.poster_url || "", genres: r.genres || [],
      rating: r.imdb_rating != null ? { source: "IMDb", value: Number(r.imdb_rating) } : undefined,
      overview: r.description || "", imdbId: r.imdb_id || undefined,
      seasonCount: r.season_count || undefined, episodeCount: r.episode_count || undefined,
      links: [{ label: "Open link", url: r.url }]
    };
  }
  function toCatalog(r) {
    var fresh = Date.now() - new Date(r.created_at).getTime() < 30 * 864e5;
    var item = {
      listingId: r.id, name: r.name, url: r.url, domain: hostOf(r.url), ads: r.ads == null ? 1 : Number(r.ads),
      pop: 70, smooth: 70, langs: 70, new: fresh, desc: r.description || "",
      logoSources: isHttps(r.logo_url) ? [r.logo_url] : []
    };
    if (r.section === "apps" || r.section === "music") {
      item.appType = r.section === "music" ? "music" : "movie";
      item.kind = "app";
      if (isHttps(r.download_url)) { item.downloadUrl = r.download_url; item.downloadDirect = !!r.download_verified; }
    }
    return item;
  }
  function catalogArrays() {
    try { return [S, A, M]; } catch (e) { return []; }
  }
  function syncCatalog(list) {
    var arrays = catalogArrays();
    if (!arrays.length) return;
    arrays.forEach(function (arr) { for (var i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].listingId) arr.splice(i, 1); });
    list.forEach(function (r) {
      if (r.section === "movie" || r.section === "series") return;
      var item = toCatalog(r);
      (r.section === "sites" ? S : r.section === "music" ? M : A).push(item);
    });
    var q = document.getElementById("q");
    if (q) q.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function titleSource(list) {
    return {
      movies: list.filter(function (r) { return r.section === "movie"; }).map(toTitle),
      series: list.filter(function (r) { return r.section === "series"; }).map(toTitle)
    };
  }
  var initial = configured ? fetchRows().catch(function () { return []; }) : Promise.resolve([]);
  window.STREAMCLOUD_TITLE_LISTINGS = initial.then(titleSource);
  initial.then(function (list) { rows = list; syncCatalog(list); });
  function refreshPublic() {
    return fetchRows().then(function (list) {
      rows = list; syncCatalog(list);
      window.STREAMCLOUD_TITLE_LISTINGS = Promise.resolve(titleSource(list));
      if (typeof window.STREAMCLOUD_RELOAD_TITLES === "function") window.STREAMCLOUD_RELOAD_TITLES();
    }).catch(function () {});
  }

  var staticTitles = null;
  function staticDup(o) {
    if (o.section !== "movie" && o.section !== "series") return Promise.resolve("");
    var p = staticTitles || (staticTitles = fetch("./data/recommendations.json").then(function (r) { return r.json(); }).catch(function () { return {}; }));
    return p.then(function (d) {
      var id = (String(o.imdb_id || "").match(/tt\d{5,10}/) || [""])[0];
      var norm = function (v) { return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
      var list = (d && d[o.section === "series" ? "series" : "movies"]) || [];
      var hit = list.some(function (t) { return (id && t.imdbId === id) || (norm(t.title) === norm(o.name) && (!o.year || !t.year || Number(t.year) === Number(o.year))); });
      return hit ? "This title is already listed." : "";
    });
  }

  /* ---------- admin session + API ---------- */
  var session = null;
  try { var saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); if (saved && saved.expiresAt > Date.now()) session = saved; } catch (e) { /* ignore */ }
  function setSession(s) {
    session = s;
    try { if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }
  function api(fn, body) {
    var headers = { "Content-Type": "application/json", apikey: CFG.anonKey };
    if (session) headers["x-admin-token"] = session.token;
    return fetch(BASE + "/functions/v1/" + fn, { method: "POST", headers: headers, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; }); })
      .then(function (res) {
        if (res.status === 401 && fn !== "admin-login") { setSession(null); res.data.expired = true; }
        if (res.status >= 400) { var err = new Error(res.data.error || "Request failed (" + res.status + ")."); err.info = res.data; err.status = res.status; throw err; }
        return res.data;
      });
  }

  /* ---------- styles ---------- */
  var style = h("style", { text:
    ".scx-fab{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:60;width:46px;height:46px;border-radius:50%;border:1px solid #404040;background:rgba(36,36,36,.94);color:#fff;font-size:26px;line-height:1;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.4);transition:background .2s,transform .15s}.scx-fab:hover{background:var(--red,#e50914)}.scx-fab:active{transform:scale(.94)}.scx-fab:focus-visible{outline:2px solid #fff;outline-offset:3px}" +
    ".scx-ov{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:16px;overflow:auto}.scx-ov[hidden]{display:none}" +
    ".scx-box{width:min(620px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--panel,#181818);color:var(--text,#fff);border:1px solid var(--border,#343434);border-radius:14px;padding:20px;box-shadow:0 24px 60px rgba(0,0,0,.55)}" +
    ".scx-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px}.scx-head h2{margin:0;font-size:19px}" +
    ".scx-x{border:0;background:transparent;color:var(--dim,#a7a7a7);font-size:24px;line-height:1;cursor:pointer;padding:4px 8px}.scx-x:hover{color:#fff}" +
    ".scx-tabs{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}.scx-tab,.scx-btn{border:1px solid var(--border,#343434);background:var(--card,#242424);color:#fff;border-radius:10px;padding:10px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .2s,border-color .2s}.scx-tab:hover,.scx-btn:hover{border-color:#555}.scx-tab.on,.scx-btn.pri{background:var(--red,#e50914);border-color:var(--red,#e50914)}.scx-btn.pri:hover{filter:brightness(1.1)}.scx-btn.dng{border-color:#8e202d;color:#ff7166}.scx-btn:disabled{opacity:.55;cursor:default}.scx-tab:focus-visible,.scx-btn:focus-visible,.scx-in:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".scx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.scx-chip{border:1px solid var(--border,#343434);background:transparent;color:var(--dim,#a7a7a7);border-radius:999px;padding:8px 13px;font:inherit;font-size:12.5px;cursor:pointer}.scx-chip.on{background:#fff;color:#000;border-color:#fff}" +
    ".scx-row{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;align-items:flex-end}.scx-row>.scx-f{flex:1 1 200px}" +
    ".scx-f{display:flex;flex-direction:column;gap:5px;margin:0 0 12px;font-size:12px;color:var(--dim,#a7a7a7)}.scx-f.full{width:100%}.scx-in{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--card,#242424);color:#fff;font:inherit;font-size:14px}textarea.scx-in{min-height:76px;resize:vertical}.scx-f.bad .scx-in{border-color:#ff7166}.scx-err{color:#ff7166;font-size:12px}.scx-ok{color:var(--green,#46d369);font-size:11px;margin-left:6px}" +
    ".scx-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:520px){.scx-grid{grid-template-columns:1fr}}" +
    ".scx-msg{margin:0 0 12px;padding:10px 12px;border-radius:10px;font-size:13px;border:1px solid var(--border,#343434);background:var(--card,#242424)}.scx-msg.err{border-color:#8e202d;color:#ff9a92}.scx-msg.ok{border-color:#2b7a45;color:var(--green,#46d369)}.scx-msg[hidden]{display:none}" +
    ".scx-notes{margin:0 0 12px;padding:0 0 0 18px;font-size:12px;color:var(--dim,#a7a7a7)}.scx-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}" +
    ".scx-list{display:flex;flex-direction:column;gap:8px}.scx-item{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--card,#242424)}.scx-item b{display:block;font-size:14px}.scx-item small{color:var(--dim,#a7a7a7)}" +
    ".scx-sum{margin:0 0 14px;padding:12px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--card,#242424);font-size:13px;line-height:1.55}.scx-sum dt{color:var(--dim,#a7a7a7);font-size:11px}.scx-sum dd{margin:0 0 6px;word-break:break-word}" });
  document.head.appendChild(style);

  /* ---------- admin modal ---------- */
  var overlay, box, titleEl, bodyEl, lastFocus = null;
  var ui = { catIndex: -1, customName: "", section: "", form: null, verified: {}, notes: [], editingId: null, view: "pin" };

  function build() {
    if (overlay) return;
    titleEl = h("h2", { id: "scxTitle", text: "Admin" });
    bodyEl = h("div", {});
    box = h("div", { class: "scx-box", role: "dialog", "aria-modal": "true", "aria-labelledby": "scxTitle", tabindex: "-1" }, [
      h("div", { class: "scx-head" }, [titleEl, h("button", { class: "scx-x", type: "button", "aria-label": "Close", text: "×", onclick: closeModal })]),
      bodyEl
    ]);
    overlay = h("div", { class: "scx-ov", hidden: true }, [box]);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) closeModal(); });
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); closeModal(); return; }
      if (e.key !== "Tab") return;
      var f = Array.prototype.filter.call(box.querySelectorAll("button,input,select,textarea,a[href]"), function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(overlay);
  }
  function openModal() {
    build();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    if (session && session.expiresAt > Date.now()) showHome("add"); else { setSession(null); showPin(); }
  }
  function closeModal() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function msgBox() { return h("div", { class: "scx-msg", role: "alert", hidden: true }); }
  function say(el, kind, text) { el.hidden = !text; el.className = "scx-msg " + (kind || ""); el.textContent = text || ""; }
  function focusFirst() { var f = box.querySelector("input:not([type=hidden]),select,textarea,button.scx-btn"); if (f) f.focus(); }

  /* --- PIN --- */
  function showPin() {
    ui.view = "pin"; titleEl.textContent = "Admin access"; bodyEl.textContent = "";
    var msg = msgBox();
    var pin = h("input", { class: "scx-in", type: "password", inputmode: "numeric", autocomplete: "off", maxlength: "64", "aria-label": "Admin PIN", placeholder: "Enter PIN" });
    var go = h("button", { class: "scx-btn pri", type: "button", text: "Unlock" });
    function submit() {
      if (!configured) { say(msg, "err", "Supabase is not configured yet. Fill listings-config.js and deploy the functions (see SUPABASE_SETUP.md)."); return; }
      if (!pin.value) { say(msg, "err", "Enter the PIN."); return; }
      go.disabled = true; say(msg, "", "");
      api("admin-login", { pin: pin.value }).then(function (d) {
        setSession({ token: d.token, expiresAt: d.expiresAt }); showHome("add");
      }).catch(function (e) {
        pin.value = ""; go.disabled = false;
        var wait = e.info && e.info.retryAfter ? " Try again in about " + Math.ceil(e.info.retryAfter / 60) + " min." : "";
        say(msg, "err", (e.status ? e.message : "Could not reach the server. Check your connection.") + wait);
        pin.focus();
      });
    }
    go.addEventListener("click", submit);
    pin.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    bodyEl.appendChild(msg);
    bodyEl.appendChild(h("label", { class: "scx-f" }, ["PIN", pin]));
    bodyEl.appendChild(h("div", { class: "scx-actions" }, [go]));
    if (!configured) say(msg, "err", "Supabase is not configured yet. Fill listings-config.js and deploy the functions (see SUPABASE_SETUP.md).");
    pin.focus();
  }

  /* --- Home with tabs --- */
  function showHome(tab, notice) {
    ui.view = tab; titleEl.textContent = "Admin"; bodyEl.textContent = "";
    var tabs = h("div", { class: "scx-tabs" }, [
      h("button", { class: "scx-tab" + (tab === "add" ? " on" : ""), type: "button", text: "Add listing", onclick: function () { resetAdd(); showHome("add"); } }),
      h("button", { class: "scx-tab" + (tab === "manage" ? " on" : ""), type: "button", text: "Manage", onclick: function () { showHome("manage"); } }),
      h("button", { class: "scx-tab", type: "button", text: "Lock", onclick: function () { setSession(null); showPin(); } })
    ]);
    bodyEl.appendChild(tabs);
    var msg = msgBox(); bodyEl.appendChild(msg);
    if (notice) say(msg, notice.kind, notice.text);
    if (tab === "manage") showManage(msg); else showAdd(msg);
  }
  function expired(e, msg) {
    if (e && e.info && e.info.expired) { showPin(); var m = bodyEl.querySelector(".scx-msg"); if (m) say(m, "err", "Session expired. Enter the PIN again."); return true; }
    return false;
  }

  /* --- Add / edit flow --- */
  function resetAdd() { ui.catIndex = -1; ui.customName = ""; ui.section = ""; ui.form = null; ui.verified = {}; ui.notes = []; ui.editingId = null; }

  function showAdd(msg) {
    var editing = !!ui.editingId;
    if (editing) titleEl.textContent = "Edit listing";
    var wrap = h("div", {});
    bodyEl.appendChild(wrap);

    if (!editing) {
      var chips = h("div", { class: "scx-chips", role: "group", "aria-label": "Category" });
      CATEGORIES.forEach(function (c, i) {
        chips.appendChild(h("button", { class: "scx-chip" + (ui.catIndex === i ? " on" : ""), type: "button", "aria-pressed": String(ui.catIndex === i), text: c.label, onclick: function () {
          ui.catIndex = i; ui.section = c.section; ui.form = null; ui.verified = {}; ui.notes = []; showHome("add");
        } }));
      });
      wrap.appendChild(chips);
    }
    var cat = CATEGORIES[ui.catIndex];
    if (!editing && !cat) { wrap.appendChild(h("p", { class: "scx-sub", text: "Choose a category to start." })); focusFirst(); return; }

    if (!editing) {
      var custom = null;
      if (cat.custom) {
        custom = h("input", { class: "scx-in", type: "text", maxlength: "60", placeholder: "Enter your category name", value: ui.customName, "aria-label": "Custom category name" });
        custom.addEventListener("input", function () { ui.customName = custom.value; });
        wrap.appendChild(h("label", { class: "scx-f" }, ["Custom category", custom]));
      }
      var secSel = ui.form ? null : sectionSelect(ui.section);
      var urlIn = h("input", { class: "scx-in", type: "url", placeholder: "https://…", "aria-label": "Public URL", value: ui.form ? ui.form.url || "" : "" });
      var detect = h("button", { class: "scx-btn pri", type: "button", text: "Detect with AI" });
      var urlMsg = h("span", { class: "scx-err" });
      if (secSel) secSel.addEventListener("change", function () { ui.section = secSel.value; });
      var runDetect = function () {
        urlMsg.textContent = "";
        var name = cat.custom ? ui.customName.trim() : cat.label;
        if (cat.custom && !name) { urlMsg.textContent = "Enter the custom category name first."; return; }
        if (!isHttps(urlIn.value)) { urlMsg.textContent = "Enter a valid public https:// URL."; return; }
        detect.disabled = true; detect.textContent = "Detecting…"; say(msg, "", "");
        api("admin-detect", { url: urlIn.value.trim(), section: ui.section, category: name }).then(function (d) {
          ui.form = Object.assign({ section: ui.section, category: name, url: urlIn.value.trim() }, d.detected || {});
          ui.form.section = ui.section; ui.form.category = name; ui.form.url = urlIn.value.trim();
          ui.verified = d.verified || {}; ui.notes = d.notes || [];
          showHome("add");
        }).catch(function (e) {
          detect.disabled = false; detect.textContent = "Detect with AI";
          if (!expired(e)) say(msg, "err", e.status ? e.message : "Could not reach the server. Check your connection.");
        });
      };
      detect.addEventListener("click", runDetect);
      urlIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); runDetect(); } });
      wrap.appendChild(h("div", { class: "scx-row" }, [
        secSel ? h("label", { class: "scx-f" }, ["Show in", secSel]) : null,
        h("label", { class: "scx-f", style: "flex:3 1 260px" }, ["URL", urlIn]),
        detect
      ]));
      wrap.appendChild(urlMsg);
      if (!ui.form) { urlIn.focus(); return; }
    }
    renderForm(wrap, msg);
  }

  function sectionSelect(value) {
    var s = h("select", { class: "scx-in", "aria-label": "Show in" });
    Object.keys(SECTION_LABEL).forEach(function (k) { var o = h("option", { value: k, text: SECTION_LABEL[k] }); if (k === value) o.selected = true; s.appendChild(o); });
    return s;
  }

  function renderForm(wrap, msg) {
    var f = ui.form, inputs = {}, errs = {};
    if (ui.notes.length) wrap.appendChild(h("ul", { class: "scx-notes" }, ui.notes.map(function (n) { return h("li", { text: n }); })));
    var section = f.section;
    function field(key, label, opts) {
      opts = opts || {};
      var el = opts.multiline ? h("textarea", { class: "scx-in", maxlength: "1500" })
        : opts.options ? h("select", { class: "scx-in" })
        : h("input", { class: "scx-in", type: opts.type || "text", step: opts.step, min: opts.min, max: opts.max });
      if (opts.options) opts.options.forEach(function (o) { var op = h("option", { value: o[0], text: o[1] }); el.appendChild(op); });
      var v = f[key];
      if (key === "genres" && Array.isArray(v)) v = v.join(", ");
      if (key === "imdb_id" && v) v = "https://www.imdb.com/title/" + v + "/";
      el.value = v == null ? "" : String(v);
      var badge = h("span", { class: "scx-ok", text: opts.verified ? "verified" : "" });
      var err = h("span", { class: "scx-err" });
      el.addEventListener("input", function () { badge.textContent = ""; err.textContent = ""; wrapEl.classList.remove("bad"); });
      var wrapEl = h("label", { class: "scx-f" + (opts.full ? " full" : "") }, [h("span", {}, [label, badge]), el, err]);
      inputs[key] = el; errs[key] = { err: err, wrap: wrapEl };
      return wrapEl;
    }
    var V = ui.verified || {};
    var isTitle = section === "movie" || section === "series", isApp = section === "apps" || section === "music";
    var grid = h("div", { class: "scx-grid" });
    var secSel = sectionSelect(section);
    secSel.addEventListener("change", function () { f = collect(); f.section = secSel.value; ui.form = f; ui.section = f.section; showHome("add"); });
    wrap.appendChild(h("label", { class: "scx-f" }, ["Show in", secSel]));
    wrap.appendChild(field("name", isTitle ? "Title" : "Name", { full: true }));
    wrap.appendChild(field("url", "Destination URL", { type: "url", full: true }));
    wrap.appendChild(field("description", "Description", { multiline: true, full: true }));
    if (isTitle) {
      grid.appendChild(field("year", "Year", { type: "number", min: 1870, max: 2100, verified: V.imdb }));
      grid.appendChild(field("imdb_rating", "IMDb rating", { type: "number", step: "0.1", min: 0, max: 10, verified: V.imdb }));
      grid.appendChild(field("imdb_id", "IMDb URL or id", { verified: V.imdb }));
      grid.appendChild(field("genres", "Genres (comma separated)", { verified: V.imdb }));
      if (section === "series") {
        grid.appendChild(field("season_count", "Seasons", { type: "number", min: 0, verified: V.imdb && f.season_count != null }));
        grid.appendChild(field("episode_count", "Episodes", { type: "number", min: 0, verified: V.imdb && f.episode_count != null }));
      }
      grid.appendChild(field("poster_url", "Poster URL", { type: "url" }));
    } else {
      grid.appendChild(field("logo_url", "Logo / favicon URL", { type: "url", verified: V.logo }));
      if (isApp) {
        grid.appendChild(field("official_url", "Official website", { type: "url" }));
        grid.appendChild(field("download_url", "Direct APK URL", { type: "url", verified: V.download }));
        grid.appendChild(field("platform", "Platform"));
        grid.appendChild(field("version", "Version"));
      }
      grid.appendChild(field("ads", "Ads (your estimate)", { options: [["0", "No / minimal ads"], ["1", "Some ads"], ["2", "More / heavier ads"]] }));
    }
    wrap.appendChild(grid);
    var keepRow = h("label", { class: "scx-f", hidden: true }, [h("span", { text: "Keep this download link anyway (unverified)" }), h("input", { type: "checkbox" })]);
    wrap.appendChild(keepRow);

    function collect() {
      var o = { section: secSel.value, category: f.category };
      Object.keys(inputs).forEach(function (k) { o[k] = inputs[k].value.trim(); });
      if (o.genres !== undefined) o.genres = o.genres ? o.genres.split(",").map(function (g) { return g.trim(); }).filter(Boolean) : [];
      Object.keys(f).forEach(function (k) { if (!(k in o) && ["logo_url", "poster_url", "official_url", "download_url", "platform", "version", "imdb_id", "year", "imdb_rating", "season_count", "episode_count", "genres", "ads"].indexOf(k) !== -1) o[k] = f[k]; });
      return o;
    }
    function showFieldErrors(fields) {
      var first = null;
      Object.keys(fields || {}).forEach(function (k) {
        if (!errs[k]) return;
        errs[k].err.textContent = fields[k]; errs[k].wrap.classList.add("bad");
        if (!first) first = inputs[k];
      });
      if (first) first.focus();
    }
    function localCheck(o) {
      var bad = {};
      if (!o.name) bad.name = "Name is required.";
      if (!isHttps(o.url)) bad.url = "Enter a valid public https:// URL.";
      ["logo_url", "poster_url", "official_url", "download_url"].forEach(function (k) { if (o[k] && !isHttps(o[k])) bad[k] = "Must be a valid https:// URL."; });
      if (o.imdb_id && !/tt\d{5,10}/.test(o.imdb_id)) bad.imdb_id = "Enter an IMDb id like tt1234567 or an IMDb title URL.";
      if (!bad.url) {
        var key = urlKey(o.url), self = ui.editingId;
        var all = catalogArrays().reduce(function (a, arr) { return a.concat(arr); }, []);
        if (all.some(function (it) { return it && it.listingId !== self && urlKey(it.url) === key; }) ||
            rows.some(function (r) { return r.id !== self && urlKey(r.url) === key; })) bad.url = "This URL is already listed.";
      }
      return bad;
    }

    var actions = h("div", { class: "scx-actions" });
    var publish = h("button", { class: "scx-btn pri", type: "button", text: ui.editingId ? "Save changes" : "Publish" });
    var cancel = h("button", { class: "scx-btn", type: "button", text: "Cancel", onclick: function () { var was = ui.editingId; resetAdd(); showHome(was ? "manage" : "add"); } });
    actions.appendChild(publish); actions.appendChild(cancel); wrap.appendChild(actions);

    publish.addEventListener("click", function () {
      var o = collect(), bad = localCheck(o);
      if (Object.keys(bad).length) { showFieldErrors(bad); say(msg, "err", "Please fix the highlighted fields."); return; }
      say(msg, "", "");
      staticDup(o).then(function (dup) {
        if (dup) { showFieldErrors({ name: dup }); say(msg, "err", dup); return; }
        confirmStep(o);
      });
    });

    function confirmStep(o) {
      wrap.hidden = true;
      var c = h("div", {});
      var dl = h("dl", { class: "scx-sum" });
      [["Show in", SECTION_LABEL[o.section]], ["Category", o.category], ["Name", o.name], ["URL", o.url], ["Details", [o.year, o.imdb_rating != null && o.imdb_rating !== "" ? "IMDb " + o.imdb_rating : "", o.season_count ? o.season_count + " seasons" : "", o.episode_count ? o.episode_count + " episodes" : ""].filter(Boolean).join(" · ")], ["Download", o.download_url]].forEach(function (p) {
        if (!p[1]) return; dl.appendChild(h("dt", { text: p[0] })); dl.appendChild(h("dd", { text: String(p[1]) }));
      });
      var yes = h("button", { class: "scx-btn pri", type: "button", text: ui.editingId ? "Confirm and save" : "Confirm and publish" });
      var back = h("button", { class: "scx-btn", type: "button", text: "Back to edit", onclick: function () { c.remove(); wrap.hidden = false; focusFirst(); } });
      c.appendChild(h("p", { text: ui.editingId ? "Save these changes?" : "Publish this listing? It becomes visible to everyone." }));
      c.appendChild(dl); c.appendChild(h("div", { class: "scx-actions" }, [yes, back]));
      bodyEl.appendChild(c); yes.focus();
      yes.addEventListener("click", function () {
        yes.disabled = true; back.disabled = true;
        var payload = { action: ui.editingId ? "update" : "create", id: ui.editingId, listing: o, keepUnverifiedDownload: keepRow.querySelector("input").checked };
        api("admin-listings", payload).then(function (d) {
          var was = ui.editingId;
          rows = rows.filter(function (r) { return r.id !== d.listing.id; }); rows.unshift(d.listing);
          resetAdd(); refreshPublic();
          showHome("manage", { kind: "ok", text: was ? "Saved." : "Published. It now appears in " + SECTION_LABEL[d.listing.section] + "." });
        }).catch(function (e) {
          c.remove(); wrap.hidden = false;
          if (expired(e)) return;
          say(msg, "err", e.status ? e.message : "Could not reach the server. Check your connection.");
          if (e.info && e.info.fields) {
            showFieldErrors(e.info.fields);
            if (e.info.fields.download_url) keepRow.hidden = false;
          }
        });
      });
    }
    var first = inputs.name; if (first) first.focus();
  }

  /* --- Manage --- */
  function showManage(msg) {
    var list = h("div", { class: "scx-list" }, [h("p", { text: "Loading…" })]);
    bodyEl.appendChild(list);
    api("admin-listings", { action: "list" }).then(function (d) {
      list.textContent = "";
      var all = d.listings || [];
      if (!all.length) { list.appendChild(h("p", { text: "No listings yet. Use Add listing to publish one." })); return; }
      all.forEach(function (r) {
        var del = h("button", { class: "scx-btn dng", type: "button", text: "Delete" });
        var edit = h("button", { class: "scx-btn", type: "button", text: "Edit" });
        var item = h("div", { class: "scx-item" }, [
          h("div", {}, [h("b", { text: r.name }), h("small", { text: r.category + " · " + (SECTION_LABEL[r.section] || r.section) })]),
          h("div", { class: "scx-actions" }, [edit, del])
        ]);
        edit.addEventListener("click", function () {
          resetAdd(); ui.editingId = r.id;
          ui.form = Object.assign({}, r); ui.section = r.section; ui.verified = {}; ui.notes = [];
          showHome("add");
        });
        del.addEventListener("click", function () {
          var yes = h("button", { class: "scx-btn dng", type: "button", text: "Yes, delete" });
          var keep = h("button", { class: "scx-btn", type: "button", text: "Keep" });
          var ask = h("div", { class: "scx-actions" }, [h("span", { text: "Delete “" + r.name + "”?" }), yes, keep]);
          item.replaceChild(ask, item.lastChild); yes.focus();
          keep.addEventListener("click", function () { item.replaceChild(h("div", { class: "scx-actions" }, [edit, del]), ask); });
          yes.addEventListener("click", function () {
            yes.disabled = true;
            api("admin-listings", { action: "delete", id: r.id }).then(function () {
              rows = rows.filter(function (x) { return x.id !== r.id; }); refreshPublic();
              showHome("manage", { kind: "ok", text: "Deleted." });
            }).catch(function (e) { if (!expired(e)) { yes.disabled = false; say(msg, "err", e.message); } });
          });
        });
        list.appendChild(item);
      });
    }).catch(function (e) { list.textContent = ""; if (!expired(e)) say(msg, "err", e.status ? e.message : "Could not reach the server."); });
  }

  /* ---------- floating + button ---------- */
  var fab = h("button", { class: "scx-fab", type: "button", "aria-label": "Admin: add listing", title: "Admin", text: "+", onclick: openModal });
  function mount() { if (!fab.isConnected) document.body.appendChild(fab); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
