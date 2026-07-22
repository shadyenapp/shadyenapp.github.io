/* =========================================================
   Shared utilities: nav, mobile menu, scroll reveal, data loading.
   Loaded on every page.
   ========================================================= */

// ---- Escape user/data text before injecting into HTML ----
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---- Fetch a JSON data file relative to the site root ----
// `root` lets pages inside /pages/ pass "../" so paths resolve either way.
async function fetchJSON(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to load data file:", path, err);
    return null;
  }
}

// ---- Mobile menu toggle ----
function initMobileMenu() {
  const btn = document.getElementById("mobile-menu-button");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;
  btn.addEventListener("click", () => menu.classList.toggle("hidden"));
  menu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => menu.classList.add("hidden"))
  );
}

// ---- Highlight active nav link based on scroll position ----
function initScrollSpy() {
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".nav-link[href^='#']");
  if (!sections.length || !navLinks.length) return;

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => spy.observe(s));
}

// ---- Fade/slide sections and cards in as they enter the viewport ----
function initRevealOnScroll() {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  targets.forEach((t) => io.observe(t));
}

// Re-run reveal observer for nodes injected after initial load (e.g. dynamic cards)
function observeNewReveals(container) {
  const targets = container.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  targets.forEach((t) => io.observe(t));
}

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initScrollSpy();
  initRevealOnScroll();
});
