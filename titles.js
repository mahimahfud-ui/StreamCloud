/* Manually curated Movies & Web Series recommendations. No movie-data API is used. */
(function () {
  "use strict";
  var sec = document.getElementById("recs");
  if (!sec) return;
  var SOURCE = "./data/recommendations.json";
  var IMG = "https://image.tmdb.org/t/p/";
  var grid = document.getElementById("recsGrid");
  var msg = document.getElementById("recsMsg");
  var input = document.getElementById("recsSearch");
  var modal = document.getElementById("titleModal");
  var panel = modal.querySelector(".detail-panel");
  var body = document.getElementById("titleBody");
  var navLink = document.getElementById("recsNav");
  var tabs = Array.prototype.slice.call(sec.querySelectorAll(".t-tab"));
  var items = [];
  var tab = "movie";
  var opener = null;
  var industrySelect = null;
  var genreSelect = null;
  var filterBar = null;

  function setupFilters() {
    if (filterBar) return;
    var style = el("style");
    style.textContent = ".t-filter-bar{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px}.t-filter-select{min-width:155px;max-width:100%;padding:11px 36px 11px 13px;border:1px solid var(--border,#343434);border-radius:10px;background:var(--panel,#181818);color:var(--text,#fff);font:inherit;font-size:13px;outline-offset:3px}.t-filter-select:focus-visible{outline:2px solid #fff}.t-filter-label{display:flex;align-items:center;gap:8px;color:var(--dim,#a7a7a7);font-size:12px}.t-filter-label span{white-space:nowrap}@media(max-width:480px){.t-filter-bar{gap:8px}.t-filter-label{flex:1;min-width:0;display:block}.t-filter-label span{display:block;margin:0 0 5px}.t-filter-select{width:100%;min-width:0}}";
    document.head.appendChild(style);
    filterBar = el("div", "t-filter-bar");
    function makeSelect(label, id) {
      var wrap = el("label", "t-filter-label");
      wrap.appendChild(el("span", "", label));
      var select = el("select", "t-filter-select");
      select.id = id;
      wrap.appendChild(select);
      filterBar.appendChild(wrap);
      return select;
    }
    industrySelect = makeSelect("Industry", "recsIndustry");
    genreSelect = makeSelect("Genre", "recsGenre");
    sec.querySelector(".t-head").insertAdjacentElement("afterend", filterBar);
    industrySelect.addEventListener("change", function () { updateGenreOptions(); render(); });
    genreSelect.addEventListener("change", render);
  }
  function option(select, value, label) {
    var node = el("option", "", label);
    node.value = value;
    select.appendChild(node);
  }
  function updateGenreOptions() {
    if (!genreSelect) return;
    var selectedIndustry = industrySelect.value;
    var genres = [];
    items.forEach(function (it) {
      if (it.type !== tab || (selectedIndustry && it.industry !== selectedIndustry)) return;
      (it.genres || []).forEach(function (genre) { if (genres.indexOf(genre) === -1) genres.push(genre); });
    });
    genres.sort(function (a, b) { return a.localeCompare(b); });
    var previous = genreSelect.value;
    genreSelect.textContent = "";
    option(genreSelect, "", "All genres");
    genres.forEach(function (genre) { option(genreSelect, genre, genre); });
    genreSelect.value = genres.indexOf(previous) !== -1 ? previous : "";
  }
  function updateFilterOptions() {
    setupFilters();
    var previous = industrySelect.value;
    var industries = [];
    items.forEach(function (it) {
      if (it.type === tab && it.industry && industries.indexOf(it.industry) === -1) industries.push(it.industry);
    });
    industries.sort(function (a, b) { return a.localeCompare(b); });
    industrySelect.textContent = "";
    option(industrySelect, "", "All industries");
    industries.forEach(function (industry) { option(industrySelect, industry, industry); });
    industrySelect.value = industries.indexOf(previous) !== -1 ? previous : "";
    updateGenreOptions();
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function norm(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  function slug(value) {
    return norm(value).replace(/\s+/g, "-") || "title";
  }
  function poster(src, size) {
    if (typeof src !== "string" || !src.trim()) return "";
    src = src.trim();
    if (/^https:\/\//i.test(src)) {
      try {
        var remote = new URL(src);
        if (remote.protocol !== "https:") return "";
        if (remote.hostname === "image.tmdb.org") {
          remote.pathname = remote.pathname.replace(/\/t\/p\/(?:w\d+|original)\//, "/t/p/" + (size || "w500") + "/");
        }
        return remote.href;
      } catch (_) { return ""; }
    }
    if (/^\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(src)) return IMG + (size || "w500") + src;
    if (/^(?:\.\/|\.\.\/|assets\/)[\w./-]+\.(jpg|jpeg|png|webp|svg|avif)$/i.test(src)) {
      return src.indexOf("./") === 0 || src.indexOf("../") === 0 ? src : "./" + src;
    }
    return "";
  }
  function plural(count, word) {
    var n = Number(count);
    return n + " " + word + (n === 1 ? "" : "s");
  }
  function rating(it) {
    var r = it.rating || it.imdb;
    if (!r || !Number.isFinite(Number(r.value))) return "";
    return String(r.source || (it.imdb ? "IMDb" : "Rating")) + " " + Number(r.value).toFixed(1) + "/10";
  }
  function normalizeItem(raw, type, index) {
    if (typeof raw === "string") raw = { title: raw };
    if (!raw || typeof raw !== "object" || !String(raw.title || "").trim()) return null;
    var item = Object.assign({}, raw);
    item.title = String(raw.title).trim();
    item.type = type;
    item.key = String(raw.key || (type + "-" + slug(item.title) + "-" + index));
    item.genres = Array.isArray(raw.genres) ? raw.genres.filter(function (g) { return typeof g === "string"; }) : [];
    return item;
  }
  function posterBox(it, size, sizes) {
    var box = el("div", "t-poster");
    var src = poster(it.poster, size);
    var initial = (it.title || "?").trim().charAt(0).toUpperCase();
    if (!src) {
      box.textContent = initial;
      return box;
    }
    var img = new Image();
    img.alt = it.title + " poster";
    img.decoding = "async";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    if (typeof it.poster === "string" && (/^\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(it.poster) || /^https:\/\/image\.tmdb\.org\/t\/p\//i.test(it.poster.trim()))) {
      img.srcset = poster(it.poster, "w185") + " 185w, " + poster(it.poster, "w342") + " 342w, " + poster(it.poster, "w500") + " 500w";
      img.sizes = sizes || "200px";
    }
    img.src = src;
    img.addEventListener("load", function () { img.classList.add("on"); });
    img.addEventListener("error", function () { img.remove(); box.textContent = initial; });
    box.appendChild(img);
    return box;
  }
  function render() {
    var query = norm(input.value);
    var selectedIndustry = industrySelect ? industrySelect.value : "";
    var selectedGenre = genreSelect ? genreSelect.value : "";
    var list = items.filter(function (it) {
      if (it.type !== tab) return false;
      if (selectedIndustry && it.industry !== selectedIndustry) return false;
      if (selectedGenre && (it.genres || []).indexOf(selectedGenre) === -1) return false;
      var haystack = norm([it.title, it.originalTitle, it.year, it.industry, (it.genres || []).join(" ")].join(" "));
      return !query || haystack.indexOf(query) !== -1;
    });
    grid.textContent = "";
    var fragment = document.createDocumentFragment();
    list.forEach(function (it) {
      var card = el("button", "t-card");
      card.type = "button";
      card.dataset.key = it.key;
      card.appendChild(posterBox(it, "w342", "(max-width:560px) 45vw, 200px"));
      var score = rating(it);
      if (score) card.appendChild(el("span", "t-rating-badge", "★ " + score));
      card.appendChild(el("b", "", it.title));
      var meta = [
        it.year || "",
        it.type === "series" && it.seasonCount ? plural(it.seasonCount, "season") : ""
      ].filter(Boolean).join(" · ");
      if (meta) card.appendChild(el("p", "t-meta", meta));
      fragment.appendChild(card);
    });
    grid.appendChild(fragment);
    msg.textContent = "";
    if (list.length) return;
    if (!query) {
      if ((industrySelect && industrySelect.value) || (genreSelect && genreSelect.value)) { msg.textContent = "Nothing matches these filters."; return; }
      msg.textContent = tab === "movie" ? "No movies here yet." : "No web series here yet.";
      return;
    }
    var otherType = tab === "movie" ? "series" : "movie", otherLabel = otherType === "movie" ? "Movies" : "Web Series";
    var more = items.filter(function (it) {
      return it.type === otherType && norm([it.title, it.originalTitle, it.year, (it.genres || []).join(" ")].join(" ")).indexOf(query) !== -1;
    }).length;
    msg.appendChild(document.createTextNode("Nothing matched your search."));
    if (more) {
      var jump = el("button", "t-link", "Show " + more + " in " + otherLabel);
      jump.type = "button";
      jump.addEventListener("click", function () { setTab(otherType); });
      msg.appendChild(jump);
    }
  }
  function setTab(type) {
    tab = type;
    tabs.forEach(function (button) {
      button.setAttribute("aria-selected", String(button.dataset.type === type));
      button.tabIndex = button.dataset.type === type ? 0 : -1;
    });
    updateFilterOptions();
    render();
  }
  tabs.forEach(function (button) {
    button.addEventListener("click", function () { setTab(button.dataset.type); });
  });
  input.addEventListener("input", render);
  sec.querySelector(".t-tabs").addEventListener("keydown", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    var next = tabs[(tabs.indexOf(document.activeElement) + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    if (!next) return;
    event.preventDefault(); setTab(next.dataset.type); next.focus();
  });

  function fill(it) {
    body.textContent = "";
    var top = el("div", "t-top");
    var info = el("div", "t-info");
    var heading = el("h2", "", it.title);
    heading.id = "titleHeading";
    top.appendChild(posterBox(it, "w500", "(max-width:560px) 46vw, 200px"));
    info.appendChild(heading);
    if (it.originalTitle && norm(it.originalTitle) !== norm(it.title)) {
      info.appendChild(el("p", "t-sub", "Original title: " + it.originalTitle));
    }
    var facts = [it.year || "", it.type === "series" ? "Web series" : "Movie"];
    if (it.type === "movie" && it.runtime) facts.push(it.runtime + " min");
    if (it.type === "series" && (it.seasonCount || it.episodeCount)) {
      var seriesFacts = [];
      if (it.seasonCount) seriesFacts.push(plural(it.seasonCount, "season"));
      if (it.episodeCount) seriesFacts.push(plural(it.episodeCount, "episode"));
      facts.push(seriesFacts.join(" · "));
    }
    if (it.status) facts.push(it.status);
    info.appendChild(el("p", "t-facts", facts.filter(Boolean).join(" · ")));
    var score = rating(it);
    info.appendChild(score ? el("span", "t-rate", score) : el("p", "t-sub", "Rating not added"));
    if (it.genres.length) {
      var tags = el("div", "t-tags");
      it.genres.forEach(function (genre) { tags.appendChild(el("span", "", genre)); });
      info.appendChild(tags);
    }
    info.appendChild(el("p", "t-syn", it.overview || "Synopsis not added yet."));
    if (it.note) info.appendChild(el("p", "t-sub", "Curator's note: " + it.note));
    var links = el("div", "t-links");
    var imdbId = String(it.imdbId || "");
    if (/^tt\d+$/.test(imdbId)) {
      var imdbLink = el("a", "", "IMDb");
      imdbLink.href = "https://www.imdb.com/title/" + imdbId + "/";
      imdbLink.target = "_blank";
      imdbLink.rel = "noopener noreferrer";
      links.appendChild(imdbLink);
    }
    (Array.isArray(it.links) ? it.links : []).forEach(function (entry) {
      if (!entry || !entry.label || !/^https:\/\//i.test(String(entry.url || ""))) return;
      var link = el("a", "", entry.label);
      link.href = entry.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      links.appendChild(link);
    });
    if (links.childNodes.length) info.appendChild(links);
    top.appendChild(info);
    body.appendChild(top);

    if (Array.isArray(it.seasonList) && it.seasonList.length) {
      var seasonWrap = el("div", "t-seasons");
      it.seasonList.forEach(function (season) {
        var details = el("details", "t-season");
        var title = season.name || ("Season " + season.number);
        var factsText = [title, season.episodeCount ? plural(season.episodeCount, "episode") : "", season.airDate ? String(season.airDate).slice(0, 4) : ""].filter(Boolean).join(" · ");
        details.appendChild(el("summary", "", factsText));
        if (Array.isArray(season.episodes) && season.episodes.length) {
          var ol = el("ol");
          season.episodes.forEach(function (episode, index) {
            var li = el("li");
            li.appendChild(el("i", "", episode.number || episode.n || (index + 1)));
            li.appendChild(el("span", "", (episode.name || ("Episode " + (episode.number || episode.n || (index + 1)))) + (episode.airDate ? " · " + episode.airDate : "")));
            ol.appendChild(li);
          });
          details.appendChild(ol);
        }
        seasonWrap.appendChild(details);
      });
      seasonWrap.appendChild(el("p", "t-note", "Season and episode information is maintained manually."));
      body.appendChild(seasonWrap);
    }
  }
  function open(key) {
    var item = items.filter(function (entry) { return entry.key === key; })[0];
    if (!item) return;
    opener = document.activeElement;
    fill(item);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    panel.focus();
  }
  function close() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (opener && opener.focus) opener.focus();
  }
  grid.addEventListener("click", function (event) {
    var card = event.target.closest(".t-card");
    if (card) open(card.dataset.key);
  });
  modal.addEventListener("click", function (event) {
    if (event.target.closest("[data-t-close]")) close();
  });
  document.addEventListener("keydown", function (event) {
    if (!modal.classList.contains("open")) return;
    if (event.key === "Escape") { close(); return; }
    if (event.key !== "Tab") return;
    var nodes = Array.prototype.slice.call(panel.querySelectorAll("a[href],button,summary")).filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
    if (!nodes.length) { event.preventDefault(); panel.focus(); return; }
    var first = nodes[0], last = nodes[nodes.length - 1], active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  });

  fetch(SOURCE, { cache: "no-cache" }).then(function (response) {
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }).then(function (source) {
    var movies = (Array.isArray(source.movies) ? source.movies : []).map(function (entry, index) {
      return normalizeItem(entry, "movie", index);
    }).filter(Boolean);
    var series = (Array.isArray(source.series) ? source.series : []).map(function (entry, index) {
      return normalizeItem(entry, "series", index);
    }).filter(Boolean);
    items = movies.concat(series);
    sec.hidden = false;
    if (navLink) navLink.hidden = false;
    tab = movies.length ? "movie" : "series";
    setTab(tab);
  }).catch(function () {
    sec.hidden = false;
    msg.textContent = "Recommendations could not be loaded. Please refresh the page.";
  });
})();