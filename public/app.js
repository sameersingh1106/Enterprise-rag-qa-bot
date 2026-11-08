const form = document.querySelector("#ask-form");
const questionInput = document.querySelector("#question");
const askButton = document.querySelector("#ask-button");
const message = document.querySelector("#message");
const result = document.querySelector("#result");
const welcomeCard = document.querySelector("#welcome-card");
const views = ["ask", "documents", "evaluations", "settings"];
const titles = { ask: "Ask documents", documents: "Documents", evaluations: "Evaluations", settings: "Settings" };
let topK = readTopK();

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    questionInput.value = button.textContent;
    questionInput.focus();
  });
});

document.querySelector("#menu-toggle").addEventListener("click", () => {
  document.querySelector("#sidebar").classList.toggle("open");
});

const workspaceToggle = document.querySelector("#workspace-toggle");
const workspaceMenu = document.querySelector("#workspace-menu");
function setWorkspaceMenu(open) {
  workspaceMenu.hidden = !open;
  workspaceToggle.setAttribute("aria-expanded", String(open));
}
workspaceToggle.addEventListener("click", () => {
  setWorkspaceMenu(true);
});
document.querySelector(".workspace-menu-wrap").addEventListener("pointerenter", () => setWorkspaceMenu(true));
document.querySelector(".workspace-menu-wrap").addEventListener("pointerleave", () => {
  if (!document.querySelector(".workspace-menu-wrap").contains(document.activeElement)) setWorkspaceMenu(false);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".workspace-menu-wrap")) {
    setWorkspaceMenu(false);
  }
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

form.addEventListener("submit", ask);
questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

loadDocuments();

function readTopK() {
  const saved = Number.parseInt(localStorage.getItem("northstar-top-k") || "3", 10);
  return Number.isFinite(saved) ? Math.max(1, Math.min(saved, 10)) : 3;
}

function showView(name) {
  if (!views.includes(name)) return;
  views.forEach((view) => {
    document.querySelector(`#${view}-view`).hidden = view !== name;
    const nav = document.querySelector(`.primary-nav [data-view="${view}"]`);
    nav.classList.toggle("active", view === name);
    if (view === name) nav.setAttribute("aria-current", "page");
    else nav.removeAttribute("aria-current");
  });
  document.querySelector("#breadcrumb-title").textContent = titles[name];
  document.querySelector("#sidebar").classList.remove("open");
  setWorkspaceMenu(false);
  if (name === "documents") renderDocuments();
  if (name === "evaluations") renderEvaluations();
  if (name === "settings") renderSettings();
}

async function loadDocuments() {
  try {
    const response = await fetch("/api/documents");
    if (!response.ok) throw new Error("Could not load the document index.");
    const data = await response.json();
    const docs = data.documents || [];
    document.querySelector("#doc-count").textContent = String(docs.length).padStart(2, "0");
    const sidebar = document.querySelector("#sidebar-documents");
    sidebar.replaceChildren();
    if (!docs.length) {
      sidebar.innerHTML = '<div class="document-row"><div class="pdf-icon">PDF</div><div class="document-copy"><strong>No indexed documents</strong><span>Run the ingestion script first</span></div></div>';
      return;
    }
    docs.slice(0, 3).forEach((doc) => sidebar.append(makeDocumentRow(doc)));
  } catch (error) {
    document.querySelector("#sidebar-documents").textContent = error.message;
    document.querySelector("#doc-count").textContent = "—";
  }
}

function makeDocumentRow(doc) {
  const row = document.createElement("div");
  row.className = "document-row";
  const icon = document.createElement("div");
  icon.className = "pdf-icon";
  icon.textContent = "PDF";
  const copy = document.createElement("div");
  copy.className = "document-copy";
  const name = document.createElement("strong");
  name.textContent = doc.name;
  const count = document.createElement("span");
  count.textContent = `${doc.chunks} indexed passage${doc.chunks === 1 ? "" : "s"}`;
  const status = document.createElement("span");
  status.className = "doc-status";
  status.title = "Present in the vector index";
  status.textContent = "●";
  copy.append(name, count);
  row.append(icon, copy, status);
  return row;
}

async function renderDocuments() {
  const view = document.querySelector("#documents-view");
  view.innerHTML = '<div class="secondary-heading"><div><div class="overline">KNOWLEDGE BASE</div><h1>Documents</h1><p>Upload PDFs and manage the files available to the assistant.</p></div><button class="quiet-button" id="refresh-documents">↻ Refresh</button></div><div class="upload-panel" id="upload-panel"><input id="pdf-picker" type="file" accept="application/pdf,.pdf" hidden><div class="upload-glyph">↑</div><div class="upload-copy"><strong>Drop a PDF here, or <button type="button" id="choose-pdf" class="inline-button">browse files</button></strong><span>PDF files up to 20 MB. Duplicate filenames are rejected.</span></div><button type="button" id="upload-trigger" class="upload-button">＋ Add PDF</button></div><div id="upload-status" class="upload-status" role="status" aria-live="polite"></div><div class="upload-progress" id="upload-progress" hidden><div class="progress-track"><span id="progress-fill"></span></div><span id="progress-label">Uploading…</span></div><div class="stats-grid"><div class="stat-card"><span>Indexed files</span><strong id="total-files">—</strong></div><div class="stat-card"><span>Indexed passages</span><strong id="total-chunks">—</strong></div><div class="stat-card"><span>Index storage</span><strong>Local JSON</strong></div></div><div class="data-panel"><div class="data-panel-heading"><div><h2>Indexed documents</h2><p>Files represented in the current vector store.</p></div><span class="local-pill">LOCAL INDEX</span></div><div id="document-list" class="document-list"><div class="loading-state">Loading documents…</div></div></div><div class="info-banner"><span>ⓘ</span><p>Uploading a PDF extracts its text, creates embeddings, and adds the passages to your vector index. A filename can only be added once; rename the file if you need to upload a separate copy.</p></div>';
  view.querySelector("#refresh-documents").addEventListener("click", () => populateDocuments(view));
  const picker = view.querySelector("#pdf-picker");
  view.querySelector("#choose-pdf").addEventListener("click", () => picker.click());
  view.querySelector("#upload-trigger").addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    if (picker.files[0]) uploadPdf(view, picker.files[0]);
    picker.value = "";
  });
  const dropPanel = view.querySelector("#upload-panel");
  dropPanel.addEventListener("dragover", (event) => { event.preventDefault(); dropPanel.classList.add("dragging"); });
  dropPanel.addEventListener("dragleave", (event) => { if (!dropPanel.contains(event.relatedTarget)) dropPanel.classList.remove("dragging"); });
  dropPanel.addEventListener("drop", (event) => {
    event.preventDefault();
    dropPanel.classList.remove("dragging");
    const file = event.dataTransfer.files[0];
    if (file) uploadPdf(view, file);
  });
  await populateDocuments(view);
}

function uploadPdf(view, file) {
  const status = view.querySelector("#upload-status");
  const progress = view.querySelector("#upload-progress");
  const fill = view.querySelector("#progress-fill");
  const label = view.querySelector("#progress-label");
  const uploadButton = view.querySelector("#upload-trigger");
  status.className = "upload-status";
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    status.classList.add("error-text");
    status.textContent = "Choose a file with a .pdf extension.";
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    status.classList.add("error-text");
    status.textContent = "This file is larger than the 20 MB upload limit.";
    return;
  }
  uploadButton.disabled = true;
  status.textContent = "Uploading PDF…";
  progress.hidden = false;
  fill.style.width = "0%";
  label.textContent = "Uploading 0%";
  const request = new XMLHttpRequest();
  request.open("POST", "/api/documents/upload");
  request.setRequestHeader("Content-Type", "application/pdf");
  request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
  request.upload.addEventListener("progress", (event) => {
    if (!event.lengthComputable) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    fill.style.width = `${percent}%`;
    label.textContent = percent < 100 ? `Uploading ${percent}%` : "Upload complete · indexing PDF…";
    status.textContent = percent < 100 ? "Sending the PDF to your local server…" : "Generating embeddings and adding passages to the index…";
  });
  request.addEventListener("load", async () => {
    let data;
    try { data = JSON.parse(request.responseText); } catch { data = {}; }
    if (request.status < 200 || request.status >= 300) {
      status.className = "upload-status error-text";
      status.textContent = data.error || "Upload failed. Please try again.";
      progress.hidden = true;
      uploadButton.disabled = false;
      return;
    }
    fill.style.width = "100%";
    label.textContent = "Indexed";
    status.className = "upload-status success-text";
    status.textContent = `${data.filename} added to the index (${data.chunks} passages).`;
    await populateDocuments(view);
    await loadDocuments();
    uploadButton.disabled = false;
  });
  request.addEventListener("error", () => {
    status.className = "upload-status error-text";
    status.textContent = "Could not reach the server. Check that the app is running and try again.";
    progress.hidden = true;
    uploadButton.disabled = false;
  });
  request.send(file);
}

async function populateDocuments(view) {
  const list = view.querySelector("#document-list");
  list.textContent = "Loading documents…";
  try {
    const response = await fetch("/api/documents");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the index.");
    view.querySelector("#total-files").textContent = data.documents.length;
    view.querySelector("#total-chunks").textContent = data.totalChunks;
    list.replaceChildren();
    if (!data.documents.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-doc-icon">▤</div><strong>Your index is empty</strong><p>Run <code>node src/ingest.js</code> to add the sample PDF.</p></div>';
      return;
    }
    data.documents.forEach((doc) => {
      const row = makeDocumentRow(doc);
      row.classList.add("large-document-row");
      list.append(row);
    });
  } catch (error) {
    list.textContent = error.message;
    list.className = "document-list error-text";
  }
}

function renderEvaluations() {
  const view = document.querySelector("#evaluations-view");
  view.innerHTML = `<div class="secondary-heading"><div><div class="overline">RETRIEVAL QUALITY</div><h1>Evaluation workbench</h1><p>Inspect which passages your search retrieves for a question.</p></div><span class="local-pill">LIVE INDEX</span></div><div class="data-panel eval-panel"><div class="data-panel-heading"><div><h2>Run a retrieval check</h2><p>This checks search relevance without generating an answer.</p></div></div><form id="eval-form" class="eval-form"><label for="eval-question">Test question</label><textarea id="eval-question" rows="2" maxlength="2000" placeholder="For example: What are the key financial risks?" required></textarea><div class="eval-controls"><span>Returns the top ${topK} matching passages from your index.</span><button id="eval-submit" type="submit">Run evaluation <span>↗</span></button></div></form><div id="eval-message" class="inline-message" role="status"></div><div id="eval-results" class="eval-results"></div></div><div class="info-banner"><span>ⓘ</span><p>This first evaluation view exposes retrieval results and similarity scores. A benchmark with expected answers and citation scoring can be added as the next evaluation milestone.</p></div>`;
  view.querySelector("#eval-form").addEventListener("submit", runEvaluation);
}

async function runEvaluation(event) {
  event.preventDefault();
  const view = document.querySelector("#evaluations-view");
  const question = view.querySelector("#eval-question").value.trim();
  const button = view.querySelector("#eval-submit");
  const status = view.querySelector("#eval-message");
  const results = view.querySelector("#eval-results");
  button.disabled = true;
  button.textContent = "Searching…";
  status.className = "inline-message";
  status.textContent = "Embedding the question and ranking indexed passages…";
  results.replaceChildren();
  try {
    const response = await fetch("/api/retrieve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, topK }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Evaluation failed.");
    status.textContent = `Retrieved ${data.results.length} passage${data.results.length === 1 ? "" : "s"}. Review whether these contain evidence relevant to your question.`;
    if (!data.results.length) results.innerHTML = '<div class="empty-state">No passages were returned.</div>';
    data.results.forEach((record, index) => {
      const card = document.createElement("article");
      card.className = "eval-result-card";
      const heading = document.createElement("div");
      heading.className = "eval-result-head";
      const rank = document.createElement("strong");
      rank.textContent = `Result ${index + 1} · Chunk ${record.id}`;
      const score = document.createElement("span");
      score.textContent = `${(record.score * 100).toFixed(1)}% similarity`;
      heading.append(rank, score);
      const text = document.createElement("p");
      text.textContent = record.text;
      card.append(heading, text);
      results.append(card);
    });
  } catch (error) {
    status.className = "inline-message error-text";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Run evaluation <span>↗</span>';
  }
}

function renderSettings() {
  const view = document.querySelector("#settings-view");
  view.innerHTML = `<div class="secondary-heading"><div><div class="overline">PREFERENCES</div><h1>Settings</h1><p>Adjust how the assistant searches your indexed content.</p></div></div><div class="data-panel settings-panel"><div class="data-panel-heading"><div><h2>Retrieval</h2><p>Choose how many passages are used to prepare each answer.</p></div></div><form id="settings-form" class="settings-form"><label for="top-k">Passages per answer</label><select id="top-k">${[1, 2, 3, 4, 5, 6, 8, 10].map((n) => `<option value="${n}" ${n === topK ? "selected" : ""}>${n} passage${n === 1 ? "" : "s"}</option>`).join("")}</select><p class="setting-help">More passages can provide broader context, but may add less relevant text to the model prompt.</p><button type="submit" class="settings-save">Save settings</button><span id="settings-saved" class="saved-note" role="status"></span></form></div><div class="data-panel settings-panel"><div class="data-panel-heading"><div><h2>About this workspace</h2><p>Configuration is stored in this browser for this local demo.</p></div></div><div class="about-row"><span>Answer model</span><strong>Configured in server</strong></div><div class="about-row"><span>Vector index</span><strong>data/vector-store.json</strong></div><div class="about-row"><span>API server</span><strong>Same origin</strong></div></div>`;
  view.querySelector("#settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    topK = Number(view.querySelector("#top-k").value);
    localStorage.setItem("northstar-top-k", String(topK));
    view.querySelector("#settings-saved").textContent = "Saved";
    setTimeout(() => {
      const note = view.querySelector("#settings-saved");
      if (note) note.textContent = "";
    }, 2200);
  });
}

async function ask(event) {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  askButton.disabled = true;
  askButton.querySelector(".button-label").textContent = "Thinking…";
  message.className = "message";
  message.textContent = "Searching your indexed documents and preparing an answer…";
  result.hidden = true;
  welcomeCard.hidden = true;
  try {
    const response = await fetch("/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, topK }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    document.querySelector("#asked-question").textContent = question;
    document.querySelector("#answer").textContent = data.answer;
    const sources = document.querySelector("#sources");
    sources.replaceChildren();
    for (const [index, source] of (data.sources || []).entries()) {
      const card = document.createElement("article");
      card.className = "source";
      const meta = document.createElement("div");
      meta.className = "source-meta";
      const label = document.createElement("span");
      label.textContent = `Source ${index + 1} · Chunk ${source.id}`;
      const score = document.createElement("span");
      score.textContent = `${Math.round((source.score || 0) * 100)}% match`;
      meta.append(label, score);
      const text = document.createElement("div");
      text.className = "source-text";
      text.textContent = source.text || source.preview || "Source text unavailable.";
      card.append(meta, text);
      sources.append(card);
    }
    document.querySelector("#source-count").textContent = `${(data.sources || []).length} passages`;
    result.hidden = false;
    message.textContent = "";
  } catch (error) {
    welcomeCard.hidden = false;
    message.className = "message error";
    message.textContent = error.message;
  } finally {
    askButton.disabled = false;
    askButton.querySelector(".button-label").textContent = "Ask question";
  }
}
