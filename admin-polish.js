/* StreamCloud Admin Polish — motion + feel only. No layout, color, size or markup is changed.
   Load AFTER admin-ultra.js / admin-ai-plus.js (or paste at the end of admin-ultra.js).
   Everything animated is wrapped in prefers-reduced-motion: no-preference. */
(function () {
  "use strict";
  var EASE = "cubic-bezier(.22,1,.36,1)";
  var css =
    /* always-on: comfort, not motion */
    ".scx-box{overscroll-behavior:contain;scroll-behavior:smooth;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent;-webkit-overflow-scrolling:touch}" +
    ".scx-box::-webkit-scrollbar{width:8px;height:8px}.scx-box::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:8px}.scx-box::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.34)}" +
    ".scx-box input[type=checkbox],.scx-box input[type=radio]{accent-color:var(--red,#e50914)}" +
    ".scx-box button:focus-visible,.scx-box a:focus-visible{outline:2px solid var(--red,#e50914);outline-offset:2px}" +
    ".scx-box .scx-in:focus,.scx-box input:focus,.scx-box select:focus,.scx-box textarea:focus{box-shadow:0 0 0 3px rgba(229,9,20,.22)}" +
    ".scx-box button{-webkit-tap-highlight-color:transparent}.scx-box button:disabled{cursor:not-allowed}" +
    "@media(prefers-reduced-motion:no-preference){" +
    /* open / close */
    "@keyframes ux-fade{from{opacity:0}to{opacity:1}}" +
    "@keyframes ux-pop{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}" +
    "@keyframes ux-slide{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}" +
    "@keyframes ux-rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}" +
    "@keyframes ux-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}" +
    "@keyframes ux-toast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}" +
    ".scx-ov:not([hidden]){animation:ux-fade .22s ease-out}" +
    ".scx-ov:not([hidden]) .scx-box{animation:ux-pop .34s " + EASE + "}" +
    /* tab content fades in on tab switch (direct children only; typing/filtering won't replay it) */
    ".scx-box>div:nth-child(2)>:not(.scx-tabs){animation:ux-rise .3s " + EASE + " both}" +
    /* buttons, tabs, chips, pills */
    ".scx-btn,.scx-tab,.scx-chip,.scx-x,.ux-pill,.ux-tbtn,.ux-step button,.ux-qbar button{transition:background-color .18s ease,border-color .18s ease,color .18s ease,transform .18s " + EASE + ",box-shadow .2s ease,opacity .18s ease}" +
    ".scx-btn:hover,.scx-tab:hover,.scx-chip:hover,.ux-pill:hover,.ux-tbtn:hover{transform:translateY(-1px)}" +
    ".scx-btn:active,.scx-tab:active,.scx-chip:active,.ux-pill:active,.ux-tbtn:active,.ux-qbar button:active{transform:translateY(0) scale(.97)}" +
    ".ux-step button:active{transform:scale(.92)}.scx-x{transition:color .18s ease,transform .25s " + EASE + "}.scx-x:hover{transform:rotate(90deg)}" +
    ".scx-btn:disabled,.ux-pill:disabled{transform:none;opacity:.6}" +
    /* inputs */
    ".scx-in,.scx-box input,.scx-box select,.scx-box textarea{transition:border-color .18s ease,box-shadow .22s ease,background-color .18s ease}" +
    /* cards, rows, panels */
    ".ux-card,.scx-item,.ux-stat,.ux-panel{transition:transform .22s " + EASE + ",box-shadow .25s ease,border-color .2s ease,opacity .25s ease}" +
    ".ux-card:hover,.scx-item:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.32);border-color:rgba(255,255,255,.2)}" +
    ".ux-panel{animation:ux-rise .28s " + EASE + " both}.ux-fillrow{animation:ux-fade .25s ease both}" +
    /* media + meters */
    ".ux-thumb img,.ux-art img,.ux-fillrow img{animation:ux-fade .35s ease both}" +
    ".ux-meter i{transform-origin:left;animation:ux-grow .6s " + EASE + " both;transition:width .4s " + EASE + "}" +
    ".ux-prog i{transition:width .35s " + EASE + "}" +
    /* toast and page transitions */
    ".ux-toast{animation:ux-toast .3s " + EASE + " both}" +
    "html,body{transition:background-color .3s ease,color .3s ease}" +
    "}";
  var s = document.createElement("style");
  s.id = "ux-polish";
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);
})();