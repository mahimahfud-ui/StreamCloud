/* StreamCloud Admin AI Copilot — additive layer.
   Load after admin-ultra.js. Adds catalogue queries and review-before-publish bulk add.
   Uses the existing authenticated Supabase Edge Functions; no AI/API secrets are exposed here. */
(function () {
  "use strict";
  if (window.__STREAMCLOUD_AI_PLUS_LOADED) return;
  window.__STREAMCLOUD_AI_PLUS_LOADED = true;

  var CFG = window.STREAMCLOUD_SUPABASE || {};
  var BASE = String(CFG.url || "").replace(/\/+$/, "");
  var SECS = { movie: "Movies", series: "Web Series", sites: "Websites", apps: "Movie Apps", music: "Music Apps" };
  var CATS = {
    titles: [["Movie", "movie"], ["Web Series", "series"]],
    links: [
      ["Movie Website", "sites"], ["Anime App/Website", "sites"], ["Streaming/Live TV", "sites"], ["Other Website", "sites"],
      ["Movie App", "apps"], ["Other App", "apps"], ["Music App", "music"], ["Music Website", "music"]
    ]
  };
  var NUM = { year: true, imdb_rating: true, season_count: true, episode_count: true };
  var existing = [], catalogueLoaded = false, catalogueError = "", readyCallbacks = [];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, attrs, kids) {
    var n = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === "text") n.textContent = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function isHttps(v) {
    try { var u = new URL(String(v || "").trim()); return u.protocol === "https:" && !u.username && !u.password; }
    catch (e) { return false; }
  }
  function toast(t, k) {
    var e = h("div", { class: "ux-toast " + (k || ""), role: "status", text: t });
    document.body.appendChild(e); setTimeout(function () { e.remove(); }, 3200);
  }
  function refreshPublic() {
    if (typeof window.STREAMCLOUD_RELOAD_TITLES === "function") {
      try { window.STREAMCLOUD_RELOAD_TITLES(); } catch (e) { /* ignore */ }
    }
  }
  function api(fn, body) {
    if (!BASE || !CFG.anonKey) return Promise.reject(new Error("Supabase is not configured in listings-config.js."));
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem("streamcloud-admin-session") || "null"); } catch (e) { /* ignore */ }
    if (!s || !s.token || !(s.expiresAt > Date.now())) return Promise.reject(new Error("Admin session expired. Enter the PIN again."));
    var hd = { "Content-Type": "application/json", apikey: CFG.anonKey, "x-admin-token": s.token };
    return fetch(BASE + "/functions/v1/" + fn, {
      method: "POST", headers: hd, credentials: "omit", body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status >= 400) { var e = new Error(d.error || "Request failed (" + r.status + ")."); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  function notifyReady() { readyCallbacks.forEach(function (f) { try { f(); } catch (e) { /* ignore UI refresh errors */ } }); }
  function load() {
    catalogueLoaded = false; catalogueError = ""; notifyReady();
    return api("admin-listings", { action: "list" }).then(function (d) {
      existing = Array.isArray(d.listings) ? d.listings : [];
      catalogueLoaded = true; catalogueError = ""; notifyReady(); return existing;
    }).catch(function (e) {
      existing = []; catalogueLoaded = false; catalogueError = e.message || "Could not load the catalogue.";
      notifyReady(); throw e;
    });
  }
  function norm(s) {
    return String(s || "").toLowerCase().replace(/\(\s*\d{4}\s*\)/g, "").replace(/[^a-z0-9]+/g, "");
  }
  function ukey(raw) {
    try {
      var u = new URL(String(raw || "").trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") return "";
      u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref", "mc_cid", "mc_eid"].forEach(function (k) { u.searchParams.delete(k); });
      u.searchParams.sort();
      var path = u.pathname.replace(/\/+$/, "") || "/";
      return u.hostname + path + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "");
    } catch (e) { return ""; }
  }
  function recordText(r) { return [r.name, r.category, r.url, r.description, r.section].join(" ").toLowerCase(); }

  /* ---------- Ask your catalogue: local filtering, no AI token needed ---------- */
  function ask(q, rows) {
    q = String(q || "").toLowerCase().trim();
    var notes = [], tests = [], m, section = "";
    if (!q) return { notes: [], rows: [] };

    var sectionRules = [
      [/\bmusic\b/, "music"],
      [/\bmovie\s+apps?\b/, "apps"],
      [/\bapps?\b/, "apps"],
      [/\bweb\s*series\b|\bseries\b|\btv\s+shows?\b/, "series"],
      [/\bwebsites?\b|\bsites?\b/, "sites"],
      [/\bmovies?\b|\bfilms?\b/, "movie"]
    ];
    sectionRules.some(function (rule) {
      if (rule[0].test(q)) { section = rule[1]; return true; }
      return false;
    });
    if (section) {
      notes.push("section: " + SECS[section]);
      tests.push(function (r) { return r.section === section; });
    }

    if (/\bhidden\b|\bunpublished\b|\bnot published\b/.test(q)) {
      notes.push("hidden"); tests.push(function (r) { return !r.published; });
    } else if (/\bpublished\b|\bvisible\b|\blive\b/.test(q)) {
      notes.push("published"); tests.push(function (r) { return !!r.published; });
    }

    m = q.match(/\b(?:without|missing|lacking|no)\s+(?:(?:a|an|any)\s+)?(poster|image|logo|description|year|rating|genres?|download)\b/);
    if (m) {
      var field = m[1]; notes.push("missing " + field);
      tests.push(function (r) {
        if (field === "poster") return !r.poster_url;
        if (field === "logo") return !r.logo_url;
        if (field === "image") return !(r.poster_url || r.logo_url);
        if (field === "description") return String(r.description || "").trim().length < 40;
        if (field === "year") return r.year === null || r.year === undefined || r.year === "";
        if (field === "rating") return r.imdb_rating === null || r.imdb_rating === undefined || r.imdb_rating === "";
        if (field.indexOf("genre") === 0) return !(Array.isArray(r.genres) && r.genres.length);
        return !r.download_url;
      });
    }

    m = q.match(/\brating\s*(above|over|greater than|more than|at least|>=|>)\s*(\d+(?:\.\d+)?)/);
    if (m) {
      var high = Number(m[2]), highInclusive = m[1] === "at least" || m[1] === ">=";
      notes.push("rating " + m[1] + " " + high);
      tests.push(function (r) { var v = Number(r.imdb_rating); return r.imdb_rating !== null && r.imdb_rating !== "" && isFinite(v) && (highInclusive ? v >= high : v > high); });
    }
    m = q.match(/\brating\s*(below|under|less than|at most|<=|<)\s*(\d+(?:\.\d+)?)/);
    if (m) {
      var low = Number(m[2]), lowInclusive = m[1] === "at most" || m[1] === "<=";
      notes.push("rating " + m[1] + " " + low);
      tests.push(function (r) { var v = Number(r.imdb_rating); return r.imdb_rating !== null && r.imdb_rating !== "" && isFinite(v) && (lowInclusive ? v <= low : v < low); });
    }

    m = q.match(/\b(?:before|older than|prior to|<)\s*((?:18|19|20)\d{2})\b/);
    if (m) {
      var before = Number(m[1]); notes.push("before " + before);
      tests.push(function (r) { return r.year !== null && r.year !== undefined && r.year !== "" && Number(r.year) < before; });
    }
    m = q.match(/\b(?:after|newer than|since|>)\s*((?:18|19|20)\d{2})\b/);
    if (m) {
      var after = Number(m[1]); notes.push("after " + after);
      tests.push(function (r) { return r.year !== null && r.year !== undefined && r.year !== "" && Number(r.year) > after; });
    }

    m = q.match(/"([^"]+)"/);
    if (m) {
      var quoted = m[1].toLowerCase(); notes.push("contains “" + quoted + "”");
      tests.push(function (r) { return recordText(r).indexOf(quoted) >= 0; });
    }

    if (/\bduplicates?\b|\bduplicate links?\b/.test(q)) {
      var counts = {};
      rows.forEach(function (r) {
        var nk = norm(r.name) + "|" + r.section, uk = ukey(r.url);
        counts["n:" + nk] = (counts["n:" + nk] || 0) + 1;
        if (uk) counts["u:" + uk] = (counts["u:" + uk] || 0) + 1;
      });
      notes.push("duplicates");
      tests.push(function (r) {
        var uk = ukey(r.url);
        return counts["n:" + norm(r.name) + "|" + r.section] > 1 || (!!uk && counts["u:" + uk] > 1);
      });
    }

    if (!tests.length) {
      var terms = q.split(/\s+/).filter(Boolean);
      notes.push("text search");
      tests.push(function (r) { var text = recordText(r); return terms.every(function (term) { return text.indexOf(term) >= 0; }); });
    }
    return { notes: notes, rows: rows.filter(function (r) { return tests.every(function (f) { return f(r); }); }) };
  }

  function runBulkVisibility(op, rows, afterDone) {
    var ids = rows.map(function (r) { return r.id; }).filter(function (id) { return typeof id === "string" && id; });
    if (!ids.length) { toast("No valid catalogue items selected.", "err"); return; }
    if (op === "delete" && !confirm("Permanently delete all " + ids.length + " matching item(s)? This cannot be undone.")) return;
    var done = 0, failures = 0, offset = 0;
    function next() {
      if (offset >= ids.length) {
        toast((op === "delete" ? "Deleted " : op === "hide" ? "Hidden " : "Published ") + done + " of " + ids.length + (failures ? " · " + failures + " failed" : ""), failures ? "err" : "ok");
        refreshPublic();
        load().then(function () { if (afterDone) afterDone(); }).catch(function () { if (afterDone) afterDone(); });
        return;
      }
      var batch = ids.slice(offset, offset + 250); offset += batch.length;
      api("admin-listings", { action: "bulk", operation: op, ids: batch }).then(function (d) {
        done += Number(d.affected || 0);
      }).catch(function (e) {
        failures += batch.length; toast("Some items could not be updated: " + e.message, "err");
      }).then(next);
    }
    next();
  }

  function askPanel(root) {
    var inp = h("input", { class: "scx-in", type: "text", placeholder: "e.g. hidden movies without poster · series rating above 8 · duplicates · apps without download", "aria-label": "Ask your catalogue" });
    var out = h("div", {}), go = h("button", { class: "scx-btn pri", type: "button", text: "Ask" });
    var readyNote = h("p", { class: "scx-help", text: "Loading catalogue…" }); out.appendChild(readyNote);
    function ready() {
      go.disabled = !catalogueLoaded;
      if (readyNote.parentNode === out) readyNote.textContent = catalogueLoaded ? "Catalogue loaded. Enter a query." : catalogueError || "Loading catalogue…";
    }
    function run() {
      if (!catalogueLoaded) { out.textContent = catalogueError || "Catalogue is still loading."; return; }
      out.textContent = "";
      var res = ask(inp.value, existing);
      if (!res.notes.length) { out.appendChild(h("p", { class: "scx-help", text: "Enter a query. Try hidden movies without poster, series rating above 8, movies before 2000, apps without download, or duplicates." })); return; }
      out.appendChild(h("p", { class: "scx-help", text: res.rows.length + " match(es) · " + res.notes.join(" · ") }));
      if (!res.rows.length) return;
      res.rows.slice(0, 40).forEach(function (r) {
        out.appendChild(h("div", { class: "ux-fillrow" }, [h("div", {}, [
          h("b", { text: r.name || "Untitled" }), h("br"),
          h("small", { text: (r.category || "—") + " · " + (SECS[r.section] || r.section || "Unknown") + (r.published ? "" : " · Hidden") })
        ])]));
      });
      if (res.rows.length > 40) out.appendChild(h("p", { class: "scx-help", text: "Showing first 40 of " + res.rows.length + " matching items. Bulk actions apply to all matches." }));
      out.appendChild(h("div", { class: "scx-actions" }, [
        h("button", { class: "scx-btn", type: "button", text: "Publish all", onclick: function () { runBulkVisibility("publish", res.rows, run); } }),
        h("button", { class: "scx-btn", type: "button", text: "Hide all", onclick: function () { runBulkVisibility("hide", res.rows, run); } }),
        h("button", { class: "scx-btn dng", type: "button", text: "Delete all", onclick: function () { runBulkVisibility("delete", res.rows, run); } })
      ]));
    }
    go.addEventListener("click", run);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); run(); } });
    root.appendChild(h("div", { class: "ux-panel" }, [h("h3", { text: "✦ Ask your catalogue" }), h("div", { class: "ux-bar" }, [inp, go]), out]));
    return ready;
  }

  /* ---------- Bulk add with AI: analyze, review, then create ---------- */
  function titleAndYear(line) {
    var s = String(line || "").trim();
    var m = s.match(/^(.+?)\s*(?:\|\s*|,\s*|\(\s*)((?:18|19|20)\d{2})\s*\)?\s*$/);
    if (m) return { title: m[1].trim(), year: Number(m[2]) };
    return { title: s, year: null };
  }
  function isDuplicate(o, mode) {
    return existing.some(function (r) {
      if (mode === "links") {
        var a = ukey(r.url), b = ukey(o.url);
        return !!a && !!b && a === b;
      }
      if (o.imdb_id && r.imdb_id && norm(o.imdb_id) === norm(r.imdb_id)) return true;
      return r.section === o.section && !!norm(o.name) && norm(r.name) === norm(o.name);
    });
  }
  function bulkPanel(root) {
    var mode = h("select", { class: "scx-in", "aria-label": "Bulk add mode" });
    [["titles", "Movies / series by title"], ["links", "Websites / apps by link"]].forEach(function (o) { mode.appendChild(h("option", { value: o[0], text: o[1] })); });
    var cat = h("select", { class: "scx-in", "aria-label": "Category" });
    function fillCats() {
      cat.textContent = "";
      CATS[mode.value].forEach(function (c, i) { cat.appendChild(h("option", { value: i, text: c[0] })); });
    }
    function hint() { return mode.value === "titles" ? "One title per line. Optional year: Dune | 2021" : "One public https:// link per line"; }
    var ta = h("textarea", { class: "scx-in", rows: "5", placeholder: hint(), "aria-label": "Items to add" });
    var run = h("button", { class: "scx-btn pri", type: "button", text: "✦ Analyse details" }), out = h("div", {});
    var readyNote = h("p", { class: "scx-help", text: "Loading catalogue…" }); out.appendChild(readyNote);
    fillCats();
    mode.addEventListener("change", function () { fillCats(); ta.placeholder = hint(); });

    run.addEventListener("click", function () {
      if (!catalogueLoaded) { toast(catalogueError || "Catalogue is still loading.", "err"); return; }
      var m = mode.value, c = CATS[m][Number(cat.value)];
      var allLines = ta.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!allLines.length) { toast("Add at least one line.", "err"); return; }
      var lines = allLines.slice(0, 25);
      out.textContent = ""; run.disabled = true;
      var prog = h("div", { class: "ux-prog" }, [h("i")]), st = h("p", { class: "scx-help", text: "Preparing analysis…" });
      out.appendChild(st); out.appendChild(prog);
      if (allLines.length > 25) st.textContent = "Analysing first 25 of " + allLines.length + " lines…";
      var results = [], i = 0;

      function next() {
        if (i >= lines.length) {
          run.disabled = !catalogueLoaded;
          prog.firstChild.style.width = "100%";
          st.textContent = "Review suggestions, untick anything you do not want, then publish selected.";
          return review(out, results, st);
        }
        var ln = lines[i], label = ln, body = null, parsed;
        st.textContent = "Analysing " + (i + 1) + " / " + lines.length + ": " + ln;
        prog.firstChild.style.width = Math.round(i / lines.length * 100) + "%";
        if (m === "titles") {
          parsed = titleAndYear(ln); label = parsed.title;
          if (label.length < 2) { results.push({ label: ln, err: "Enter a title with at least two characters." }); i++; return next(); }
          body = { mode: "title-lookup", title: label, year: parsed.year, section: c[1], generateSummary: true };
        } else {
          if (!isHttps(ln)) { results.push({ label: ln, err: "Not a valid public https link." }); i++; return next(); }
          body = { url: ln, section: c[1], category: c[0] };
        }
        api("admin-detect", body).then(function (d) {
          var f = d.detected || {}, o = {};
          Object.keys(f).forEach(function (k) { o[k] = f[k]; });
          o.section = c[1]; o.category = c[0];
          if (m === "titles") {
            if (!o.name) throw new Error("No verified title match returned.");
            var idMatch = String(o.imdb_id || "").match(/tt\d{5,10}/); if (!isHttps(o.url) && idMatch) o.url = "https://www.imdb.com/title/" + idMatch[0] + "/";
            if (!isHttps(o.url)) throw new Error("No valid IMDb link was returned.");
          } else {
            o.url = ln;
            if (!o.name) throw new Error("Could not detect a name from this link.");
          }
          var dup = isDuplicate(o, m);
          results.push({ label: label, o: o, on: !dup, dup: dup });
        }).catch(function (e) {
          results.push({ label: label, err: e.message || "Metadata lookup failed." });
        }).then(function () { i++; next(); });
      }
      next();
    });

    root.appendChild(h("div", { class: "ux-panel" }, [
      h("h3", { text: "✦ Bulk add (up to 25 per run)" }),
      h("div", { class: "ux-bar" }, [mode, cat]), ta,
      h("p", { class: "scx-help", text: "Metadata is fetched through your existing secured Supabase function. Review every suggestion before publishing." }),
      h("div", { class: "scx-actions" }, [run]), out
    ]));
    return function ready() {
      run.disabled = !catalogueLoaded;
      if (readyNote.parentNode === out) readyNote.textContent = catalogueLoaded ? "Catalogue loaded. Ready to analyse." : catalogueError || "Loading catalogue…";
    };
  }

  function review(out, results, status) {
    var list = h("div", {}); out.appendChild(list);
    results.forEach(function (x) {
      var o = x.o || {};
      var ck = h("input", { type: "checkbox", checked: !!x.on, disabled: !x.o });
      ck.addEventListener("change", function () { x.on = ck.checked; });
      var img = o.poster_url || o.logo_url;
      var meta = x.err ? x.err : [
        o.year || "", o.imdb_rating != null ? "★ " + o.imdb_rating : "",
        x.dup ? "Already in catalogue (unticked)" : ""
      ].filter(Boolean).join(" · ");
      list.appendChild(h("div", { class: "ux-fillrow" }, [
        ck,
        isHttps(img) ? h("img", { src: img, alt: "", referrerpolicy: "no-referrer", loading: "lazy" }) : null,
        h("div", {}, [h("b", { text: o.name || x.label || "Untitled" }), h("br"), h("small", { text: meta })])
      ]));
    });
    var selectable = results.some(function (x) { return !!x.o; });
    if (!selectable) { status.textContent = "No publishable items were detected. Check the error notes above and try again."; return; }
    var pub = h("button", { class: "scx-btn pri", type: "button", text: "Publish selected" });
    pub.addEventListener("click", function () {
      var todo = results.filter(function (x) { return x.on && x.o; }), n = 0, ok = 0, failed = 0;
      if (!todo.length) { toast("Nothing selected.", "err"); return; }
      pub.disabled = true;
      function createNext() {
        if (n >= todo.length) {
          pub.disabled = true;
          status.textContent = "Created " + ok + " of " + todo.length + " selected item(s)." + (failed ? " " + failed + " failed; see error notifications." : "");
          toast("Created " + ok + " of " + todo.length + (failed ? " · " + failed + " failed" : ""), failed ? "err" : "ok");
          refreshPublic();
          load().catch(function () { /* readiness panel shows the catalogue error */ });
          return;
        }
        var x = todo[n], o = x.o, listing = {};
        pub.textContent = "Publishing " + (n + 1) + " / " + todo.length + "…";
        ["section", "category", "name", "url", "description", "logo_url", "poster_url", "official_url", "download_url", "platform", "version", "imdb_id", "year", "imdb_rating", "season_count", "episode_count", "genres", "ads"].forEach(function (k) {
          var v = o[k];
          if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
          listing[k] = NUM[k] ? String(v) : v;
        });
        api("admin-listings", { action: "create", id: null, listing: listing, keepUnverifiedDownload: false }).then(function () {
          ok++;
        }).catch(function (e) {
          failed++; toast((o.name || x.label || "Item") + ": " + e.message, "err");
        }).then(function () { n++; createNext(); });
      }
      createNext();
    });
    out.appendChild(h("div", { class: "scx-actions" }, [pub]));
  }

  /* ---------- AI Copilot tab ---------- */
  function openAi() {
    var tabs = $(".scx-tabs"), body = tabs && tabs.parentNode;
    if (!body) return;
    while (tabs.nextSibling) body.removeChild(tabs.nextSibling);
    $$(".scx-tab", tabs).forEach(function (t) {
      var on = t.classList.contains("ux-aitab");
      t.classList.toggle("on", on); t.setAttribute("aria-selected", String(on));
    });
    var ttl = $("#scxTitle"); if (ttl) ttl.textContent = "Catalogue helper";
    var root = h("div", { class: "ux-pro" }); body.appendChild(root);
    readyCallbacks = [];
    catalogueLoaded = false; catalogueError = ""; existing = [];
    readyCallbacks.push(askPanel(root));
    readyCallbacks.push(bulkPanel(root));
    notifyReady();
    load().catch(function () { /* panels display the actual error */ });
  }
  function inject() {
    var tabs = $(".scx-tabs");
    if (!tabs || $(".ux-aitab", tabs)) return;
    var anchor = $(".ux-protab", tabs);
    if (!anchor) $$(".scx-tab", tabs).forEach(function (b) { if (b.textContent.trim() === "Content") anchor = b; });
    if (anchor) anchor.after(h("button", { class: "scx-tab ux-aitab", type: "button", text: "Catalogue helper ✦", onclick: openAi }));
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var ov = $(".scx-ov");
      if (ov && !ov.hidden) inject();
    });
  }
  function start() {
    if (!document.body) return;
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    schedule();
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();