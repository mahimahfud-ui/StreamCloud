/* StreamCloud premium behaviour layer. Loaded after the inline scripts in index.html. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var slug = function (n) { return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var toast = function (m) { if (window.scToast) window.scToast(m); };
  var cat = function () { return window.MAHIFLIX_CATALOG || { sites: [], apps: [] }; };
  var q = $("#q"), adF = $("#adFilter"), sortS = $("#sortSelect"), tools = $(".catalog-selects"), chips = $(".filter-chips");
  if (!q || !tools || !chips || !adF || !sortS) return;
  var favOnly = false;

  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* Toolbar: favourites chip, grid/list toggle, reset */
  var favChip = mk("button", "sc-chip", "Favourites"); favChip.type = "button"; favChip.setAttribute("aria-pressed", "false");
  chips.appendChild(favChip);
  var seg = mk("div", "sc-seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Layout");
  var gridBtn = mk("button", "", "Grid"), listBtn = mk("button", "", "List"); gridBtn.type = listBtn.type = "button";
  seg.appendChild(gridBtn); seg.appendChild(listBtn); tools.appendChild(seg);
  var resetBtn = mk("button", "sc-reset", "Reset filters"); resetBtn.type = "button"; resetBtn.hidden = true; tools.appendChild(resetBtn);

  function setView(v) {
    document.documentElement.classList.toggle("list-view", v === "list");
    gridBtn.setAttribute("aria-pressed", String(v !== "list")); listBtn.setAttribute("aria-pressed", String(v === "list"));
    store.set("streamcloud-view", v);
  }
  gridBtn.addEventListener("click", function () { setView("grid"); });
  listBtn.addEventListener("click", function () { setView("list"); });
  setView(store.get("streamcloud-view", "grid") === "list" ? "list" : "grid");

  function isFiltered() {
    var chip = $(".filter-chip.active");
    return !!q.value.trim() || adF.value !== "all" || sortS.value !== "score" || (chip && chip.dataset.filter !== "all");
  }

  /* Re-applied after every render of the catalogue */
  function apply() {
    var view = $(".view.active"); if (!view) return;
    var shown = 0;
    $$(".card", view).forEach(function (c) {
      var hide = favOnly && store.get("mahiflix-favorite:" + slug(c.dataset.name || ""), "") !== "1";
      c.classList.toggle("sc-hide", hide);
      if (!hide && c.style.display !== "none") shown++;
      var f = $(".fav", c);
      if (f) {
        var on = f.dataset.on === "1";
        f.setAttribute("aria-pressed", String(on));
        f.setAttribute("aria-label", (on ? "Remove " : "Add ") + c.dataset.name + (on ? " from" : " to") + " Favourites");
      }
    });
    var empty = $("#empty");
    if (favOnly && !shown && empty) { empty.textContent = "No favourites here yet. Press + on a card to save it."; empty.style.display = "block"; }
    else if (empty && !favOnly) { empty.style.display = ""; }
    favChip.classList.toggle("on", favOnly); favChip.setAttribute("aria-pressed", String(favOnly));
    resetBtn.hidden = !(favOnly || isFiltered());
  }
  favChip.addEventListener("click", function () { favOnly = !favOnly; if (!favOnly) { var e = $("#empty"); if (e) e.style.display = "none"; } apply(); });
  resetBtn.addEventListener("click", function () {
    favOnly = false;
    q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true }));
    adF.value = "all"; adF.dispatchEvent(new Event("change", { bubbles: true }));
    sortS.value = "score"; sortS.dispatchEvent(new Event("change", { bubbles: true }));
    var all = $('.filter-chip[data-filter="all"]'); if (all) all.click();
    apply(); toast("Filters reset");
  });
  var mo = new MutationObserver(apply);
  ["sitesView", "appsView"].forEach(function (id) { var v = document.getElementById(id); if (v) mo.observe(v, { childList: true, subtree: true }); });
  ["input", "change", "click"].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(apply, 0); }); });

  /* Recently visited (recorded only when a card or link is activated) */
  var RK = "streamcloud-recent-v1";
  var panel = mk("section", "sc-recent"); panel.id = "scRecent"; panel.hidden = true; panel.setAttribute("aria-label", "Recently visited");
  panel.innerHTML = "<div class='sc-recent-head'><h2>Recently visited</h2><button type='button' id='scRecentClear'>Clear history</button></div><ul></ul>";
  var anchor = $(".catalog-tools"); if (anchor) anchor.insertAdjacentElement("afterend", panel);
  function recents() {
    try { var a = JSON.parse(store.get(RK, "[]")); return Array.isArray(a) ? a.filter(function (x) { return x && x.name && /^https?:/.test(x.url || ""); }).slice(0, 8) : []; } catch (e) { return []; }
  }
  function paint() {
    var list = recents(); panel.hidden = !list.length;
    $("ul", panel).innerHTML = list.map(function (x) {
      return "<li><a href='" + esc(x.url) + "' target='_blank' rel='noopener noreferrer' data-rname='" + esc(x.name) + "' data-rtype='" + esc(x.type) + "'><span class='sc-dot' aria-hidden='true'>" + esc(x.name.slice(0, 2).toUpperCase()) + "</span><span>" + esc(x.name) + "</span><small>" + (x.type === "site" ? "Website" : x.type === "music" ? "Music app" : "Movie app") + "</small></a></li>";
    }).join("");
  }
  function remember(item, type) {
    if (!item || !item.url) return;
    var list = recents().filter(function (x) { return !(x.name === item.name && x.type === type); });
    list.unshift({ name: item.name, type: type, url: item.url });
    store.set(RK, JSON.stringify(list.slice(0, 8)));
    setTimeout(paint, 0);
  }
  $("#scRecentClear").addEventListener("click", function () { store.del(RK); paint(); toast("History cleared"); });
  function typeOf(c) { return c.closest("#sitesView") ? "site" : (c.dataset.category === "music" ? "music" : "movie"); }
  function find(name, type) {
    var C = cat(), list = type === "site" ? C.sites : C.apps;
    return list.filter(function (i) { return String(i.name).toLowerCase() === String(name).toLowerCase() && (type === "site" || (i.appType || "movie") === type); })[0];
  }
  /* Capture clicks before the site's own navigation handlers run. */
  window.addEventListener("click", function (e) {
    var t = e.target; if (!t.closest) return;
    var r = t.closest(".sc-recent a");
    if (r) { remember(find(r.dataset.rname, r.dataset.rtype), r.dataset.rtype); return; }
    if (t.closest("#detailVisit")) {
      var siteView = $("#sitesView");
      var type = siteView && siteView.classList.contains("active") ? "site" : null, n = $("#detailTitle").textContent;
      var item = type ? find(n, "site") : (find(n, "movie") || find(n, "music"));
      if (item) remember(item, type || item.appType || "movie");
      return;
    }
    if (t.closest(".fav,.arrow,[data-detail]")) return;
    var c = t.closest(".card"); if (!c) return;
    if (t.closest("button") && !t.closest("a")) return;
    var ty = typeOf(c); remember(find(c.dataset.name, ty), ty);
  }, true);
  window.addEventListener("keydown", function (e) {
    if ((e.key !== "Enter" && e.key !== " ") || !e.target.classList || !e.target.classList.contains("card")) return;
    var ty = typeOf(e.target); remember(find(e.target.dataset.name, ty), ty);
  }, true);

  paint(); apply();
})();