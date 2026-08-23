/* =========================================================
   Generic detail page: driven entirely by ?collection=&slug=
   Handles: projects, malware, languages
   ========================================================= */

// Collections are either one shared array file (`file`) or one file per
// item under a directory (`dir`, fetched as `<dir>/<slug>.json`).
const COLLECTION_META = {
  projects: { file: "../data/projects.json", label: "Project", accent: "cyan" },
  malware: { dir: "../data/malware", label: "Malware Analysis", accent: "rose" },
  languages: { file: "../data/languages.json", label: "Language", accent: "cyan" },
};

function tagsHtml(tags, accent) {
  if (!tags || !tags.length) return "";
  const cls = accent === "rose" ? "card-tag danger" : "card-tag";
  return `<div class="mb-4">${tags.map((t) => `<span class="${cls}">${escapeHtml(t)}</span>`).join("")}</div>`;
}

function iocsHtml(iocs) {
  if (!iocs) return "";
  const rows = Object.entries(iocs)
    .map(([key, val]) => `<div><dt>${escapeHtml(key)}</dt><dd class="font-mono text-xs break-all">${escapeHtml(val)}</dd></div>`)
    .join("");
  return `
    <div class="mb-8">
      <h2 class="text-sm font-bold text-white uppercase tracking-wide font-mono mb-3">Indicators of Compromise</h2>
      <dl class="kv-grid grid sm:grid-cols-2 gap-x-8">${rows}</dl>
    </div>`;
}

// A malware entry can either be a simple write-up (just `details` text, as
// before) or a rich one with a `sections` array for a full walkthrough:
// terminal transcripts, Ghidra-styled decompiled code, image placeholders,
// data tables, a timeline, and callouts -- see sectionBodyHtml/reportSectionHtml.

// Wraps a code/term block with a small labeled tab above it, like a physical
// evidence tag -- used whenever the block has a title/label to show. Kept as
// a separate opt-in wrapper (rather than baked into .code-block/.term-block)
// so existing entries without a title render exactly as before.
function evidenceWrapHtml(label, innerHtml) {
  return `
    <div class="evidence">
      <div class="evidence-tab">${escapeHtml(label)}</div>
      ${innerHtml}
    </div>`;
}

// `term` is either a plain string (legacy -- renders exactly as before, no
// tab) or `{ label, text }` for a labeled evidence block, e.g. a registry
// value or a Prefetch filename with a source annotation above it.
function termBlockHtml(term) {
  if (term && typeof term === "object") {
    return evidenceWrapHtml(term.label || "Evidence", `<pre class="term-block">${escapeHtml(term.text)}</pre>`);
  }
  return `<pre class="term-block">${escapeHtml(term)}</pre>`;
}

// `image` can be a real screenshot (`{ src, caption }`) once one's been
// uploaded, or just a caption string/object (no `src`) as a placeholder for
// one referenced in source notes but not yet added.
function imagePlaceholderHtml(img) {
  const caption = typeof img === "string" ? img : img.caption;
  const src = typeof img === "object" ? img.src : null;

  if (src) {
    return `<figure class="report-image">
      <img src="${encodeURI(src)}" alt="${escapeHtml(caption || "")}" loading="lazy" />
      ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
    </figure>`;
  }

  return `<div class="img-placeholder">Image referenced in source notes — not yet uploaded.${
    caption ? `<span class="cap">${escapeHtml(caption)}</span>` : ""
  }</div>`;
}

// Plain (non-Ghidra) code block -- for scratch work / math walkthroughs, decoded
// config files, or any other listing that isn't actual reverse-engineering tool
// output, so it doesn't get the Ghidra light-theme treatment. Gets an evidence
// tab whenever a title is given, same as termBlockHtml.
function renderPlainCode(block) {
  const inner = `<pre class="code-block">${escapeHtml(block.code)}</pre>`;
  return block.title ? evidenceWrapHtml(block.title, inner) : inner;
}

// A data table for tabular content (file/hash listings, IOC summaries, ATT&CK
// mappings) -- real <table> markup rather than hand-aligned monospace text.
// Cell/header text is escaped, same trust model as `iocsHtml`.
function tableHtml(table) {
  if (!table || !table.rows || !table.rows.length) return "";
  const head = table.headers
    ? `<thead><tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`
    : "";
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const wrapped = `<div class="table-wrap"><table class="data-table">${head}<tbody>${body}</tbody></table></div>`;
  return table.title ? evidenceWrapHtml(table.title, wrapped) : wrapped;
}

// A vertical dot-timeline, reusing the site's existing .timeline-item/.timeline-dot
// look (see the About/experience section) inside a bordered rail. `text` is
// authored HTML like `body`, so <strong>/<code> pass through untouched.
function timelineHtml(items) {
  if (!items || !items.length) return "";
  const rows = items
    .map(
      (it) => `
      <div class="report-tl-item timeline-item">
        <span class="timeline-dot"></span>
        <p class="report-tl-time">${escapeHtml(it.time)}</p>
        <p class="report-tl-text">${it.text}</p>
      </div>`
    )
    .join("");
  return `<div class="report-timeline">${rows}</div>`;
}

// A highlighted callout box -- `tone: "flag"` for a critical/must-know point,
// `tone: "trace"` for a technical aside. `text` is authored HTML like `body`.
function calloutHtml(callout) {
  if (!callout) return "";
  const tone = callout.tone === "flag" ? "flag" : "trace";
  return `
    <div class="callout ${tone}">
      ${callout.tag ? `<span class="callout-tag">${escapeHtml(callout.tag)}</span>` : ""}
      <p>${callout.text}</p>
    </div>`;
}

function sectionBodyHtml(section) {
  let html = "";
  if (section.body) {
    // `body` is authored HTML (site owner's own content, not user input) so
    // simple inline tags like <code>/<em> are allowed through untouched.
    html += Array.isArray(section.body)
      ? section.body.map((p) => `<p>${p}</p>`).join("")
      : `<p>${section.body}</p>`;
  }
  if (section.term) html += termBlockHtml(section.term);
  if (section.code) {
    html += section.code.type === "plain" ? renderPlainCode(section.code) : renderGhidraBlock(section.code);
  }
  if (section.image) html += imagePlaceholderHtml(section.image);
  if (section.table) html += tableHtml(section.table);
  if (section.timeline) html += timelineHtml(section.timeline);
  if (section.callout) html += calloutHtml(section.callout);
  return html;
}

// Each section gets a numbered, bordered header (01, 02, ...) and an anchor
// id so the side table-of-contents (renderSections, below) can jump to it.
function reportSectionHtml(section, index) {
  const num = String(index + 1).padStart(2, "0");
  return `
    <section id="report-sec-${index}" class="report-section">
      <div class="report-section-head">
        <span class="report-num">${num}</span>
        <h2>${escapeHtml(section.heading)}</h2>
      </div>
      ${sectionBodyHtml(section)}
    </section>`;
}

// A sticky side table-of-contents next to the numbered section list -- only
// shown once a report actually has enough sections to need one. The accent
// color follows the collection (rose for malware, cyan otherwise) via a CSS
// custom property, same convention as .card-tag.danger elsewhere.
function renderSections(sections, meta) {
  const toc = sections
    .map((s, i) => `<li><a href="#report-sec-${i}">${String(i + 1).padStart(2, "0")} — ${escapeHtml(s.heading)}</a></li>`)
    .join("");
  const body = sections.map((s, i) => reportSectionHtml(s, i)).join("");
  const accentVar = meta.accent === "rose" ? "var(--danger)" : "var(--accent)";
  return `
    <div class="report-shell" style="--report-accent: ${accentVar};">
      <nav class="report-toc"><ol>${toc}</ol></nav>
      <div class="report-main">${body}</div>
    </div>`;
}

function renderReportDetail(item, meta) {
  document.title = `${item.title} | Hayden Sapp`;
  const root = document.getElementById("detail-root");
  const hasSections = Array.isArray(item.sections) && item.sections.length > 0;

  // The sticky side TOC needs more horizontal room than the standard
  // max-w-3xl detail container -- only widen it for reports that actually
  // have a TOC to show, so plain write-ups (no `sections`) keep their
  // narrower, more readable column.
  if (hasSections) {
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.classList.remove("max-w-3xl");
      mainEl.classList.add("max-w-5xl");
    }
  }

  root.innerHTML = `
    <p class="section-eyebrow">${escapeHtml(meta.label)}</p>
    <h1 class="text-3xl md:text-4xl font-bold text-white mt-2 mb-3">${escapeHtml(item.title)}</h1>
    <p class="font-mono text-sm text-gray-500 mb-6">${escapeHtml(item.category || item.sampleType || "")} ${item.date ? "&middot; " + escapeHtml(item.date) : ""}</p>
    ${tagsHtml(item.tags, meta.accent)}
    <p class="text-gray-300 leading-relaxed mb-8">${escapeHtml(item.details || item.summary)}</p>
    ${item.callout ? calloutHtml(item.callout) : ""}

    ${hasSections ? renderSections(item.sections, meta) : ""}

    <dl class="kv-grid grid sm:grid-cols-2 gap-x-8 mb-8">
      ${item.tools && item.tools.length ? `<div><dt>Tools</dt><dd>${item.tools.map(escapeHtml).join(", ")}</dd></div>` : ""}
      ${item.family ? `<div><dt>Family</dt><dd>${escapeHtml(item.family)}</dd></div>` : ""}
    </dl>

    ${iocsHtml(item.iocs)}

    ${item.reportUrl ? `<a href="${encodeURI(item.reportUrl)}" target="_blank" rel="noopener" class="card-btn inline-flex w-auto">${escapeHtml(item.reportLabel || "View Full Report (PDF)")}</a>` : ""}
  `;
  initGhidraPairs(root);
}

function renderLanguageDetail(item) {
  document.title = `${item.name} | Hayden Sapp`;
  const root = document.getElementById("detail-root");
  const programs = item.programs || [];
  root.innerHTML = `
    <p class="section-eyebrow">Language</p>
    <h1 class="text-3xl md:text-4xl font-bold text-white mt-2 mb-3 font-mono">${escapeHtml(item.name)}</h1>
    <p class="text-cyan-400 mb-6">${escapeHtml(item.tagline || "")}</p>
    <p class="text-gray-300 leading-relaxed mb-10">${escapeHtml(item.summary)}</p>

    <h2 class="text-xl font-bold text-white mb-4">Programs & Write-ups</h2>
    <div class="grid md:grid-cols-2 gap-6">
      ${
        programs.length
          ? programs
              .map(
                (p) => `
        <div class="card">
          <div class="card-content">
            <h3 class="text-lg font-bold text-white mb-2">${escapeHtml(p.title)}</h3>
            <p class="text-gray-400 text-sm mb-3">${escapeHtml(p.description)}</p>
            ${
              p.highlights && p.highlights.length
                ? `<div class="mb-2">${p.highlights.map((h) => `<span class="card-tag">${escapeHtml(h)}</span>`).join("")}</div>`
                : ""
            }
          </div>
          ${p.repoUrl ? `<a href="${encodeURI(p.repoUrl)}" target="_blank" rel="noopener" class="card-btn">View Code</a>` : ""}
        </div>`
              )
              .join("")
          : emptyStateHtml("No programs added for this language yet.")
      }
    </div>
  `;
}

function emptyStateHtml(msg) {
  return `<div class="empty-state col-span-2">${escapeHtml(msg)}</div>`;
}

function renderNotFound(collection, slug) {
  const root = document.getElementById("detail-root");
  root.innerHTML = `
    <p class="section-eyebrow">Not Found</p>
    <h1 class="text-3xl font-bold text-white mt-2 mb-4">Nothing here</h1>
    <p class="text-gray-400">Couldn't find an entry for <code class="font-mono text-cyan-400">${escapeHtml(collection)}/${escapeHtml(slug)}</code>. Check the link, or head back to the homepage.</p>
  `;
}

async function initDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const collection = params.get("collection");
  const slug = params.get("slug");
  const meta = COLLECTION_META[collection];

  if (!meta || !slug) {
    renderNotFound(collection || "?", slug || "?");
    return;
  }

  let item = null;
  if (meta.dir) {
    item = await fetchJSON(`${meta.dir}/${slug}.json`);
  } else {
    const data = await fetchJSON(meta.file);
    item = data ? data.find((d) => d.slug === slug) : null;
  }

  if (!item) {
    renderNotFound(collection, slug);
    return;
  }

  if (collection === "languages") {
    renderLanguageDetail(item);
  } else {
    renderReportDetail(item, meta);
  }
}

document.addEventListener("DOMContentLoaded", initDetailPage);
