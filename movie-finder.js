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
    .sc-mf-sites{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}.sc-mf-site{display:flex;flex-direction:column;gap:9px;padding:12px;border:1px solid #363740;border-radius:12px;background:#191a20;min-width:0}.sc-mf-site-head{display:flex;align-items:center;gap:9px;min-width:0}.sc-mf-site-logo{width:36px;height:36px;object-fit:contain;border-radius:8px;background:#24252c;flex-shrink:0}.sc-mf-site-name{font-size:13px;font-weight:700;overflow-wrap:anywhere}.sc-mf-site-domain{font-size:11px;color:#92939d;overflow-wrap:anywhere}.sc-mf-site-link{display:inline-flex;justify-content:center;align-items:center;text-align:center;background:#f4f4f5;color:#111;padding:9px 10px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none}.sc-mf-site-rank{font-size:10px;color:#b9bac4}.sc-mf-candidates{display:grid;gap:9px;margin-top:12px}.sc-mf-candidate{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;width:100%;text-align:left;padding:9px;background:#191a20;color:#f5f5f7;border:1px solid #363740;border-radius:11px;cursor:pointer}.sc-mf-candidate:hover,.sc-mf-candidate:focus-visible{border-color:#777}.sc-mf-candidate-poster{width:48px;aspect-ratio:2/3;object-fit:cover;border-radius:5px;background:#26272d}.sc-mf-candidate-title{font-size:13px;font-weight:700}.sc-mf-candidate-meta{font-size:11px;color:#a7a8b0;margin-top:3px}.sc-mf-candidate-pick{font-size:11px;color:#f5f5f7;border:1px solid #464750;border-radius:7px;padding:6px 8px}
    .sc-mf-note{font-size:11px;line-height:1.5;color:#898a94;margin-top:13px}.sc-mf-loading{display:inline-block;width:15px;height:15px;border:2px solid #666;border-top-color:#fff;border-radius:50%;animation:sc-mf-spin .7s linear infinite;vertical-align:middle;margin-right:8px}@keyframes sc-mf-spin{to{transform:rotate(360deg)}}
    @media(max-width:520px){.sc-mf-panel{padding:18px;border-radius:15px}.sc-mf-result{grid-template-columns:72px 1fr;gap:12px}.sc-mf-poster{width:72px}.sc-mf-title{font-size:20px}}
  `;
  document.head.appendChild(css);
  var backdrop = document.createElement("div");
  backdrop.className = "sc-mf-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", "Find legal movie availability");
  backdrop.innerHTML = '<section class="sc-mf-panel" tabindex="-1"><button class="sc-mf-close" type="button" aria-label="Close">×</button><h2 class="sc-mf-title">Find where to watch</h2><p class="sc-mf-sub">Checking official availability for your region</p><div class="sc-mf-content"><p class="sc-mf-status">Ready to search.</p></div><p class="sc-mf-note">Availability information can change. StreamCloud does not verify ad counts or guarantee direct playback. Site searches may not confirm availability; links open external websites.</p></section>';
  document.body.appendChild(backdrop);
  var panel = backdrop.querySelector(".sc-mf-panel"), content = backdrop.querySelector(".sc-mf-content"), sub = backdrop.querySelector(".sc-mf-sub");
  function esc(s){return String(s == null ? "" : s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  var requestSequence=0,activeController=null;
  function close(){requestSequence++;if(activeController){activeController.abort();activeController=null}backdrop.classList.remove("open");document.body.style.overflow="";input.focus()}
  function status(message, loading){content.innerHTML='<p class="sc-mf-status">'+(loading?'<span class="sc-mf-loading"></span>':'')+esc(message)+'</p>'}
  function open(){backdrop.classList.add("open");document.body.style.overflow="hidden";panel.focus()}
  function normalizeTitle(value){return String(value||"").toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ")}
  function render(data, query){
    if(!data.found){
      var candidates=Array.isArray(data.candidates)?data.candidates:[];
      if(!candidates.length){status(data.message||"No close movie or series match was found.");return}
      content.innerHTML='<p class="sc-mf-status">'+esc(data.message||"Choose the correct title.")+'</p><div class="sc-mf-candidates">'+candidates.map(function(c){
        var media=c.mediaType==="tv"?"Series":"Movie";
        var poster=c.poster?'<img class="sc-mf-candidate-poster" loading="lazy" alt="" src="'+esc(c.poster)+'">':'<div class="sc-mf-candidate-poster"></div>';
        return '<button type="button" class="sc-mf-candidate" data-tmdb-id="'+esc(c.id)+'" data-tmdb-type="'+esc(c.mediaType)+'">'+poster+'<span><span class="sc-mf-candidate-title">'+esc(c.title||"Unknown title")+'</span><span class="sc-mf-candidate-meta">'+esc(media)+(c.year?' · '+esc(c.year):'')+'</span></span><span class="sc-mf-candidate-pick">Select</span></button>';
      }).join("")+'</div>';
      sub.textContent="Choose a title before checking providers · "+(data.region||"BD");
      return;
    }
    var m=data.movie||{},opts=Array.isArray(data.options)?data.options:[];
    var list=opts.map(function(p){return '<span class="sc-mf-provider">'+(p.logo?'<img alt="" loading="lazy" src="'+esc(p.logo)+'">':'')+esc(p.name)+' · '+esc(({free:"Free",ads:"With ads",flatrate:"Subscription",rent:"Rent",buy:"Buy",search:"Official search"})[p.type]||p.type)+'</span>'}).join("");
    var action=data.watchLink?'<a class="sc-mf-cta" href="'+esc(data.watchLink)+'" target="_blank" rel="noopener noreferrer">See official watch options ↗</a>':'';
    var title=String(query||m.title||"").trim();
    var catalog=window.MAHIFLIX_CATALOG;
    var sites=catalog&&Array.isArray(catalog.sites)?catalog.sites.slice():[];
    sites=sites.filter(function(s){return s&&s.name&&s.url&&/^https?:\/\//i.test(s.url)});
    sites.sort(function(a,b){
      function score(s){return Number(s.pop||0)*.45+Number(s.smooth||0)*.35+Number(s.langs||0)*.2}
      return score(b)-score(a);
    });
    var cards=sites.slice(0,8).map(function(s,i){
      var domain=String(s.domain||"").replace(/^www\./i,"");
      var searchUrl="https://www.google.com/search?q="+encodeURIComponent('site:'+domain+' "'+title+'"');
      var logo=Array.isArray(s.logoSources)&&s.logoSources.length?s.logoSources[0]:"";
      return '<article class="sc-mf-site"><div class="sc-mf-site-head">'+(logo?'<img class="sc-mf-site-logo" loading="lazy" alt="" src="'+esc(logo)+'" onerror="this.style.display=\'none\'">':'')+'<div><div class="sc-mf-site-name">'+esc(s.name)+'</div><div class="sc-mf-site-domain">'+esc(domain)+'</div></div></div><div class="sc-mf-site-rank">Directory rank #'+(i+1)+' · title match not verified</div><a class="sc-mf-site-link" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Open site ↗</a><a class="sc-mf-site-link" style="background:#24252c;color:#f4f4f5;border:1px solid #414149" href="'+esc(searchUrl)+'" target="_blank" rel="noopener noreferrer">Find title on site ↗</a></article>';
    }).join("");
    var bestSite=sites.length?sites[0]:null;
    var bestDomain=bestSite?String(bestSite.domain||"").replace(/^www\\./i,""):"";
    var bestSearch=bestSite&&bestDomain?"https://www.google.com/search?q="+encodeURIComponent('site:'+bestDomain+' "'+title+'"'):"";
    var bestLink=data.watchLink||bestSearch;
    var bestLabel=data.watchLink?"Open best watch-options link ↗":"Open best matching site search ↗";
    var exactQuery=normalizeTitle(parseMovieQuery(title).title), exactResult=normalizeTitle(m.title||"");
    var exactMatch=!!exactQuery&&exactQuery===exactResult;
    content.innerHTML='<article class="sc-mf-result">'+(m.poster?'<img class="sc-mf-poster" loading="lazy" alt="" src="'+esc(m.poster)+'">':'<div class="sc-mf-poster"></div>')+'<div><h3 class="sc-mf-movie-title">'+esc(m.title)+(m.year?' ('+esc(m.year)+')':'')+'</h3><p class="sc-mf-overview">'+esc(m.overview||"No synopsis available.")+'</p>'+(opts.length?'<div class="sc-mf-options">'+list+'</div>':'<p class="sc-mf-status">No verified streaming providers were returned for '+esc(data.region||"your region")+'.</p>')+action+(bestLink?'<p><a class="sc-mf-cta" style="margin-top:8px" href="'+esc(bestLink)+'" target="_blank" rel="noopener noreferrer">'+bestLabel+'</a></p>':'')+(!exactMatch?'<p class="sc-mf-note">The catalog returned “'+esc(m.title||"unknown title")+'”, which is not an exact text match for your keyword. Check the title/year before opening a provider.</p>':'')+'</div></article>'+'<h3 class="sc-mf-movie-title" style="margin-top:18px">Search StreamCloud sites</h3><p class="sc-mf-overview">Exact title query is used for site search. “Open best link” prioritizes the official watch-options search when available; otherwise it opens the highest-ranked StreamCloud site’s title search. Results are not guaranteed playback links.</p>'+(cards?'<div class="sc-mf-sites">'+cards+'</div>':'<p class="sc-mf-status">No catalog websites are available.</p>');
    sub.textContent="Region: "+(data.region||"BD")+" · Provider data from "+(data.source||"official provider search");
  }
  function parseMovieQuery(raw){
    var title=String(raw||"").trim().replace(/[\u0000-\u001f\u007f]/g,"").replace(/\s+/g," ").slice(0,200);
    var mediaType=null,year=null;
    var prefix=title.match(/^(movie|film|series|web\s*series|tv|show)\s*:\s*/i);
    if(prefix){mediaType=/^(series|web\s*series|tv|show)$/i.test(prefix[1].replace(/\s+/g," "))?"tv":"movie";title=title.slice(prefix[0].length).trim()}
    var suffix=title.match(/\s+(series|web\s*series|tv\s*show|movie|film)$/i);
    if(suffix){mediaType=/series|tv\s*show/i.test(suffix[1])?"tv":"movie";title=title.slice(0,suffix.index).trim()}
    var yearMatch=title.match(/\s*[\[(]?\s*((?:18|19|20)\d{2})\s*[\])]?\s*$/);
    if(yearMatch){var n=Number(yearMatch[1]);if(n>=1870&&n<=2100){year=n;title=title.slice(0,yearMatch.index).trim().replace(/[([]\s*$/,"").trim()}}
    return {title:title.slice(0,160),year:year,mediaType:mediaType};
  }
  async function findMovie(raw, selection){
    var original=String(raw||"").trim();if(original.length<2)return;
    var parsed=parseMovieQuery(original);
    if(parsed.title.length<2){open();status("Enter a movie or series title, optionally followed by a year.",false);return}
    requestSequence++;
    var thisRequest=requestSequence;
    if(activeController)activeController.abort();
    activeController=typeof AbortController!=="undefined"?new AbortController():null;
    var controller=activeController,timeoutId=null;
    open();sub.textContent="Detecting title and checking official options for “"+parsed.title.slice(0,80)+"”…";status("Matching the title and checking legal streaming options…",true);
    try{
      if(!cfg.anonKey)throw new Error("StreamCloud's public Supabase configuration is unavailable.");
      var body={title:parsed.title,year:parsed.year,mediaType:parsed.mediaType,region:"BD"};
      if(selection){body.selectedId=Number(selection.id);body.selectedType=selection.mediaType}
      var options={method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.anonKey},body:JSON.stringify(body)};
      if(controller){options.signal=controller.signal;timeoutId=setTimeout(function(){controller.abort()},15000)}
      var res=await fetch(endpoint,options);
      var data=await res.json().catch(function(){return {}});
      if(thisRequest!==requestSequence)return;
      if(!res.ok)throw new Error(data.error||"Title lookup failed with HTTP "+res.status+".");
      render(data,original);
    }catch(e){
      if(thisRequest!==requestSequence)return;
      if(e&&e.name==="AbortError")status("The title lookup timed out. Please try again.",false);
      else status(e&&e.message?e.message:"Could not check the title. Please try again.",false);
    }finally{
      if(timeoutId)clearTimeout(timeoutId);
      if(thisRequest===requestSequence)activeController=null;
    }
  }
  content.addEventListener("click",function(e){var pick=e.target.closest("[data-tmdb-id][data-tmdb-type]");if(!pick)return;findMovie(input.value,{id:pick.dataset.tmdbId,mediaType:pick.dataset.tmdbType})});
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
