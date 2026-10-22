/* StreamCloud Admin Theme "Aurora Glass" — visual skin only.
   Restyles the existing admin shell and the Ultra / Catalogue Pro / AI Copilot
   components. No application logic or markup is changed.
   Load LAST: after admin-ultra.js, admin-ai-plus.js and admin-polish.js.
   Remove this file or its loader entry to restore the previous admin appearance. */
(function () {
  "use strict";
  if (document.getElementById("ux-theme-aurora")) return;

  var R = "var(--red,#e50914)";
  var G = "linear-gradient(135deg," + R + ",#ff4d6d)";
  var L = "rgba(255,255,255,.08)";
  var F = "rgba(255,255,255,.04)";
  var O = ".scx-ov ";

  var css =
    /* backdrop + shell */
    O + "{background:radial-gradient(1100px 560px at 85% -10%,rgba(229,9,20,.20),transparent 60%),radial-gradient(900px 520px at -10% 110%,rgba(112,82,255,.18),transparent 55%),rgba(6,6,10,.74)!important;-webkit-backdrop-filter:blur(14px) saturate(1.25);backdrop-filter:blur(14px) saturate(1.25)}" +
    ".scx-ov.ux-dock{background:transparent!important;-webkit-backdrop-filter:none;backdrop-filter:none}" +
    O + ".scx-box{width:min(1120px,100%);padding:0;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:linear-gradient(180deg,rgba(30,30,37,.94),rgba(15,15,20,.97));box-shadow:0 34px 100px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);letter-spacing:.005em}" +
    ".scx-ov.ux-dock .scx-box{border-radius:22px 0 0 22px}@media(max-width:700px){.scx-ov.ux-dock .scx-box{border-radius:20px 20px 0 0}}" +

    /* sticky header */
    O + ".scx-head{position:sticky;top:0;z-index:20;margin:0;padding:16px 24px;border-bottom:1px solid " + L + ";background:rgba(20,20,26,.82);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-radius:22px 22px 0 0}" +
    O + ".scx-head h2{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:750;letter-spacing:.01em}" +
    O + ".scx-head h2::before{content:\"\";width:10px;height:10px;flex:0 0 10px;border-radius:50%;background:" + G + ";box-shadow:0 0 14px rgba(229,9,20,.7)}" +
    O + ".scx-x{width:34px;height:34px;display:grid;place-items:center;padding:0;border-radius:50%;background:" + F + ";border:1px solid " + L + "}" +
    O + ".scx-box>div:nth-child(2){padding:22px 24px 28px}" +

    /* sidebar navigation on wide, non-docked admin panels */
    "@media(min-width:900px){" +
      ".scx-ov:not(.ux-dock) .scx-box>div:nth-child(2):has(>.scx-tabs)>.scx-tabs{float:left;width:206px;flex-direction:column;flex-wrap:nowrap;gap:4px;margin:0;position:sticky;top:84px;max-height:calc(100vh - 150px);overflow:auto;padding:0 2px 0 0}" +
      ".scx-ov:not(.ux-dock) .scx-box>div:nth-child(2):has(>.scx-tabs)>:not(.scx-tabs){margin-left:234px}" +
      ".scx-ov:not(.ux-dock) .scx-box>div:nth-child(2):has(>.scx-tabs)::after{content:\"\";display:block;clear:both}" +
      ".scx-ov:not(.ux-dock) .scx-tab{width:100%}" +
    "}" +
    O + ".scx-tabs{gap:6px;margin:0 0 18px;scrollbar-width:none}" +
    ".scx-ov.ux-dock .scx-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}" +
    "@media(max-width:899px){" + O + ".scx-tabs{flex-wrap:nowrap;overflow-x:auto}}" +
    O + ".scx-tab{display:flex;align-items:center;justify-content:flex-start;gap:8px;white-space:nowrap;text-align:left;padding:10px 14px;border:1px solid transparent;border-radius:12px;background:transparent;color:#a7aab5;font-size:13px;font-weight:650}" +
    O + ".scx-tab:hover{background:rgba(255,255,255,.06);color:#fff}" +
    O + ".scx-tab.on{color:#fff;background:linear-gradient(135deg,rgba(229,9,20,.26),rgba(255,77,109,.10));border-color:rgba(229,9,20,.35);box-shadow:inset 3px 0 0 " + R + ",0 8px 24px rgba(229,9,20,.12)}" +
    O + ".ux-protab::after,.ux-aitab::after{content:\"AI\";margin-left:auto;font-size:9px;font-weight:800;letter-spacing:.08em;padding:2px 6px;border-radius:99px;background:" + G + ";color:#fff}" +

    /* buttons */
    O + ".scx-btn,.ux-tbtn{border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(255,255,255,.055);color:#fff;padding:9px 15px;font-size:13px;font-weight:650}" +
    O + ".scx-btn:hover,.ux-tbtn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)}" +
    O + ".scx-btn.pri{background:" + G + ";border-color:transparent;box-shadow:0 8px 24px rgba(229,9,20,.38)}.scx-ov .scx-btn.pri:hover{filter:brightness(1.1)}" +
    O + ".scx-btn.dng{color:#ff9a9f;background:rgba(229,72,77,.09);border-color:rgba(229,72,77,.4)}.scx-ov .scx-btn.dng:hover{background:rgba(229,72,77,.2)}" +
    O + ".ux-tbtn{border-radius:999px;padding:7px 13px;font-size:12px}.scx-ov .ux-tbtn.on{background:" + G + ";border-color:transparent}" +

    /* fields */
    O + ".scx-f{gap:6px;font-size:11.5px;font-weight:650;letter-spacing:.03em;color:#9c9fab}" +
    O + ".scx-in,.scx-box input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]),.scx-box select,.scx-box textarea{background:" + F + ";border:1px solid rgba(255,255,255,.11);border-radius:12px;padding:10px 13px;color:#fff;font-size:13.5px}" +
    O + ".scx-box input[type=color]{height:42px;padding:3px;border-radius:12px;background:" + F + ";border:1px solid rgba(255,255,255,.11);cursor:pointer}" +
    O + ".scx-in:focus,.scx-box input:focus,.scx-box select:focus,.scx-box textarea:focus{border-color:rgba(255,77,109,.7);background:rgba(255,255,255,.06);box-shadow:0 0 0 3px rgba(255,77,109,.14)}" +
    O + ".ux-step input{border-radius:0!important}" +
    O + ".ux-step button{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.11);font-weight:700}" +
    O + ".scx-help{color:#9195a1;font-size:12.5px;line-height:1.6}" +

    /* surfaces, stats and messages */
    O + ".scx-item,.ux-card,.ux-panel,.ux-stat,.scx-sum,.scx-ai-head,.scx-stat{background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025));border:1px solid " + L + ";border-radius:16px}" +
    O + ".ux-panel{padding:16px}.ux-panel h3{font-size:14px;font-weight:750}" +
    O + ".ux-stat,.scx-stat{padding:14px 16px}.ux-stat b,.scx-stat b,.scx-stat strong{font-size:26px;font-weight:800;background:linear-gradient(135deg,#fff,#a9adbd);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    O + ".ux-stat small,.scx-stat span,.scx-stat small{color:#9195a1;font-size:11.5px}" +
    O + ".scx-msg{border-radius:13px;background:" + F + "}.scx-ov .scx-msg.ok{background:rgba(70,211,105,.09);border-color:rgba(70,211,105,.38)}.scx-ov .scx-msg.err{background:rgba(229,72,77,.1);border-color:rgba(229,72,77,.45)}" +

    /* Catalogue Pro and AI Copilot */
    O + ".ux-sticky{top:76px;padding:9px 10px;border:1px solid " + L + ";border-radius:15px;background:rgba(22,22,28,.88);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}" +
    O + ".ux-thumb,.ux-art{background:linear-gradient(135deg,rgba(229,9,20,.3),rgba(112,82,255,.32));color:#fff}" +
    O + ".ux-pill{border-radius:999px;padding:5px 11px;font-size:11.5px;background:" + F + "}.scx-ov button.ux-pill.on{background:" + G + ";border-color:transparent}" +
    O + ".ux-cardprev{border:1px solid " + L + ";border-style:solid;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));border-radius:16px}" +
    O + ".ux-meter,.ux-prog{background:rgba(255,255,255,.09)}.scx-ov .ux-prog i{background:" + G + "}.scx-ov .ux-meter i{background:linear-gradient(90deg,#2fd27a,#7be0a8)}.scx-ov .ux-meter.mid i{background:linear-gradient(90deg,#f5a623,#ffd27a)}.scx-ov .ux-meter.low i{background:linear-gradient(90deg,#e5484d,#ff8a8a)}" +
    O + ".ux-fillrow{border-top-color:" + L + "}.ux-live{color:#46d369}" +

    /* floating toast and quick bar */
    ".ux-toast{border-radius:14px;background:rgba(22,22,28,.92);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.14)}" +
    ".ux-qbar{background:rgba(20,20,26,.78);border-color:rgba(255,255,255,.13);box-shadow:0 14px 44px rgba(0,0,0,.55)}.ux-qbar button:hover{background:" + G + "}";

  var s = document.createElement("style");
  s.id = "ux-theme-aurora";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);
})();