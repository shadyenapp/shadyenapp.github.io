/* =========================================================
   Ghidra-style code viewer: syntax highlighting for decompiled
   C-ish pseudocode, plus raw<->decompiled hover-linking for
   blocks that have both (via a shared numeric data-group per
   line). Used on malware analysis detail pages.

   Data shapes this renders (see data/malware/*.json + detail.js):

   Single decompiled pane, no raw counterpart yet:
     { type: "decompiled", title: "toggle_obf", code: "..." }

   Paired raw (Listing) + decompiled, hover-linked by line:
     { type: "pair", title: "toggle_obf",
       raw:        [{ group: 1, text: "..." }, ...],
       decompiled: [{ group: 1, text: "..." }, ...] }
   ========================================================= */

const GHIDRA_KEYWORDS = new Set([
  "if", "else", "while", "for", "do", "return", "switch", "case", "default",
  "break", "continue", "goto", "sizeof", "struct", "typedef", "union", "enum",
  "void", "const", "static", "extern", "unsigned", "signed",
]);

const GHIDRA_TYPES = new Set([
  "int", "char", "short", "long", "float", "double", "bool", "BOOL", "byte",
  "undefined", "undefined1", "undefined2", "undefined4", "undefined8",
  "uint", "uint8_t", "uint16_t", "uint32_t", "uint64_t",
  "int8_t", "int16_t", "int32_t", "int64_t", "size_t", "ulong", "uchar", "ushort",
]);

// One-pass tokenizer: comments / strings / words / numbers, in priority order.
function highlightGhidraC(code) {
  const pattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b([A-Za-z_]\w*)\b|(0x[0-9a-fA-F]+|\b\d+\b)/g;
  return code.replace(pattern, (m, comment, str, word, num, offset, full) => {
    if (comment) return `<span class="g-comment">${escapeHtml(comment)}</span>`;
    if (str) return `<span class="g-str">${escapeHtml(str)}</span>`;
    if (num) return `<span class="g-num">${escapeHtml(num)}</span>`;
    if (word) {
      if (GHIDRA_KEYWORDS.has(word)) return `<span class="g-kw">${escapeHtml(word)}</span>`;
      if (GHIDRA_TYPES.has(word)) return `<span class="g-type">${escapeHtml(word)}</span>`;
      const rest = full.slice(offset + word.length);
      if (/^\s*\(/.test(rest)) return `<span class="g-func">${escapeHtml(word)}</span>`;
      return escapeHtml(word);
    }
    return escapeHtml(m);
  });
}

// Very light asm-line highlighter for future raw Listing panes:
// leading mnemonic in blue, trailing ";"/"//" comment in green, hex in violet.
function highlightGhidraAsm(line) {
  const commentMatch = line.match(/^(.*?)(\s*(?:;|\/\/).*)$/);
  const code = commentMatch ? commentMatch[1] : line;
  const comment = commentMatch ? commentMatch[2] : "";
  const mnemMatch = code.match(/^(\s*)(\S+)(.*)$/);
  let codeHtml = escapeHtml(code);
  if (mnemMatch) {
    const [, lead, mnem, rest] = mnemMatch;
    const restHtml = escapeHtml(rest).replace(/0x[0-9a-fA-F]+/g, (h) => `<span class="g-num">${h}</span>`);
    codeHtml = `${escapeHtml(lead)}<span class="g-mnem">${escapeHtml(mnem)}</span>${restHtml}`;
  }
  return codeHtml + (comment ? `<span class="g-comment">${escapeHtml(comment)}</span>` : "");
}

function ghidraLineHtml(text, group, highlighter) {
  const html = highlighter(text) || "&nbsp;";
  const groupAttr = group != null ? ` data-group="${escapeHtml(String(group))}"` : "";
  return `<div class="ghidra-line"${groupAttr}><span class="ghidra-code">${html}</span></div>`;
}

function ghidraLineHtmlNumbered(text, index, group, highlighter) {
  const html = highlighter(text) || "&nbsp;";
  const groupAttr = group != null ? ` data-group="${escapeHtml(String(group))}"` : "";
  return `<div class="ghidra-line"${groupAttr}><span class="ghidra-lineno">${index + 1}</span><span class="ghidra-code">${html}</span></div>`;
}

// Single Ghidra-styled decompiled pane (no raw counterpart).
function renderGhidraDecompiled(block) {
  const lines = block.code.replace(/\n+$/, "").split("\n");
  const body = lines.map((line, i) => ghidraLineHtmlNumbered(line, i, null, highlightGhidraC)).join("");
  return `
    <div class="ghidra-window">
      <div class="ghidra-titlebar"><span class="ghidra-tab">Decompile: ${escapeHtml(block.title || "")}</span></div>
      <div class="ghidra-body">${body}</div>
    </div>`;
}

// Paired raw (Listing) + decompiled panes, hover-linked by shared group id.
function renderGhidraPair(block) {
  const rawHtml = (block.raw || []).map((l) => ghidraLineHtml(l.text, l.group, highlightGhidraAsm)).join("");
  const decHtml = (block.decompiled || []).map((l) => ghidraLineHtml(l.text, l.group, highlightGhidraC)).join("");
  return `
    <div class="ghidra-pair-grid">
      <div class="ghidra-window">
        <div class="ghidra-titlebar"><span class="ghidra-tab">Listing</span></div>
        <div class="ghidra-body ghidra-body-raw">${rawHtml}</div>
      </div>
      <div class="ghidra-window">
        <div class="ghidra-titlebar"><span class="ghidra-tab">Decompile: ${escapeHtml(block.title || "")}</span></div>
        <div class="ghidra-body ghidra-body-dec">${decHtml}</div>
      </div>
    </div>`;
}

function renderGhidraBlock(block) {
  if (block.type === "pair") return renderGhidraPair(block);
  return renderGhidraDecompiled(block);
}

// Wire up hover-linking within each pair block found under `root`.
// Scoped per .ghidra-pair-grid so group numbers don't collide across blocks.
function initGhidraPairs(root = document) {
  root.querySelectorAll(".ghidra-pair-grid").forEach((grid) => {
    grid.querySelectorAll("[data-group]").forEach((el) => {
      const group = el.dataset.group;
      const matches = () => grid.querySelectorAll(`[data-group="${group}"]`);
      el.addEventListener("mouseenter", () => {
        const matched = Array.from(matches());
        matched.forEach((m) => m.classList.add("hl"));
        scrollPairedLinesIntoView(matched, el);
      });
      el.addEventListener("mouseleave", () => matches().forEach((m) => m.classList.remove("hl")));
    });
  });
  capRawPaneHeights(root);
}

// True if `el` is fully visible both within its pane's own scroll box (the
// raw/Listing pane scrolls internally, see capRawPaneHeights below) and
// within the browser viewport itself.
function isFullyVisible(el, container) {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const withinContainer = elRect.top >= containerRect.top - 1 && elRect.bottom <= containerRect.bottom + 1;
  const withinViewport = elRect.top >= 0 && elRect.bottom <= viewportHeight;
  return withinContainer && withinViewport;
}

// When hovering a line, its paired line(s) in the other pane can be
// scrolled out of frame -- either inside the raw pane's own internal
// scrollbar, or off the page entirely. Bring the first offscreen match in
// each pane smoothly into view so the highlighted pairing is always visible.
function scrollPairedLinesIntoView(matchedEls, sourceEl) {
  const handledContainers = new Set();
  matchedEls.forEach((m) => {
    if (m === sourceEl) return;
    const container = m.closest(".ghidra-body");
    if (!container || handledContainers.has(container)) return;
    if (!isFullyVisible(m, container)) {
      handledContainers.add(container);
      m.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  });
}

// Raw (Listing) panes usually have far more lines than their decompiled
// counterpart -- one decompiled statement can be a dozen+ instructions.
// Rather than letting the raw pane stretch the page, cap its height to
// match the decompiled pane it's paired with and let it scroll internally.
function capRawPaneHeights(root = document) {
  root.querySelectorAll(".ghidra-pair-grid").forEach((grid) => {
    const rawBody = grid.querySelector(".ghidra-body-raw");
    const decBody = grid.querySelector(".ghidra-body-dec");
    if (!rawBody || !decBody) return;
    const targetHeight = decBody.getBoundingClientRect().height;
    if (targetHeight > 0) {
      rawBody.style.maxHeight = `${targetHeight}px`;
      rawBody.classList.add("ghidra-body-scroll");
    }
  });
}
