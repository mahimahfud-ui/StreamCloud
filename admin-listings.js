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
    if (typeof window.STREAMCLOUD_REFRESH_PUBLIC_CONTROLS === "function") window.STREAMCLOUD_REFRESH_PUBLIC_CONTROLS();
    var q = document.getElementById("q");
    if (q) q.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function titleSource(list) {
    return {
      movies: list.filter(function (r) { return r.section === "movie"; }).map(toTitle),
      series: list.filter(function (r) { return r.section === "series"; }).map(toTitle)
    };
  }
  var initial = configured
    ? Promise.all([
        fetchRows().catch(function () { return []; }),
        Promise.resolve(window.STREAMCLOUD_SETTINGS_READY).catch(function () { return null; })
      ]).then(function (pair) { return pair[0]; })
    : Promise.resolve([]);
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
  try {
    var saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (saved && typeof saved.token === "string" && saved.expiresAt > Date.now()) session = saved;
    else sessionStorage.removeItem(SESSION_KEY);
  } catch (e) { /* ignore expired or stale session hints */ }
  function setSession(s) {
    session = s;
    try { if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }
  function api(fn, body) {
    var headers = { "Content-Type": "application/json", apikey: CFG.anonKey };
    if (session && session.token) headers["x-admin-token"] = session.token;
    return fetch(BASE + "/functions/v1/" + fn, { method: "POST", headers: headers, credentials: "omit", body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; }); })
      .then(function (res) {
        if (res.status === 401 && fn !== "admin-login") { setSession(null); res.data.expired = true; }
        if (res.status >= 400) { var err = new Error(res.data.error || "Request failed (" + res.status + ")."); err.info = res.data; err.status = res.status; throw err; }
        return res.data;
      })
      .catch(function (e) {
        if (e && typeof e.status === "number") throw e;
        var detail = "Could not contact Supabase. Request origin: " + (window.location.origin || "unknown") +
          ". Check the connection or CORS allowlist for " + BASE + ".";
        var err = new Error(detail);
        err.network = true; err.cause = e;
        throw err;
      });
  }

  /* ---------- styles ---------- */
  var style = h("style", { text:
    ".scx-ov{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:16px;overflow:auto}.scx-ov[hidden]{display:none}" +
    ".scx-box{width:min(1040px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--panel,#181818);color:var(--text,#fff);border:1px solid var(--border,#343434);border-radius:14px;padding:20px;box-shadow:0 24px 60px rgba(0,0,0,.55)}" +
    ".scx-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px}.scx-head h2{margin:0;font-size:19px}" +
    ".scx-x{border:0;background:transparent;color:var(--dim,#a7a7a7);font-size:24px;line-height:1;cursor:pointer;padding:4px 8px}.scx-x:hover{color:#fff}" +
    ".scx-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 16px}.scx-tab,.scx-btn{border:1px solid var(--border,#343434);background:var(--card,#242424);color:#fff;border-radius:10px;padding:10px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .2s,border-color .2s}.scx-tab{min-width:0;min-height:118px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:10px;padding:12px;text-align:left;white-space:normal;border-radius:12px;background:linear-gradient(145deg,var(--card,#242424),rgba(255,255,255,.025))}.scx-tab:hover,.scx-btn:hover{border-color:#555}.scx-tab.on{background:var(--red,#e50914);border-color:var(--red,#e50914)}.scx-btn.pri{background:var(--red,#e50914);border-color:var(--red,#e50914)}.scx-btn.pri:hover{filter:brightness(1.1)}.scx-nav-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.08);font-size:18px;line-height:1;flex:0 0 auto}.scx-nav-title{display:block;font-size:13px;font-weight:800;line-height:1.15;color:#fff}.scx-nav-sub{display:block;font-size:10.5px;line-height:1.35;color:var(--dim,#a7a7a7);font-weight:500}.scx-tab.on .scx-nav-icon{background:rgba(255,255,255,.18)}.scx-tab.on .scx-nav-sub{color:rgba(255,255,255,.85)}.scx-btn.dng{border-color:#8e202d;color:#ff7166}.scx-btn:disabled{opacity:.55;cursor:default}.scx-tab:focus-visible,.scx-btn:focus-visible,.scx-in:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".scx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.scx-chip{border:1px solid var(--border,#343434);background:transparent;color:var(--dim,#a7a7a7);border-radius:999px;padding:8px 13px;font:inherit;font-size:12.5px;cursor:pointer}.scx-chip.on{background:#fff;color:#000;border-color:#fff}" +
    ".scx-row{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;align-items:flex-end}.scx-row>.scx-f{flex:1 1 200px}" +
    ".scx-f{display:flex;flex-direction:column;gap:5px;margin:0 0 12px;font-size:12px;color:var(--dim,#a7a7a7)}.scx-f.full{width:100%}.scx-in{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--card,#242424);color:#fff;font:inherit;font-size:14px}textarea.scx-in{min-height:76px;resize:vertical}.scx-f.bad .scx-in{border-color:#ff7166}.scx-err{color:#ff7166;font-size:12px}.scx-ok{color:var(--green,#46d369);font-size:11px;margin-left:6px}" +
    ".scx-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:520px){.scx-grid{grid-template-columns:1fr}}" +
    ".scx-msg{margin:0 0 12px;padding:10px 12px;border-radius:10px;font-size:13px;border:1px solid var(--border,#343434);background:var(--card,#242424)}.scx-msg.err{border-color:#8e202d;color:#ff9a92}.scx-msg.ok{border-color:#2b7a45;color:var(--green,#46d369)}.scx-msg[hidden]{display:none}" +
    ".scx-notes{margin:0 0 12px;padding:0 0 0 18px;font-size:12px;color:var(--dim,#a7a7a7)}.scx-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}" +
    ".scx-list{display:flex;flex-direction:column;gap:8px}.scx-item{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--card,#242424)}.scx-item b{display:block;font-size:14px}.scx-item small{color:var(--dim,#a7a7a7)}" +
    ".scx-ai-result{margin-top:10px}.scx-ai-head{display:flex;gap:14px;align-items:flex-start;padding:14px;border:1px solid var(--border,#343434);border-radius:12px;background:var(--card,#242424)}.scx-ai-head img{width:104px;max-width:30%;height:auto;max-height:160px;object-fit:cover;border-radius:8px;background:#111}.scx-ai-info{min-width:0;flex:1}.scx-ai-info b{display:block;font-size:16px}.scx-ai-info small{display:block;color:var(--dim,#a7a7a7);margin:6px 0}.scx-ai-info p{font-size:13px;line-height:1.5;color:#ddd;margin:8px 0 0}" +
    ".scx-sum{margin:0 0 14px;padding:12px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--card,#242424);font-size:13px;line-height:1.55}.scx-sum dt{color:var(--dim,#a7a7a7);font-size:11px}.scx-sum dd{margin:0 0 6px;word-break:break-word}" });
  document.head.appendChild(style);
  var dashboardStyle = h("style", { text:
    ".scx-tabs{max-height:none}.scx-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:0 0 16px}.scx-stat{padding:14px;border:1px solid var(--border,#343434);border-radius:12px;background:var(--card,#242424)}.scx-stat strong{display:block;font-size:24px;margin:0 0 4px;color:#fff}.scx-stat span{display:block;font-size:11px;color:var(--dim,#a7a7a7)}.scx-help{font-size:12px;color:var(--dim,#a7a7a7);line-height:1.5}.scx-divider{height:1px;background:var(--border,#343434);margin:17px 0}.scx-order-list{display:flex;flex-direction:column;gap:7px;margin:10px 0}.scx-order-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 11px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--card,#242424)}.scx-order-row[draggable=true]{cursor:grab}.scx-order-row.dragging{opacity:.4;border-color:var(--red,#e50914)}.scx-order-title{flex:1;min-width:110px;font-size:13px;font-weight:700}.scx-status{font-size:10px;color:var(--dim,#a7a7a7)}.scx-small{font-size:11px;padding:6px 9px}.scx-two{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:640px){.scx-two{grid-template-columns:1fr}.scx-box{padding:14px}.scx-tabs{gap:8px;grid-template-columns:repeat(auto-fit,minmax(112px,1fr))}.scx-tab{min-height:110px;padding:10px;font-size:12px}}.scx-field-note{font-size:11px;color:var(--dim,#a7a7a7);margin-top:4px}.scx-count{font-size:11px;color:var(--dim,#a7a7a7)}"
  });
  document.head.appendChild(dashboardStyle);

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
    if (session && session.expiresAt > Date.now()) showHome("overview"); else { setSession(null); showPin(); }
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
        setSession({ token: d.token, expiresAt: d.expiresAt }); showHome("overview");
      }).catch(function (e) {
        pin.value = ""; go.disabled = false;
        var wait = e.info && e.info.retryAfter ? " Try again in about " + Math.ceil(e.info.retryAfter / 60) + " min." : "";
        say(msg, "err", (e.status || e.network ? e.message : "Could not reach the server. Check your connection.") + wait);
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
    ui.view = tab; titleEl.textContent = "Admin Dashboard"; bodyEl.textContent = "";
    var tabs = h("nav", { class: "scx-tabs", "aria-label": "Admin features" });
    [
      { id: "overview", label: "Overview", icon: "▦", desc: "Totals and recent activity" },
      { id: "add", label: "Add item", icon: "＋", desc: "Add a movie, service or app" },
      { id: "ai", label: "Title lookup", icon: "⌕", desc: "Find verified title details" },
      { id: "manage", label: "Content", icon: "▤", desc: "Select, publish, move or delete items" },
      { id: "layout", label: "Cards & Layout", icon: "▥", desc: "Arrange cards and visibility" },
      { id: "appearance", label: "Appearance", icon: "◐", desc: "Theme, colours and spacing" },
      { id: "site", label: "Site settings", icon: "⚙", desc: "Announcement and visitor controls" },
      { id: "activity", label: "Activity", icon: "◷", desc: "Review admin history" },
      { id: "data", label: "Backup", icon: "⇅", desc: "Export or import data" },
      { id: "pin", label: "Change PIN", icon: "◈", desc: "Update admin access PIN" },
      { id: "logout", label: "Log out", icon: "↗", desc: "End your admin session" }
    ].forEach(function (item) {
      tabs.appendChild(h("button", {
        class: "scx-tab" + (tab === item.id ? " on" : ""),
        type: "button", "aria-label": item.label, "aria-current": tab === item.id ? "page" : false,
        onclick: function () {
          if (item.id === "add") resetAdd();
          if (item.id === "logout") {
            api("admin-listings", { action: "logout" }).catch(function () {}).finally(function () { setSession(null); showPin(); });
            return;
          }
          showHome(item.id);
        }
      }, [
        h("span", { class: "scx-nav-icon", "aria-hidden": "true", text: item.icon }),
        h("span", { class: "scx-nav-title", text: item.label }),
        h("span", { class: "scx-nav-sub", text: item.desc })
      ]));
    });
    bodyEl.appendChild(tabs);
    var msg = msgBox(); bodyEl.appendChild(msg);
    if (notice) say(msg, notice.kind, notice.text);
    if (tab === "manage") showManage(msg);
    else if (tab === "add") showAdd(msg);
    else if (tab === "ai") showAiStudio(msg);
    else if (tab === "layout") showLayout(msg);
    else if (tab === "appearance") showAppearance(msg);
    else if (tab === "site") showSiteSettings(msg);
    else if (tab === "activity") showActivity(msg);
    else if (tab === "data") showBackup(msg);
    else if (tab === "pin") showPinChange(msg);
    else showOverview(msg);
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
      var detect = h("button", { class: "scx-btn pri", type: "button", text: "Detect details" });
      var urlMsg = h("span", { class: "scx-err" });
      if (secSel) secSel.addEventListener("change", function () { ui.section = secSel.value; });
      var runDetect = function () {
        urlMsg.textContent = "";
        var name = cat.custom ? ui.customName.trim() : cat.label;
        if (cat.custom && !name) { urlMsg.textContent = "Enter the custom category name first."; return; }
        if (!isHttps(urlIn.value)) { urlMsg.textContent = "Enter a valid public https:// URL."; return; }
        detect.disabled = true; detect.textContent = "Detecting…"; say(msg, "", "");
        api("admin-detect", { url: urlIn.value.trim(), section: ui.section, category: name, aiProvider: "auto" }).then(function (d) {
          ui.form = Object.assign({ section: ui.section, category: name, url: urlIn.value.trim() }, d.detected || {});
          ui.form.section = ui.section; ui.form.category = name; ui.form.url = urlIn.value.trim();
          ui.verified = d.verified || {}; ui.notes = d.notes || [];
          showHome("add");
        }).catch(function (e) {
          detect.disabled = false; detect.textContent = "Detect details";
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
    var all = [];
    var search = h("input", { class: "scx-in", type: "search", placeholder: "Search database items…", "aria-label": "Search listings" });
    var statusFilter = h("select", { class: "scx-in", "aria-label": "Filter by visibility" });
    options(statusFilter, [
      { value: "all", label: "All visibility states" },
      { value: "published", label: "Published only" },
      { value: "hidden", label: "Hidden only" }
    ], "all");
    var sectionFilter = h("select", { class: "scx-in", "aria-label": "Filter by section" });
    options(sectionFilter, [
      { value: "all", label: "All sections" },
      { value: "sites", label: "Websites" },
      { value: "apps", label: "Movie Apps" },
      { value: "music", label: "Music Apps" },
      { value: "movie", label: "Movies" },
      { value: "series", label: "Web Series" }
    ], "all");
    bodyEl.appendChild(h("div", { class: "scx-two" }, [
      h("label", { class: "scx-f" }, ["Search", search]),
      h("label", { class: "scx-f" }, ["Visibility", statusFilter]),
      h("label", { class: "scx-f" }, ["Section", sectionFilter])
    ]));
    var selectAll = h("input", { type: "checkbox", "aria-label": "Select all filtered listings" });
    var bulkSection = h("select", { class: "scx-in", "aria-label": "Bulk destination section" });
    options(bulkSection, [
      { value: "sites", label: "Websites" }, { value: "apps", label: "Movie Apps" },
      { value: "music", label: "Music Apps" }, { value: "movie", label: "Movies" },
      { value: "series", label: "Web Series" }
    ], "sites");
    var bulkCategory = h("input", { class: "scx-in", type: "text", value: "General", maxlength: "60", "aria-label": "Bulk destination category" });
    var toolbar = h("div", { class: "scx-actions" }, [
      h("label", { class: "scx-help" }, [selectAll, " Select all filtered"]),
      h("button", { class: "scx-btn", type: "button", text: "Publish", onclick: function () { runBulk("publish"); } }),
      h("button", { class: "scx-btn", type: "button", text: "Hide", onclick: function () { runBulk("hide"); } }),
      h("button", { class: "scx-btn", type: "button", text: "Move selected", onclick: function () { runBulk("move"); } }),
      h("button", { class: "scx-btn dng", type: "button", text: "Delete selected", onclick: function () { runBulk("delete"); } })
    ]);
    bodyEl.appendChild(toolbar);
    bodyEl.appendChild(h("div", { class: "scx-row" }, [bulkSection, bulkCategory]));
    bodyEl.appendChild(list);

    function selectedIds() {
      return Array.prototype.map.call(list.querySelectorAll("input[data-listing-id]:checked"), function (x) { return x.dataset.listingId; });
    }
    function runBulk(operation) {
      var ids = selectedIds();
      if (!ids.length) { say(msg, "err", "Select at least one listing first."); return; }
      if (operation === "delete" && !confirm("Permanently delete " + ids.length + " selected listing(s)? This cannot be undone.")) return;
      var payload = { action: "bulk", operation: operation, ids: ids };
      if (operation === "move") {
        payload.section = bulkSection.value;
        payload.category = bulkCategory.value.trim();
        if (!payload.category) { say(msg, "err", "Enter a category for the selected listings."); return; }
      }
      var buttons = toolbar.querySelectorAll("button");
      buttons.forEach(function (b) { b.disabled = true; });
      api("admin-listings", payload).then(function (result) {
        say(msg, "ok", "Bulk action complete. Updated " + result.affected + " item(s).");
        return refreshPublic();
      }).then(function () {
        showHome("manage", { kind: "ok", text: "Bulk action saved." });
      }).catch(function (e) {
        if (!expired(e)) say(msg, "err", e.message || "Bulk action failed.");
        buttons.forEach(function (b) { b.disabled = false; });
      });
    }
    function filteredRows() {
      var q = search.value.trim().toLowerCase();
      return all.filter(function (r) {
        if (sectionFilter.value !== "all" && r.section !== sectionFilter.value) return false;
        if (statusFilter.value === "published" && !r.published) return false;
        if (statusFilter.value === "hidden" && r.published) return false;
        return !q || [r.name, r.category, r.url, r.section, r.description].join(" ").toLowerCase().indexOf(q) >= 0;
      });
    }
    function renderRows() {
      list.textContent = "";
      selectAll.checked = false;
      var filtered = filteredRows();
      if (!filtered.length) {
        list.appendChild(h("p", { class: "scx-help", text: all.length ? "No listings match these filters." : "No database listings yet. Use Add item to publish one." }));
        return;
      }
      filtered.forEach(function (r) {
        var check = h("input", { type: "checkbox", "data-listing-id": r.id, "aria-label": "Select " + r.name });
        var edit = h("button", { class: "scx-btn", type: "button", text: "Edit" });
        var item = h("div", { class: "scx-item" }, [
          h("div", {}, [
            check,
            h("b", { text: r.name }),
            h("small", { text: r.category + " · " + (SECTION_LABEL[r.section] || r.section) + " · " + (r.published ? "Published" : "Hidden") })
          ]),
          h("div", { class: "scx-actions" }, [edit])
        ]);
        edit.addEventListener("click", function () {
          resetAdd(); ui.editingId = r.id;
          ui.form = Object.assign({}, r); ui.section = r.section; ui.verified = {}; ui.notes = [];
          showHome("add");
        });
        list.appendChild(item);
      });
    }
    [search, statusFilter, sectionFilter].forEach(function (control) {
      control.addEventListener(control === search ? "input" : "change", renderRows);
    });
    selectAll.addEventListener("change", function () {
      list.querySelectorAll("input[data-listing-id]").forEach(function (x) { x.checked = selectAll.checked; });
    });
    api("admin-listings", { action: "list" }).then(function (d) {
      all = d.listings || [];
      renderRows();
    }).catch(function (e) { list.textContent = ""; if (!expired(e)) say(msg, "err", e.status ? e.message : "Could not reach the server."); });
  }


  /* ---------- persistent site control dashboard ---------- */
  function defaultSettings() {
    return {
      schemaVersion: 1, site: {}, appearance: {},
      sections: { sites: { visible: true, title: "Movie Websites" }, apps: { visible: true, title: "Movie Apps" }, recs: { visible: true, title: "Recommendations" }, order: ["sites", "apps", "recs"] },
      content: { overrides: {}, hidden: [], deleted: [], order: {} }
    };
  }
  function normalizeClientSettings(s) {
    s = s && typeof s === "object" ? s : defaultSettings();
    s.site = s.site && typeof s.site === "object" ? s.site : {};
    s.appearance = s.appearance && typeof s.appearance === "object" ? s.appearance : {};
    s.sections = s.sections && typeof s.sections === "object" ? s.sections : {};
    s.content = s.content && typeof s.content === "object" ? s.content : {};
    s.content.overrides = s.content.overrides && typeof s.content.overrides === "object" ? s.content.overrides : {};
    s.content.hidden = Array.isArray(s.content.hidden) ? s.content.hidden : [];
    s.content.deleted = Array.isArray(s.content.deleted) ? s.content.deleted : [];
    s.content.order = s.content.order && typeof s.content.order === "object" ? s.content.order : {};
    return s;
  }
  function cloneSettings(s) { return JSON.parse(JSON.stringify(normalizeClientSettings(s))); }
  function sectionObject(s, key, title) {
    if (!s.sections[key] || typeof s.sections[key] !== "object") s.sections[key] = { visible: true, title: title };
    if (typeof s.sections[key].visible !== "boolean") s.sections[key].visible = true;
    if (typeof s.sections[key].title !== "string") s.sections[key].title = title;
    return s.sections[key];
  }
  function loadSettings() {
    return api("admin-listings", { action: "settings-get" }).then(function (d) { return normalizeClientSettings(d.settings); });
  }
  function saveSettings(s, msg, done) {
    api("admin-listings", { action: "settings-save", settings: s }).then(function (d) {
      var finalSettings = normalizeClientSettings(d.settings || s);
      if (typeof window.STREAMCLOUD_APPLY_SETTINGS === "function") window.STREAMCLOUD_APPLY_SETTINGS(finalSettings);
      if (typeof window.STREAMCLOUD_RELOAD_TITLES === "function") window.STREAMCLOUD_RELOAD_TITLES();
      say(msg, "ok", "Saved to the database. Changes apply to visitors after the page refreshes.");
      if (done) done(finalSettings);
    }).catch(function (e) {
      if (!expired(e)) say(msg, "err", e.message || "Could not save settings.");
    });
  }
  function field(labelText, value, type, attrs) {
    attrs = attrs || {};
    var input = h(type === "textarea" ? "textarea" : "input", Object.assign({
      class: "scx-in", type: type === "textarea" ? undefined : (type || "text"),
      value: value == null ? "" : String(value)
    }, attrs));
    if (type === "textarea") { input.value = value == null ? "" : String(value); input.rows = attrs.rows || 3; }
    var label = h("label", { class: "scx-f" }, [labelText, input]);
    return { wrap: label, input: input };
  }
  function checkbox(labelText, checked) {
    var input = h("input", { type: "checkbox" });
    input.checked = !!checked;
    var wrap = h("label", { class: "scx-f", style: "display:flex;flex-direction:row;align-items:center;gap:9px" }, [input, labelText]);
    return { wrap: wrap, input: input };
  }
  function options(select, items, selected) {
    select.textContent = "";
    items.forEach(function (item) {
      var o = h("option", { value: item.value, text: item.label });
      select.appendChild(o);
    });
    if (selected != null) select.value = selected;
  }
  function statCard(label, value) {
    return h("div", { class: "scx-stat" }, [h("strong", { text: String(value) }), h("span", { text: label })]);
  }
  function showOverview(msg) {
    var stats = h("div", { class: "scx-stat-grid" }, [h("p", { text: "Loading dashboard…" })]);
    bodyEl.appendChild(stats);
    api("admin-listings", { action: "overview" }).then(function (data) {
      stats.textContent = "";
      var counts = data.counts || {};
      var registry = window.STREAMCLOUD_CARD_REGISTRY || {};
      var recMovies = (registry.movie || []).length, recSeries = (registry.series || []).length;
      [
        ["Websites", (registry.sites || (typeof S !== "undefined" ? S : [])).length],
        ["Movie apps", (registry.apps || (typeof A !== "undefined" ? A : [])).length],
        ["Music apps", (registry.music || (typeof M !== "undefined" ? M : [])).length],
        ["Movies", recMovies], ["Web series", recSeries],
        ["Database items", counts.all || 0], ["Published DB items", counts.published || 0], ["Hidden DB items", counts.hidden || 0]
      ].forEach(function (p) { stats.appendChild(statCard(p[0], p[1])); });
      var desc = h("p", { class: "scx-help", text: "Edits to database listings are saved in Supabase. Card order, visibility, section names, and appearance are stored in the shared site settings." });
      bodyEl.appendChild(desc);
      bodyEl.appendChild(h("div", { class: "scx-divider" }));
      bodyEl.appendChild(h("h3", { text: "Recent admin activity" }));
      var list = h("div", { class: "scx-list" });
      (data.activity || []).forEach(function (a) {
        list.appendChild(h("div", { class: "scx-item" }, [
          h("div", {}, [h("b", { text: a.action || "Admin action" }), h("small", { text: (a.entity_name || a.entity_type || "") + " · " + new Date(a.created_at).toLocaleString() })])
        ]));
      });
      if (!list.children.length) list.appendChild(h("p", { class: "scx-help", text: "No admin activity recorded yet." }));
      bodyEl.appendChild(list);
    }).catch(function (e) { stats.textContent = ""; say(msg, "err", e.message || "Could not load dashboard."); });
  }
  function catalogKey(section, item) {
    if (typeof window.STREAMCLOUD_CARD_KEY === "function") return window.STREAMCLOUD_CARD_KEY(section, item);
    if (item && item.listingId) return "db:" + item.listingId;
    if (section === "movie" || section === "series") return section + ":" + (item.imdbId || String(item.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    return section + ":" + String(item.domain || item.name || "").toLowerCase().replace(/^www\./, "");
  }
  function getRegistry(section) {
    var registry = window.STREAMCLOUD_CARD_REGISTRY || {};
    return (registry[section] || []).slice();
  }
  function currentOrder(settings, section) {
    var rows = getRegistry(section);
    var keys = rows.map(function (r) { return catalogKey(section, r); });
    var saved = settings.content.order[section];
    if (Array.isArray(saved) && saved.length) {
      var seen = new Set(saved);
      keys = saved.filter(function (k) { return keys.indexOf(k) >= 0; }).concat(keys.filter(function (k) { return !seen.has(k); }));
    }
    return keys;
  }
  function itemForKey(section, key) {
    return getRegistry(section).find(function (r) { return catalogKey(section, r) === key; }) || null;
  }
  function getOverride(settings, key, section, item) {
    var old = settings.content.overrides[key];
    if (old && typeof old === "object") {
      if (section === "movie" || section === "series") {
        return {
          title: old.title != null ? old.title : item.title || "",
          url: old.links && old.links[0] && old.links[0].url || (item.links && item.links[0] && item.links[0].url) || (item.imdbId ? "https://www.imdb.com/title/" + item.imdbId + "/" : ""),
          year: old.year != null ? old.year : item.year || "",
          poster: old.poster != null ? old.poster : item.poster || "",
          overview: old.overview != null ? old.overview : item.overview || "",
          genres: Array.isArray(old.genres) ? old.genres.join(", ") : (old.genres || (item.genres || []).join(", ")),
          rating: old.rating && typeof old.rating === "object" ? old.rating.value : (old.rating != null ? old.rating : item.rating && item.rating.value || ""),
          seasonCount: old.seasonCount != null ? old.seasonCount : item.seasonCount || "",
          episodeCount: old.episodeCount != null ? old.episodeCount : item.episodeCount || "",
          imdbId: old.imdbId != null ? old.imdbId : item.imdbId || "",
          industry: old.industry != null ? old.industry : item.industry || ""
        };
      }
      return Object.assign({
        name: item.name || "", url: item.url || "", description: item.desc || "",
        logoUrl: (item.logoSources || [])[0] || "", downloadUrl: item.downloadUrl || "",
        downloadDirect: item.downloadDirect !== false, domain: item.domain || ""
      }, old);
    }
    if (section === "movie" || section === "series") {
      return {
        title: item.title || "", url: (item.links && item.links[0] && item.links[0].url) || (item.imdbId ? "https://www.imdb.com/title/" + item.imdbId + "/" : ""),
        year: item.year || "", poster: item.poster || "", overview: item.overview || "",
        genres: (item.genres || []).join(", "), rating: item.rating && item.rating.value != null ? item.rating.value : "",
        seasonCount: item.seasonCount || "", episodeCount: item.episodeCount || "", imdbId: item.imdbId || "", industry: item.industry || ""
      };
    }
    return {
      name: item.name || "", url: item.url || "", description: item.desc || "",
      logoUrl: (item.logoSources || [])[0] || "", downloadUrl: item.downloadUrl || "",
      downloadDirect: item.downloadDirect !== false, domain: item.domain || ""
    };
  }
  function readCatalogControls(msg, settings) {
    settings = cloneSettings(settings);
    var wrap = h("div", {});
    bodyEl.appendChild(wrap);

    wrap.appendChild(h("h3", { text: "Section visibility and order" }));
    var sectionFields = {};
    [["sites", "Movie Websites"], ["apps", "Movie Apps"], ["music", "Music Apps"], ["recs", "Recommendations"]].forEach(function (p) {
      var sec = sectionObject(settings, p[0], p[1]);
      var show = checkbox("Show " + p[1], sec.visible !== false);
      var title = field(p[1] + " title", sec.title || p[1], "text", { maxlength: "100" });
      wrap.appendChild(h("div", { class: "scx-row" }, [show.wrap, title.wrap]));
      sectionFields[p[0]] = { show: show.input, title: title.input };
    });
    var savedOrder = Array.isArray(settings.sections.order) ? settings.sections.order.slice() : ["sites", "apps", "music", "recs"];
    if (savedOrder.indexOf("music") < 0) { var recIndex = savedOrder.indexOf("recs"); savedOrder.splice(recIndex < 0 ? savedOrder.length : recIndex, 0, "music"); }
    ["sites", "apps", "recs"].forEach(function (key) { if (savedOrder.indexOf(key) < 0) savedOrder.push(key); });
    var secOrder = field("Section order (comma-separated: sites, apps, music, recs)", savedOrder.join(", "), "text");
    wrap.appendChild(secOrder.wrap);

    wrap.appendChild(h("div", { class: "scx-divider" }));
    wrap.appendChild(h("h3", { text: "Grid sizing" }));
    var appearance = settings.appearance;
    var colsD = field("Desktop columns", appearance.desktopColumns == null ? 3 : appearance.desktopColumns, "number", { min: "1", max: "8" });
    var colsT = field("Tablet columns", appearance.tabletColumns == null ? 2 : appearance.tabletColumns, "number", { min: "1", max: "6" });
    var colsM = field("Mobile columns", appearance.mobileColumns == null ? 1 : appearance.mobileColumns, "number", { min: "1", max: "3" });
    var gap = field("Card gap (px)", appearance.gap == null ? 22 : appearance.gap, "number", { min: "0", max: "48" });
    var radius = field("Card corner radius (px)", appearance.radius == null ? 4 : appearance.radius, "number", { min: "0", max: "32" });
    var aspect = h("select", { class: "scx-in", "aria-label": "Card aspect ratio" });
    options(aspect, [{value:"1 / 1",label:"Square (1:1)"},{value:"2 / 3",label:"Portrait (2:3)"},{value:"16 / 9",label:"Wide (16:9)"},{value:"4 / 3",label:"Landscape (4:3)"}], appearance.aspectRatio || "1 / 1");
    var aspectWrap = h("label", { class: "scx-f" }, ["Card aspect ratio", aspect]);
    [colsD.wrap, colsT.wrap, colsM.wrap, gap.wrap, radius.wrap, aspectWrap].forEach(function (el) { wrap.appendChild(el); });

    wrap.appendChild(h("div", { class: "scx-divider" }));
    wrap.appendChild(h("h3", { text: "Edit and arrange cards" }));
    wrap.appendChild(h("p", { class: "scx-help", text: "Choose a card to edit its fields. Use the list below to reorder by dragging rows or to hide/show an item. These settings affect the public catalog on every device." }));
    var group = h("select", { class: "scx-in", "aria-label": "Card category" });
    options(group, [
      { value: "sites", label: "Websites" }, { value: "apps", label: "Movie Apps" },
      { value: "music", label: "Music Apps" }, { value: "movie", label: "Movies" }, { value: "series", label: "Web Series" }
    ], ui.controlSection || "sites");
    var itemSelect = h("select", { class: "scx-in", "aria-label": "Select card" });
    var selectRow = h("div", { class: "scx-row" }, [
      h("label", { class: "scx-f" }, ["Category", group]),
      h("label", { class: "scx-f" }, ["Card", itemSelect])
    ]);
    wrap.appendChild(selectRow);
    var form = h("div", { class: "scx-two" });
    wrap.appendChild(form);
    var orderList = h("div", { class: "scx-order-list" });
    wrap.appendChild(orderList);
    var fields = {};
    function buildFields() {
      form.textContent = "";
      var key = itemSelect.value, section = group.value, item = itemForKey(section, key);
      fields = {};
      if (!item) { form.appendChild(h("p", { class: "scx-help", text: "No cards found in this category yet." })); return; }
      var vals = getOverride(settings, key, section, item);
      var rec = section === "movie" || section === "series";
      function add(name, label, type, val, attrs) {
        var f = field(label, val, type || "text", attrs || {});
        form.appendChild(f.wrap); fields[name] = f.input;
      }
      add(rec ? "title" : "name", "Title / name", "text", rec ? vals.title : vals.name, { maxlength: "160" });
      add("url", rec ? "Title detail / external link" : "Homepage URL", "url", vals.url || "", { placeholder: "https://…" });
      add(rec ? "poster" : "logoUrl", rec ? "Poster image URL" : "Logo image URL", "url", rec ? vals.poster : vals.logoUrl, { placeholder: "https://…" });
      add(rec ? "overview" : "description", "Description", "textarea", rec ? vals.overview : vals.description, { rows: "3", maxlength: "1500" });
      if (!rec && (section === "apps" || section === "music")) {
        add("downloadUrl", "Download URL", "url", vals.downloadUrl || "", { placeholder: "https://…" });
        var direct = checkbox("Direct APK/package URL verified", vals.downloadDirect === true);
        form.appendChild(direct.wrap); fields.downloadDirect = direct.input;
      }
      if (rec) {
        add("year", "Release year", "number", vals.year || "", { min: "1870", max: "2100" });
        add("rating", "IMDb rating / 10", "number", vals.rating || "", { min: "0", max: "10", step: "0.1" });
        add("genres", "Genres (comma-separated)", "text", vals.genres || "", { maxlength: "500" });
        if (section === "series") {
          add("seasonCount", "Season count", "number", vals.seasonCount || "", { min: "1", max: "5000" });
          add("episodeCount", "Episode count", "number", vals.episodeCount || "", { min: "1", max: "100000" });
        }
        add("imdbId", "IMDb ID", "text", vals.imdbId || item.imdbId || "", { placeholder: "tt1234567" });
        add("industry", "Industry / region", "text", vals.industry || "", { maxlength: "80" });
      }
      fields.section = section; fields.key = key; fields.isRec = rec;
      var actions = h("div", { class: "scx-actions" });
      var save = h("button", { class: "scx-btn pri", type: "button", text: "Save card changes" });
      var reset = h("button", { class: "scx-btn", type: "button", text: "Reset overrides" });
      actions.appendChild(save); actions.appendChild(reset); form.appendChild(actions);
      save.addEventListener("click", function () {
        var next = cloneSettings(settings);
        var values = {};
        Object.keys(fields).forEach(function (k) { var input = fields[k]; if (input && typeof input === "object" && "value" in input) values[k] = input.value.trim(); });
        if (rec) {
          values.year = values.year ? Number(values.year) : null;
          values.rating = values.rating ? { source: "IMDb", value: Number(values.rating) } : null;
          values.genres = values.genres ? values.genres.split(",").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12) : [];
          if (section === "series") {
            values.seasonCount = values.seasonCount ? Number(values.seasonCount) : null;
            values.episodeCount = values.episodeCount ? Number(values.episodeCount) : null;
          }
          values.title = String(values.title || "").slice(0, 160);
          values.overview = String(values.overview || "").slice(0, 1500);
          values.poster = String(values.poster || "");
          values.imdbId = String(values.imdbId || "");
          values.industry = String(values.industry || "");
          values.links = values.url ? [{ label: "Open title", url: values.url }] : [];
          delete values.url;
        } else {
          values.name = String(values.name || "").slice(0, 160);
          values.description = String(values.description || "").slice(0, 1500);
          values.domain = values.url ? (function () { try { return new URL(values.url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } })() : "";
          if (section === "apps" || section === "music") values.downloadDirect = fields.downloadDirect ? fields.downloadDirect.checked : false;
          delete values.hidden;
        }
        delete values.hidden; delete values.section; delete values.key; delete values.isRec;
        next.content.overrides[key] = values;
        saveSettings(next, msg, function (finalSettings) { settings = finalSettings; buildOptions(); buildFields(); buildOrderList(); });
      });
      reset.addEventListener("click", function () {
        if (!confirm("Reset saved field overrides for this card?")) return;
        var next = cloneSettings(settings); delete next.content.overrides[key];
        saveSettings(next, msg, function (finalSettings) { settings = finalSettings; buildOptions(); buildFields(); buildOrderList(); });
      });
    }
    function buildOptions() {
      var rows = getRegistry(group.value).filter(function (item) { return settings.content.deleted.indexOf(catalogKey(group.value, item)) < 0; });
      var saved = currentOrder(settings, group.value);
      rows.sort(function (a, b) { return saved.indexOf(catalogKey(group.value, a)) - saved.indexOf(catalogKey(group.value, b)); });
      options(itemSelect, rows.map(function (it) {
        var key = catalogKey(group.value, it);
        return { value: key, label: (settings.content.hidden.indexOf(key) >= 0 ? "◌ " : "") + (it.name || it.title || key) };
      }), itemSelect.value || (rows[0] ? catalogKey(group.value, rows[0]) : ""));
      buildFields(); buildOrderList();
    }
    function persistOrder(keys) {
      var next = cloneSettings(settings); next.content.order[group.value] = keys;
      saveSettings(next, msg, function (finalSettings) { settings = finalSettings; buildOptions(); });
    }
    function deleteCard(key, item, section) {
      var name = String(item && (item.name || item.title) || key);
      var listingId = item && item.listingId ? String(item.listingId) :
        (item && typeof item.key === "string" && item.key.indexOf("db-") === 0 ? item.key.slice(3) : "");
      var isDatabaseListing = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId);
      var promptText = isDatabaseListing
        ? "Permanently delete \"" + name + "\" from the database? This cannot be undone."
        : "Remove \"" + name + "\" from the public catalog? This is saved in site settings; the original source file will not be edited.";
      if (!confirm(promptText)) return;

      function saveRemoval() {
        var next = cloneSettings(settings);
        next.content.deleted = Array.isArray(next.content.deleted) ? next.content.deleted : [];
        if (next.content.deleted.indexOf(key) < 0) next.content.deleted.push(key);
        next.content.hidden = next.content.hidden.filter(function (x) { return x !== key; });
        delete next.content.overrides[key];
        if (Array.isArray(next.content.order[section])) {
          next.content.order[section] = next.content.order[section].filter(function (x) { return x !== key; });
        }
        saveSettings(next, msg, function (finalSettings) {
          settings = finalSettings;
          refreshPublic().then(function () {
            buildOptions();
            say(msg, "ok", "Card removed from the public catalog.");
          });
        });
      }

      if (isDatabaseListing) {
        api("admin-listings", { action: "delete", id: listingId }).then(saveRemoval).catch(function (e) {
          if (!expired(e)) say(msg, "err", e.message || "Could not delete this listing.");
        });
      } else {
        saveRemoval();
      }
    }
    function buildOrderList() {
      orderList.textContent = "";
      var section = group.value, rows = getRegistry(section).filter(function (item) { return settings.content.deleted.indexOf(catalogKey(section, item)) < 0; }), keys = currentOrder(settings, section);
      var lookup = new Map(rows.map(function (r) { return [catalogKey(section, r), r]; }));
      var dragging = "";
      keys.filter(function (k) { return lookup.has(k); }).forEach(function (key) {
        var item = lookup.get(key), hidden = settings.content.hidden.indexOf(key) >= 0;
        var row = h("div", { class: "scx-order-row", draggable: "true", "data-key": key }, [
          h("span", { class: "scx-order-title", text: (item.name || item.title || key) }),
          h("span", { class: "scx-status", text: hidden ? "Hidden" : "Visible" }),
          h("button", { class: "scx-btn scx-small", type: "button", text: "Edit", onclick: function () { itemSelect.value = key; buildFields(); } }),
          h("button", { class: "scx-btn scx-small", type: "button", text: hidden ? "Show" : "Hide", onclick: function () {
            var next = cloneSettings(settings);
            next.content.hidden = next.content.hidden.filter(function (x) { return x !== key; });
            if (!hidden) next.content.hidden.push(key);
            saveSettings(next, msg, function (finalSettings) { settings = finalSettings; buildOptions(); });
          } }),
          h("button", { class: "scx-btn dng scx-small", type: "button", text: "Delete", onclick: function () { deleteCard(key, item, section); } })
        ]);
        row.addEventListener("dragstart", function (e) { dragging = key; row.classList.add("dragging"); e.dataTransfer.setData("text/plain", key); e.dataTransfer.effectAllowed = "move"; });
        row.addEventListener("dragend", function () { row.classList.remove("dragging"); });
        row.addEventListener("dragover", function (e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
        row.addEventListener("drop", function (e) {
          e.preventDefault();
          var from = e.dataTransfer.getData("text/plain") || dragging, to = key;
          if (!from || from === to) return;
          var nextKeys = keys.slice().filter(function (k) { return lookup.has(k); });
          nextKeys.splice(nextKeys.indexOf(from), 1);
          nextKeys.splice(Math.max(0, nextKeys.indexOf(to)), 0, from);
          persistOrder(nextKeys);
        });
        orderList.appendChild(row);
      });
      if (!orderList.children.length) orderList.appendChild(h("p", { class: "scx-help", text: "No items in this category yet. Add an item using the Add item tab." }));
    }
    group.addEventListener("change", function () { ui.controlSection = group.value; buildOptions(); });
    itemSelect.addEventListener("change", buildFields);
    if (typeof window.STREAMCLOUD_SETTINGS_READY === "object") {
      Promise.resolve(window.STREAMCLOUD_SETTINGS_READY).then(function () {
        if (typeof window.STREAMCLOUD_RELOAD_TITLES === "function") window.STREAMCLOUD_RELOAD_TITLES();
      });
    }
    Promise.all([
      fetch("./data/recommendations.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      Promise.resolve(window.STREAMCLOUD_TITLE_LISTINGS).catch(function () { return {}; })
    ]).then(function (pair) {
      var source = pair[0] || {}, extra = pair[1] || {};
      source.movies = (source.movies || []).concat(extra.movies || []);
      source.series = (source.series || []).concat(extra.series || []);
      if (typeof window.STREAMCLOUD_CONTROL_RECOMMENDATIONS === "function") window.STREAMCLOUD_CONTROL_RECOMMENDATIONS(source);
      buildOptions();
    }).catch(buildOptions);
    buildOptions();

    var saveSection = h("button", { class: "scx-btn pri", type: "button", text: "Save section and grid settings", onclick: function () {
      var next = cloneSettings(settings);
      [["sites", "Movie Websites"], ["apps", "Movie Apps"], ["music", "Music Apps"], ["recs", "Recommendations"]].forEach(function (p) {
        var f = sectionFields[p[0]];
        next.sections[p[0]] = { visible: f.show.checked, title: f.title.value.trim().slice(0, 100) || p[1] };
      });
      var order = secOrder.input.value.split(",").map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return ["sites", "apps", "music", "recs"].indexOf(x) >= 0; });
      if (new Set(order).size !== 4 || ["sites", "apps", "music", "recs"].some(function (x) { return order.indexOf(x) < 0; })) { say(msg, "err", "Section order must contain sites, apps, music, and recs exactly once."); return; }
      next.sections.order = order;
      next.appearance.desktopColumns = Number(colsD.input.value);
      next.appearance.tabletColumns = Number(colsT.input.value);
      next.appearance.mobileColumns = Number(colsM.input.value);
      next.appearance.gap = Number(gap.input.value);
      next.appearance.radius = Number(radius.input.value);
      next.appearance.aspectRatio = aspect.value;
      saveSettings(next, msg, function (finalSettings) { settings = finalSettings; });
    } });
    wrap.appendChild(h("div", { class: "scx-actions" }, [saveSection]));
  }
  function showLayout(msg) {
    bodyEl.appendChild(h("p", { class: "scx-help", text: "Card fields, visibility, section order, desktop/tablet/mobile grid columns, card spacing and ordering are stored in Supabase and shared with visitors." }));
    loadSettings().then(function (settings) { readCatalogControls(msg, settings); }).catch(function (e) { if (!expired(e)) say(msg, "err", e.message); });
  }
  function showAppearance(msg) {
    loadSettings().then(function (settings) {
      var a = settings.appearance || {};
      var grid = h("div", { class: "scx-two" });
      var fields = {};
      [["background", "Background", "#141414"], ["panel", "Panel", "#181818"], ["card", "Card", "#242424"], ["text", "Text", "#ffffff"], ["dim", "Muted text", "#a7a7a7"], ["accent", "Accent", "#e50914"], ["border", "Border", "#343434"]].forEach(function (p) {
        var f = field(p[1], a[p[0]] || p[2], "color"); grid.appendChild(f.wrap); fields[p[0]] = f.input;
      });
      var font = field("Font family", a.fontFamily || "Inter, system-ui, sans-serif", "text", { maxlength: "80" });
      var size = field("Base font size (px)", a.fontSize || 14, "number", { min: "12", max: "20" });
      var imageFit = h("select", { class: "scx-in", "aria-label": "Image fit" });
      options(imageFit, [{value:"contain",label:"Contain (show full logo/poster)"},{value:"cover",label:"Cover (fill card)"},{value:"fill",label:"Fill card"}], a.imageFit || "contain");
      var fitWrap = h("label", { class: "scx-f" }, ["Image fit", imageFit]);
      grid.appendChild(font.wrap); grid.appendChild(size.wrap); grid.appendChild(fitWrap); bodyEl.appendChild(grid);
      bodyEl.appendChild(h("p", { class: "scx-help", text: "These appearance settings only adjust existing design tokens. The site's dark StreamCloud identity and card components remain in place." }));
      bodyEl.appendChild(h("div", { class: "scx-actions" }, [h("button", { class: "scx-btn pri", type: "button", text: "Save appearance", onclick: function () {
        var next = cloneSettings(settings);
        Object.keys(fields).forEach(function (key) { next.appearance[key] = fields[key].value; });
        next.appearance.fontFamily = font.input.value.trim().slice(0, 80);
        next.appearance.fontSize = Number(size.input.value);
        next.appearance.imageFit = imageFit.value;
        saveSettings(next, msg);
      } })]));
    }).catch(function (e) { if (!expired(e)) say(msg, "err", e.message); });
  }
  function showSiteSettings(msg) {
    loadSettings().then(function (settings) {
      var site = settings.site || {};
      bodyEl.appendChild(h("h3", { text: "SEO & identity" }));
      var title = field("Browser / site title", site.title || "StreamCloud", "text", { maxlength: "100" });
      var desc = field("SEO description", site.description || "Explore curated movie and web-series websites, streaming apps, and music apps—all in one place.", "textarea", { maxlength: "300", rows: "3" });
      var keywords = field("SEO keywords (comma-separated)", site.keywords || "movies, web series, streaming, music apps", "text", { maxlength: "300" });
      var instagram = field("Instagram URL", site.instagramUrl || "https://www.instagram.com/mahimahfud/", "url");
      var themeColor = field("Browser theme color", site.themeColor || "#141414", "color", { "aria-label": "Browser theme color" });
      bodyEl.appendChild(title.wrap); bodyEl.appendChild(desc.wrap); bodyEl.appendChild(keywords.wrap);
      bodyEl.appendChild(instagram.wrap); bodyEl.appendChild(themeColor.wrap);
      bodyEl.appendChild(h("h3", { text: "Homepage hero" }));
      var heroVisible = checkbox("Show the homepage hero", site.heroVisible !== false);
      var eyebrow = field("Small hero heading", site.heroEyebrow || "Unlocking the Universe of", "text", { maxlength: "80" });
      var heroTitle = field("Main hero heading", site.heroTitle || "Movies, Series & Music", "text", { maxlength: "100" });
      var heroDescription = field("Hero description", site.heroDescription || site.description || "Explore curated movie and web-series websites, streaming apps, and music apps—all in one place.", "textarea", { maxlength: "300", rows: "3" });
      bodyEl.appendChild(heroVisible.wrap); bodyEl.appendChild(eyebrow.wrap); bodyEl.appendChild(heroTitle.wrap); bodyEl.appendChild(heroDescription.wrap);
      bodyEl.appendChild(h("h3", { text: "Announcement banner" }));
      var announcementEnabled = checkbox("Show announcement to visitors", site.announcementEnabled === true);
      var announcement = field("Announcement message", site.announcement || "", "textarea", { maxlength: "240", rows: "2", placeholder: "Example: New movie recommendations added today" });
      var announcementLink = field("Optional announcement link (HTTPS)", site.announcementLink || "", "url", { placeholder: "https://…" });
      var announcementLabel = field("Link label", site.announcementLabel || "Learn more", "text", { maxlength: "36" });
      bodyEl.appendChild(announcementEnabled.wrap); bodyEl.appendChild(announcement.wrap); bodyEl.appendChild(announcementLink.wrap); bodyEl.appendChild(announcementLabel.wrap);
      bodyEl.appendChild(h("p", { class: "scx-help", text: "Hero and banner text is inserted as plain text. Links must use HTTPS. Visitors can dismiss an announcement for their current browser session." }));
      bodyEl.appendChild(h("div", { class: "scx-actions" }, [h("button", { class: "scx-btn pri", type: "button", text: "Save site controls", onclick: function () {
        var igValue = instagram.input.value.trim(), bannerUrl = announcementLink.input.value.trim();
        if (igValue && !/^https:\/\//i.test(igValue)) { say(msg, "err", "Instagram URL must use HTTPS."); return; }
        if (bannerUrl && !isHttps(bannerUrl)) { say(msg, "err", "Announcement link must be a valid HTTPS URL."); return; }
        if (announcementEnabled.input.checked && !announcement.input.value.trim()) { say(msg, "err", "Enter announcement text or turn the banner off."); return; }
        if (!/^#[0-9a-f]{6}$/i.test(themeColor.input.value)) { say(msg, "err", "Choose a valid theme color."); return; }
        var next = cloneSettings(settings);
        next.site.title = title.input.value.trim().slice(0, 100);
        next.site.description = desc.input.value.trim().slice(0, 300);
        next.site.keywords = keywords.input.value.trim().slice(0, 300);
        next.site.instagramUrl = igValue; next.site.themeColor = themeColor.input.value;
        next.site.heroVisible = heroVisible.input.checked;
        next.site.heroEyebrow = eyebrow.input.value.trim().slice(0, 80);
        next.site.heroTitle = heroTitle.input.value.trim().slice(0, 100);
        next.site.heroDescription = heroDescription.input.value.trim().slice(0, 300);
        next.site.announcementEnabled = announcementEnabled.input.checked;
        next.site.announcement = announcement.input.value.trim().slice(0, 240);
        next.site.announcementLink = bannerUrl;
        next.site.announcementLabel = announcementLabel.input.value.trim().slice(0, 36);
        saveSettings(next, msg);
      } })]));
    }).catch(function (e) { if (!expired(e)) say(msg, "err", e.message); });
  }

  function showAiStudio(msg) {
    bodyEl.appendChild(h("p", { class: "scx-help", text: "Look up a movie or web series by title. IMDb rating, poster, release year, genres, and series counts are loaded only when the match is verified. Nothing is published until you review it in Add item." }));
    var title = field("Movie / web-series title", "", "text", { maxlength: "160", placeholder: "Enter the exact title" });
    var year = field("Release year (optional)", "", "number", { min: "1870", max: "2100", placeholder: "e.g. 2024" });
    var type = h("select", { class: "scx-in", "aria-label": "Title type" });
    options(type, [{ value: "movie", label: "Movie" }, { value: "series", label: "Web Series" }], "movie");
    var typeWrap = h("label", { class: "scx-f" }, ["Type", type]);
    var aiSummary = checkbox("Create a short summary from the verified plot", true);
    var lookup = h("button", { class: "scx-btn pri", type: "button", text: "Find verified metadata" });
    var result = h("div", { class: "scx-ai-result" });
    var resultMsg = h("p", { class: "scx-help", text: "Search results appear here after lookup." });
    bodyEl.appendChild(h("div", { class: "scx-grid" }, [title.wrap, year.wrap, typeWrap]));
    bodyEl.appendChild(aiSummary.wrap);
    bodyEl.appendChild(h("div", { class: "scx-actions" }, [lookup]));
    bodyEl.appendChild(resultMsg); bodyEl.appendChild(result);
    function showResult(d) {
      result.textContent = "";
      var item = d.detected || {};
      var head = h("div", { class: "scx-ai-head" });
      if (item.poster_url && isHttps(item.poster_url)) head.appendChild(h("img", { src: item.poster_url, alt: item.name ? item.name + " poster" : "Title poster", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" }));
      var info = h("div", { class: "scx-ai-info" });
      info.appendChild(h("b", { text: item.name || "Untitled" }));
      info.appendChild(h("small", { text: [item.year || "Year not listed", item.imdb_rating != null ? "IMDb " + item.imdb_rating + "/10" : "IMDb rating unavailable", item.genres && item.genres.length ? item.genres.join(", ") : ""].filter(Boolean).join(" · ") }));
      info.appendChild(h("p", { text: item.description || "No verified plot was supplied." }));
      if (item.season_count != null || item.episode_count != null) info.appendChild(h("small", { text: [item.season_count != null ? item.season_count + " seasons" : "", item.episode_count != null ? item.episode_count + " episodes" : ""].filter(Boolean).join(" · ") }));
      head.appendChild(info); result.appendChild(head);
      (d.notes || []).forEach(function (note) { result.appendChild(h("p", { class: "scx-help", text: note })); });
      var use = h("button", { class: "scx-btn pri", type: "button", text: "Use this title in Add item" });
      use.addEventListener("click", function () {
        var sec = type.value;
        resetAdd(); ui.catIndex = sec === "series" ? 1 : 0; ui.section = sec;
        ui.form = Object.assign({ section: sec, category: sec === "series" ? "Web Series" : "Movie" }, item);
        ui.form.section = sec; ui.form.category = sec === "series" ? "Web Series" : "Movie";
        ui.form.url = item.url || (item.imdb_id ? "https://www.imdb.com/title/" + item.imdb_id + "/" : "");
        ui.verified = d.verified || {}; ui.notes = d.notes || [];
        showHome("add", { kind: "ok", text: "Metadata loaded. Review the destination URL and details before publishing." });
      });
      result.appendChild(h("div", { class: "scx-actions" }, [use]));
    }
    lookup.addEventListener("click", function () {
      var name = title.input.value.trim();
      if (name.length < 2) { say(msg, "err", "Enter at least two characters for the title."); title.input.focus(); return; }
      lookup.disabled = true; lookup.textContent = "Looking up…"; say(msg, "", "");
      result.textContent = ""; resultMsg.textContent = "Checking title, rating, poster and series details…";
      api("admin-detect", { mode: "title-lookup", title: name, year: year.input.value ? Number(year.input.value) : null, section: type.value, generateSummary: aiSummary.input.checked, aiProvider: "auto" })
        .then(function (d) { showResult(d); resultMsg.textContent = "Metadata checked. Review every field before saving."; say(msg, "ok", "Lookup complete."); })
        .catch(function (e) { resultMsg.textContent = ""; if (!expired(e)) say(msg, "err", e.message || "Title lookup failed."); })
        .finally(function () { lookup.disabled = false; lookup.textContent = "Find verified metadata"; });
    });
    title.input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); lookup.click(); } });
  }
  function showActivity(msg) {
    var list = h("div", { class: "scx-list" }, [h("p", { text: "Loading activity…" })]); bodyEl.appendChild(list);
    api("admin-listings", { action: "activity-list" }).then(function (d) {
      list.textContent = "";
      (d.activity || []).forEach(function (a) {
        list.appendChild(h("div", { class: "scx-item" }, [
          h("div", {}, [h("b", { text: a.action }), h("small", { text: (a.entity_name || a.entity_type || "") + " · " + new Date(a.created_at).toLocaleString() })]),
          h("small", { text: JSON.stringify(a.details || {}) })
        ]));
      });
      if (!list.children.length) list.appendChild(h("p", { class: "scx-help", text: "No admin activity recorded yet." }));
    }).catch(function (e) { list.textContent = ""; if (!expired(e)) say(msg, "err", e.message); });
  }
  function showBackup(msg) {
    var note = h("p", { class: "scx-help", text: "Export database listings and persistent site settings to a JSON file. Import is additive: duplicate or invalid listings are skipped; existing data is not silently replaced." });
    bodyEl.appendChild(note);
    var area = field("Import JSON", "", "textarea", { rows: "9", placeholder: '{"listings":[],"settings":{}}' });
    bodyEl.appendChild(area.wrap);
    var exportBtn = h("button", { class: "scx-btn", type: "button", text: "Export JSON" });
    var importBtn = h("button", { class: "scx-btn pri", type: "button", text: "Validate and import" });
    bodyEl.appendChild(h("div", { class: "scx-actions" }, [exportBtn, importBtn]));
    exportBtn.addEventListener("click", function () {
      Promise.all([
        api("admin-listings", { action: "list" }),
        api("admin-listings", { action: "settings-get" }),
        fetch("./data/recommendations.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      ]).then(function (pair) {
        var data = { schema: "streamcloud-admin-v1", exportedAt: new Date().toISOString(), listings: pair[0].listings || [], settings: pair[1].settings || {}, curatedRecommendationsSnapshot: pair[2] };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob), a = h("a", { href: url, download: "streamcloud-admin-backup.json" });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        say(msg, "ok", "Backup exported. Curated recommendations are included as a reference snapshot.");
      }).catch(function (e) { if (!expired(e)) say(msg, "err", e.message); });
    });
    importBtn.addEventListener("click", function () {
      var data;
      try { data = JSON.parse(area.input.value); } catch (e) { say(msg, "err", "The JSON syntax is invalid."); return; }
      if (!data || typeof data !== "object" || (!Array.isArray(data.listings) && !data.settings)) { say(msg, "err", "Expected a backup with listings and/or settings."); return; }
      var count = Array.isArray(data.listings) ? data.listings.length : 0;
      if (!confirm("Import up to " + count + " database listings and the supplied site settings? Duplicate listings will be skipped. Existing listings will not be replaced.")) return;
      importBtn.disabled = true;
      api("admin-listings", { action: "import", listings: data.listings || [], settings: data.settings || null }).then(function (result) {
        say(msg, "ok", "Import finished: " + result.added + " added, " + result.skipped + " skipped. Curated recommendation snapshots are not written to the repository by browser import.");
        area.input.value = "";
        if (typeof window.STREAMCLOUD_APPLY_SETTINGS === "function" && result.settings) window.STREAMCLOUD_APPLY_SETTINGS(result.settings);
      }).catch(function (e) { if (!expired(e)) say(msg, "err", e.message); }).finally(function () { importBtn.disabled = false; });
    });
  }
  function showPinChange(msg) {
    var pin = field("New admin PIN (4–64 characters)", "", "password", { autocomplete: "new-password", maxlength: "64" });
    var confirmPin = field("Confirm new PIN", "", "password", { autocomplete: "new-password", maxlength: "64" });
    bodyEl.appendChild(pin.wrap); bodyEl.appendChild(confirmPin.wrap);
    bodyEl.appendChild(h("p", { class: "scx-help", text: "The PIN is verified and hashed server-side. Saving it revokes all existing admin sessions, so you will need to log in again." }));
    bodyEl.appendChild(h("div", { class: "scx-actions" }, [h("button", { class: "scx-btn pri", type: "button", text: "Change PIN", onclick: function () {
      if (pin.input.value.length < 4 || pin.input.value.length > 64) { say(msg, "err", "PIN must be 4–64 characters."); return; }
      if (pin.input.value !== confirmPin.input.value) { say(msg, "err", "PIN confirmation does not match."); return; }
      if (!confirm("Change the admin PIN and revoke every active admin session?")) return;
      api("admin-listings", { action: "pin-change", pin: pin.input.value }).then(function () {
        setSession(null); showPin(); var target = bodyEl.querySelector(".scx-msg"); if (target) say(target, "ok", "PIN changed. Log in with the new PIN.");
      }).catch(function (e) { if (!expired(e)) say(msg, "err", e.message); });
    } })]));
  }

  /* ---------- admin panel entry point (header shield icon) ---------- */
  function mount() {
    var adminIcon = document.getElementById("adminIcon");
    if (adminIcon && !adminIcon.dataset.bound) { adminIcon.dataset.bound = "1"; adminIcon.addEventListener("click", openModal); }
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
