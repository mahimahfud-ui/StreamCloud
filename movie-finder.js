/* StreamCloud legal movie availability finder.
   Press Enter in the existing search box to check official availability options. */
(function () {
  "use strict";
  var input = document.getElementById("q");
  if (!input) return;
  var endpoint = "https://husydmiujigyonlxbuuj.supabase.co/functions/v1/movie-availability";
  var cfg = window.STREAMCLOUD_SUPABASE || {};
  var css = document.createElement("style");
  css.textContent = `
    .sc-mf-backdrop{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.78);backdrop-filter:blur(12px);display:none;align-items:center;justify-content:center;padding:18px}
    .sc-mf-backdrop.open{display:flex}
    .sc-mf-panel{position:relative;width:min(620px,100%);max-height:min(82vh,760px);overflow:auto;background:#111216;color:#f5f5f7;border:1px solid #34353b;border-radius:18px;padding:22px;box-shadow:0 24px 90px #0009}
    .sc-mf-close{position:absolute;right:14px;top:14px;border:1px solid #414149;border-radius:50%;width:34px;height:34px;background:#1b1c22;color:#fff;font-size:20px;cursor:pointer}
    .sc-mf-title{font-size:22px;font-weight:700;margin:0 42px 6px 0}.sc-mf-sub{color:#a7a8b0;font-size:13px;margin:0 0 18px}
    .sc-mf-status{padding:18px 0;color:#d5d5dc;font-size:14px}.sc-mf-result{display:grid;grid-template-columns:88px 1fr;gap:16px;padding:14px 0;border-top:1px solid #2a2b31}
    .sc-mf-poster{width:88px;aspect-ratio:2/3;object-fit:cover;border-radius:9px;background:#222}.sc-mf-movie-title{font-size:17px;font-weight:700;margin:0 0 6px}.sc-mf-overview{font-size:13px;color:#b7b8c0;line-height:1.5;margin:0 0 12px}
    .sc-mf-options{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 14px}.sc-mf-provider{display:inline-flex;align-items:center;gap:6px;background:#1d1e24;border:1px solid #363740;border-radius:9px;padding:7px 9px;font-size:12px}
    .sc-mf-provider img{width:20px;height:20px;border-radius:5px}.sc-mf-cta{display:inline-flex;align-items:center;justify-content:center;background:#f4f4f5;color:#111;padding:11px 14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px}
    .sc-mf-note{font-size:11px;line-height:1.5;color:#898a94;margin-top:13px}.sc-mf-loading{display:inline-block;width:15px;height:15px;border:2px solid #666;border-top-color:#fff;border-radius:50%;animation:sc-mf-spin .7s linear infinite;vertical-align:middle;margin-right:8px}@keyframes sc-mf-spin{to{transform:rotate(360deg)}}
    @media(max-width:520px){.sc-mf-panel{padding:18px;border-radius:15px}.sc-mf-result{grid-template-columns:72px 1fr;gap:12px}.sc-mf-poster{width:72px}.sc-mf-title{font-size:20px}}
  `;
  document.head.appendChild(css);
  var backdrop = document.createElement("div");
  backdrop.className = "sc-mf-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", "Find legal movie availability");
  backdrop.innerHTML = '<section class="sc-mf-panel" tabindex="-1"><button class="sc-mf-close" type="button" aria-label="Close">×</button><h2 class="sc-mf-title">Find where to watch</h2><p class="sc-mf-sub">Checking official availability for your region</p><div class="sc-mf-content"><p class="sc-mf-status">Ready to search.</p></div><p class="sc-mf-note">Availability is based on TMDB/JustWatch data and can change. StreamCloud does not verify ad counts or guarantee direct playback; provider links open their official availability page.</p></section>';
  document.body.appendChild(backdrop);
  var panel = backdrop.querySelector(".sc-mf-panel"), content = backdrop.querySelector(".sc-mf-content"), sub = backdrop.querySelector(".sc-mf-sub");
  function esc(s){return String(s == null ? "" : s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function close(){backdrop.classList.remove("open");document.body.style.overflow=""}
  function status(message, loading){content.innerHTML='<p class="sc-mf-status">'+(loading?'<span class="sc-mf-loading"></span>':'')+esc(message)+'</p>'}
  function open(){backdrop.classList.add("open");document.body.style.overflow="hidden";panel.focus()}
  function render(data){
    if(!data.found){status(data.message||"No matching movie was found.");return}
    var m=data.movie||{},opts=Array.isArray(data.options)?data.options:[];
    var list=opts.map(function(p){return '<span class="sc-mf-provider">'+(p.logo?'<img alt="" loading="lazy" src="'+esc(p.logo)+'">':'')+esc(p.name)+' · '+esc(({free:"Free",ads:"With ads",flatrate:"Subscription",rent:"Rent",buy:"Buy"})[p.type]||p.type)+'</span>'}).join("");
    var action=data.watchLink?'<a class="sc-mf-cta" href="'+esc(data.watchLink)+'" target="_blank" rel="noopener noreferrer">See official watch options ↗</a>':'';
    content.innerHTML='<article class="sc-mf-result">'+(m.poster?'<img class="sc-mf-poster" loading="lazy" alt="" src="'+esc(m.poster)+'">':'<div class="sc-mf-poster"></div>')+'<div><h3 class="sc-mf-movie-title">'+esc(m.title)+(m.year?' ('+esc(m.year)+')':'')+'</h3><p class="sc-mf-overview">'+esc(m.overview||"No synopsis available.")+'</p>'+(opts.length?'<div class="sc-mf-options">'+list+'</div>':'<p class="sc-mf-status">No verified streaming providers were returned for '+esc(data.region||"your region")+'.</p>')+action+'</div></article>';
    sub.textContent="Region: "+(data.region||"BD")+" · Provider data from TMDB/JustWatch";
  }
  async function findMovie(raw){
    var title=String(raw||"").trim();if(title.length<2)return;
    open();sub.textContent="Searching official availability for “"+title.slice(0,80)+"”…";status("Checking title and legal streaming options…",true);
    try{
      if(!cfg.anonKey)throw new Error("StreamCloud's public Supabase configuration is unavailable.");
      var res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.anonKey},body:JSON.stringify({title:title,region:"BD"})});
      var data=await res.json().catch(function(){return {}});
      if(!res.ok)throw new Error(data.error||"Availability lookup failed.");
      render(data);
    }catch(e){status(e&&e.message?e.message:"Could not check availability. Please try again.");}
  }
  backdrop.querySelector(".sc-mf-close").addEventListener("click",close);
  backdrop.addEventListener("click",function(e){if(e.target===backdrop)close()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&backdrop.classList.contains("open"))close()});
  input.setAttribute("placeholder","Search listings or movie titles");
  input.setAttribute("aria-label","Search listings or movie availability");
  input.addEventListener("keydown",function(e){
    if(e.key!=="Enter"||e.defaultPrevented)return;
    if(input.value.trim().length<2)return;
    e.preventDefault();
    findMovie(input.value);
  });
})();
