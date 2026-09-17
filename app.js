(function () {
  "use strict";

  var KEY_STORAGE = "wireDesk.openrouterKey";
  var HISTORY_STORAGE = "wireDesk.history";
  var HISTORY_MAX = 200;
  var currentController = null;

  var el = {
    headline: document.getElementById("f-headline"),
    source: document.getElementById("f-source"),
    context: document.getElementById("f-context"),
    btnGenerate: document.getElementById("btn-generate"),
    btnStop: document.getElementById("btn-stop"),
    statusLine: document.getElementById("status-line"),
    capNote: document.getElementById("capability-note"),
    outputEmpty: document.getElementById("output-empty"),
    outputFilled: document.getElementById("output-filled"),
    btnExample: document.getElementById("btn-example"),
    contextHint: document.getElementById("context-hint"),
    draftHeadline: document.getElementById("draft-headline"),
    draftSource: document.getElementById("draft-source"),
    threadContainer: document.getElementById("thread-container"),
    btnRegenerate: document.getElementById("btn-regenerate"),
    btnCopyAll: document.getElementById("btn-copy-all"),
    btnNew: document.getElementById("btn-new"),
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty"),
    btnSettings: document.getElementById("btn-settings"),
    settingsPanel: document.getElementById("settings-panel"),
    settingsKeyInput: document.getElementById("settings-key-input"),
    settingsKeyToggle: document.getElementById("settings-key-toggle"),
    settingsKeyForget: document.getElementById("settings-key-forget"),
    settingsClose: document.getElementById("settings-close"),
    draftSources: document.getElementById("draft-sources"),
    sourcesList: document.getElementById("sources-list")
  };

  // ---- HOUSE_STYLE / buildPrompt ----

  var HOUSE_STYLE = [
    "You write a Threads news account. Produce a Threads thread about the",
    "news story described below, following these exact rules.",
    "",
    "OUTPUT SHAPE",
    "- 3 to 6 posts TOTAL, including the final source-link post.",
    "- Every post is strictly under 500 characters, INCLUDING its \"🧵 N/T\" suffix.",
    "- Every post except the final one ends with \"🧵 N/T\" (e.g. \"🧵 1/4\"), where T is the total post count.",
    "- The final post is ONLY: \"Read more: <source URL> 🧵 T/T\" — use the source URL given below;",
    "  if none was given, write \"Read more: [source link] 🧵 T/T\" as a placeholder.",
    "- No hashtags, no engagement bait, no rhetorical closers, no generic calls to action, no curiosity-gap phrasing.",
    "- Paragraph spacing inside a post is fine. Use bullets only when they genuinely clarify a compact list — never force them.",
    "",
    "VOICE",
    "- Calm, plain, informed narrator. Precise, not \"punchy AI\".",
    "- Post 1 leads with the most important verified fact and the immediate stakes — usually actor + concrete",
    "  action. If the fact comes from a leak, court filing, investigation, or FOIA document, attribute the outlet",
    "  or source inline. A modest bridge like \"Here is what we know so far\" or \"Here is what this means\" is fine",
    "  but only when it earns its place.",
    "- Later posts unfold progressively: explain the mechanism in plain language, give concrete scale or evidence,",
    "  identify the material catch/accountability gap/failure mode, state the consequence or current uncertainty.",
    "- Define necessary jargon inline. Use an everyday analogy only when it genuinely clarifies the mechanism —",
    "  never mandatory.",
    "- Preserve evidentiary status precisely: a proposal is not a law, a patent is not a product, an allegation is",
    "  not a finding, disputed documents remain disputed. Never manufacture certainty, hypocrisy, a privacy danger,",
    "  a hidden catch, or an everyday-user consequence just to fit the template.",
    "- Apply privacy, civil-liberties, overreach, or systemic-failure lenses only when the story actually supports",
    "  and needs them. Otherwise just explain the real mechanism and stakes.",
    "- Prefer concrete actors, dates, thresholds, amounts, documents, and consequences. Credit the original outlet",
    "  at least once where it did original reporting.",
    "- Avoid fake \"practitioner insight\", hype, moralising, and stock phrases like \"the terrifying reality\",",
    "  \"here's the wild part\", \"what nobody is telling you\", \"changes everything\", \"you won't believe\",",
    "  \"let that sink in\".",
    "- Natural connective language (\"However\", \"The problem is\", \"This matters because\", \"Despite\", \"Now\") is",
    "  fine — don't force a repeated beat template.",
    "- Never use section labels like \"What happened:\". Never repeat the headline in different words across posts.",
    "",
    "SHAPE OF THE CONTENT POSTS (flexible — use only what the story needs)",
    "1. Verified event + stakes/caveat.",
    "2. Mechanism or institutional process.",
    "3. Concrete evidence/scale or a technically important detail.",
    "4. Material catch, accountability question, or uncertainty.",
    "5. Consequence or what happens next.",
    "A simple story may need only two content posts plus the link post; a complex story may need five plus it.",
    "",
    "RESEARCH FIRST",
    "A research brief has already been prepared for you below by a separate research pass that used live web",
    "search — trust it as your factual foundation rather than relying on memory. It states plainly when",
    "something could not be confirmed; if so, do not invent it — hedge or omit per the evidentiary care above.",
    "Note which outlet did the original reporting, from the brief, so you can credit it per the house style above."
  ].join("\n");

  var RESEARCH_INSTRUCTIONS = [
    "You are a careful news researcher with live web search. Investigate the story described below as",
    "thoroughly as it needs — search more than once if the first results don't cover something important",
    "(a name, a figure, the outlet that broke it, a rebuttal from the other side, etc).",
    "",
    "Then write a plain-text research brief with exactly these six labeled sections, in this order:",
    "",
    "WHO:",
    "WHAT:",
    "WHEN & WHERE:",
    "HOW:",
    "WHY:",
    "CONTEXT (why it matters, background, what happens next):",
    "",
    "Rules:",
    "- State only what your search results actually support. If something important isn't confirmed by what",
    "  you found, say so explicitly in that section (e.g. \"Not confirmed by available sources\") instead of",
    "  guessing or inventing.",
    "- Name the outlet(s) that did the original reporting, in the WHO or WHAT section.",
    "- Keep it factual and neutral — this is raw research material for someone else to write from, not the",
    "  finished piece. Do not draft any social media post or thread here."
  ].join("\n");

  // Kept as system + user, not one big user message: the OpenRouter web plugin's
  // non-native search engines (Exa/Perplexity/etc.) search on the last user message
  // verbatim as the query. A single message mixing house-style instructions with the
  // story buries the actual headline under paragraphs of style rules, producing
  // generic/irrelevant search results instead of ones about the story.
  function buildSystemPrompt() {
    return HOUSE_STYLE +
      "\n\nOUTPUT FORMAT\n" +
      "Your reply must be exactly one JSON object and nothing else — no narration, no markdown code fence: " +
      "{\"posts\": [\"...\", \"...\"]} — one string per post, each already including its \"🧵 N/T\" suffix (or the " +
      "final \"Read more\" line), in posting order.";
  }

  function buildUserPrompt(headline, sourceUrl, context) {
    var today = new Date().toISOString().slice(0, 10);
    return "TODAY'S DATE: " + today +
      "\n\nSTORY\nHeadline: " + headline +
      "\nSource URL: " + (sourceUrl || "(none given)") +
      "\nKnown facts / excerpts supplied by the editor (may be empty):\n" + (context || "(none given)");
  }

  function buildDraftUserPrompt(brief, headline, sourceUrl) {
    return "RESEARCH BRIEF (already verified via live web search):\n" + brief +
      "\n\nOriginal headline: " + headline +
      "\nSource URL: " + (sourceUrl || "(none given)") +
      "\n\nWrite the Threads thread now, following the house style above. Do not repeat the brief's section " +
      "labels (WHO/WHAT/etc.) in the actual posts — write flowing prose per the voice rules.";
  }

  // ---- parsing ----

  function charLen(s) {
    return Array.from(s).length;
  }

  function normalizePosts(raw) {
    var arr = null;
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (raw && typeof raw === "object") {
      var candidateKeys = ["posts", "thread", "result", "output", "drafts", "items"];
      for (var i = 0; i < candidateKeys.length; i++) {
        if (Array.isArray(raw[candidateKeys[i]])) { arr = raw[candidateKeys[i]]; break; }
      }
      if (!arr) {
        var vals = Object.keys(raw).map(function (k) { return raw[k]; });
        var firstArr = vals.filter(function (v) { return Array.isArray(v); })[0];
        if (firstArr) arr = firstArr;
      }
    }
    if (!arr) return null;
    var posts = arr.map(function (p) {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") {
        var v = p.text || p.post || p.content || p.body;
        if (typeof v === "string") return v;
      }
      return null;
    });
    if (posts.length < 2 || posts.length > 6) return null;
    if (!posts.every(function (p) { return typeof p === "string" && p.trim().length; })) return null;
    return posts.map(function (p) { return p.trim(); });
  }

  function lenientParse(text) {
    if (typeof text !== "string") return null;
    var start = text.indexOf("[");
    var end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      return null;
    }
  }

  // ---- settings (localStorage key mgmt) ----

  function getApiKey() {
    try { return localStorage.getItem(KEY_STORAGE) || ""; } catch (e) { return ""; }
  }
  function setApiKey(key) {
    try {
      if (key) localStorage.setItem(KEY_STORAGE, key);
      else localStorage.removeItem(KEY_STORAGE);
    } catch (e) {}
  }
  function refreshGenerateGate() {
    var hasKey = !!getApiKey();
    el.btnGenerate.disabled = !hasKey;
    el.capNote.hidden = hasKey;
    if (!hasKey) {
      el.capNote.innerHTML = "<strong>No OpenRouter key set.</strong> Open Settings (⚙) and paste your OpenRouter API key to enable drafting.";
    }
  }
  function openSettings() {
    el.settingsKeyInput.value = getApiKey();
    el.settingsPanel.hidden = false;
  }
  function closeSettings() {
    el.settingsPanel.hidden = true;
    refreshGenerateGate();
  }

  // ---- OpenRouter call ----

  function errorCopy(e) {
    if (e && e.name === "AbortError") return "Stopped.";
    var status = e && e.status;
    if (status === 401) return "OpenRouter rejected that key — check it in Settings.";
    if (status === 429) return "Rate limited by OpenRouter — wait a moment and try again.";
    if (status === 402) return "OpenRouter account is out of credit.";
    if (e && e.code === "invalid_json") return "That draft didn't come back clean — try Regenerate.";
    if (e && e.code === "network") return "Couldn't reach OpenRouter — check your connection and try again.";
    return "Something went wrong — try again.";
  }

  async function postChatCompletion(body, signal) {
    var apiKey = getApiKey();
    var res;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
          "X-Title": "Wire Desk"
        },
        body: JSON.stringify(body),
        signal: signal
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw { code: "network" };
    }
    if (!res.ok) {
      var err = new Error("OpenRouter error " + res.status);
      err.status = res.status;
      throw err;
    }
    var data = await res.json();
    var message = data.choices && data.choices[0] && data.choices[0].message;
    var content = message && message.content;
    if (typeof content !== "string" || !content.trim()) throw { code: "invalid_json" };
    return { content: content, annotations: (message && message.annotations) || [] };
  }

  // Citations come back as OpenAI-style url_citation annotations, standardized by
  // OpenRouter across engines. Dedupe by URL since one source can be cited for
  // several spans in the response.
  function sourcesFromAnnotations(annotations) {
    var seen = {};
    var sources = [];
    (annotations || []).forEach(function (a) {
      var c = a && a.url_citation;
      if (!c || !c.url || seen[c.url]) return;
      seen[c.url] = true;
      sources.push({ url: c.url, title: c.title || c.url });
    });
    return sources;
  }

  // Stage 1: a research-capable model with real (multi-query, model-driven) native web
  // search does the actual investigating and writes a plain-text brief. Stage 2 (GLM,
  // no search) only ever sees that brief — separating "find the facts" from "write in
  // voice" so neither task competes with the other in one pass.
  async function runResearch(headline, sourceUrl, context, signal) {
    var body = {
      models: ["google/gemini-3.8-flash", "anthropic/claude-sonnet-5"],
      messages: [
        { role: "system", content: RESEARCH_INSTRUCTIONS },
        { role: "user", content: buildUserPrompt(headline, sourceUrl, context) }
      ],
      plugins: [{ id: "web" }],
      web_search_options: { search_context_size: "high" },
      reasoning: { effort: "high" }
    };
    var result = await postChatCompletion(body, signal);
    return { brief: result.content.trim(), sources: sourcesFromAnnotations(result.annotations) };
  }

  async function runDraft(brief, headline, sourceUrl, signal) {
    var body = {
      model: "z-ai/glm-5.3-flash",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildDraftUserPrompt(brief, headline, sourceUrl) }
      ],
      response_format: { type: "json_object" },
      reasoning: { effort: "high" }
    };
    var result = await postChatCompletion(body, signal);
    var content = result.content;
    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = lenientParse(content);
    }
    if (parsed == null) throw { code: "invalid_json" };
    return parsed;
  }

  // ---- generation flow / rendering ----

  function setStatus(text, isError) {
    el.statusLine.textContent = text || "";
    el.statusLine.classList.toggle("error", !!isError);
  }
  function setGenerating(on) {
    el.btnGenerate.disabled = on || !getApiKey();
    el.btnStop.hidden = !on;
    if (el.btnRegenerate) el.btnRegenerate.disabled = on;
  }
  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = (ta.scrollHeight + 2) + "px";
  }

  function fillSourcesList(ulEl, sources) {
    ulEl.innerHTML = "";
    (sources || []).forEach(function (s) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = s.title || s.url;
      li.appendChild(a);
      ulEl.appendChild(li);
    });
  }

  function renderThread(entry) {
    el.outputEmpty.hidden = true;
    el.outputFilled.hidden = false;
    el.draftHeadline.textContent = entry.headline;
    el.draftSource.textContent = entry.sourceUrl || "";
    el.threadContainer.innerHTML = "";
    var sources = entry.sources || [];
    el.draftSources.hidden = !sources.length;
    fillSourcesList(el.sourcesList, sources);
    var total = entry.posts.length;
    entry.posts.forEach(function (postText, i) {
      var post = document.createElement("div");
      post.className = "post";
      var badge = document.createElement("div");
      badge.className = "post-badge";
      badge.textContent = (i + 1) + "/" + total;
      post.appendChild(badge);
      var box = document.createElement("div");
      box.className = "post-box";
      var ta = document.createElement("textarea");
      ta.value = postText;
      ta.rows = 2;
      box.appendChild(ta);
      var foot = document.createElement("div");
      foot.className = "post-foot";
      var count = document.createElement("span");
      count.className = "char-count";
      foot.appendChild(count);
      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "icon-btn";
      copyBtn.textContent = "Copy";
      foot.appendChild(copyBtn);
      box.appendChild(foot);
      post.appendChild(box);
      el.threadContainer.appendChild(post);

      function updateCount() {
        var n = charLen(ta.value);
        count.textContent = n + " / 500";
        count.classList.toggle("warn", n >= 450 && n < 500);
        count.classList.toggle("over", n >= 500);
      }
      ta.addEventListener("input", function () { autoGrow(ta); updateCount(); });
      requestAnimationFrame(function () { autoGrow(ta); updateCount(); });
      copyBtn.addEventListener("click", function () { copyText(ta.value, copyBtn); });
    });
  }

  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("copied");
      setTimeout(function () { btn.textContent = original; btn.classList.remove("copied"); }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  function currentThreadTexts() {
    var areas = el.threadContainer.querySelectorAll("textarea");
    return Array.prototype.map.call(areas, function (a) { return a.value; });
  }

  async function handleGenerate(regenerate) {
    var headline = el.headline.value.trim();
    var sourceUrl = el.source.value.trim();
    var context = el.context.value.trim();
    if (!headline) { setStatus("Add a headline first.", true); el.headline.focus(); return; }
    if (!getApiKey()) { setStatus("Add your OpenRouter key in Settings (⚙) first.", true); return; }

    setGenerating(true);
    currentController = new AbortController();
    setStatus(regenerate ? "Re-researching…" : "Researching…");

    try {
      var research = await runResearch(headline, sourceUrl, context, currentController.signal);
      setStatus("Drafting…");
      var raw = await runDraft(research.brief, headline, sourceUrl, currentController.signal);
      var posts = normalizePosts(raw);
      if (!posts) throw { code: "invalid_json" };
      var entry = { headline: headline, sourceUrl: sourceUrl, context: context, posts: posts, sources: research.sources, createdAt: new Date().toISOString() };
      renderThread(entry);
      setStatus("Drafted " + posts.length + " posts.");
      saveToHistory(entry);
    } catch (e) {
      setStatus(errorCopy(e), true);
    } finally {
      currentController = null;
      setGenerating(false);
    }
  }
  function handleStop() { if (currentController) currentController.abort(); }
  function handleRegenerate() { handleGenerate(true); }
  function handleNewDraft() {
    el.headline.value = ""; el.source.value = ""; el.context.value = "";
    el.outputFilled.hidden = true; el.outputEmpty.hidden = false;
    setStatus(""); el.headline.focus();
  }
  function handleCopyAll() { copyText(currentThreadTexts().join("\n\n"), el.btnCopyAll); }
  function handleExample() {
    el.headline.value = "A regional water utility is fined after sewage discharge data was found inconsistent with permit records";
    el.source.value = "";
    el.context.value = "Example only — illustrates the format. Replace with a real headline and, ideally, a link or known facts.";
    handleGenerate(false);
  }

  // ---- history (localStorage) ----

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_STORAGE);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeHistory(arr) {
    try { localStorage.setItem(HISTORY_STORAGE, JSON.stringify(arr.slice(0, HISTORY_MAX))); } catch (e) {}
  }
  function saveToHistory(entry) {
    var arr = loadHistory();
    var withId = { id: "d" + Date.now() + Math.random().toString(36).slice(2, 8), headline: entry.headline, sourceUrl: entry.sourceUrl || "", context: entry.context || "", posts: entry.posts, sources: entry.sources || [], createdAt: entry.createdAt };
    arr.unshift(withId);
    writeHistory(arr);
    renderHistory(loadHistory());
  }
  function deleteHistoryEntry(id) {
    var arr = loadHistory().filter(function (d) { return d.id !== id; });
    writeHistory(arr);
    renderHistory(arr);
  }
  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " +
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function renderHistory(docs) {
    el.historyList.innerHTML = "";
    if (!docs.length) {
      el.historyEmpty.hidden = false;
      el.historyList.appendChild(el.historyEmpty);
      return;
    }
    el.historyEmpty.hidden = true;
    docs.forEach(function (data) {
      var item = document.createElement("div");
      item.className = "history-item";
      var row = document.createElement("div");
      row.className = "history-row";
      var main = document.createElement("div");
      main.className = "history-row-main";
      var h = document.createElement("div");
      h.className = "history-headline";
      h.textContent = data.headline || "(untitled)";
      var sub = document.createElement("div");
      sub.className = "history-sub";
      sub.textContent = fmtDate(data.createdAt) + " · " + ((data.posts && data.posts.length) || 0) + " posts";
      main.appendChild(h); main.appendChild(sub);
      var chevron = document.createElement("span");
      chevron.className = "history-chevron";
      chevron.textContent = "View";
      row.appendChild(main); row.appendChild(chevron);
      var body = document.createElement("div");
      body.className = "history-body";
      body.hidden = true;
      row.addEventListener("click", function () {
        var willShow = body.hidden;
        body.hidden = !willShow;
        chevron.textContent = willShow ? "Hide" : "View";
        if (willShow && !body.dataset.built) {
          buildHistoryBody(body, data);
          body.dataset.built = "1";
        }
      });
      item.appendChild(row); item.appendChild(body);
      el.historyList.appendChild(item);
    });
  }
  function buildHistoryBody(body, data) {
    var thread = document.createElement("div");
    thread.className = "thread";
    var total = (data.posts || []).length;
    (data.posts || []).forEach(function (postText, i) {
      var post = document.createElement("div");
      post.className = "post";
      var badge = document.createElement("div");
      badge.className = "post-badge";
      badge.textContent = (i + 1) + "/" + total;
      post.appendChild(badge);
      var box = document.createElement("div");
      box.className = "post-box";
      var txt = document.createElement("div");
      txt.className = "history-post-text";
      txt.textContent = postText;
      box.appendChild(txt);
      var foot = document.createElement("div");
      foot.className = "post-foot";
      foot.appendChild(document.createElement("span"));
      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "icon-btn";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", function () { copyText(postText, copyBtn); });
      foot.appendChild(copyBtn);
      box.appendChild(foot);
      post.appendChild(box);
      thread.appendChild(post);
    });
    body.appendChild(thread);

    var footer = document.createElement("div");
    footer.className = "history-footer";
    var copyAllBtn = document.createElement("button");
    copyAllBtn.type = "button";
    copyAllBtn.className = "btn-ghost";
    copyAllBtn.textContent = "Copy full thread";
    copyAllBtn.addEventListener("click", function () { copyText((data.posts || []).join("\n\n"), copyAllBtn); });
    footer.appendChild(copyAllBtn);

    var confirmWrap = document.createElement("div");
    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-danger-outline";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      confirmWrap.innerHTML = "";
      var wrap = document.createElement("span");
      wrap.className = "confirm-delete";
      wrap.textContent = "Delete this draft? ";
      var yes = document.createElement("button");
      yes.type = "button"; yes.className = "icon-btn"; yes.textContent = "Delete";
      yes.addEventListener("click", function () { deleteHistoryEntry(data.id); });
      var no = document.createElement("button");
      no.type = "button"; no.className = "icon-btn"; no.textContent = "Cancel";
      no.addEventListener("click", function () { confirmWrap.innerHTML = ""; confirmWrap.appendChild(deleteBtn); });
      wrap.appendChild(yes); wrap.appendChild(no);
      confirmWrap.appendChild(wrap);
    });
    confirmWrap.appendChild(deleteBtn);
    footer.appendChild(confirmWrap);
    body.appendChild(footer);

    if (data.sources && data.sources.length) {
      var sourcesBox = document.createElement("div");
      sourcesBox.className = "draft-sources";
      var label = document.createElement("p");
      label.className = "section-label";
      label.textContent = "Sources";
      sourcesBox.appendChild(label);
      var ul = document.createElement("ul");
      ul.className = "sources-list";
      fillSourcesList(ul, data.sources);
      sourcesBox.appendChild(ul);
      body.appendChild(sourcesBox);
    }
  }

  // ---- init ----

  el.btnSettings.addEventListener("click", openSettings);
  el.settingsClose.addEventListener("click", closeSettings);
  el.settingsKeyInput.addEventListener("input", function () { setApiKey(el.settingsKeyInput.value.trim()); });
  el.settingsKeyToggle.addEventListener("click", function () {
    var isPassword = el.settingsKeyInput.type === "password";
    el.settingsKeyInput.type = isPassword ? "text" : "password";
    el.settingsKeyToggle.textContent = isPassword ? "Hide" : "Show";
  });
  el.settingsKeyForget.addEventListener("click", function () {
    setApiKey(""); el.settingsKeyInput.value = ""; refreshGenerateGate();
  });
  el.btnGenerate.addEventListener("click", function () { handleGenerate(false); });
  el.btnStop.addEventListener("click", handleStop);
  el.btnRegenerate.addEventListener("click", handleRegenerate);
  el.btnNew.addEventListener("click", handleNewDraft);
  el.btnCopyAll.addEventListener("click", handleCopyAll);
  el.btnExample.addEventListener("click", handleExample);
  el.context.addEventListener("input", function () { autoGrow(el.context); });

  refreshGenerateGate();
  if (el.contextHint) {
    el.contextHint.textContent = "A research pass (Gemini, live web search) runs before drafting (GLM). Add anything extra you want it to prioritize.";
  }
  renderHistory(loadHistory());
})();
