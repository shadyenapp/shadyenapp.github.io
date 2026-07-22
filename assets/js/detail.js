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
// and (once real raw listings exist) hover-linked raw/decompiled pairs.
function termBlockHtml(text) {
  return `<pre class="term-block">${escapeHtml(text)}</pre>`;
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

// Plain (non-Ghidra) code block -- for scratch work / math walkthroughs that
// aren't actual tool output, so they shouldn't look like a Ghidra window.
function renderPlainCode(block) {
  return `<pre class="code-block">${escapeHtml(block.code)}</pre>`;
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
  return html;
}

function renderSections(sections) {
  return sections
    .map((s) => `<div class="report-section"><h2>${escapeHtml(s.heading)}</h2>${sectionBodyHtml(s)}</div>`)
    .join("");
}

function renderReportDetail(item, meta) {
  document.title = `${item.title} | Hayden Sapp`;
  const root = document.getElementById("detail-root");
  const hasSections = Array.isArray(item.sections) && item.sections.length > 0;
  root.innerHTML = `
    <p class="section-eyebrow">${escapeHtml(meta.label)}</p>
    <h1 class="text-3xl md:text-4xl font-bold text-white mt-2 mb-3">${escapeHtml(item.title)}</h1>
    <p class="font-mono text-sm text-gray-500 mb-6">${escapeHtml(item.category || item.sampleType || "")} ${item.date ? "&middot; " + escapeHtml(item.date) : ""}</p>
    ${tagsHtml(item.tags, meta.accent)}
    <p class="text-gray-300 leading-relaxed mb-8">${escapeHtml(item.details || item.summary)}</p>

    ${hasSections ? renderSections(item.sections) : ""}

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
