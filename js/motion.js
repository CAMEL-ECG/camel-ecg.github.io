/*  motion.js — CAMEL-ECG
    · IntersectionObserver reveals
    · Counter ticks for stat values
    · BibTeX / code copy buttons
    · Demo scenario tabs
    · Navbar scroll shadow
    · Mobile nav toggle
    No dependencies. <2 KB once minified.
*/

(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Navbar scroll state ---------- */
  const nav = document.querySelector(".navbar");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile nav toggle ---------- */
  const toggle = document.querySelector(".navbar__toggle");
  const links  = document.querySelector(".navbar__links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    links.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });
  }

  /* ---------- IntersectionObserver reveals ---------- */
  const revealables = document.querySelectorAll(
    ".reveal, .reveal-stagger, .wipe-on-view, .curriculum, .divider-ecg"
  );
  if ("IntersectionObserver" in window && !prefersReduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
            if (entry.target.matches("[data-stat]")) runStatTicker(entry.target);
            if (entry.target.querySelectorAll) {
              entry.target.querySelectorAll("[data-stat]").forEach(runStatTicker);
            }
          }
        });
      },
      { threshold: 0.15, rootMargin: "-5% 0px -10% 0px" }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("in-view"));
    document.querySelectorAll("[data-stat]").forEach((el) => {
      el.textContent = el.dataset.statText || formatFinal(el);
    });
  }

  /* ---------- Stat counter ticker ---------- */
  function formatFinal(el) {
    const to      = parseFloat(el.dataset.stat);
    const suffix  = el.dataset.suffix || "";
    const prefix  = el.dataset.prefix || "";
    const digits  = parseInt(el.dataset.digits || "0", 10);
    return prefix + to.toFixed(digits) + suffix;
  }

  function runStatTicker(el) {
    if (el.dataset.animated === "1") return;
    el.dataset.animated = "1";
    const to       = parseFloat(el.dataset.stat);
    const from     = parseFloat(el.dataset.statFrom || "0");
    const duration = parseFloat(el.dataset.statDuration || "900");
    const suffix   = el.dataset.suffix || "";
    const prefix   = el.dataset.prefix || "";
    const digits   = parseInt(el.dataset.digits || "0", 10);
    if (Number.isNaN(to)) return;

    if (prefersReduced) {
      el.textContent = prefix + to.toFixed(digits) + suffix;
      return;
    }

    const start = performance.now();
    const ease  = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * ease(p);
      el.textContent = prefix + v.toFixed(digits) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Copy-to-clipboard for BibTeX & snippets ---------- */
  document.querySelectorAll("[data-copy-target]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const sel  = btn.dataset.copyTarget;
      const tgt  = document.querySelector(sel);
      if (!tgt) return;
      const text = tgt.innerText.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(tgt);
        const sel2 = window.getSelection();
        sel2.removeAllRanges();
        sel2.addRange(r);
        document.execCommand("copy");
        sel2.removeAllRanges();
      }
      const original = btn.textContent;
      btn.classList.add("is-copied");
      btn.textContent = "Copied ✓";
      setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.textContent = original;
      }, 1400);
    });
  });

  /* ---------- Demo scenario tabs ---------- */
  document.querySelectorAll("[data-tabs]").forEach((group) => {
    const tabs   = group.querySelectorAll(".demo-tab");
    const panels = document.querySelectorAll(`[data-panel-group="${group.dataset.tabs}"] .demo-panel`);
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.setAttribute("aria-selected", "false"));
        tab.setAttribute("aria-selected", "true");
        const id = tab.dataset.panel;
        panels.forEach((p) => {
          p.hidden = p.dataset.panel !== id;
        });
      });
    });
  });

  /* ---------- Draw logo on first visit ---------- */
  const logoPath = document.querySelector(".navbar__brand .mark path.pulse");
  if (logoPath && !sessionStorage.getItem("logoDrawn") && !prefersReduced) {
    const len = logoPath.getTotalLength ? logoPath.getTotalLength() : 120;
    logoPath.style.strokeDasharray  = len;
    logoPath.style.strokeDashoffset = len;
    logoPath.getBoundingClientRect();
    logoPath.style.transition = "stroke-dashoffset 720ms cubic-bezier(0.65, 0, 0.35, 1)";
    requestAnimationFrame(() => {
      logoPath.style.strokeDashoffset = "0";
    });
    sessionStorage.setItem("logoDrawn", "1");
  }
})();
