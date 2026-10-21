/* Movies & Web Series recommendations. Reads data/tmdb/*.json generated at deploy time. */
(function () {
  "use strict";
  var sec = document.getElementById("recs"); if (!sec) return;
  var DATA = "./data/tmdb/", IMG = "https://image.tmdb.org/t/p/";
  var grid = document.getElementById("recsGrid"), msg = document.getElementById("recsMsg"), input = document.getElementById("recsSearch");
  var modal = document.getElementById("titleModal"), panel = modal.querySelector(".detail-panel"), body = document.getElementById("titleBody");
  var navLink = document.getElementById("recsNav"), tabs = [].slice.call(sec.querySelectorAll(".t-tab"));
  var items = [], tab = "movie", cache = {}, opener = null;

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
  function poster(path, w) { return /^\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(path || "") ? IMG + w + path : ""; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function rating(it) {
    if (it.imdb && it.imdb.value) return "IMDb " + it.imdb.value.toFixed(1) + "/10";
    if (it.rating && it.rating.value) return "TMDB " + it.rating.value.toFixed(1) + "/10";
    return "";
  }
  function posterBox(it, w, sizes) {
    var box = h("div", "t-poster"), src = poster(it.poster, w), letter = (it.title || "?").trim().charAt(0).toUpperCase();
    if (!src) { box.textContent = letter; return box; }
    var img = new Image(); img.alt = ""; img.decoding = "async"; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
    img.srcset = poster(it.poster, "w185") + " 185w, " + poster(it.poster, "w342") + " 342w, " + poster(it.poster, "w500") + " 500w"; img.sizes = sizes;
    img.src = src; img.addEventListener("load", function () { img.classList.add("on"); });
    img.addEventListener("error", function () { img.remove(); box.textContent = letter; });
    box.appendChild(img); return box;
  }

  function render() {
    var q = norm(input.value), list = items.filter(function (it) {
      if (it.type !== tab) return false;
      return !q || norm([it.title, it.originalTitle, it.year, (it.genres || []).join(" ")].join(" ")).indexOf(q) > -1;
    });
    grid.textContent = "";
    var frag = document.createDocumentFragment();
    list.forEach(function (it) {
      var b = h("button", "t-card"); b.type = "button"; b.dataset.key = it.key;
      b.appendChild(posterBox(it, "w342", "(max-width:560px) 45vw, 200px"));
      b.appendChild(h("b", "", it.title));
      var meta = [it.year, it.type === "series" && it.seasons ? plural(it.seasons, "season") : "", rating(it)].filter(Boolean).join(" · ");
      if (meta) b.appendChild(h("p", "t-meta", meta));
      frag.appendChild(b);
    });
    grid.appendChild(frag);
    msg.textContent = list.length ? "" : q ? "Nothing matched your search." : tab === "movie" ? "No movies yet." : "No web series yet.";
  }

  function setTab(t) {
    tab = t; tabs.forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.type === t)); }); render();
  }
  tabs.forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.type); }); });
  input.addEventListener("input", render);

  function fill(it, d) {
    body.textContent = "";
    var top = h("div", "t-top"), info = h("div", "t-info"), full = d || it, heading = h("h2", "", it.title);
    heading.id = "titleHeading";
    top.appendChild(posterBox(it, "w500", "(max-width:560px) 46vw, 200px"));
    info.appendChild(heading);
    if (it.originalTitle) info.appendChild(h("p", "t-sub", "Original title: " + it.originalTitle));
    var facts = [it.year, it.type === "series" ? "Web series" : "Movie"];
    if (it.type === "movie" && full.runtime) facts.push(full.runtime + " min");
    if (it.type === "series" && (full.seasonCount || it.seasons)) {
      var ns = full.seasonCount || it.seasons, ne = full.episodeCount != null ? full.episodeCount : it.episodes;
      facts.push(plural(ns, "season") + " · " + plural(ne, "episode") + (d && d.airedEpisodes < d.episodeCount ? " (" + d.airedEpisodes + " aired)" : ""));
    }
    if (d && d.status) facts.push(d.status);
    info.appendChild(h("p", "t-facts", facts.filter(Boolean).join(" · ")));
    var r = rating(it);
    info.appendChild(r ? h("span", "t-rate", r) : h("p", "t-sub", "Not rated yet"));
    if (it.genres && it.genres.length) { var tg = h("div", "t-tags"); it.genres.forEach(function (g) { tg.appendChild(h("span", "", g)); }); info.appendChild(tg); }
    info.appendChild(h("p", "t-syn", !d ? "Loading details…" : d.overview ? d.overview : "Synopsis not available."));
    if (d && d.overviewLanguage) info.appendChild(h("p", "t-sub", "Synopsis shown in its original language."));
    var links = h("div", "t-links"), a = h("a", "", "TMDB");
    a.href = "https://www.themoviedb.org/" + (it.type === "series" ? "tv/" : "movie/") + it.id; a.target = "_blank"; a.rel = "noopener noreferrer"; links.appendChild(a);
    if (d && /^tt\d+$/.test(d.imdbId || "")) { var b = h("a", "", "IMDb"); b.href = "https://www.imdb.com/title/" + d.imdbId + "/"; b.target = "_blank"; b.rel = "noopener noreferrer"; links.appendChild(b); }
    info.appendChild(links); top.appendChild(info); body.appendChild(top);
    if (d && d.seasons && d.seasons.length) {
      var wrap = h("div", "t-seasons");
      d.seasons.forEach(function (s) {
        var det = h("details", "t-season"), sum = h("summary", "", s.name + " · " + plural(s.episodeCount, "episode") + (s.airDate ? " · " + s.airDate.slice(0, 4) : ""));
        det.appendChild(sum); var done = false;
        det.addEventListener("toggle", function () {
          if (!det.open || done) return; done = true;
          if (!s.episodes) { det.appendChild(h("p", "t-sub", "Episode list unavailable.")); return; }
          var ol = h("ol"); s.episodes.forEach(function (e) {
            var li = h("li"); li.appendChild(h("i", "", String(e.n))); li.appendChild(h("span", "", (e.name || "Episode " + e.n) + (e.airDate ? " · " + e.airDate : ""))); ol.appendChild(li);
          }); det.appendChild(ol);
        });
        wrap.appendChild(det);
      });
      wrap.appendChild(h("p", "t-note", "Regular seasons only; specials are not counted.")); body.appendChild(wrap);
    }
  }
  function open(key) {
    var it = items.filter(function (x) { return x.key === key; })[0]; if (!it) return;
    opener = document.activeElement; body.dataset.key = key; fill(it, cache[key]);
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; panel.focus();
    if (cache[key]) return;
    fetch(DATA + key + ".json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      cache[key] = d; if (modal.classList.contains("open") && body.dataset.key === key) fill(it, d);
    }).catch(function () {
      if (body.dataset.key === key) { var s = body.querySelector(".t-syn"); if (s) s.textContent = "More details couldn’t be loaded right now."; }
    });
  }
  function close() {
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
    if (opener && opener.focus) opener.focus();
  }
  grid.addEventListener("click", function (e) { var c = e.target.closest(".t-card"); if (c) open(c.dataset.key); });
  modal.addEventListener("click", function (e) { if (e.target.closest("[data-t-close]")) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("open")) close(); });

  fetch(DATA + "index.json").then(function (r) {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (j) {
    if (!j) return;
    items = (j.items || []).filter(function (x) { return x && x.key && x.title && (x.type === "movie" || x.type === "series"); });
    if (!items.length) return;
    if (!items.some(function (x) { return x.type === "movie"; })) tab = "series";
    sec.hidden = false; if (navLink) navLink.hidden = false; setTab(tab);
  }).catch(function () {
    sec.hidden = false; msg.textContent = "Recommendations couldn’t be loaded right now. Please try again later.";
  });
})();
