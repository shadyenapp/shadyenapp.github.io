/* =========================================================
   Homepage: pulls /data/*.json and renders each section's cards.
   To add new content, edit the JSON files — this file shouldn't
   need to change.
   ========================================================= */

function tagList(tags, variant) {
  if (!tags || !tags.length) return "";
  const cls = variant === "danger" ? "card-tag danger" : "card-tag";
  return tags.map((t) => `<span class="${cls}">${escapeHtml(t)}</span>`).join("");
}

function projectCard(item) {
  return `
    <div class="card reveal" data-category="${escapeHtml(item.category || "")}">
      <div class="card-content">
        <h3 class="text-xl font-bold text-white mb-1">${escapeHtml(item.title)}</h3>
        <p class="text-sm text-cyan-400 mb-3 font-mono">${escapeHtml(item.category)}</p>
        <p class="text-gray-400 text-sm mb-4">${escapeHtml(item.summary)}</p>
        <div class="mb-2">${tagList(item.tags)}</div>
      </div>
      <a href="pages/detail.html?collection=projects&slug=${encodeURIComponent(item.slug)}" class="card-btn">View Details</a>
    </div>`;
}

function malwareCard(item) {
  return `
    <div class="card malware reveal">
      <div class="card-content">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-xl font-bold text-white">${escapeHtml(item.title)}</h3>
          <span class="font-mono text-xs text-gray-500">${escapeHtml(item.date || "")}</span>
        </div>
        <p class="text-sm text-rose-400 mb-3 font-mono">${escapeHtml(item.sampleType || "")}</p>
        <p class="text-gray-400 text-sm mb-4">${escapeHtml(item.summary)}</p>
        <div class="mb-2">${tagList(item.tags, "danger")}</div>
      </div>
      <a href="pages/detail.html?collection=malware&slug=${encodeURIComponent(item.slug)}" class="card-btn">View Analysis</a>
    </div>`;
}

function languageCard(item) {
  const count = item.programs ? item.programs.length : 0;
  return `
    <div class="card reveal">
      <div class="card-content">
        <h3 class="text-xl font-bold text-white mb-1 font-mono">${escapeHtml(item.name)}</h3>
        <p class="text-sm text-cyan-400 mb-3">${escapeHtml(item.tagline || "")}</p>
        <p class="text-gray-400 text-sm mb-4">${escapeHtml(item.summary)}</p>
        <p class="text-xs text-gray-500 font-mono mb-2">${count} program${count === 1 ? "" : "s"} showcased</p>
      </div>
      <a href="pages/detail.html?collection=languages&slug=${encodeURIComponent(item.slug)}" class="card-btn">Explore</a>
    </div>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

// Some collections (e.g. malware) are split into one JSON file per report
// instead of a single array, so a report can be added just by dropping in
// a new file. `dir/index.json` lists the slugs to fetch; each slug maps to
// `dir/<slug>.json`, a single report object.
async function fetchSplitCollection(dir) {
  const index = await fetchJSON(`${dir}/index.json`);
  if (!index || !index.length) return [];
  const items = await Promise.all(index.map((slug) => fetchJSON(`${dir}/${slug}.json`)));
  return items.filter(Boolean);
}

async function renderSection({ path, dir, gridId, emptyId, render, wrap }) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const data = dir ? await fetchSplitCollection(dir) : await fetchJSON(path);
  if (!data || !data.length) {
    grid.innerHTML = "";
    const emptyEl = document.getElementById(emptyId);
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  grid.innerHTML = data.map(render).join("");
  observeNewReveals(grid);
  if (wrap) wrap(data);
}

function initProjectFilters(data) {
  const chipRow = document.getElementById("project-filters");
  if (!chipRow) return;
  const categories = ["All", ...new Set(data.map((p) => p.category))];
  chipRow.innerHTML = categories
    .map(
      (c, i) =>
        `<button class="filter-chip${i === 0 ? " active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    )
    .join("");

  chipRow.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chipRow.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.cat;
      document.querySelectorAll("#projects-grid .card").forEach((card) => {
        const match = cat === "All" || card.dataset.category === cat;
        card.style.display = match ? "" : "none";
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderSection({
    path: "data/projects.json",
    gridId: "projects-grid",
    emptyId: "projects-empty",
    render: projectCard,
    wrap: initProjectFilters,
  });

  // Malware reports live one-file-per-report under data/malware/ so a new
  // report can be added without touching a shared file — see data/malware/index.json.
  renderSection({
    dir: "data/malware",
    gridId: "malware-grid",
    emptyId: "malware-empty",
    render: malwareCard,
  });

  // Code Samples / Languages section is disabled on the homepage for now
  // (see the matching comment in index.html) -- uncomment once there's
  // real ASM content to show.
  // renderSection({
  //   path: "data/languages.json",
  //   gridId: "languages-grid",
  //   emptyId: "languages-empty",
  //   render: languageCard,
  // });
});
