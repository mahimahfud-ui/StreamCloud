/* StreamCloud public site controls. Values are loaded from Supabase; only known safe fields affect the page. */
(function () {
  "use strict";
  var CFG = window.STREAMCLOUD_SUPABASE || {};
  var BASE = String(CFG.url || "").replace(/\/+$/, "");
  var DEFAULTS = {
    schemaVersion: 1, site: {}, appearance: {},
    sections: {
      sites: { visible: true, title: "Movie Websites" },
      apps: { visible: true, title: "Movie Apps" },
      music: { visible: true, title: "Music Apps" },
      gaming: { visible: true, title: "Gaming Websites" },
      tv: { visible: true, title: "TV Apps" },
      recs: { visible: true, title: "Recommendations" },
      order: ["sites", "apps", "music", "gaming", "tv", "recs"]
    },
    content: { overrides: {}, hidden: [], deleted: [], order: {} }
  };
  var original = { sites: [], apps: [], music: [], gaming: [], tv: [] };
  var dynamic = { sites: new Map(), apps: new Map(), music: new Map(), gaming: new Map(), tv: new Map() };
  var settings = DEFAULTS;
  var registry = { sites: [], apps: [], music: [], gaming: [], tv: [], movie: [], series: [] };
  var manual = { sites: false, apps: false, music: false, gaming: false, tv: false };
  var styleNode = null;
  var siteSettingsStyle = null;

  function slug(v) { return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function keyFor(section, item) {
    if (item && item.__scKey) return item.__scKey;
    if (item && item.listingId) return "db:" + item.listingId;
    if ((section === "movie" || section === "series") && item && typeof item.key === "string" && item.key.indexOf("db-") === 0) return "db:" + item.key.slice(3);
    if (section === "movie" || section === "series") return section + ":" + (item.imdbId || slug(item.title));
    return section + ":" + (String(item.domain || "").toLowerCase().replace(/^www\./, "") || slug(item.name));
  }
  function safeSettings(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return DEFAULTS;
    v.site = v.site && typeof v.site === "object" ? v.site : {};
    v.appearance = v.appearance && typeof v.appearance === "object" ? v.appearance : {};
    v.sections = v.sections && typeof v.sections === "object" ? v.sections : {};
    v.content = v.content && typeof v.content === "object" ? v.content : {};
    v.content.overrides = v.content.overrides && typeof v.content.overrides === "object" ? v.content.overrides : {};
    v.content.hidden = Array.isArray(v.content.hidden) ? v.content.hidden : [];
    v.content.deleted = Array.isArray(v.content.deleted) ? v.content.deleted : [];
    v.content.order = v.content.order && typeof v.content.order === "object" ? v.content.order : {};
    return v;
  }
  function overrideItem(section, raw) {
    var item = Object.assign({}, raw);
    var k = keyFor(section, raw);
    item.__scKey = k;
    var ov = settings.content.overrides[k];
    if (!ov || typeof ov !== "object") return item;
    if (section === "movie" || section === "series") {
      Object.keys(ov).forEach(function (p) {
        if (["title", "year", "poster", "genres", "rating", "overview", "imdbId", "runtime", "seasonCount", "episodeCount", "industry", "originalTitle", "links", "note"].indexOf(p) >= 0) item[p] = ov[p];
      });
    } else {
      if (typeof ov.name === "string") item.name = ov.name;
      if (typeof ov.url === "string") item.url = ov.url;
      if (typeof ov.description === "string") item.desc = ov.description;
      if (typeof ov.downloadUrl === "string") item.downloadUrl = ov.downloadUrl;
      if (typeof ov.downloadDirect === "boolean") item.downloadDirect = ov.downloadDirect;
      if (typeof ov.domain === "string") item.domain = ov.domain;
      if (typeof ov.logoUrl === "string") item.logoSources = ov.logoUrl ? [ov.logoUrl] : [];
      if (typeof ov.thumbnail === "string") item.thumbnail = ov.thumbnail;
      if (typeof ov.ads === "number" && [0, 1, 2].indexOf(ov.ads) >= 0) item.ads = ov.ads;
    }
    item.__scKey = k;
    return item;
  }
  function isHidden(item) { return settings.content.hidden.indexOf(item.__scKey) >= 0; }
  function isDeleted(item) { return settings.content.deleted.indexOf(item.__scKey) >= 0; }
  function arrange(section, rows) {
    var order = settings.content.order[section];
    var sorted = rows.slice();
    if (Array.isArray(order) && order.length) {
      var rank = new Map(order.map(function (k, i) { return [k, i]; }));
      sorted.sort(function (a, b) {
        var ar = rank.has(a.__scKey) ? rank.get(a.__scKey) : 1000000;
        var br = rank.has(b.__scKey) ? rank.get(b.__scKey) : 1000000;
        return ar === br ? 0 : ar - br;
      });
    }
    return sorted;
  }
  function replaceArray(target, rows) {
    target.splice(0, target.length);
    rows.forEach(function (x) { target.push(x); });
  }
  function cacheDynamic(section, current) {
    (current || []).forEach(function (item) {
      if (item && item.listingId) dynamic[section].set(item.listingId, Object.assign({}, item));
    });
  }
  function controlCatalog(section, target) {
    cacheDynamic(section, target);
    var combined = original[section].map(function (x) { return overrideItem(section, x); });
    dynamic[section].forEach(function (x) { combined.push(overrideItem(section, x)); });
    registry[section] = combined.slice();
    var visible = arrange(section, combined).filter(function (x) { return !isHidden(x) && !isDeleted(x); });
    manual[section] = Array.isArray(settings.content.order[section]) && settings.content.order[section].length > 0;
    replaceArray(target, visible);
  }
  function validColor(value) { return typeof value === "string" && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(value); }
  function boundedNumber(value, min, max, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }
  function applyAppearance() {
    var a = settings.appearance || {}, root = document.documentElement;
    [["--bg", a.background], ["--panel", a.panel], ["--card", a.card], ["--text", a.text], ["--dim", a.dim], ["--red", a.accent], ["--border", a.border]].forEach(function (pair) {
      if (validColor(pair[1])) root.style.setProperty(pair[0], pair[1]);
    });
    var d = boundedNumber(a.desktopColumns, 1, 8, 3);
    var t = boundedNumber(a.tabletColumns, 1, 6, 2);
    var m = boundedNumber(a.mobileColumns, 1, 3, 1);
    var gap = boundedNumber(a.gap, 0, 48, 22);
    var radius = boundedNumber(a.radius, 0, 32, 4);
    var aspect = ["1 / 1", "2 / 3", "16 / 9", "4 / 3"].indexOf(a.aspectRatio) >= 0 ? a.aspectRatio : "1 / 1";
    var fit = ["contain", "cover", "fill"].indexOf(a.imageFit) >= 0 ? a.imageFit : "contain";
    if (!styleNode) {
      styleNode = document.createElement("style");
      styleNode.id = "streamcloud-admin-public-controls";
      document.head.appendChild(styleNode);
    }
    styleNode.textContent =
      ".track{grid-template-columns:repeat(var(--sc-cols-d,3),minmax(0,1fr))!important;gap:var(--sc-gap,22px)!important}" +
      "#sitesView .card,#appsView .card,#musicView .card,#gamingView .card,#tvView .card{aspect-ratio:var(--sc-aspect,1/1)!important}" +
      ".logo-card img{object-fit:var(--sc-image-fit,contain)!important}" +
      ".card{border-radius:var(--sc-radius,4px)!important}" +
      ".sc-hidden-section{display:none!important}" +
      "@media(max-width:1024px){.track{grid-template-columns:repeat(var(--sc-cols-t,2),minmax(0,1fr))!important}}" +
      "@media(max-width:560px){.track{grid-template-columns:repeat(var(--sc-cols-m,1),minmax(0,1fr))!important}}";
    root.style.setProperty("--sc-cols-d", String(d));
    root.style.setProperty("--sc-cols-t", String(t));
    root.style.setProperty("--sc-cols-m", String(m));
    root.style.setProperty("--sc-gap", gap + "px");
    root.style.setProperty("--sc-radius", radius + "px");
    root.style.setProperty("--sc-aspect", aspect);
    root.style.setProperty("--sc-image-fit", fit);
    if (typeof a.fontFamily === "string" && /^[a-zA-Z0-9 ,"'_-]{1,80}$/.test(a.fontFamily)) document.body.style.fontFamily = a.fontFamily;
    if (typeof a.fontSize === "number" || typeof a.fontSize === "string") {
      var fs = boundedNumber(a.fontSize, 12, 20, 14);
      document.body.style.fontSize = fs + "px";
    }
  }
  function applyAnnouncement() {
    var site = settings.site || {};
    var hero = document.getElementById("top");
    if (!hero || !hero.parentNode) return;
    var banner = document.getElementById("streamcloud-announcement");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "streamcloud-announcement"; banner.setAttribute("role", "status"); banner.className = "sc-announcement";
      hero.parentNode.insertBefore(banner, hero);
    }
    if (!siteSettingsStyle) {
      siteSettingsStyle = document.createElement("style");
      siteSettingsStyle.id = "streamcloud-admin-site-settings-css";
      document.head.appendChild(siteSettingsStyle);
    }
    siteSettingsStyle.textContent = ".sc-site-hero-hidden{display:none!important}.sc-announcement{position:relative;z-index:10;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin:66px 4% 0;padding:10px 14px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:linear-gradient(100deg,rgba(229,9,20,.20),rgba(36,36,36,.96));color:#fff;font-size:12px;line-height:1.5;text-align:center}.sc-announcement[hidden]{display:none!important}.sc-announcement a{font-weight:800;text-decoration:underline;text-underline-offset:3px}.sc-announcement-close{border:0;border-radius:50%;width:25px;height:25px;background:rgba(255,255,255,.12);color:#fff;font-size:18px;line-height:1}.sc-announcement-close:hover{background:rgba(255,255,255,.24)}@media(max-width:760px){.sc-announcement{margin:62px 3% 0;padding:9px 10px;font-size:11px;gap:8px}}";
    var message = typeof site.announcement === "string" ? site.announcement.trim().slice(0, 240) : "";
    if (site.announcementEnabled !== true || !message) { banner.hidden = true; banner.textContent = ""; return; }
    banner.textContent = "";
    var copy = document.createElement("span"); copy.textContent = message; banner.appendChild(copy);
    var link = typeof site.announcementLink === "string" ? site.announcementLink.trim() : "";
    if (/^https:\/\//i.test(link)) {
      try {
        var parsed = new URL(link);
        if (parsed.protocol === "https:" && !parsed.username && !parsed.password) {
          var a = document.createElement("a"); a.href = parsed.href; a.target = "_blank"; a.rel = "noopener noreferrer";
          a.textContent = String(site.announcementLabel || "Learn more").slice(0, 36); banner.appendChild(a);
        }
      } catch (e) { /* Invalid optional link is omitted. */ }
    }
    var close = document.createElement("button");
    close.type = "button"; close.className = "sc-announcement-close"; close.setAttribute("aria-label", "Dismiss announcement"); close.textContent = "×";
    close.addEventListener("click", function () {
      banner.hidden = true;
      try { sessionStorage.setItem("streamcloud-announcement-dismissed", message); } catch (e) { /* Optional convenience only. */ }
    });
    banner.appendChild(close);
    try { banner.hidden = sessionStorage.getItem("streamcloud-announcement-dismissed") === message; } catch (e) { banner.hidden = false; }
  }
  function applySiteSettings() {
    var site = settings.site || {};
    if (typeof site.title === "string" && site.title.trim()) {
      document.title = site.title.trim().slice(0, 100);
      var titleMeta = document.querySelector("meta[property='og:title']");
      if (titleMeta) titleMeta.content = site.title.trim().slice(0, 100);
    }
    if (typeof site.description === "string" && site.description.trim()) {
      var desc = document.querySelector('meta[name="description"]');
      var og = document.querySelector('meta[property="og:description"]');
      if (desc) desc.content = site.description.trim().slice(0, 300);
      if (og) og.content = site.description.trim().slice(0, 300);
    }
    if (typeof site.keywords === "string" && site.keywords.trim()) {
      var keywords = document.querySelector('meta[name="keywords"]');
      if (!keywords) { keywords = document.createElement("meta"); keywords.name = "keywords"; document.head.appendChild(keywords); }
      keywords.content = site.keywords.trim().slice(0, 300);
    }
    var eyebrow = document.querySelector("#top .hero-line.sm");
    if (eyebrow && typeof site.heroEyebrow === "string" && site.heroEyebrow.trim()) eyebrow.textContent = site.heroEyebrow.trim().slice(0, 80);
    var headline = document.querySelector("#top .hero-line.big");
    if (headline && typeof site.heroTitle === "string" && site.heroTitle.trim()) headline.textContent = site.heroTitle.trim().slice(0, 100);
    var heroDesc = document.getElementById("heroDesc");
    if (heroDesc && typeof site.heroDescription === "string" && site.heroDescription.trim()) heroDesc.textContent = site.heroDescription.trim().slice(0, 300);
    var hero = document.getElementById("top");
    if (hero) hero.classList.toggle("sc-site-hero-hidden", site.heroVisible === false);
    if (typeof site.themeColor === "string" && /^#[0-9a-f]{6}$/i.test(site.themeColor)) {
      var themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.content = site.themeColor;
      document.documentElement.style.setProperty("--sc-browser-theme", site.themeColor);
    }
    if (typeof site.instagramUrl === "string" && /^https:\/\//i.test(site.instagramUrl)) {
      var ig = document.querySelector(".hero-social-icons .ig-link");
      if (ig) ig.href = site.instagramUrl;
    }
  }
  function applySections() {
    var sections = settings.sections || {};
    var main = document.querySelector("main");
    var sites = document.getElementById("sitesView");
    var apps = document.getElementById("appsView");
    var music = document.getElementById("musicView");
    var gaming = document.getElementById("gamingView");
    var tv = document.getElementById("tvView");
    var recs = document.getElementById("recs");
    var empty = document.getElementById("empty");
    [
      [sites, sections.sites, "sites"],
      [apps, sections.apps, "apps"],
      [music, sections.music, "music"],
      [gaming, sections.gaming, "gaming"],
      [tv, sections.tv, "tv"],
      [recs, sections.recs, "recs"]
    ].forEach(function (p) {
      if (!p[0]) return;
      var opt = p[1] || {};
      p[0].classList.toggle("sc-hidden-section", opt.visible === false);
      if (typeof opt.title === "string" && opt.title.trim()) {
        var heading = p[0].querySelector(".row-head h2, #recsTitle");
        if (heading) heading.textContent = opt.title.trim().slice(0, 100);
        var mode = document.querySelector('.mode[data-mode="' + p[2] + '"]');
        if (mode) {
          mode.textContent = opt.title.trim().slice(0, 30).toUpperCase();
          mode.classList.toggle("sc-hidden-section", opt.visible === false);
        }
      }
    });
    var order = Array.isArray(sections.order) ? sections.order.slice() : ["sites", "apps", "music", "gaming", "tv", "recs"];
    ["sites", "apps", "music", "gaming", "tv", "recs"].forEach(function (key) { if (order.indexOf(key) < 0) { var recIndex = order.indexOf("recs"); order.splice(recIndex < 0 ? order.length : recIndex, 0, key); } });
    var modeWrap = document.querySelector(".mode-switch");
    var modeMap = { sites: sites, apps: apps, music: music, gaming: gaming, tv: tv };
    var modes = ["sites", "apps", "music", "gaming", "tv"].slice();
    if (modeWrap) {
      modes.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      modes.forEach(function (key) {
        var button = document.querySelector('.mode[data-mode="' + key + '"]');
        if (button) modeWrap.appendChild(button);
      });
    }
    if (main) {
      order.filter(function (key) { return key === "sites" || key === "apps" || key === "music" || key === "gaming" || key === "tv" || key === "recs"; }).forEach(function (key) {
        var node = key === "recs" ? recs : modeMap[key];
        if (node) main.appendChild(node);
      });
      if (empty) main.appendChild(empty);
    }
    var nav = document.getElementById("recsNav");
    if (nav) nav.hidden = !!(sections.recs && sections.recs.visible === false);
  }
  function applySettings(next) {
    settings = safeSettings(next || settings || DEFAULTS);
    window.STREAMCLOUD_SITE_SETTINGS = settings;
    try {
      if (typeof S !== "undefined") controlCatalog("sites", S);
      if (typeof A !== "undefined") controlCatalog("apps", A);
      if (typeof M !== "undefined") controlCatalog("music", M);
      if (typeof G !== "undefined") controlCatalog("gaming", G);
      if (typeof TV !== "undefined") controlCatalog("tv", TV);
      if (typeof renderView === "function") { renderView("sites"); renderView("apps"); renderView("music"); renderView("gaming"); renderView("tv"); }
    } catch (e) { console.warn("StreamCloud catalog controls could not be applied.", e); }
    applyAppearance();
    applySiteSettings();
    applyAnnouncement();
    applySections();
    document.dispatchEvent(new CustomEvent("streamcloud-settings-applied", { detail: settings }));
  }
  function controlRecommendations(source) {
    source = source || {};
    var out = {};
    ["movies", "series"].forEach(function (group) {
      var section = group === "movies" ? "movie" : "series";
      var rows = (Array.isArray(source[group]) ? source[group] : []).map(function (raw) { return overrideItem(section, raw); });
      var imported = settings.content.extraRecommendations && Array.isArray(settings.content.extraRecommendations[group]) ? settings.content.extraRecommendations[group] : [];
      imported.forEach(function (raw) { rows.push(overrideItem(section, raw)); });
      registry[section] = rows.slice();
      out[group] = arrange(section, rows).filter(function (x) { return !isHidden(x) && !isDeleted(x); });
    });
    return out;
  }
  window.STREAMCLOUD_CARD_KEY = keyFor;
  window.STREAMCLOUD_CARD_REGISTRY = registry;
  window.STREAMCLOUD_CONTROL_RECOMMENDATIONS = controlRecommendations;
  window.STREAMCLOUD_APPLY_SETTINGS = applySettings;
  window.STREAMCLOUD_REFRESH_PUBLIC_CONTROLS = function () {
    try {
      if (typeof S !== "undefined") controlCatalog("sites", S);
      if (typeof A !== "undefined") controlCatalog("apps", A);
      if (typeof M !== "undefined") controlCatalog("music", M);
      if (typeof G !== "undefined") controlCatalog("gaming", G);
      if (typeof TV !== "undefined") controlCatalog("tv", TV);
      if (typeof renderView === "function") { renderView("sites"); renderView("apps"); renderView("music"); renderView("gaming"); renderView("tv"); }
      applySections();
    } catch (e) { console.warn("StreamCloud public catalogue refresh failed.", e); }
  };
  original.sites = typeof S !== "undefined" ? S.slice() : [];
  original.apps = typeof A !== "undefined" ? A.slice() : [];
  original.music = typeof M !== "undefined" ? M.slice() : [];
  original.gaming = typeof G !== "undefined" ? G.slice() : [];
  original.tv = typeof TV !== "undefined" ? TV.slice() : [];

  window.STREAMCLOUD_SETTINGS_READY = (function () {
    if (!BASE || !CFG.anonKey) { applySettings(DEFAULTS); return Promise.resolve(DEFAULTS); }
    return fetch(BASE + "/rest/v1/site_settings?id=eq.global&select=settings", {
      headers: { apikey: CFG.anonKey }, cache: "no-cache"
    }).then(function (r) {
      if (!r.ok) throw new Error("Could not load site settings (" + r.status + ").");
      return r.json();
    }).then(function (rows) {
      var loaded = Array.isArray(rows) && rows[0] ? rows[0].settings : DEFAULTS;
      applySettings(loaded);
      return settings;
    }).catch(function () {
      applySettings(DEFAULTS);
      return DEFAULTS;
    });
  })();
})();
