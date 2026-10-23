/* StreamCloud Admin Theme v3 "Campus" — full-page admin skin.
   Keeps the existing admin logic and data handlers untouched.
   Load LAST after admin-ultra.js, admin-ai-plus.js and admin-polish.js. */
(function () {
  "use strict";
  if (document.getElementById("ux-theme-campus")) return;

  var NS = "http://www.w3.org/2000/svg";
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
  var LOGO = "url(\"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e50914'/><stop offset='1' stop-color='#ff3b45'/></linearGradient></defs><rect width='36' height='36' rx='10' fill='url(#g)'/><path d='M14 11l11 7-11 7z' fill='white'/></svg>") + "\")";
  var G = "linear-gradient(135deg,var(--u-ac),var(--u-ac2))", O = ".scx-ov ", SURF = "background:var(--u-sf);border:1px solid var(--u-ln);border-radius:16px";
  var css =
    O + "{--u-bg:#09090b;--u-sf:#121216;--u-sf2:#1b1b21;--u-ln:rgba(255,255,255,.08);--u-tx:#f5f5f7;--u-dm:#a1a1aa;--u-ac:#e50914;--u-ac2:#ff3b45;--u-acs:rgba(229,9,20,.16);--u-actx:#fff;--u-sh:0 30px 90px rgba(0,0,0,.6);--u-ov:rgba(0,0,0,.72);--card:var(--u-sf2);--text:var(--u-tx);--dim:var(--u-dm);--border:var(--u-ln);--panel:var(--u-sf);--red:var(--u-ac);color-scheme:dark}" +
    O + "{position:fixed!important;inset:0!important;width:100%!important;max-width:100%!important;height:100vh!important;height:100dvh!important;box-sizing:border-box!important;z-index:9999!important;overflow:hidden!important;background:radial-gradient(900px 520px at 85% -6%,rgba(229,9,20,.16),transparent 60%),radial-gradient(700px 420px at -6% 32%,rgba(255,59,69,.06),transparent 60%),var(--u-bg)!important;-webkit-backdrop-filter:none;backdrop-filter:none;padding:0!important;display:block}.scx-ov[hidden]{display:none!important}" +
    "html,body{width:100%;max-width:100%;min-width:0}body.ux-page{width:100%;height:100vh;height:100dvh;overflow:hidden!important;overscroll-behavior:none}body.ux-page>*:not(.scx-ov):not(.ux-toast):not(script):not(style):not(link){display:none!important}" +
    O + ".scx-box{position:relative;width:100%;max-width:none;height:100%;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:radial-gradient(900px 520px at 85% -6%,rgba(229,9,20,.16),transparent 60%),radial-gradient(700px 420px at -6% 32%,rgba(255,59,69,.06),transparent 60%),var(--u-bg);color:var(--u-tx);box-shadow:none}" +
    /* header */
    O + ".scx-head{position:sticky;top:0;z-index:20;margin:0;padding:14px 22px;display:flex;align-items:center;gap:14px;background:var(--u-sf);border-bottom:1px solid var(--u-ln);border-radius:0}" +
    O + ".scx-head h2{margin:0;font-size:18px;font-weight:800;color:var(--u-tx);white-space:nowrap}" +
    O + ".ux-gsearch{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,calc(100% - 360px));max-width:340px;min-width:190px;margin:0;flex:none}.ux-gsearch input{width:100%;min-width:0;padding:9px 14px 9px 36px!important;border-radius:999px!important}.ux-gsearch svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--u-dm);pointer-events:none}" +
    O + ".ux-tools{margin-left:0}" + O + ".ux-gsearch+.ux-tools{margin-left:0}" +
    O + ".scx-x{width:36px;height:36px;display:grid;place-items:center;padding:0;border-radius:50%;background:var(--u-sf2);border:1px solid var(--u-ln);color:var(--u-tx)}" +
    O + ".scx-box>div:nth-child(2){max-width:1320px;margin:0 auto;padding:24px 22px 40px}" +
    /* desktop sidebar */
    "@media(min-width:900px){.scx-ov .scx-box>div:nth-child(2):has(>.scx-tabs)>.scx-tabs{float:left;width:220px;flex-direction:column;flex-wrap:nowrap;gap:3px;margin:0;padding:14px 12px;position:sticky;top:84px;max-height:calc(100vh - 150px);overflow:auto;" + SURF.replace("16px", "18px") + "}" +
    ".scx-ov .scx-box>div:nth-child(2):has(>.scx-tabs)>:not(.scx-tabs){margin-left:244px}" +
    ".scx-ov .scx-box>div:nth-child(2):has(>.scx-tabs)::after{content:\"\";display:block;clear:both}" +
    ".scx-ov .scx-tabs::before{content:\"StreamCloud Admin\";display:block;margin:0 0 10px;padding:2px 0 12px 48px;min-height:38px;line-height:34px;font-weight:800;font-size:14px;color:var(--u-tx);background:" + LOGO + " no-repeat 2px 0/34px;border-bottom:1px solid var(--u-ln)}.scx-ov .scx-tab{width:100%}}" +
    O + ".scx-tabs{gap:6px;margin:0 0 18px;scrollbar-width:none}@media(max-width:899px){.scx-ov .scx-tabs{flex-wrap:nowrap;overflow-x:auto}}" +
    O + ".scx-tab{display:flex;align-items:center;justify-content:flex-start;gap:10px;white-space:nowrap;text-align:left;padding:10px 12px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--u-dm);font-size:13px;font-weight:650}" +
    O + ".scx-tab .ux-ico{display:grid;place-items:center;flex:none}" +
    O + ".scx-tab:hover{background:var(--u-sf2);color:var(--u-tx)}" +
    O + ".scx-tab.on{background:var(--u-acs);color:var(--u-actx);border-color:transparent;box-shadow:none}" +
    O + ".ux-protab::after,.ux-aitab::after{content:\"AI\";margin-left:auto;font-size:9px;font-weight:800;letter-spacing:.08em;padding:2px 6px;border-radius:99px;background:" + G + ";color:#fff}" +
    /* controls */
    O + ".scx-btn,.ux-tbtn{border:1px solid var(--u-ln);border-radius:11px;background:var(--u-sf2);color:var(--u-tx);padding:9px 15px;font-size:13px;font-weight:650}" +
    O + ".scx-btn:hover,.ux-tbtn:hover{border-color:var(--u-ac);color:var(--u-actx)}" +
    O + ".scx-btn.pri,.scx-ov .ux-tbtn.on{background:" + G + ";color:#fff;border-color:transparent;box-shadow:0 8px 22px rgba(229,9,20,.28)}.scx-ov .scx-btn.pri:hover{filter:brightness(1.08);color:#fff}" +
    O + ".scx-btn.dng{color:#ef4444;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.35)}.scx-ov .scx-btn.dng:hover{background:rgba(239,68,68,.16);color:#ef4444}" +
    O + ".ux-tbtn{border-radius:999px;padding:7px 13px;font-size:12px}" +
    O + ".scx-f{gap:6px;font-size:11.5px;font-weight:650;color:var(--u-dm)}" +
    O + ".scx-in,.scx-box input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]),.scx-box select,.scx-box textarea{background:var(--u-sf2);border:1px solid var(--u-ln);border-radius:12px;padding:10px 13px;color:var(--u-tx);font-size:13.5px}" +
    O + ".scx-box select{color-scheme:inherit}" +
    ".scx-ov .scx-box select option,.scx-ov .scx-box select optgroup{background:#1b1b21;color:#f5f5f7}" +
    O + ".scx-box input[type=color]{height:42px;padding:3px;border-radius:12px;background:var(--u-sf2);border:1px solid var(--u-ln);cursor:pointer}" +
    O + ".scx-in:focus,.scx-box input:focus,.scx-box select:focus,.scx-box textarea:focus{border-color:var(--u-ac);background:var(--u-sf);box-shadow:0 0 0 3px var(--u-acs)}" +
    O + ".ux-step input{border-radius:0!important}.scx-ov .ux-step button{background:var(--u-sf2);border-color:var(--u-ln);color:var(--u-tx);font-weight:700}.scx-ov .ux-step button:hover{background:var(--u-ac);border-color:var(--u-ac);color:#fff}" +
    O + ".scx-help{color:var(--u-dm);font-size:12.5px;line-height:1.6}" +
    /* surfaces */
    O + ".scx-item,.ux-card,.ux-panel,.ux-stat,.scx-sum,.scx-ai-head,.scx-stat{" + SURF + ";box-shadow:0 1px 2px rgba(15,23,42,.06)}" +
    O + ".ux-panel{padding:16px}.ux-panel h3{font-size:14px;font-weight:750;color:var(--u-tx)}" +
    O + ".ux-stat,.scx-stat{padding:16px}.ux-stat b,.scx-stat b,.scx-stat strong{font-size:27px;font-weight:800;color:var(--u-tx)}.scx-ov .ux-stat small,.scx-ov .scx-stat span,.scx-ov .scx-stat small{color:var(--u-dm);font-size:11.5px}" +
    O + ".ux-stats>.ux-stat:first-child,.scx-ov .scx-stat-grid>:first-child{background:" + G + ";border-color:transparent;box-shadow:0 12px 28px rgba(229,9,20,.28)}.scx-ov .ux-stats>.ux-stat:first-child *,.scx-ov .scx-stat-grid>:first-child *{color:#fff;opacity:1}" +
    O + ".scx-msg{border-radius:13px;background:var(--u-sf2);color:var(--u-tx)}.scx-ov .scx-msg.ok{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.4)}.scx-ov .scx-msg.err{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.45)}" +
    O + ".ux-sticky{top:76px;padding:9px 10px;border:1px solid var(--u-ln);border-radius:15px;background:var(--u-sf)}" +
    O + ".ux-thumb,.ux-art{background:linear-gradient(135deg,var(--u-acs),rgba(229,9,20,.16));color:var(--u-actx)}" +
    O + ".ux-pill{border-radius:999px;padding:5px 11px;font-size:11.5px;background:var(--u-sf2);color:var(--u-tx);border-color:var(--u-ln)}.scx-ov button.ux-pill.on{background:" + G + ";border-color:transparent;color:#fff}" +
    O + ".ux-cardprev{" + SURF + ";background:var(--u-sf2)}" +
    O + ".ux-meter,.ux-prog{background:var(--u-ln)}.scx-ov .ux-prog i{background:" + G + "}.scx-ov .ux-meter i{background:#10b981}.scx-ov .ux-meter.mid i{background:#f59e0b}.scx-ov .ux-meter.low i{background:#ef4444}" +
    O + ".ux-fillrow{border-top-color:var(--u-ln)}.scx-ov .ux-live{color:#10b981}" +
    /* Responsive viewport fit across mobile browsers; keep full Admin controls visible. */
    "@media(max-width:899px){.scx-ov{inset:0!important;width:100%!important;height:100vh!important;height:100dvh!important}.scx-ov .scx-box{position:absolute;inset:0;width:100%;max-width:none;height:100%;max-height:none;border-radius:0;padding-bottom:calc(24px + env(safe-area-inset-bottom));overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;box-sizing:border-box}.scx-ov .scx-head{display:grid;position:sticky;top:0;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;gap:10px;border-radius:0;padding:12px 14px}.scx-ov .scx-head h2{grid-row:1;grid-column:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.scx-ov .scx-head .scx-x{grid-row:1;grid-column:2}.scx-ov .ux-gsearch{display:block;position:relative;grid-row:2;grid-column:1/-1;left:auto;top:auto;transform:none;width:100%;max-width:none;min-width:0;margin:0}.scx-ov .scx-tabs{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;overflow:visible;padding:0;margin:0 0 18px}.scx-ov .scx-tab{min-height:92px;width:auto;min-width:0;white-space:normal;align-items:flex-start;word-break:normal;overflow-wrap:anywhere}.scx-ov .scx-box>div:nth-child(2){padding:16px 14px 30px}.scx-ov input:not([type=checkbox]):not([type=radio]):not([type=color]),.scx-ov select,.scx-ov textarea{font-size:16px!important;max-width:100%;box-sizing:border-box}}"
    O + ".ux-qbar{background:rgba(9,9,11,.82);border-color:rgba(255,255,255,.08)}";

  css +=
    ".scx-ov.ux-admin-categories .scx-box>div:nth-child(2)>.scx-tabs,.scx-ov.ux-admin-subcategories .scx-box>div:nth-child(2)>.scx-tabs,.scx-ov.ux-admin-feature .scx-box>div:nth-child(2)>.scx-tabs{display:none!important}" +
    ".scx-ov.ux-admin-categories .scx-box>div:nth-child(2)>:not(.scx-tabs):not(.ux-admin-nav-screen),.scx-ov.ux-admin-subcategories .scx-box>div:nth-child(2)>:not(.scx-tabs):not(.ux-admin-nav-screen){display:none!important}" +
    ".scx-ov .ux-admin-nav-screen{display:none;min-width:0;width:100%;gap:18px}" +
    ".scx-ov.ux-admin-categories .ux-admin-nav-screen,.scx-ov.ux-admin-subcategories .ux-admin-nav-screen{display:grid!important;grid-template-columns:minmax(0,1fr)}" +
    ".scx-ov.ux-admin-categories .scx-box>div:nth-child(2)>.ux-admin-nav-screen,.scx-ov.ux-admin-subcategories .scx-box>div:nth-child(2)>.ux-admin-nav-screen{float:none!important;width:100%!important;max-width:none!important;margin:0!important;clear:both}" +
    ".scx-ov.ux-admin-feature .scx-box>div:nth-child(2)>.ux-admin-nav-screen{display:none!important}" +
    ".scx-ov.ux-admin-feature .scx-box>div:nth-child(2)>.scx-tabs{display:none!important}" +
    ".scx-ov.ux-admin-feature .scx-box>div:nth-child(2)>:not(.scx-tabs):not(.ux-admin-nav-screen){margin-left:0!important;float:none!important;width:auto!important;max-width:none!important}" +
    ".scx-ov.ux-admin-categories .scx-box>div:nth-child(2),.scx-ov.ux-admin-subcategories .scx-box>div:nth-child(2),.scx-ov.ux-admin-feature .scx-box>div:nth-child(2){max-width:1320px;margin:0 auto;padding:24px 22px 40px}" +
    ".scx-ov .ux-admin-nav-intro{min-width:0;display:grid;gap:5px}" +
    ".scx-ov .ux-admin-nav-eyebrow{margin:0;color:var(--u-ac);font-size:10px;font-weight:850;letter-spacing:.14em;text-transform:uppercase;overflow-wrap:anywhere}" +
    ".scx-ov .ux-admin-nav-intro h3{margin:0;color:var(--u-tx);font-size:clamp(21px,3vw,28px);font-weight:850;line-height:1.15;overflow-wrap:anywhere}" +
    ".scx-ov .ux-admin-nav-intro p{margin:2px 0 0;color:var(--u-dm);font-size:13px;line-height:1.55;overflow-wrap:anywhere}" +
    ".scx-ov .ux-admin-nav-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:stretch;min-width:0}" +
    ".scx-ov .ux-admin-nav-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:9px;min-width:0;min-height:128px;width:100%;padding:15px;text-align:left;border:1px solid var(--u-ln);border-radius:16px;background:linear-gradient(145deg,var(--u-sf),rgba(255,255,255,.015));color:var(--u-tx);cursor:pointer;white-space:normal;overflow-wrap:anywhere;box-shadow:0 8px 24px rgba(0,0,0,.12);transition:background .18s ease,border-color .18s ease,transform .18s ease}" +
    ".scx-ov .ux-admin-nav-card:hover,.scx-ov .ux-admin-nav-card:focus-visible{background:var(--u-sf2);border-color:rgba(229,9,20,.42);outline:none}" +
    ".scx-ov .ux-admin-nav-card:focus-visible{box-shadow:0 0 0 3px rgba(229,9,20,.2)}" +
    ".scx-ov .ux-admin-nav-card:active{transform:scale(.985)}" +
    ".scx-ov .ux-admin-nav-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;color:var(--u-ac)}" +
    ".scx-ov .ux-admin-nav-card-top svg{flex:none;width:23px;height:23px}" +
    ".scx-ov .ux-admin-nav-arrow{font-size:18px;line-height:1;color:var(--u-dm)}" +
    ".scx-ov .ux-admin-nav-card-title{display:block;max-width:100%;font-size:14px;font-weight:800;line-height:1.3;color:var(--u-tx);overflow-wrap:anywhere}" +
    ".scx-ov .ux-admin-nav-card-desc{display:block;max-width:100%;font-size:11.5px;font-weight:500;line-height:1.45;color:var(--u-dm);overflow-wrap:anywhere}" +
    ".scx-ov .ux-admin-back{display:none;align-items:center;justify-content:center;flex:none;min-height:36px;max-width:100%;padding:8px 11px;border:1px solid var(--u-ln);border-radius:11px;background:var(--u-sf2);color:var(--u-tx);font-size:12px;font-weight:750;white-space:nowrap;cursor:pointer}" +
    ".scx-ov .ux-admin-back[hidden]{display:none!important}" +
    ".scx-ov.ux-admin-subcategories .ux-admin-back,.scx-ov.ux-admin-feature .ux-admin-back{display:inline-flex}" +
    ".scx-ov.ux-admin-subcategories .scx-head,.scx-ov.ux-admin-feature .scx-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto;gap:10px}" +
    ".scx-ov.ux-admin-subcategories .scx-head .ux-admin-back,.scx-ov.ux-admin-feature .scx-head .ux-admin-back{grid-column:1;grid-row:1}" +
    ".scx-ov.ux-admin-subcategories .scx-head h2,.scx-ov.ux-admin-feature .scx-head h2{grid-column:2;grid-row:1;min-width:0;white-space:normal;overflow-wrap:anywhere}" +
    ".scx-ov.ux-admin-subcategories .scx-head .scx-x,.scx-ov.ux-admin-feature .scx-head .scx-x{grid-column:3;grid-row:1}" +
    ".scx-ov.ux-admin-categories .ux-gsearch{display:block}" +
    ".scx-ov.ux-admin-subcategories .ux-gsearch,.scx-ov.ux-admin-feature .ux-gsearch,.scx-ov.ux-admin-auth .ux-gsearch{display:none!important}" +
    ".scx-ov.ux-admin-auth .scx-head{display:flex}" +
    "@media(max-width:899px){.scx-ov.ux-admin-categories .scx-head{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;gap:10px;padding:12px 14px}.scx-ov.ux-admin-categories .scx-head h2{grid-column:1;grid-row:1;min-width:0;white-space:normal;overflow-wrap:anywhere}.scx-ov.ux-admin-categories .scx-head .scx-x{grid-column:2;grid-row:1}.scx-ov.ux-admin-categories .ux-gsearch{position:relative;left:auto;top:auto;transform:none;grid-column:1/-1;grid-row:2;width:100%;max-width:none;min-width:0;margin:0}.scx-ov.ux-admin-subcategories .scx-head,.scx-ov.ux-admin-feature .scx-head{grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto;gap:7px;padding:12px 10px}.scx-ov.ux-admin-categories .scx-box>div:nth-child(2),.scx-ov.ux-admin-subcategories .scx-box>div:nth-child(2),.scx-ov.ux-admin-feature .scx-box>div:nth-child(2){padding:14px 12px calc(28px + env(safe-area-inset-bottom))!important;width:100%;max-width:100%;margin:0}.scx-ov .ux-admin-nav-screen{gap:14px}.scx-ov .ux-admin-nav-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.scx-ov .ux-admin-nav-card{min-height:110px;padding:11px 10px;gap:7px;border-radius:13px}.scx-ov .ux-admin-nav-card-title{font-size:13px;line-height:1.25}.scx-ov .ux-admin-nav-card-desc{font-size:11px;line-height:1.4}.scx-ov .ux-admin-nav-card-top svg{width:21px;height:21px}.scx-ov.ux-admin-auth .scx-head{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto;padding:12px 14px}.scx-ov.ux-admin-auth .scx-head h2{grid-column:1;grid-row:1}.scx-ov.ux-admin-auth .scx-head .scx-x{grid-column:2;grid-row:1}}";
  var st = document.createElement("style");
  st.id = "ux-theme-campus";
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------- header search ---------- */
  function globalSearch(q) {
    var tabs = $(".scx-tabs"), t = findAdminTab("Catalogue Pro", tabs);
    if (!t) return;
    if (navLevel !== "feature" || navFeature !== "Catalogue Pro") {
      if (navLevel === "categories") setAdminScreen("subcategories", "catalogue", "", true);
      setAdminScreen("feature", "catalogue", "Catalogue Pro", true);
      t.click();
    }
    var n = 0, timer = setInterval(function () {
      var i = $(".ux-pro input[type=search]");
      if (i) { clearInterval(timer); i.value = q; i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); }
      else if (++n > 30) clearInterval(timer);
    }, 60);
  }
  function header() {
    var head = $(".scx-head");
    if (!head) return;
    if (!$(".ux-admin-back", head)) {
      var back = h("button", { class: "ux-admin-back", type: "button", text: "← Back", "aria-label": "Back to previous Admin screen", hidden: true });
      back.addEventListener("click", goBack);
      head.insertBefore(back, head.firstChild);
    }
    if (!$(".ux-gsearch")) {
      var inp = h("input", { type: "search", placeholder: "Search catalogue…", "aria-label": "Search catalogue" });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); globalSearch(inp.value.trim()); } });
      var wrap = h("div", { class: "ux-gsearch" }, [svg("search", 16), inp]);
      head.insertBefore(wrap, $(".ux-tools") || head.lastChild);
    }
  }

  /* ---------- tab icons ---------- */
  function icons() {
    $(".scx-tab").forEach(function (t) {
      if ($(".ux-ico", t)) return;
      /* Replace the built-in glyph, do not append a second icon to the same feature. */
      var oldIcon = $(".scx-nav-icon", t);
      if (oldIcon) oldIcon.remove();
      t.insertBefore(h("span", { class: "ux-ico" }, [svg(iconKey(t.textContent))]), t.firstChild);
    });
  }

  /* ---------- Category -> Subcategory -> full-screen Feature navigation ---------- */
  var wasOpen = false, path = location.pathname + location.search;
  var navLevel = "", navCategory = "", navFeature = "";
  var ADMIN_GROUPS = [
    { id:"dashboard", label:"Dashboard & Activity", icon:"overview", desc:"Site totals and recent admin activity", items:[
      { label:"Overview", desc:"Totals and recent activity" },
      { label:"Activity", desc:"Review recent admin actions" }
    ]},
    { id:"catalogue", label:"Catalogue & AI", icon:"layers", desc:"Add, search, review and manage listings", items:[
      { label:"Add item", desc:"Add a movie, series, website or app" },
      { label:"Title lookup", desc:"Find verified movie and series details" },
      { label:"Content", desc:"Publish, hide, move or delete listings" },
      { label:"Catalogue Pro", desc:"Search, bulk-manage and audit catalogue entries" },
      { label:"AI Copilot", desc:"Assist with catalogue lookup and review" }
    ]},
    { id:"design", label:"Design & Layout", icon:"layout", desc:"Manage card layout and visual appearance", items:[
      { label:"Cards & Layout", desc:"Arrange cards, sections and responsive grids" },
      { label:"Appearance", desc:"Manage site colours and appearance settings" }
    ]},
    { id:"site", label:"Site Controls", icon:"globe", desc:"Manage site identity and visitor-facing controls", items:[
      { label:"Site settings", desc:"Announcement, SEO and site identity" }
    ]},
    { id:"security", label:"Security & Data", icon:"lock", desc:"Manage backups and admin access", items:[
      { label:"Backup", desc:"Export or import site data" },
      { label:"Change PIN", desc:"Update the Admin access PIN" },
      { label:"Log out", desc:"End the current admin session" }
    ]}
  ];
  function groupById(id) {
    for (var i = 0; i < ADMIN_GROUPS.length; i++) if (ADMIN_GROUPS[i].id === id) return ADMIN_GROUPS[i];
    return null;
  }
  function cleanLabel(value) {
    return String(value || "").replace(/[✦★]/g, "").replace(/\s+/g, " ").trim();
  }
  function tabLabel(tab) {
    if (!tab) return "";
    var title = $(".scx-nav-title", tab);
    return cleanLabel(tab.getAttribute("aria-label") || (title && title.textContent) || tab.textContent);
  }
  function findAdminTab(label, tabs) {
    var found = null, target = cleanLabel(label).toLowerCase();
    $$(".scx-tab", tabs || $(".scx-tabs")).forEach(function (tab) {
      if (!found && tabLabel(tab).toLowerCase() === target) found = tab;
    });
    return found;
  }
  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }
  function categoryState(level, category, feature) {
    return { scAdmin: true, level: level, category: category || "", feature: feature || "" };
  }
  function setAdminScreen(level, category, feature, push) {
    var ov = $(".scx-ov");
    if (!ov) return;
    if (level !== "auth" && !$(".scx-tabs", ov)) level = "auth";
    navLevel = level || "categories";
    navCategory = category || "";
    navFeature = feature || "";
    ov.classList.toggle("ux-admin-categories", navLevel === "categories");
    ov.classList.toggle("ux-admin-subcategories", navLevel === "subcategories");
    ov.classList.toggle("ux-admin-feature", navLevel === "feature");
    ov.classList.toggle("ux-admin-auth", navLevel === "auth");
    if (push) {
      try { history.pushState(categoryState(navLevel, navCategory, navFeature), "", path + "#admin"); }
      catch (e) { /* Browser/embedded history can be restricted. */ }
    }
    renderAdminNavigation();
  }
  function pushRootState() {
    try { history.replaceState(categoryState("categories", "", ""), "", path + "#admin"); }
    catch (e) { /* ignore */ }
  }
  function goBack() {
    if (navLevel === "categories" || navLevel === "auth") return;
    var state = history.state;
    if (state && state.scAdmin === true) {
      history.back();
      return;
    }
    if (navLevel === "feature") setAdminScreen("subcategories", navCategory, "", false);
    else setAdminScreen("categories", "", "", false);
  }
  function makeAdminNavCard(title, description, icon, click) {
    var b = h("button", { class: "ux-admin-nav-card", type: "button", "aria-label": title });
    var top = h("span", { class: "ux-admin-nav-card-top" }, [
      svg(icon || "dot", 23),
      h("span", { class: "ux-admin-nav-arrow", text: "↗", "aria-hidden": "true" })
    ]);
    b.appendChild(top);
    b.appendChild(h("span", { class: "ux-admin-nav-card-title", text: title }));
    b.appendChild(h("span", { class: "ux-admin-nav-card-desc", text: description || "" }));
    b.addEventListener("click", click);
    return b;
  }
  function tabSignature(tabs) {
    return $$(".scx-tab", tabs).map(tabLabel).join("|");
  }
  function renderAdminNavigation() {
    var ov = $(".scx-ov");
    var tabs = ov && $(".scx-tabs", ov);
    if (!ov || ov.hidden) return;
    if (!tabs) {
      navLevel = "auth"; navCategory = ""; navFeature = "";
      ov.classList.remove("ux-admin-categories", "ux-admin-subcategories", "ux-admin-feature");
      ov.classList.add("ux-admin-auth");
      var backAuth = $(".ux-admin-back", ov); if (backAuth) backAuth.hidden = true;
      return;
    }
    ov.classList.remove("ux-admin-auth");
    if (!navLevel || navLevel === "auth") {
      navLevel = "categories"; navCategory = ""; navFeature = "";
      pushRootState();
    }
    var body = tabs.parentNode;
    var screen = $(".ux-admin-nav-screen", body);
    if (navLevel === "feature") {
      if (screen) screen.remove();
      ov.classList.add("ux-admin-feature");
      ov.classList.remove("ux-admin-categories", "ux-admin-subcategories");
      var titleFeature = $("#scxTitle", ov);
      setText(titleFeature, navFeature || "Admin");
      var backFeature = $(".ux-admin-back", ov);
      if (backFeature) { backFeature.hidden = false; backFeature.setAttribute("aria-label", "Back to " + ((groupById(navCategory) || {}).label || "Admin menu")); setText(backFeature, "← Back"); }
      return;
    }
    if (navLevel !== "subcategories") { navLevel = "categories"; navCategory = ""; navFeature = ""; }
    var signature = tabSignature(tabs);
    var needsBuild = !screen || screen.parentNode !== body ||
      screen.getAttribute("data-level") !== navLevel ||
      screen.getAttribute("data-category") !== navCategory ||
      (navLevel === "subcategories" && screen.getAttribute("data-tabs-signature") !== signature);
    if (needsBuild) {
      if (screen && screen.parentNode) screen.remove();
      screen = h("div", { class: "ux-admin-nav-screen", "data-level": navLevel, "data-category": navCategory, "data-tabs-signature": signature });
      var intro = h("div", { class: "ux-admin-nav-intro" });
      var grid = h("div", { class: "ux-admin-nav-grid" });
      if (navLevel === "categories") {
        intro.appendChild(h("p", { class: "ux-admin-nav-eyebrow", text: "STREAMCLOUD · ADMIN" }));
        intro.appendChild(h("h3", { text: "Choose a category" }));
        intro.appendChild(h("p", { text: "Open a category first. Its subcategories will appear on the next screen." }));
        ADMIN_GROUPS.forEach(function (group) {
          grid.appendChild(makeAdminNavCard(group.label, group.desc, group.icon, function () {
            setAdminScreen("subcategories", group.id, "", true);
          }));
        });
      } else {
        var group = groupById(navCategory);
        if (!group) {
          navLevel = "categories"; navCategory = "";
          setAdminScreen("categories", "", "", false);
          return;
        }
        intro.appendChild(h("p", { class: "ux-admin-nav-eyebrow", text: "CATEGORY / " + group.label }));
        intro.appendChild(h("h3", { text: "Choose a subcategory" }));
        intro.appendChild(h("p", { text: "Select one feature to open its own full-screen panel." }));
        group.items.forEach(function (item) {
          var target = findAdminTab(item.label, tabs);
          if (!target) return;
          var title = tabLabel(target) || item.label;
          var icon = iconKey(title);
          grid.appendChild(makeAdminNavCard(title, item.desc, icon, function () {
            setAdminScreen("feature", group.id, title, true);
            target.click();
          }));
        });
      }
      screen.appendChild(intro);
      screen.appendChild(grid);
      body.insertBefore(screen, tabs);
    }
    ov.classList.toggle("ux-admin-categories", navLevel === "categories");
    ov.classList.toggle("ux-admin-subcategories", navLevel === "subcategories");
    ov.classList.remove("ux-admin-feature");
    var title = $("#scxTitle", ov);
    var groupTitle = groupById(navCategory);
    setText(title, navLevel === "categories" ? "Admin Catalogue" : (groupTitle ? groupTitle.label : "Admin Catalogue"));
    var back = $(".ux-admin-back", ov);
    if (back) {
      back.hidden = navLevel === "categories";
      back.setAttribute("aria-label", "Back to Admin catalogue");
      setText(back, "← Catalogue");
    }
  }
  function routeHash(open) {
    if (open === wasOpen) return;
    wasOpen = open;
    try {
      if (open) {
        var base = categoryState("categories", "", "");
        if (location.hash !== "#admin") history.pushState(base, "", path + "#admin");
        else history.replaceState(base, "", path + "#admin");
      } else if (location.hash === "#admin") {
        history.replaceState(null, "", path);
      }
    } catch (e) { /* ignore */ }
  }
  window.addEventListener("popstate", function (e) {
    var ov = $(".scx-ov");
    if (!ov || ov.hidden) return;
    if (location.hash !== "#admin") {
      var close = $(".scx-x", ov);
      if (close) close.click(); else ov.hidden = true;
      return;
    }
    if (!$(".scx-tabs", ov)) {
      navLevel = "auth";
      ov.classList.remove("ux-admin-categories", "ux-admin-subcategories", "ux-admin-feature");
      ov.classList.add("ux-admin-auth");
      return;
    }
    var state = e.state;
    if (state && state.scAdmin === true) {
      var level = state.level || (state.screen === "feature" ? "feature" : "categories");
      if (level !== "subcategories" && level !== "feature") level = "categories";
      setAdminScreen(level, state.category || "", state.feature || "", false);
    } else {
      setAdminScreen("categories", "", "", false);
    }
  });
  function autoOpen() {
    if (location.hash !== "#admin") return;
    var n = 0, timer = setInterval(function () {
      var ov = $(".scx-ov");
      if (ov && !ov.hidden) { clearInterval(timer); return; }
      var ic = $("#adminIcon");
      if (ic) {
        ic.click();
        ov = $(".scx-ov");
        if (ov && !ov.hidden) { clearInterval(timer); return; }
      }
      if (++n > 50) clearInterval(timer);
    }, 100);
  }
  var queued = false;
  function pass() {
    queued = false;
    var ov = $(".scx-ov"), open = !!(ov && !ov.hidden);
    document.body.classList.toggle("ux-page", open && ov.parentNode === document.body);
    routeHash(open);
    if (!open) {
      navLevel = ""; navCategory = ""; navFeature = "";
      if (ov) ov.classList.remove("ux-admin-categories", "ux-admin-subcategories", "ux-admin-feature", "ux-admin-auth");
      return;
    }
    header();
    icons();
    renderAdminNavigation();
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