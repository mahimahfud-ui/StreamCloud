/* StreamCloud Admin Theme v3 "Campus" — full-page admin skin.
   Keeps the existing admin logic and data handlers untouched.
   Load LAST after admin-ultra.js, admin-ai-plus.js and admin-polish.js. */
(function () {
  "use strict";
  if (document.getElementById("ux-theme-campus")) return;

  var NS = "http://www.w3.org/2000/svg", TK = "scx-ux-theme";
  var P = {
    overview: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
    add: "M12 5v14M5 12h14",
    ai: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16v4M17 18h4",
    layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
    list: "M4 6h16M4 12h16M4 18h10",
    layout: "M3 4h18v16H3zM3 10h18M9 10v10",
    palette: "M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.6-.3-1-.6-1.4-.3-.4-.4-.8-.4-1.2 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0021 11c0-4.4-4-8-9-8z",
    globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
    clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
    download: "M12 4v11M7 11l5 5 5-5M4 20h16",
    lock: "M5 11h14v9H5zM8 11V8a4 4 0 018 0v3",
    logout: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9",
    dot: "M12 12h.01",
    sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
    moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
    more: "M5 12h.01M12 12h.01M19 12h.01"
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function svg(k, sz) {
    var s = document.createElementNS(NS, "svg"), p = document.createElementNS(NS, "path");
    [["viewBox", "0 0 24 24"], ["width", sz || 18], ["height", sz || 18], ["fill", "none"], ["stroke", "currentColor"], ["stroke-width", k === "more" ? 3 : 1.8], ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"]].forEach(function (a) { s.setAttribute(a[0], a[1]); });
    p.setAttribute("d", P[k] || P.dot); s.appendChild(p); return s;
  }
  function h(tag, a, kids) {
    var n = document.createElement(tag); a = a || {};
    Object.keys(a).forEach(function (k) { if (k === "text") n.textContent = a[k]; else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), a[k]); else n.setAttribute(k, a[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); }); return n;
  }
  function iconKey(t) {
    t = t.toLowerCase();
    if (/overview|dashboard/.test(t)) return "overview";
    if (/add/.test(t)) return "add";
    if (/copilot|ai studio/.test(t)) return "ai";
    if (/catalogue/.test(t)) return "layers";
    if (/content/.test(t)) return "list";
    if (/layout|card/.test(t)) return "layout";
    if (/appearance|theme/.test(t)) return "palette";
    if (/site|setting/.test(t)) return "globe";
    if (/log ?out|sign ?out/.test(t)) return "logout";
    if (/activity|log/.test(t)) return "clock";
    if (/backup|export|import/.test(t)) return "download";
    if (/pin|password|security/.test(t)) return "lock";
    return "dot";
  }

  /* ---------- Campus theme CSS ---------- */
  var LOGO = "url(\"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#6366f1'/><stop offset='1' stop-color='#8b5cf6'/></linearGradient></defs><rect width='36' height='36' rx='10' fill='url(#g)'/><path d='M14 11l11 7-11 7z' fill='white'/></svg>") + "\")";
  var G = "linear-gradient(135deg,var(--u-ac),var(--u-ac2))", O = ".scx-ov ", SURF = "background:var(--u-sf);border:1px solid var(--u-ln);border-radius:16px";
  var css =
    O + "{--u-bg:#0e1016;--u-sf:#161922;--u-sf2:#1d212c;--u-ln:rgba(255,255,255,.09);--u-tx:#f3f5f9;--u-dm:#98a1b5;--u-ac:#6366f1;--u-ac2:#8b5cf6;--u-acs:rgba(99,102,241,.18);--u-actx:#a5b4fc;--u-sh:0 30px 90px rgba(0,0,0,.6);--u-ov:rgba(7,8,13,.68);--card:var(--u-sf2);--text:var(--u-tx);--dim:var(--u-dm);--border:var(--u-ln);--panel:var(--u-sf);--red:var(--u-ac);color-scheme:dark}" +
    ".scx-ov[data-ux-theme=light]{--u-bg:#f1f5f9;--u-sf:#fff;--u-sf2:#f8fafc;--u-ln:#e2e8f0;--u-tx:#0f172a;--u-dm:#64748b;--u-ac:#4f46e5;--u-ac2:#7c3aed;--u-acs:#eef2ff;--u-actx:#4f46e5;--u-sh:0 30px 80px rgba(15,23,42,.2);--u-ov:rgba(203,213,225,.66);color-scheme:light}" +
    O + "{background:var(--u-bg)!important;-webkit-backdrop-filter:none;backdrop-filter:none;padding:0!important;display:block}.scx-ov[hidden]{display:none!important}" +
    "body.ux-page>*:not(.scx-ov):not(.ux-toast):not(script):not(style):not(link){display:none!important}" +
    ".ux-dockbtn,.ux-live,.ux-revert,.ux-qbar button:first-child{display:none!important}" +
    O + ".scx-box{position:relative;width:100%;max-width:none;height:100%;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:var(--u-bg);color:var(--u-tx);box-shadow:none}" +
    /* header */
    O + ".scx-head{position:sticky;top:0;z-index:20;margin:0;padding:14px 22px;display:flex;align-items:center;gap:14px;background:var(--u-sf);border-bottom:1px solid var(--u-ln);border-radius:0}" +
    O + ".scx-head h2{margin:0;font-size:18px;font-weight:800;color:var(--u-tx);white-space:nowrap}" +
    O + ".ux-gsearch{position:relative;flex:1 1 220px;max-width:340px;margin-left:auto}.ux-gsearch input{width:100%;padding:9px 14px 9px 36px!important;border-radius:999px!important}.ux-gsearch svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--u-dm);pointer-events:none}" +
    O + ".ux-tools{margin-left:0}" + O + ".ux-gsearch+.ux-tools{margin-left:0}" +
    O + ".ux-themebtn{width:36px;height:36px;display:grid;place-items:center;padding:0;border-radius:50%}" +
    O + ".scx-x{width:36px;height:36px;display:grid;place-items:center;padding:0;border-radius:50%;background:var(--u-sf2);border:1px solid var(--u-ln);color:var(--u-tx)}" +
    O + ".scx-box>div:nth-child(2){max-width:1320px;margin:0 auto;padding:24px 22px 40px}" +
    /* desktop sidebar */
    "@media(min-width:900px){.scx-ov:not(.ux-dock) .scx-box>div:nth-child(2):has(>.scx-tabs)>.scx-tabs{float:left;width:220px;flex-direction:column;flex-wrap:nowrap;gap:3px;margin:0;padding:14px 12px;position:sticky;top:84px;max-height:calc(100vh - 150px);overflow:auto;" + SURF.replace("16px", "18px") + "}" +
    ".scx-ov:not(.ux-dock) .scx-box>div:nth-child(2):has(>.scx-tabs)>:not(.scx-tabs){margin-left:244px}" +
    ".scx-ov:not(.ux-dock) .scx-box>div:nth-child(2):has(>.scx-tabs)::after{content:\"\";display:block;clear:both}" +
    ".scx-ov:not(.ux-dock) .scx-tabs::before{content:\"StreamCloud Admin\";display:block;margin:0 0 10px;padding:2px 0 12px 48px;min-height:38px;line-height:34px;font-weight:800;font-size:14px;color:var(--u-tx);background:" + LOGO + " no-repeat 2px 0/34px;border-bottom:1px solid var(--u-ln)}.scx-ov:not(.ux-dock) .scx-tab{width:100%}}" +
    O + ".scx-tabs{gap:6px;margin:0 0 18px;scrollbar-width:none}.scx-ov.ux-dock .scx-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}@media(max-width:899px){.scx-ov .scx-tabs{flex-wrap:nowrap;overflow-x:auto}}" +
    O + ".scx-tab{display:flex;align-items:center;justify-content:flex-start;gap:10px;white-space:nowrap;text-align:left;padding:10px 12px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--u-dm);font-size:13px;font-weight:650}" +
    O + ".scx-tab .ux-ico{display:grid;place-items:center;flex:none}" +
    O + ".scx-tab:hover{background:var(--u-sf2);color:var(--u-tx)}" +
    O + ".scx-tab.on{background:var(--u-acs);color:var(--u-actx);border-color:transparent;box-shadow:none}" +
    O + ".ux-protab::after,.ux-aitab::after{content:\"AI\";margin-left:auto;font-size:9px;font-weight:800;letter-spacing:.08em;padding:2px 6px;border-radius:99px;background:" + G + ";color:#fff}" +
    /* controls */
    O + ".scx-btn,.ux-tbtn{border:1px solid var(--u-ln);border-radius:11px;background:var(--u-sf2);color:var(--u-tx);padding:9px 15px;font-size:13px;font-weight:650}" +
    O + ".scx-btn:hover,.ux-tbtn:hover{border-color:var(--u-ac);color:var(--u-actx)}" +
    O + ".scx-btn.pri,.scx-ov .ux-tbtn.on{background:" + G + ";color:#fff;border-color:transparent;box-shadow:0 8px 22px rgba(99,102,241,.35)}.scx-ov .scx-btn.pri:hover{filter:brightness(1.08);color:#fff}" +
    O + ".scx-btn.dng{color:#ef4444;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.35)}.scx-ov .scx-btn.dng:hover{background:rgba(239,68,68,.16);color:#ef4444}" +
    O + ".ux-tbtn{border-radius:999px;padding:7px 13px;font-size:12px}" +
    O + ".scx-f{gap:6px;font-size:11.5px;font-weight:650;color:var(--u-dm)}" +
    O + ".scx-in,.scx-box input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]),.scx-box select,.scx-box textarea{background:var(--u-sf2);border:1px solid var(--u-ln);border-radius:12px;padding:10px 13px;color:var(--u-tx);font-size:13.5px}" +
    O + ".scx-box select{color-scheme:inherit}" +
    ".scx-ov:not([data-ux-theme=light]) .scx-box select option,.scx-ov:not([data-ux-theme=light]) .scx-box select optgroup{background:#1d212c;color:#f3f5f9}" +
    ".scx-ov[data-ux-theme=light] .scx-box select option,.scx-ov[data-ux-theme=light] .scx-box select optgroup{background:#fff;color:#0f172a}" +
    O + ".scx-box input[type=color]{height:42px;padding:3px;border-radius:12px;background:var(--u-sf2);border:1px solid var(--u-ln);cursor:pointer}" +
    O + ".scx-in:focus,.scx-box input:focus,.scx-box select:focus,.scx-box textarea:focus{border-color:var(--u-ac);background:var(--u-sf);box-shadow:0 0 0 3px var(--u-acs)}" +
    O + ".ux-step input{border-radius:0!important}.scx-ov .ux-step button{background:var(--u-sf2);border-color:var(--u-ln);color:var(--u-tx);font-weight:700}.scx-ov .ux-step button:hover{background:var(--u-ac);border-color:var(--u-ac);color:#fff}" +
    O + ".scx-help{color:var(--u-dm);font-size:12.5px;line-height:1.6}" +
    /* surfaces */
    O + ".scx-item,.ux-card,.ux-panel,.ux-stat,.scx-sum,.scx-ai-head,.scx-stat{" + SURF + ";box-shadow:0 1px 2px rgba(15,23,42,.06)}" +
    O + ".ux-panel{padding:16px}.ux-panel h3{font-size:14px;font-weight:750;color:var(--u-tx)}" +
    O + ".ux-stat,.scx-stat{padding:16px}.ux-stat b,.scx-stat b,.scx-stat strong{font-size:27px;font-weight:800;color:var(--u-tx)}.scx-ov .ux-stat small,.scx-ov .scx-stat span,.scx-ov .scx-stat small{color:var(--u-dm);font-size:11.5px}" +
    O + ".ux-stats>.ux-stat:first-child,.scx-ov .scx-stat-grid>:first-child{background:" + G + ";border-color:transparent;box-shadow:0 12px 28px rgba(99,102,241,.35)}.scx-ov .ux-stats>.ux-stat:first-child *,.scx-ov .scx-stat-grid>:first-child *{color:#fff;opacity:1}" +
    O + ".scx-msg{border-radius:13px;background:var(--u-sf2);color:var(--u-tx)}.scx-ov .scx-msg.ok{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.4)}.scx-ov .scx-msg.err{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.45)}" +
    O + ".ux-sticky{top:76px;padding:9px 10px;border:1px solid var(--u-ln);border-radius:15px;background:var(--u-sf)}" +
    O + ".ux-thumb,.ux-art{background:linear-gradient(135deg,var(--u-acs),rgba(139,92,246,.22));color:var(--u-actx)}" +
    O + ".ux-pill{border-radius:999px;padding:5px 11px;font-size:11.5px;background:var(--u-sf2);color:var(--u-tx);border-color:var(--u-ln)}.scx-ov button.ux-pill.on{background:" + G + ";border-color:transparent;color:#fff}" +
    O + ".ux-cardprev{" + SURF + ";background:var(--u-sf2)}" +
    O + ".ux-meter,.ux-prog{background:var(--u-ln)}.scx-ov .ux-prog i{background:" + G + "}.scx-ov .ux-meter i{background:#10b981}.scx-ov .ux-meter.mid i{background:#f59e0b}.scx-ov .ux-meter.low i{background:#ef4444}" +
    O + ".ux-fillrow{border-top-color:var(--u-ln)}.scx-ov .ux-live{color:#10b981}" +
    /* mobile bottom dock */
    ".ux-bnav,.ux-sheet{display:none}" +
    "@media(max-width:700px){.scx-ov:not(.ux-dock){padding:0!important}.scx-ov:not(.ux-dock) .scx-box{width:100%;max-width:none;height:100%;max-height:none;border-radius:0;padding-bottom:104px}.scx-ov:not(.ux-dock) .scx-head{border-radius:0;padding:12px 14px}.scx-ov:not(.ux-dock) .scx-tabs{display:none}.scx-ov:not(.ux-dock) .scx-box>div:nth-child(2){padding:16px 14px 30px}.ux-gsearch{display:none}" +
    ".scx-ov:not(.ux-dock) .ux-bnav{display:flex;position:fixed;left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));width:min(440px,calc(100% - 24px));z-index:40;align-items:center;justify-content:space-around;padding:8px 6px;border-radius:26px;background:var(--u-sf);border:1px solid var(--u-ln);box-shadow:0 14px 40px rgba(15,23,42,.3)}" +
    ".scx-ov:not(.ux-dock) .ux-sheet.open{display:grid}}" +
    O + ".ux-bn{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:54px;padding:6px 8px;border:0;border-radius:14px;background:transparent;color:var(--u-dm);font-size:10px;font-weight:700;cursor:pointer}.scx-ov .ux-bn.on{color:var(--u-actx);background:var(--u-acs)}" +
    O + ".ux-bn.ux-fab{width:54px;height:54px;min-width:54px;margin-top:-26px;padding:0;justify-content:center;border-radius:50%;background:" + G + ";color:#fff;border:4px solid var(--u-bg);box-shadow:0 10px 24px rgba(99,102,241,.45)}.scx-ov .ux-bn.ux-fab span{display:none}" +
    O + ".ux-sheet{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(12px,env(safe-area-inset-bottom)) + 76px);width:min(440px,calc(100% - 24px));z-index:41;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px;border-radius:22px;background:var(--u-sf);border:1px solid var(--u-ln);box-shadow:0 18px 50px rgba(15,23,42,.35)}" +
    O + ".ux-sheet button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border:1px solid var(--u-ln);border-radius:14px;background:var(--u-sf2);color:var(--u-tx);font-size:11px;font-weight:650;cursor:pointer}.scx-ov .ux-sheet button.on{background:var(--u-acs);color:var(--u-actx);border-color:transparent}" +
    ".ux-qbar{background:rgba(20,22,30,.85)}";

  var st = document.createElement("style");
  st.id = "ux-theme-campus";
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------- dark / light switch ---------- */
  function theme() {
    try { return localStorage.getItem(TK) === "light" ? "light" : "dark"; }
    catch (e) { return "dark"; }
  }
  function setIcon(b) {
    b.textContent = "";
    b.appendChild(svg(theme() === "dark" ? "sun" : "moon", 17));
    b.title = theme() === "dark" ? "Switch to light mode" : "Switch to dark mode";
    b.setAttribute("aria-label", b.title);
  }
  function applyTheme(ov) {
    if (ov.dataset.uxTheme !== theme()) ov.dataset.uxTheme = theme();
    var b = $(".ux-themebtn");
    if (b) setIcon(b);
  }
  function toggle() {
    try { localStorage.setItem(TK, theme() === "dark" ? "light" : "dark"); } catch (e) { /* ignore */ }
    var ov = $(".scx-ov");
    if (ov) applyTheme(ov);
  }

  /* ---------- header search + theme button ---------- */
  function globalSearch(q) {
    var t = $(".ux-protab");
    if (!t) return;
    t.click();
    var n = 0, timer = setInterval(function () {
      var i = $(".ux-pro input[type=search]");
      if (i) { clearInterval(timer); i.value = q; i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); }
      else if (++n > 30) clearInterval(timer);
    }, 60);
  }
  function header() {
    var head = $(".scx-head");
    if (!head) return;
    if (!$(".ux-gsearch")) {
      var inp = h("input", { type: "search", placeholder: "Search catalogue…", "aria-label": "Search catalogue" });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); globalSearch(inp.value.trim()); } });
      var wrap = h("div", { class: "ux-gsearch" }, [svg("search", 16), inp]);
      head.insertBefore(wrap, $(".ux-tools") || head.lastChild);
    }
    var tools = $(".ux-tools");
    if (tools && !$(".ux-themebtn", tools)) {
      var b = h("button", { class: "ux-tbtn ux-themebtn", type: "button", onclick: toggle });
      setIcon(b);
      tools.appendChild(b);
    }
  }

  /* ---------- tab icons ---------- */
  function icons() {
    $$(".scx-tab").forEach(function (t) {
      if ($(".ux-ico", t)) return;
      t.insertBefore(h("span", { class: "ux-ico" }, [svg(iconKey(t.textContent))]), t.firstChild);
    });
  }

  /* ---------- mobile bottom navigation ---------- */
  function tabBtn(label) {
    var out = null;
    $$(".scx-tab").forEach(function (b) { if (!out && b.textContent.trim().indexOf(label) === 0) out = b; });
    return out;
  }
  var sheet = null;
  function closeSheet() { if (sheet) sheet.classList.remove("open"); }
  function openSheet(ov) {
    if (!sheet) { sheet = h("div", { class: "ux-sheet", role: "menu" }); ov.appendChild(sheet); }
    if (sheet.classList.contains("open")) return closeSheet();
    sheet.textContent = "";
    $$(".scx-tab").forEach(function (t) {
      var label = t.textContent.replace("✦", "").trim();
      var b = h("button", { type: "button", role: "menuitem", class: t.classList.contains("on") ? "on" : "" }, [svg(iconKey(label), 20), h("span", { text: label })]);
      b.addEventListener("click", function () { t.click(); closeSheet(); setTimeout(sync, 80); });
      sheet.appendChild(b);
    });
    sheet.classList.add("open");
  }
  function sync() {
    $$(".ux-bn[data-t]").forEach(function (b) {
      var t = tabBtn(b.dataset.t);
      b.classList.toggle("on", !!(t && t.classList.contains("on")));
    });
  }
  function dock(ov) {
    if ($(".ux-bnav", ov)) return sync();
    var nav = h("nav", { class: "ux-bnav", "aria-label": "Admin sections" });
    [["Overview", "overview", "Overview"], ["Catalogue Pro", "layers", "Catalogue"], ["Add item", "add", "Add", 1], ["AI Copilot", "ai", "AI"], ["More", "more", "More"]].forEach(function (d) {
      var b = h("button", { type: "button", class: "ux-bn" + (d[3] ? " ux-fab" : ""), "aria-label": d[0] }, [svg(d[1], d[3] ? 24 : 20), h("span", { text: d[2] })]);
      if (d[0] !== "More") b.dataset.t = d[0];
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        if (d[0] === "More") return openSheet(ov);
        closeSheet();
        var t = tabBtn(d[0]);
        if (t) t.click();
        setTimeout(sync, 80);
      });
      nav.appendChild(b);
    });
    ov.appendChild(nav);
    sync();
  }
  document.addEventListener("click", function (e) {
    if (sheet && sheet.classList.contains("open") && !e.target.closest(".ux-sheet,.ux-bnav")) closeSheet();
  });

  /* ---------- same-page route + hide main UI while admin is open ---------- */
  var wasOpen = false, path = location.pathname + location.search;
  function routeHash(open) {
    if (open === wasOpen) return;
    wasOpen = open;
    try {
      if (open) { if (location.hash !== "#admin") history.replaceState(null, "", path + "#admin"); }
      else if (location.hash === "#admin") history.replaceState(null, "", path);
    } catch (e) { /* ignore */ }
  }
  function autoOpen() {
    if (location.hash !== "#admin") return;
    var n = 0, timer = setInterval(function () {
      var ic = $("#adminIcon");
      if (ic) { clearInterval(timer); ic.click(); }
      else if (++n > 50) clearInterval(timer);
    }, 100);
  }
  var queued = false;
  function pass() {
    queued = false;
    var ov = $(".scx-ov"), open = !!(ov && !ov.hidden);
    document.body.classList.toggle("ux-page", open && ov.parentNode === document.body);
    routeHash(open);
    if (!open) return;
    /* Keep the Campus UI full-page even if the old live-preview preference was enabled. */
    if (ov.classList.contains("ux-dock")) {
      var db = $(".ux-dockbtn");
      if (db) db.click();
      else ov.classList.remove("ux-dock");
    }
    applyTheme(ov);
    header();
    icons();
    dock(ov);
  }
  function sched() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(pass);
    }
  }
  function start() {
    autoOpen();
    new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    sched();
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();