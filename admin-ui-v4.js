/* StreamCloud Admin v4 "Campus Flow" — full-page admin, organised Category > Sub-category, one layout per device.
   Desktop: 3 panes (categories | sub-categories | page). Tablet: category + sub-category rows above the page.
   Mobile: step-by-step screens with a back button (like a settings menu). Dark/light switch. No glass, no blur.
   Skin + navigation only: every original tab/function is still there and is clicked for you. Load LAST.
   Open from the admin icon or your-site/#admin. Remove this file to restore the old look. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg", TK = "scx-ux-theme";
  var P = {
    overview: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z", add: "M12 5v14M5 12h14", ai: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16v4M17 18h4",
    layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5", list: "M4 6h16M4 12h16M4 18h10", layout: "M3 4h18v16H3zM3 10h18M9 10v10",
    palette: "M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.6-.3-1-.6-1.4-.3-.4-.4-.8-.4-1.2 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0021 11c0-4.4-4-8-9-8z",
    globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z", clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
    download: "M12 4v11M7 11l5 5 5-5M4 20h16", lock: "M5 11h14v9H5zM8 11V8a4 4 0 018 0v3", logout: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9", dot: "M12 12h.01",
    sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5", moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3", chev: "M9 6l6 6-6 6", back: "M15 6l-6 6 6 6", shield: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z", more: "M5 12h.01M12 12h.01M19 12h.01"
  };
  var CATS = [
    { t: "Dashboard", d: "Overview and recent activity", i: "overview", rx: /overview|dashboard|activity/ },
    { t: "Catalogue", d: "Add, edit and organise items", i: "layers", rx: /add|catalogue|content|manage|listing/ },
    { t: "Title Tools", d: "Verified title lookup and autofill", i: "search", rx: /title lookup|studio/ },
    { t: "Site Design", d: "Layout, colours and site settings", i: "palette", rx: /layout|card|appearance|theme|site|setting/ },
    { t: "Security & Data", d: "PIN, backup and sign out", i: "shield", rx: /backup|pin|password|security|export|import|log ?out|sign ?out/ },
    { t: "More", d: "Everything else", i: "more", rx: /./ }
  ];
  var SUBD = [[/overview|dashboard/, "Stats and current status"], [/activity/, "Recent admin actions"], [/add/, "Create a new listing"], [/catalogue/, "Health score, bulk actions, metadata review"], [/content/, "Browse, edit and delete items"],
    [/title lookup|studio/, "Find verified title details"], [/copilot/, "Ask in plain words, bulk add"], [/layout|card/, "Cards, columns and spacing"], [/appearance/, "Colours, fonts and shape"], [/site|setting/, "Site name, links and options"],
    [/backup/, "Export and import your data"], [/pin/, "Change your admin PIN"], [/log ?out|sign ?out/, "Sign out of admin"]];
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
  function catOf(t) { t = t.toLowerCase(); for (var i = 0; i < CATS.length; i++) if (CATS[i].rx.test(t)) return i; return CATS.length - 1; }
  function iconOf(t) {
    t = t.toLowerCase();
    if (/overview|dashboard/.test(t)) return "overview"; if (/add/.test(t)) return "add"; if (/copilot|studio/.test(t)) return "ai"; if (/catalogue/.test(t)) return "layers"; if (/content/.test(t)) return "list";
    if (/layout|card/.test(t)) return "layout"; if (/appearance|theme/.test(t)) return "palette"; if (/site|setting/.test(t)) return "globe"; if (/activity|log\b/.test(t)) return "clock";
    if (/backup|export|import/.test(t)) return "download"; if (/pin|password|security/.test(t)) return "lock"; if (/log ?out|sign ?out/.test(t)) return "logout"; return "dot";
  }
  function descOf(t) { t = t.toLowerCase(); for (var i = 0; i < SUBD.length; i++) if (SUBD[i][0].test(t)) return SUBD[i][1]; return ""; }

  /* ---------- CSS ---------- */
  var LOGO = "url(\"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#6366f1'/><stop offset='1' stop-color='#8b5cf6'/></linearGradient></defs><rect width='36' height='36' rx='10' fill='url(#g)'/><path d='M14 11l11 7-11 7z' fill='white'/></svg>") + "\")";
  var G = "linear-gradient(135deg,var(--u-ac),var(--u-ac2))", O = ".scx-ov ", SURF = "background:var(--u-sf);border:1px solid var(--u-ln);border-radius:16px";
  var D = "@media(min-width:1100px){", T = "@media(min-width:700px) and (max-width:1099px){", M = "@media(max-width:699px){";
  var css =
    O + "{--u-bg:#0e1016;--u-sf:#161922;--u-sf2:#1d212c;--u-ln:rgba(255,255,255,.09);--u-tx:#f3f5f9;--u-dm:#98a1b5;--u-ac:#6366f1;--u-ac2:#8b5cf6;--u-acs:rgba(99,102,241,.18);--u-actx:#a5b4fc;" +
    "--card:var(--u-sf2);--text:var(--u-tx);--dim:var(--u-dm);--border:var(--u-ln);--panel:var(--u-sf);--red:var(--u-ac);color-scheme:dark}" +
    ".scx-ov[data-ux-theme=light]{--u-bg:#f1f5f9;--u-sf:#fff;--u-sf2:#f8fafc;--u-ln:#e2e8f0;--u-tx:#0f172a;--u-dm:#64748b;--u-ac:#4f46e5;--u-ac2:#7c3aed;--u-acs:#eef2ff;--u-actx:#4f46e5;color-scheme:light}" +
    /* full page shell */
    O + "{position:fixed;inset:0;display:block;padding:0!important;background:var(--u-bg)!important;-webkit-backdrop-filter:none;backdrop-filter:none}.scx-ov[hidden]{display:none!important}" +
    "body.ux-page>*:not(.scx-ov):not(.ux-toast):not(script):not(style):not(link){display:none!important}" +
    ".ux-dockbtn,.ux-live,.ux-revert,.ux-qbar button:first-child{display:none!important}" +
    O + ".scx-box{position:relative;width:100%;max-width:none;height:100vh;height:100dvh;max-height:none;margin:0;padding:0;border:0;border-radius:0;overflow:hidden;background:var(--u-bg);color:var(--u-tx);box-shadow:none;display:flex;flex-direction:column}" +
    O + ".scx-head{order:0;flex:none;position:relative;z-index:20;margin:0;padding:12px clamp(12px,2vw,22px);padding-top:max(12px,env(safe-area-inset-top));display:flex;align-items:center;gap:12px;background:var(--u-sf);border-bottom:1px solid var(--u-ln);border-radius:0}" +
    O + ".scx-head h2{margin:0;font-size:clamp(15px,1.4vw,18px);font-weight:800;color:var(--u-tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    O + ".ux-nav{order:1;flex:none}" + O + ".ux-body{order:2;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:clamp(14px,2.4vw,30px);padding-bottom:max(30px,env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch;overscroll-behavior:contain}" +
    O + ".ux-body>:not(.scx-tabs){max-width:1100px}" + O + ".scx-tabs{display:none!important}" +
    O + ".ux-sticky{top:-1px}" +
    O + ".ux-back{display:none;width:38px;height:38px;place-items:center;padding:0;border-radius:50%;background:var(--u-sf2);border:1px solid var(--u-ln);color:var(--u-tx);cursor:pointer}" +
    O + ".ux-ttl{display:none;margin:0;font-size:17px;font-weight:800;color:var(--u-tx)}" +
    O + ".ux-gsearch{position:relative;flex:1 1 200px;max-width:340px;margin-left:auto}.ux-gsearch input{width:100%;padding:9px 14px 9px 36px!important;border-radius:999px!important}.ux-gsearch svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--u-dm);pointer-events:none}" +
    O + ".ux-themebtn,.scx-x{width:38px;height:38px;display:grid;place-items:center;padding:0;border-radius:50%}.scx-ov .scx-x{background:var(--u-sf2);border:1px solid var(--u-ln);color:var(--u-tx)}" +
    /* nav items */
    O + ".ux-nav button{font:inherit;cursor:pointer;text-align:left;color:var(--u-tx)}" +
    O + ".ux-lh{margin:0;padding:2px 10px 10px;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--u-dm)}" +
    O + ".ux-it{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 4px;padding:10px 12px;border:1px solid transparent;border-radius:14px;background:transparent}" +
    O + ".ux-it:hover{background:var(--u-sf2)}.scx-ov .ux-it.on{background:var(--u-acs);color:var(--u-actx)}" +
    O + ".ux-ib{flex:none;width:38px;height:38px;display:grid;place-items:center;border-radius:12px;color:var(--kc);background:color-mix(in srgb,var(--kc) 16%,transparent)}" +
    O + ".ux-tx{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}.ux-tx b{font-size:14px;font-weight:700}.ux-tx small{font-size:12px;font-weight:500;color:var(--u-dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.scx-ov .ux-it.on small{color:inherit;opacity:.8}" +
    O + ".ux-chev{display:none;color:var(--u-dm)}.k0{--kc:#6366f1}.k1{--kc:#8b5cf6}.k2{--kc:#ec4899}.k3{--kc:#f59e0b}.k4{--kc:#10b981}.k5{--kc:#64748b}" +
    O + "[data-ux-nav=\"0\"] .ux-nav{display:none}" +
    /* DESKTOP: 3 panes */
    D + O + ".scx-box{display:grid;grid-template-columns:236px 288px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}.scx-ov .scx-head{grid-column:1/-1}" +
    ".scx-ov .scx-head::before{content:\"\";width:34px;height:34px;flex:none;background:" + LOGO + " no-repeat center/34px}" +
    ".scx-ov .ux-nav{display:contents}.scx-ov .ux-l1,.scx-ov .ux-l2{grid-row:2;min-height:0;overflow-y:auto;padding:16px 12px;border-right:1px solid var(--u-ln)}.scx-ov .ux-l1{grid-column:1;background:var(--u-sf)}.scx-ov .ux-l2{grid-column:2;background:var(--u-bg)}.scx-ov .ux-body{grid-column:3;grid-row:2}" +
    ".scx-ov[data-ux-nav=\"0\"] .scx-box{grid-template-columns:minmax(0,1fr)}.scx-ov[data-ux-nav=\"0\"] .ux-body{grid-column:1}.scx-ov .ux-l1 .ux-tx small{display:none}}" +
    /* TABLET: two rows of chips */
    T + O + ".ux-nav{padding:10px clamp(12px,2vw,22px) 8px;background:var(--u-sf);border-bottom:1px solid var(--u-ln)}.scx-ov .ux-l1,.scx-ov .ux-l2{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 8px}.scx-ov .ux-lh{display:none}" +
    ".scx-ov .ux-it{width:auto;flex:none;margin:0;padding:7px 14px 7px 8px;border-radius:999px;background:var(--u-sf2);border-color:var(--u-ln)}.scx-ov .ux-it.on{border-color:transparent}.scx-ov .ux-ib{width:28px;height:28px;border-radius:50%}.scx-ov .ux-tx small{display:none}.scx-ov .ux-l2 .ux-it{background:transparent}.scx-ov .ux-l2 .ux-it.on{background:var(--u-acs)}}" +
    /* MOBILE: step-by-step screens */
    M + O + ".ux-nav{flex:1 1 auto;min-height:0;overflow-y:auto;padding:16px 14px max(24px,env(safe-area-inset-bottom))}.scx-ov .ux-l1,.scx-ov .ux-l2{padding:0}.scx-ov .ux-lh{padding:4px 4px 12px;font-size:12px}" +
    ".scx-ov .ux-it{padding:14px;margin:0 0 10px;border-radius:18px;background:var(--u-sf);border-color:var(--u-ln)}.scx-ov .ux-ib{width:46px;height:46px;border-radius:15px}.scx-ov .ux-tx b{font-size:15px}.scx-ov .ux-chev{display:block}" +
    ".scx-ov[data-ux-view=home] .ux-l2,.scx-ov[data-ux-view=home] .ux-body,.scx-ov[data-ux-view=sub] .ux-l1,.scx-ov[data-ux-view=sub] .ux-body,.scx-ov[data-ux-view=page] .ux-nav{display:none}" +
    ".scx-ov[data-ux-nav=\"0\"] .ux-body{display:block!important}.scx-ov[data-ux-nav=\"1\"] .ux-back.show{display:grid}" +
    ".scx-ov[data-ux-nav=\"1\"][data-ux-view=home] .scx-head h2,.scx-ov[data-ux-nav=\"1\"][data-ux-view=sub] .scx-head h2{display:none}.scx-ov[data-ux-nav=\"1\"][data-ux-view=home] .ux-ttl,.scx-ov[data-ux-nav=\"1\"][data-ux-view=sub] .ux-ttl{display:block;flex:1}.scx-ov .ux-gsearch{display:none}}" +
    /* controls + surfaces (light/dark aware) */
    O + ".scx-btn,.ux-tbtn{border:1px solid var(--u-ln);border-radius:11px;background:var(--u-sf2);color:var(--u-tx);padding:9px 15px;font-size:13px;font-weight:650}" +
    O + ".scx-btn:hover,.ux-tbtn:hover{border-color:var(--u-ac);color:var(--u-actx)}" +
    O + ".scx-btn.pri,.scx-ov .ux-tbtn.on{background:" + G + ";color:#fff;border-color:transparent;box-shadow:0 8px 22px rgba(99,102,241,.32)}.scx-ov .scx-btn.pri:hover{filter:brightness(1.08);color:#fff}" +
    O + ".scx-btn.dng{color:#ef4444;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.35)}.scx-ov .scx-btn.dng:hover{background:rgba(239,68,68,.16);color:#ef4444}" +
    O + ".ux-tbtn{border-radius:999px;padding:7px 13px;font-size:12px}" +
    O + ".scx-f{gap:6px;font-size:11.5px;font-weight:650;color:var(--u-dm)}.scx-ov .scx-help{color:var(--u-dm);font-size:12.5px;line-height:1.6}" +
    O + ".scx-in,.scx-box input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]),.scx-box select,.scx-box textarea{background:var(--u-sf2);border:1px solid var(--u-ln);border-radius:12px;padding:10px 13px;color:var(--u-tx);font-size:14px}" +
    O + ".scx-box input[type=color]{height:42px;padding:3px;border-radius:12px;background:var(--u-sf2);border:1px solid var(--u-ln);cursor:pointer}" +
    O + ".scx-in:focus,.scx-box input:focus,.scx-box select:focus,.scx-box textarea:focus{border-color:var(--u-ac);background:var(--u-sf);box-shadow:0 0 0 3px var(--u-acs)}" +
    O + ".ux-step input{border-radius:0!important}.scx-ov .ux-step button{background:var(--u-sf2);border-color:var(--u-ln);color:var(--u-tx);font-weight:700}.scx-ov .ux-step button:hover{background:var(--u-ac);border-color:var(--u-ac);color:#fff}" +
    O + ".scx-item,.ux-card,.ux-panel,.ux-stat,.scx-sum,.scx-ai-head,.scx-stat{" + SURF + ";box-shadow:0 1px 2px rgba(15,23,42,.06)}" +
    O + ".ux-panel{padding:16px}.ux-panel h3{font-size:14px;font-weight:750;color:var(--u-tx)}.ux-stat,.scx-stat{padding:16px}.ux-stat b,.scx-stat b,.scx-stat strong{font-size:27px;font-weight:800;color:var(--u-tx)}.scx-ov .ux-stat small,.scx-ov .scx-stat span,.scx-ov .scx-stat small{color:var(--u-dm);font-size:11.5px}" +
    O + ".ux-stats>.ux-stat:first-child,.scx-ov .scx-stat-grid>:first-child{background:" + G + ";border-color:transparent;box-shadow:0 12px 28px rgba(99,102,241,.32)}.scx-ov .ux-stats>.ux-stat:first-child *,.scx-ov .scx-stat-grid>:first-child *{color:#fff;opacity:1}" +
    O + ".scx-msg{border-radius:13px;background:var(--u-sf2);color:var(--u-tx)}.scx-ov .scx-msg.ok{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.4)}.scx-ov .scx-msg.err{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.45)}" +
    O + ".ux-sticky{padding:9px 10px;border:1px solid var(--u-ln);border-radius:15px;background:var(--u-sf)}.scx-ov .ux-thumb,.scx-ov .ux-art{background:linear-gradient(135deg,var(--u-acs),rgba(139,92,246,.22));color:var(--u-actx)}" +
    O + ".ux-pill{border-radius:999px;padding:5px 11px;font-size:11.5px;background:var(--u-sf2);color:var(--u-tx);border-color:var(--u-ln)}.scx-ov button.ux-pill.on{background:" + G + ";border-color:transparent;color:#fff}.scx-ov .ux-cardprev{" + SURF + ";background:var(--u-sf2)}" +
    O + ".ux-meter,.ux-prog{background:var(--u-ln)}.scx-ov .ux-prog i{background:" + G + "}.scx-ov .ux-meter i{background:#10b981}.scx-ov .ux-meter.mid i{background:#f59e0b}.scx-ov .ux-meter.low i{background:#ef4444}.scx-ov .ux-fillrow{border-top-color:var(--u-ln)}" +
    "@media(prefers-reduced-motion:no-preference){@keyframes ux-step-in{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}@keyframes ux-list-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
    ".scx-ov .ux-l2 .ux-it,.scx-ov .ux-l1 .ux-it{animation:ux-list-in .28s cubic-bezier(.22,1,.36,1) both}.scx-ov .ux-it:nth-child(3){animation-delay:.04s}.scx-ov .ux-it:nth-child(4){animation-delay:.08s}.scx-ov .ux-it:nth-child(5){animation-delay:.12s}.scx-ov .ux-it:nth-child(n+6){animation-delay:.16s}" +
    M + ".scx-ov[data-ux-view=home] .ux-l1,.scx-ov[data-ux-view=sub] .ux-l2,.scx-ov[data-ux-view=page] .ux-body{animation:ux-step-in .3s cubic-bezier(.22,1,.36,1) both}}}";
  var st0 = document.createElement("style"); st0.id = "ux-theme-flow"; st0.textContent = css; (document.head || document.documentElement).appendChild(st0);

  /* ---------- theme ---------- */
  function theme() { try { return localStorage.getItem(TK) === "light" ? "light" : "dark"; } catch (e) { return "dark"; } }
  function setIcon(b) { b.textContent = ""; b.appendChild(svg(theme() === "dark" ? "sun" : "moon", 17)); b.title = theme() === "dark" ? "Switch to light mode" : "Switch to dark mode"; b.setAttribute("aria-label", b.title); }
  function applyTheme(ov) { if (ov.dataset.uxTheme !== theme()) ov.dataset.uxTheme = theme(); var b = $(".ux-themebtn"); if (b) setIcon(b); }
  function toggle() { try { localStorage.setItem(TK, theme() === "dark" ? "light" : "dark"); } catch (e) { /* ignore */ } var ov = $(".scx-ov"); if (ov) applyTheme(ov); }

  /* ---------- navigation state ---------- */
  var st = { cat: -1, view: "home", act: "", sig: "" };
  function mode() { var w = window.innerWidth || 1200; return w < 700 ? "m" : w < 1100 ? "t" : "d"; }
  function items() { return $$(".scx-tab").map(function (t) { var tx = t.textContent.replace("✦", "").trim(); return { t: t, tx: tx, cat: catOf(tx), on: t.classList.contains("on") }; }); }
  function pick(it) { it.t.click(); if (mode() === "m") st.view = "page"; setTimeout(sched, 70); }
  function row(cls, k, ico, title, desc, on, fn) {
    var b = h("button", { type: "button", class: "ux-it " + cls + " k" + k + (on ? " on" : "") }, [h("span", { class: "ux-ib" }, [svg(ico, 19)]), h("span", { class: "ux-tx" }, [h("b", { text: title }), desc ? h("small", { text: desc }) : null]), h("span", { class: "ux-chev" }, [svg("chev", 18)])]);
    b.addEventListener("click", fn); return b;
  }
  function render(ov, box) {
    var its = items(), has = its.length > 0, act = its.filter(function (x) { return x.on; })[0], m = mode();
    ov.dataset.uxNav = has ? "1" : "0"; ov.dataset.uxView = has ? st.view : "page";
    var tabsEl = $(".scx-tabs", box); if (tabsEl && tabsEl.parentNode !== box) tabsEl.parentNode.classList.add("ux-body");
    var an = act ? act.tx : ""; if (an !== st.act) { st.act = an; if (act) st.cat = act.cat; }
    var present = {}; its.forEach(function (x) { present[x.cat] = (present[x.cat] || 0) + 1; });
    if (!present[st.cat]) st.cat = act ? act.cat : Number(Object.keys(present)[0] || 0);
    var sig = [has, m, st.cat, st.view, its.map(function (x) { return x.tx + (x.on ? "*" : ""); }).join("|")].join("~");
    var nav = $(".ux-nav", box);
    if (!nav) { nav = h("div", { class: "ux-nav" }, [h("div", { class: "ux-l1" }), h("div", { class: "ux-l2" })]); box.appendChild(nav); st.sig = ""; }
    var back = $(".ux-back"), ttl = $(".ux-ttl");
    if (back) back.classList.toggle("show", has && st.view !== "home");
    if (ttl) ttl.textContent = st.view === "sub" ? CATS[st.cat].t : "Admin";
    if (sig === st.sig) return; st.sig = sig;
    var l1 = $(".ux-l1", nav), l2 = $(".ux-l2", nav); l1.textContent = ""; l2.textContent = "";
    l1.appendChild(h("p", { class: "ux-lh", text: "Admin" }));
    CATS.forEach(function (c, i) {
      if (!present[i]) return;
      l1.appendChild(row("ux-c", i, c.i, c.t, c.d, i === st.cat, function () {
        st.cat = i;
        if (mode() === "m") st.view = "sub";
        else { var f = items().filter(function (x) { return x.cat === i; })[0]; if (f && !f.on) f.t.click(); }
        setTimeout(sched, 70); sched();
      }));
    });
    l2.appendChild(h("p", { class: "ux-lh", text: CATS[st.cat].t }));
    its.filter(function (x) { return x.cat === st.cat; }).forEach(function (x) { l2.appendChild(row("ux-s", st.cat, iconOf(x.tx), x.tx, descOf(x.tx), x.on, function () { pick(x); })); });
  }

  /* ---------- header ---------- */
  function globalSearch(q) {
    var t = $$(".scx-tab").filter(function (b) { return b.classList.contains("ux-protab"); })[0]; if (!t) return; t.click(); if (mode() === "m") st.view = "page"; var n = 0;
    var iv = setInterval(function () { var i = $(".ux-pro input[type=search]"); if (i) { clearInterval(iv); i.value = q; i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); } else if (++n > 30) clearInterval(iv); }, 60);
  }
  function header() {
    var head = $(".scx-head"); if (!head) return;
    if (!$(".ux-back", head)) {
      var bk = h("button", { class: "ux-back", type: "button", "aria-label": "Back" }, [svg("back", 20)]);
      bk.addEventListener("click", function () { st.view = st.view === "page" ? "sub" : "home"; sched(); }); head.insertBefore(bk, head.firstChild);
      var h2 = $("h2", head); if (h2) h2.after(h("h2", { class: "ux-ttl", text: "Admin" }));
    }
    var tools = $(".ux-tools", head);
    if (!tools) { tools = h("div", { class: "ux-tools" }); head.appendChild(tools); }
    if (!$(".ux-gsearch", head)) {
      var inp = h("input", { type: "search", placeholder: "Search catalogue…", "aria-label": "Search catalogue" });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); globalSearch(inp.value.trim()); } });
      head.insertBefore(h("div", { class: "ux-gsearch" }, [svg("search", 16), inp]), tools);
    }
    if (!$(".ux-themebtn", tools)) { var b = h("button", { class: "ux-tbtn ux-themebtn", type: "button", onclick: toggle }); setIcon(b); tools.appendChild(b); }
  }

  /* ---------- page behaviour ---------- */
  var wasOpen = false, path = location.pathname + location.search;
  function routeHash(open) {
    if (open === wasOpen) return; wasOpen = open; if (open) { st.view = "home"; st.sig = ""; }
    try { if (open) { if (location.hash !== "#admin") history.replaceState(null, "", path + "#admin"); } else if (location.hash === "#admin") history.replaceState(null, "", path); } catch (e) { /* ignore */ }
  }
  function autoOpen() {
    if (location.hash !== "#admin") return; var n = 0;
    var iv = setInterval(function () { var ic = $("#adminIcon"); if (ic) { clearInterval(iv); ic.click(); } else if (++n > 50) clearInterval(iv); }, 100);
  }
  var queued = false;
  function pass() {
    queued = false; var ov = $(".scx-ov"), open = !!(ov && !ov.hidden);
    document.body.classList.toggle("ux-page", open && ov.parentNode === document.body); routeHash(open);
    if (!open) return;
    if (ov.classList.contains("ux-dock")) { var db = $(".ux-dockbtn"); if (db) db.click(); }
    var box = $(".scx-box", ov); applyTheme(ov); header(); if (box) render(ov, box);
  }
  function sched() { if (!queued) { queued = true; requestAnimationFrame(pass); } }
  function start() { autoOpen(); window.addEventListener("resize", sched); new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] }); sched(); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();