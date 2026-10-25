/* StreamCloud Admin AI Agent UI — additive tab inside the existing PIN-protected admin modal. */
(function () {
  "use strict";
  if (window.__STREAMCLOUD_ADMIN_AGENT_UI__) return;
  window.__STREAMCLOUD_ADMIN_AGENT_UI__ = true;

  var CFG = window.STREAMCLOUD_SUPABASE || {};
  var BASE = String(CFG.url || "").replace(/\/+$/, "");
  var FN = BASE + "/functions/v1/admin-agent";
  var THREAD_KEY = "streamcloud-admin-agent-thread";
  var activeThread = "";
  var activeProposal = null;
  var busy = false;
  var statusData = null;
  var uiRoot = null;
  var observer = null;
  var statusLine = null;
  var messagesBox = null;
  var inputBox = null;
  var sendButton = null;
  var planButton = null;

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === "text") n.textContent = v;
      else if (k === "className") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : String(v));
    });
    (children || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function readSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem("streamcloud-admin-session") || "null");
      if (s && typeof s.token === "string" && s.expiresAt > Date.now()) return s;
    } catch (e) {}
    return null;
  }
  function request(action, values) {
    var session = readSession();
    if (!BASE || !CFG.anonKey) return Promise.reject(new Error("Supabase config missing in listings-config.js."));
    if (!session) return Promise.reject(new Error("Admin session expired. Close this panel and unlock it again using your PIN."));
    var body = Object.assign({ action: action }, values || {});
    return fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": CFG.anonKey, "x-admin-token": session.token },
      credentials: "omit",
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var e = new Error(data.error || ("Agent request failed (" + r.status + ")."));
          e.status = r.status; throw e;
        }
        return data;
      });
    });
  }
  function addStyle() {
    if (document.getElementById("sc-agent-ui-style")) return;
    var s = el("style", { id: "sc-agent-ui-style" });
    s.textContent =
      ".sc-agent{display:flex;flex-direction:column;gap:12px;min-height:380px;color:var(--text,#f6f6f6)}" +
      ".sc-agent-status{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;border:1px solid var(--border,#343434);background:var(--card,#242424);border-radius:12px;padding:10px 12px;font-size:12px;color:var(--dim,#aaa)}" +
      ".sc-agent-chips{display:flex;gap:6px;flex-wrap:wrap}.sc-agent-chip{display:inline-flex;align-items:center;border:1px solid var(--border,#383838);border-radius:999px;padding:4px 8px;font-size:11px;color:var(--dim,#aaa)}.sc-agent-chip.ok{color:#83e5a0;border-color:#28633a}.sc-agent-chip.warn{color:#ffd27d;border-color:#725620}.sc-agent-chip.bad{color:#ff9e9e;border-color:#733838}" +
      ".sc-agent-intro{padding:14px;border:1px solid var(--border,#343434);border-radius:14px;background:linear-gradient(125deg,rgba(229,9,20,.08),rgba(255,255,255,.02));}.sc-agent-intro h3{margin:0 0 6px;font-size:17px}.sc-agent-intro p{margin:0;color:var(--dim,#aaa);font-size:12px;line-height:1.6}" +
      ".sc-agent-quick{display:flex;gap:7px;flex-wrap:wrap}.sc-agent-btn{border:1px solid var(--border,#414141);background:var(--card,#242424);color:var(--text,#fff);border-radius:9px;padding:9px 12px;font-size:12px;cursor:pointer;max-width:100%}.sc-agent-btn:hover{border-color:var(--red,#e50914)}.sc-agent-btn.primary{background:var(--red,#e50914);border-color:var(--red,#e50914);color:#fff;font-weight:700}.sc-agent-btn:disabled{opacity:.55;cursor:wait}.sc-agent-btn.ghost{background:transparent}" +
      ".sc-agent-thread{display:flex;flex-direction:column;gap:10px;min-height:140px;max-height:46vh;overflow:auto;padding:2px 1px 8px;scroll-behavior:smooth}" +
      ".sc-agent-msg{max-width:min(900px,96%);padding:12px 13px;border:1px solid var(--border,#343434);border-radius:13px;background:var(--card,#242424);font-size:13px;line-height:1.65;overflow-wrap:anywhere;white-space:pre-wrap}.sc-agent-msg.user{align-self:flex-end;background:rgba(229,9,20,.1);border-color:rgba(229,9,20,.35)}.sc-agent-msg.assistant{align-self:flex-start}.sc-agent-role{display:block;margin-bottom:4px;color:var(--dim,#aaa);font-size:10px;text-transform:uppercase;letter-spacing:.08em}" +
      ".sc-agent-proposal{border:1px solid var(--border,#464646);border-radius:14px;padding:12px;background:var(--panel,#181818);display:flex;flex-direction:column;gap:10px}.sc-agent-proposal h4{margin:0;font-size:14px}.sc-agent-proposal p{margin:0;font-size:12px;line-height:1.55;color:var(--dim,#aaa)}.sc-agent-file{border:1px solid var(--border,#343434);border-radius:10px;overflow:hidden}.sc-agent-file summary{padding:9px 10px;cursor:pointer;font-size:12px;font-weight:700;overflow-wrap:anywhere;background:var(--card,#242424)}.sc-agent-diff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:8px}.sc-agent-diff label{display:block;font-size:10px;color:var(--dim,#aaa);margin-bottom:4px}.sc-agent-diff pre{margin:0;padding:8px;border-radius:7px;background:#101010;color:#ddd;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}.sc-agent-actions{display:flex;gap:8px;flex-wrap:wrap}.sc-agent-compose{position:sticky;bottom:0;z-index:2;border:1px solid var(--border,#464646);border-radius:13px;padding:9px;background:var(--panel,#181818);display:flex;flex-direction:column;gap:8px}.sc-agent-compose textarea{width:100%;min-height:76px;max-height:200px;resize:vertical;background:var(--bg,#141414);border:1px solid var(--border,#414141);border-radius:9px;padding:10px;color:var(--text,#fff);font:inherit;font-size:13px;line-height:1.5;outline-offset:2px}.sc-agent-compose textarea:focus{border-color:var(--red,#e50914)}.sc-agent-compose-foot{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}.sc-agent-hint{font-size:10px;line-height:1.5;color:var(--dim,#999)}.sc-agent-error{color:#ff9e9e;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.sc-agent-test-list{margin:0;padding-left:18px;color:var(--dim,#aaa);font-size:11px;line-height:1.6}" +
      "@media(max-width:560px){.sc-agent-thread{max-height:42vh}.sc-agent-diff{grid-template-columns:minmax(0,1fr)}.sc-agent-msg{max-width:100%}.sc-agent-status{align-items:flex-start}.sc-agent-compose textarea{min-height:88px}.sc-agent-btn{padding:9px 10px}}";
    document.head.appendChild(s);
  }
  function scrollBottom() { if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight; }
  function message(role, text) {
    if (!messagesBox) return;
    var m = el("div", { className: "sc-agent-msg " + role });
    m.appendChild(el("span", { className: "sc-agent-role", text: role === "user" ? "You" : "StreamCloud AI" }));
    m.appendChild(el("div", { text: String(text || "") }));
    messagesBox.appendChild(m);
    scrollBottom();
    return m;
  }
  function setBusy(value) {
    busy = !!value;
    if (sendButton) sendButton.disabled = busy;
    if (planButton) planButton.disabled = busy;
    if (inputBox) inputBox.disabled = busy;
    if (sendButton) sendButton.textContent = busy ? "Working…" : "Send";
    if (planButton) planButton.textContent = busy ? "Preparing…" : "Plan changes";
  }
  function setStatus(text, kind) {
    if (!statusLine) return;
    statusLine.textContent = text;
    statusLine.className = "sc-agent-chip " + (kind || "");
  }
  function renderStatus(data) {
    if (!uiRoot) return;
    var chips = uiRoot.querySelector(".sc-agent-status-chips");
    if (!chips) return;
    chips.textContent = "";
    var gh = data && data.github || {};
    var ai = data && data.ai || {};
    var sb = data && data.supabase || {};
    var githubText = !gh.configured ? "GitHub token missing" : !gh.connected ? "GitHub disconnected" : gh.canPush ? "GitHub write enabled" : "GitHub read-only";
    chips.appendChild(el("span", { className: "sc-agent-chip " + (gh.canPush ? "ok" : "warn"), text: githubText }));
    chips.appendChild(el("span", { className: "sc-agent-chip " + ((ai.enabled || []).length ? "ok" : "bad"), text: (ai.enabled || []).length ? "AI: " + ai.enabled.join(", ") : "No enabled AI provider" }));
    chips.appendChild(el("span", { className: "sc-agent-chip " + (sb.managementApiConfigured ? "ok" : "warn"), text: sb.managementApiConfigured ? "Supabase auto-deploy ready" : "Supabase auto-deploy secret needed" }));
    var hint = uiRoot.querySelector(".sc-agent-management-hint");
    if (hint) {
      hint.textContent = sb.managementApiConfigured
        ? "Agent can try to deploy changed Edge Functions and run new SQL migrations after a reviewed GitHub commit. The result will be shown per target."
        : "To enable direct backend deploys, add SC_SUPABASE_MANAGEMENT_TOKEN in Supabase Edge Function Secrets with edge_functions:write and database:write scopes. Until then it can commit code to GitHub, but backend deploys/migrations may be skipped.";
    }
    var repoHint = uiRoot.querySelector(".sc-agent-repo-hint");
    if (repoHint) repoHint.textContent = "Repository: " + (gh.repo || "mahimahfud-ui/StreamCloud") + " · Branch: " + (gh.branch || "main");
  }
  function statusRefresh() {
    setStatus("Checking connections…", "");
    return request("status").then(function (data) {
      statusData = data; renderStatus(data);
      if (statusLine) setStatus(data.github && data.github.connected ? "Connected" : "Connection needs attention", data.github && data.github.connected && data.github.canPush ? "ok" : "warn");
      return data;
    }).catch(function (e) {
      setStatus("Status unavailable", "bad");
      showError(e.message);
      throw e;
    });
  }
  function showError(text) {
    if (!uiRoot) return;
    var old = uiRoot.querySelector(".sc-agent-error");
    if (!old) { old = el("div", { className: "sc-agent-error", role: "alert" }); var area=uiRoot.querySelector(".sc-agent-thread"); if(area) area.appendChild(old); }
    old.textContent = text || "";
    scrollBottom();
  }
  function clearError() { if (!uiRoot) return; var n=uiRoot.querySelector(".sc-agent-error"); if(n)n.remove(); }
  function appendProposal(p) {
    if (!messagesBox || !p) return;
    activeProposal = p;
    var card = el("section", { className: "sc-agent-proposal" });
    card.appendChild(el("h4", { text: p.summary || "Proposed changes" }));
    card.appendChild(el("p", { text: "Risk: " + String(p.risk || "medium").toUpperCase() + " · Status: " + String(p.status || "pending") }));
    if (p.explanation) card.appendChild(el("p", { text: p.explanation }));
    (p.files || []).forEach(function (f) {
      var details = el("details", { className: "sc-agent-file", open: false });
      details.appendChild(el("summary", { text: (f.created ? "＋ " : "✎ ") + f.path + " · " + (f.operationCount || (f.previews || []).length) + " operation(s)" }));
      (f.previews || []).forEach(function (d) {
        var diff = el("div", { className: "sc-agent-diff" });
        var before = el("div", {}); before.appendChild(el("label", { text: "BEFORE" })); before.appendChild(el("pre", { text: d.before || "(new file)" }));
        var after = el("div", {}); after.appendChild(el("label", { text: "AFTER" })); after.appendChild(el("pre", { text: d.after || "(empty)" }));
        diff.appendChild(before); diff.appendChild(after); details.appendChild(diff);
      });
      card.appendChild(details);
    });
    if (p.tests && p.tests.length) {
      card.appendChild(el("p", { text: "Suggested checks" }));
      var list = el("ul", { className: "sc-agent-test-list" });
      p.tests.forEach(function (t) { list.appendChild(el("li", { text: t })); });
      card.appendChild(list);
    }
    var buttons = el("div", { className: "sc-agent-actions" });
    if (p.status === "pending") {
      buttons.appendChild(el("button", { className: "sc-agent-btn primary", type: "button", text: "Apply changes", onclick: function () { applyProposal(p); } }));
      buttons.appendChild(el("button", { className: "sc-agent-btn ghost", type: "button", text: "Discard plan", onclick: function () { rejectProposal(p); } }));
    }
    if (p.appliedCommitSha) {
      var link = el("a", { className: "sc-agent-btn", href: "https://github.com/mahimahfud-ui/StreamCloud/commit/" + encodeURIComponent(p.appliedCommitSha), target: "_blank", rel: "noopener noreferrer", text: "Open GitHub commit ↗" });
      buttons.appendChild(link);
    }
    card.appendChild(buttons);
    if (Array.isArray(p.deploymentStatus) && p.deploymentStatus.length) {
      var deploys = el("div", {});
      deploys.appendChild(el("p", { text: "Backend deployment results" }));
      p.deploymentStatus.forEach(function (d) {
        deploys.appendChild(el("p", { text: String(d.target || "target") + ": " + String(d.status || "unknown") + (d.message ? " — " + d.message : "") }));
      });
      card.appendChild(deploys);
    }
    messagesBox.appendChild(card);
    scrollBottom();
  }
  function mountWorkspace() {
    addStyle();
    var tabs = document.querySelector(".scx-tabs");
    if (!tabs) return;
    var parent = tabs.parentElement;
    if (!parent) return;
    var title = document.getElementById("scxTitle");
    if (title) title.textContent = "StreamCloud AI Agent";
    while (parent.children.length > 1) parent.removeChild(parent.lastElementChild);
    uiRoot = el("section", { className: "sc-agent" });
    var status = el("div", { className: "sc-agent-status" });
    var left = el("div", {});
    left.appendChild(el("span", { className: "sc-agent-chip", text: "ADMIN AI AGENT" }));
    left.appendChild(el("div", { className: "sc-agent-repo-hint", text: "Repository: checking…" }));
    statusLine = el("span", { className: "sc-agent-chip", text: "Connecting…" });
    status.appendChild(left); status.appendChild(statusLine);
    var chips = el("div", { className: "sc-agent-chips sc-agent-status-chips" });
    var intro = el("div", { className: "sc-agent-intro" });
    intro.appendChild(el("h3", { text: "এক জায়গা থেকেই StreamCloud পরিচালনা করো" }));
    intro.appendChild(el("p", { text: "UI, frontend logic, Supabase Edge Functions, SQL migrations ও GitHub code change—বাংলায় নির্দেশ দাও। AI আগে patch plan ও preview তৈরি করবে; তুমি Apply চাপলে তবেই commit/deploy-এর চেষ্টা করবে। API keys browser-এ রাখা হয় না।" }));
    var hint = el("p", { className: "sc-agent-management-hint" });
    var quick = el("div", { className: "sc-agent-quick" });
    [
      ["Scan current setup", "Check the StreamCloud repository, Supabase function health, configured AI providers and deployment readiness. Do not modify any files."],
      ["Improve a feature", "Inspect the relevant StreamCloud files and propose a focused improvement. Preserve unrelated UI and behavior. Do not apply anything."],
      ["Fix an error", "Investigate the reported StreamCloud error from source context, identify the likely cause and propose a minimal tested fix. Preserve unrelated functionality."]
    ].forEach(function (q) {
      quick.appendChild(el("button", { className: "sc-agent-btn", type: "button", text: q[0], onclick: function () { if (inputBox) { inputBox.value = q[1]; inputBox.focus(); } } }));
    });
    var thread = el("div", { className: "sc-agent-thread", "aria-live": "polite", "aria-relevant": "additions" });
    messagesBox = thread;
    var compose = el("div", { className: "sc-agent-compose" });
    inputBox = el("textarea", { rows: "3", maxlength: "12000", placeholder: "উদাহরণ: Admin panel mobile-এ ঠিকমতো fit করো, অন্য design বা feature বদলাবে না…", "aria-label": "Ask StreamCloud AI Agent" });
    inputBox.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send("chat"); }
    });
    var foot = el("div", { className: "sc-agent-compose-foot" });
    foot.appendChild(el("span", { className: "sc-agent-hint", text: "Enter = send · Shift+Enter = newline · Plan changes only prepares a reviewable patch." }));
    var actions = el("div", { className: "sc-agent-actions" });
    sendButton = el("button", { className: "sc-agent-btn", type: "button", text: "Send", onclick: function () { send("chat"); } });
    planButton = el("button", { className: "sc-agent-btn primary", type: "button", text: "Plan changes", onclick: function () { send("plan"); } });
    actions.appendChild(sendButton); actions.appendChild(planButton);
    foot.appendChild(actions);
    compose.appendChild(inputBox); compose.appendChild(foot);
    var topActions = el("div", { className: "sc-agent-actions" });
    topActions.appendChild(el("button", { className: "sc-agent-btn ghost", type: "button", text: "New chat", onclick: function () {
      activeThread = ""; activeProposal = null;
      try { localStorage.removeItem(THREAD_KEY); } catch (e) {}
      messagesBox.textContent = ""; clearError();
      message("assistant", "নতুন কথোপকথন শুরু হয়েছে। কী পরিবর্তন করতে হবে লিখো।");
    } }));
    topActions.appendChild(el("button", { className: "sc-agent-btn ghost", type: "button", text: "Refresh status", onclick: function () { statusRefresh().catch(function () {}); } }));
    uiRoot.appendChild(status);
    uiRoot.appendChild(chips);
    uiRoot.appendChild(hint);
    uiRoot.appendChild(intro);
    uiRoot.appendChild(quick);
    uiRoot.appendChild(topActions);
    uiRoot.appendChild(thread);
    uiRoot.appendChild(compose);
    parent.appendChild(uiRoot);
    thread.appendChild(el("p", { className: "sc-agent-hint", text: "Loading saved conversation and checking your connected services…" }));
    statusRefresh().catch(function () {});
    loadHistory();
  }
  function loadHistory() {
    try { activeThread = localStorage.getItem(THREAD_KEY) || ""; } catch (e) { activeThread = ""; }
    if (!activeThread) {
      messagesBox.textContent = "";
      message("assistant", "আমি StreamCloud-এর code, UI ও backend পরিবর্তনের কাজ করতে পারি। প্রশ্ন করলে ব্যাখ্যা দেব; Plan changes চাপলে patch preview তৈরি করব। Apply changes ছাড়া GitHub source-এ কোনো পরিবর্তন push হবে না।");
      return;
    }
    request("history", { threadId: activeThread }).then(function (d) {
      messagesBox.textContent = "";
      (d.messages || []).forEach(function (m) { if (m.role === "user" || m.role === "assistant") message(m.role, m.content); });
      if (d.proposal) appendProposal(d.proposal);
      if (!(d.messages || []).length) message("assistant", "আগের কথোপকথন পাওয়া যায়নি। নতুন নির্দেশ দাও।");
    }).catch(function () {
      messagesBox.textContent = "";
      message("assistant", "আগের কথোপকথন লোড করা যায়নি। নতুন কাজ লিখে চেষ্টা করো।");
    });
  }
  function send(kind) {
    if (busy || !inputBox) return;
    var prompt = inputBox.value.trim();
    if (prompt.length < 2) { showError("কমপক্ষে ২টি অক্ষর লিখে তারপর Send বা Plan changes চাপো।"); inputBox.focus(); return; }
    if (prompt.length > 12000) { showError("একটি নির্দেশ 12,000 অক্ষরের মধ্যে রাখো।"); return; }
    clearError();
    message("user", prompt);
    inputBox.value = "";
    setBusy(true);
    var wait = message("assistant", kind === "plan" ? "Repository ও প্রাসঙ্গিক source পরীক্ষা করে safe patch preview তৈরি করছি…" : "তোমার নির্দেশ বুঝে উত্তর তৈরি করছি…");
    request(kind, { message: prompt, threadId: activeThread }).then(function (d) {
      if (d.threadId) {
        activeThread = d.threadId;
        try { localStorage.setItem(THREAD_KEY, activeThread); } catch (e) {}
      }
      if (wait && wait.parentNode) wait.remove();
      if (d.reply) message("assistant", d.reply);
      if (d.proposal) appendProposal(d.proposal);
      if (kind === "plan") statusRefresh().catch(function () {});
    }).catch(function (e) {
      if (wait && wait.parentNode) wait.remove();
      showError(e.message || "Agent request failed.");
      message("assistant", "কাজটি সম্পন্ন হয়নি। উপরের error দেখে configuration বা নির্দেশ ঠিক করে আবার চেষ্টা করো।");
    }).finally(function () { setBusy(false); scrollBottom(); });
  }
  function applyProposal(p) {
    if (busy) return;
    var ok = window.confirm("Apply this reviewed patch to the GitHub branch and run configured backend deployment steps?");
    if (!ok) return;
    var confirmedHighRisk = false;
    if (p.risk === "high") {
      var typed = window.prompt("High-risk backend/auth/database change. Type APPLY to confirm:");
      if (typed !== "APPLY") return;
      confirmedHighRisk = true;
    }
    clearError(); setBusy(true);
    var wait = message("assistant", "Review-approved patch GitHub-এ apply হচ্ছে; backend deployment configured থাকলে সেটাও চেষ্টা হবে…");
    request("apply", { proposalId: p.id, confirmedHighRisk: confirmedHighRisk }).then(function (d) {
      if (wait && wait.parentNode) wait.remove();
      message("assistant", d.reply || "Patch apply step returned.");
      if (d.commitUrl) message("assistant", "GitHub commit: " + d.commitUrl);
      activeProposal = null;
      statusRefresh().catch(function () {});
      if (d.deployment && d.deployment.length) {
        appendProposal({ id:p.id, summary:p.summary, risk:p.risk, status:"applied", appliedCommitSha:d.commitSha, deploymentStatus:d.deployment, files:p.files });
      }
    }).catch(function (e) {
      if (wait && wait.parentNode) wait.remove();
      showError(e.message || "Could not apply patch.");
      message("assistant", "Apply সম্পন্ন হয়নি বা blocked হয়েছে। GitHub branch ও proposal status যাচাই করে তারপর আবার চেষ্টা করো।");
    }).finally(function () { setBusy(false); scrollBottom(); });
  }
  function rejectProposal(p) {
    if (busy || !window.confirm("Discard this pending patch? GitHub will not be changed.")) return;
    setBusy(true);
    request("reject", { proposalId: p.id }).then(function () {
      message("assistant", "Patch plan বাতিল করা হয়েছে। GitHub source পরিবর্তন করা হয়নি।");
      activeProposal = null;
    }).catch(function (e) { showError(e.message); }).finally(function () { setBusy(false); });
  }
  function addTab() {
    var nav = document.querySelector(".scx-tabs");
    if (!nav || nav.querySelector("[data-sc-agent-tab]")) return;
    var btn = el("button", {
      className: "scx-tab",
      type: "button",
      "data-sc-agent-tab": "true",
      "aria-label": "StreamCloud AI Agent",
      title: "Edit StreamCloud UI and backend using AI"
    }, [
      el("span", { className: "scx-nav-icon", "aria-hidden": "true", text: "✦" }),
      el("span", { className: "scx-nav-title", text: "StreamCloud AI" }),
      el("span", { className: "scx-nav-sub", text: "Code, UI and backend agent" })
    ]);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      Array.prototype.forEach.call(nav.querySelectorAll(".scx-tab"), function (n) { n.classList.toggle("on", n === btn); });
      mountWorkspace();
    });
    nav.appendChild(btn);
  }
  function observe() {
    addTab();
    if (!observer) {
      observer = new MutationObserver(function () { addTab(); });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-sc-agent-tab]") : null;
      if (t) return;
      if (e.target && e.target.closest && e.target.closest(".scx-tabs .scx-tab")) {
        uiRoot = null; messagesBox = null; statusLine = null; inputBox = null; sendButton = null; planButton = null;
      }
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe, { once: true });
  else observe();
})();