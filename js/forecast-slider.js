/* ==========================================================================
   Forecast slider — data, chart renderer, tablist wiring.
   Driven by data-forecast-slider on the section.
   ========================================================================== */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const WINDOWS = [10, 30, 60, 120, 300, 600];

  const HORIZONS = [
    { h: 60,  tab: '1 min',  label: '60\u202fs',  word: 'one minute ahead' },
    { h: 180, tab: '3 min',  label: '180\u202fs', word: 'three minutes ahead' },
    { h: 300, tab: '5 min',  label: '300\u202fs', word: 'five minutes ahead' },
    { h: 600, tab: '10 min', label: '600\u202fs', word: 'ten minutes ahead' },
  ];

  // Paper data · macro-F1 (%) forecasting AFib / AFlutter / Sinus rhythm.
  // null = method does not support that input window.
  const DATA = {
    60: {
      'PULSE':       [43.21, null, null, null, null, null],
      'GEM':         [32.54, null, null, null, null, null],
      'GPT-5.2':     [43.26, 47.54, 48.00, 48.24, 54.36, 51.28],
      'CAMEL':       [63.28, 68.88, 69.23, 71.37, 73.42, 73.18],
      'XGBoost':     [59.55, 55.58, 56.89, 56.09, 59.64, 55.20],
      'CNN':         [46.89, 54.62, 53.59, 50.79, 52.35, 53.10],
      'CAMEL Probe': [69.83, 72.52, 69.43, 74.30, 72.56, 75.14],
    },
    180: {
      'PULSE':       [40.50, null, null, null, null, null],
      'GEM':         [32.95, null, null, null, null, null],
      'GPT-5.2':     [37.67, 46.71, 51.22, 54.43, 49.29, 52.01],
      'CAMEL':       [60.04, 61.27, 65.44, 69.59, 71.34, 67.53],
      'XGBoost':     [56.85, 56.60, 58.18, 57.09, 58.07, 56.17],
      'CNN':         [49.59, 54.72, 57.08, 54.40, 52.76, 50.21],
      'CAMEL Probe': [69.81, 67.38, 69.91, 69.85, 75.46, 74.64],
    },
    300: {
      'PULSE':       [36.67, null, null, null, null, null],
      'GEM':         [33.33, null, null, null, null, null],
      'GPT-5.2':     [43.14, 53.42, 52.07, 51.19, 58.16, 56.37],
      'CAMEL':       [58.07, 63.58, 70.15, 67.15, 70.73, 70.48],
      'XGBoost':     [54.08, 54.97, 54.35, 57.05, 56.86, 53.37],
      'CNN':         [48.47, 53.13, 46.54, 46.32, 57.72, 48.99],
      'CAMEL Probe': [68.54, 71.05, 69.31, 70.30, 73.36, 72.70],
    },
    600: {
      'PULSE':       [40.12, null, null, null, null, null],
      'GEM':         [31.49, null, null, null, null, null],
      'GPT-5.2':     [46.11, 56.04, 47.55, 55.80, 50.01, 55.41],
      'CAMEL':       [58.54, 63.91, 64.28, 65.99, 71.37, 66.90],
      'XGBoost':     [57.93, 57.12, 53.84, 55.06, 56.03, 57.07],
      'CNN':         [48.85, 51.96, 53.69, 51.32, 49.90, 56.19],
      'CAMEL Probe': [69.30, 69.53, 68.49, 72.04, 73.54, 76.02],
    },
  };

  /*
    Visual hierarchy:
      hero      = CAMEL Probe · filled marker, solid arterial line, 2.4
      hero-hollow = CAMEL      · ring marker,  solid arterial line, 2.0
      baseline  = GPT/XGB/CNN  · faint graphite, 1.3, tiny dot marker
      solo      = PULSE/GEM    · ring at w=10 only, no line
  */
  const SERIES = [
    { key: 'CNN',         kind: 'baseline',    opacity: 0.38, order: 1 },
    { key: 'XGBoost',     kind: 'baseline',    opacity: 0.48, order: 2 },
    { key: 'GPT-5.2',     kind: 'baseline',    opacity: 0.62, order: 3 },
    { key: 'PULSE',       kind: 'solo',        order: 4 },
    { key: 'GEM',         kind: 'solo',        order: 5 },
    { key: 'CAMEL',       kind: 'hero-hollow', order: 6 },
    { key: 'CAMEL Probe', kind: 'hero',        order: 7 },
  ];

  // For each horizon, the takeaway pointer: { method, window, template }.
  // {V} is replaced with the peak value; {W} with the input window.
  const TAKEAWAYS = {
    60:  { method: 'CAMEL Probe', w: 600, template: 'At <em>w&nbsp;=&nbsp;600\u202fs</em>, <strong>CAMEL Probe</strong> reaches <b>{V}%</b> &mdash; <em>+{GAP}</em> points over the best baseline.' },
    180: { method: 'CAMEL Probe', w: 300, template: 'Three minutes out &mdash; at <em>w&nbsp;=&nbsp;300\u202fs</em>, <strong>CAMEL Probe</strong> reaches <b>{V}%</b> while every zero-shot baseline stalls below <em>55%</em>.' },
    300: { method: 'CAMEL',       w: 300, template: 'Five minutes ahead, <strong>CAMEL</strong> holds at <b>{V}%</b> at <em>w&nbsp;=&nbsp;300\u202fs</em> &mdash; <em>+{GAP}</em> points over any supervised baseline.' },
    600: { method: 'CAMEL Probe', w: 600, template: 'Ten minutes ahead, <strong>CAMEL Probe</strong> still reaches <b>{V}%</b> at <em>w&nbsp;=&nbsp;600\u202fs</em>, <em>+{GAP}</em> points over any baseline.' },
  };

  const PLOT = { w: 800, h: 360, padL: 56, padR: 24, padT: 32, padB: 56 };
  const Y_MIN = 28, Y_MAX = 80;

  function xFor(i) {
    return PLOT.padL + (i / (WINDOWS.length - 1)) * (PLOT.w - PLOT.padL - PLOT.padR);
  }
  function yFor(v) {
    return PLOT.padT + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (PLOT.h - PLOT.padT - PLOT.padB);
  }

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(SVG_NS, tag);
    if (attrs) { for (const k in attrs) e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function bestBaseline(horizonH) {
    const baselines = ['PULSE', 'GEM', 'GPT-5.2', 'XGBoost', 'CNN'];
    let max = -Infinity;
    baselines.forEach(k => {
      DATA[horizonH][k].forEach(v => { if (v != null && v > max) max = v; });
    });
    return max;
  }

  function renderChart(svg, horizonH, { animate = true } = {}) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // ---- Defs ---------------------------------------------------------------
    const defs = el('defs', null, svg);
    const softMask = el('linearGradient', {
      id: 'fc-top-fade', x1: 0, y1: 0, x2: 0, y2: 1
    }, defs);
    el('stop', { offset: '0',   'stop-color': 'white', 'stop-opacity': '0' }, softMask);
    el('stop', { offset: '0.25','stop-color': 'white', 'stop-opacity': '1' }, softMask);
    el('stop', { offset: '1',   'stop-color': 'white', 'stop-opacity': '1' }, softMask);

    // ---- Background zones ---------------------------------------------------
    const bandMax = bestBaseline(horizonH);
    const band = el('g', { class: 'fc-band' }, svg);
    el('rect', {
      x: PLOT.padL, y: yFor(bandMax),
      width: PLOT.w - PLOT.padL - PLOT.padR,
      height: (PLOT.h - PLOT.padB) - yFor(bandMax),
      class: 'fc-band-rect'
    }, band);
    el('line', {
      x1: PLOT.padL, y1: yFor(bandMax),
      x2: PLOT.w - PLOT.padR, y2: yFor(bandMax),
      class: 'fc-band-top'
    }, band);
    el('text', {
      x: PLOT.w - PLOT.padR - 4,
      y: yFor(bandMax) - 6,
      class: 'fc-band-label',
      'text-anchor': 'end'
    }, band, 'baseline ceiling · ' + bandMax.toFixed(1) + '%');

    // ---- Grid ---------------------------------------------------------------
    const grid = el('g', { class: 'fc-grid' }, svg);
    for (let f = 30; f <= Y_MAX; f += 10) {
      const y = yFor(f);
      el('line', {
        x1: PLOT.padL, y1: y, x2: PLOT.w - PLOT.padR, y2: y,
        class: 'fc-grid-line' + (f === 30 || f === Y_MAX ? ' fc-grid-bound' : '')
      }, grid);
      el('text', {
        x: PLOT.padL - 10, y: y + 3,
        class: 'fc-axis-label fc-axis-label--y',
        'text-anchor': 'end'
      }, grid, f);
    }

    // X ticks / labels
    WINDOWS.forEach((w, i) => {
      const x = xFor(i);
      el('line', {
        x1: x, y1: PLOT.h - PLOT.padB,
        x2: x, y2: PLOT.h - PLOT.padB + 5,
        class: 'fc-tick'
      }, grid);
      el('text', {
        x: x, y: PLOT.h - PLOT.padB + 19,
        class: 'fc-axis-label fc-axis-label--x',
        'text-anchor': 'middle'
      }, grid, w);
    });

    // Axis titles
    el('text', {
      x: PLOT.padL, y: PLOT.padT - 10,
      class: 'fc-axis-title',
      'text-anchor': 'start'
    }, grid, 'F1 (%)');
    el('text', {
      x: (PLOT.w - PLOT.padR + PLOT.padL) / 2,
      y: PLOT.h - 8,
      class: 'fc-axis-title',
      'text-anchor': 'middle'
    }, grid, 'Input window  w  (s)');

    // ---- Series -------------------------------------------------------------
    const gLines = el('g', { class: 'fc-series' }, svg);
    let staggerIdx = 0;
    const stagger = 90;              // ms between series
    const drawDur = 720;             // per-line draw duration
    // Two passes: lines first, markers second (so markers sit on top).
    const sortedSeries = SERIES.slice().sort((a, b) => a.order - b.order);

    sortedSeries.forEach(s => {
      const values = DATA[horizonH][s.key];
      if (!values) return;
      const pts = values
        .map((v, i) => v == null ? null : { x: xFor(i), y: yFor(v), v, w: WINDOWS[i] })
        .filter(Boolean);
      if (!pts.length) return;

      const g = el('g', {
        class: 'fc-group fc-group--' + s.kind + ' fc-group--' + slug(s.key),
        'data-key': s.key,
        style: animate ? ('--fc-delay:' + (staggerIdx * stagger) + 'ms') : '--fc-delay:0ms'
      }, gLines);

      if (s.kind === 'solo') {
        const p = pts[0];
        el('circle', {
          cx: p.x, cy: p.y, r: 5,
          class: 'fc-dot fc-dot--solo'
        }, g);
        el('text', {
          x: p.x - 10, y: p.y + 4,
          class: 'fc-solo-label',
          'text-anchor': 'end'
        }, g, s.key);
        // small value label underneath dot
        el('text', {
          x: p.x, y: p.y + 22,
          class: 'fc-solo-value',
          'text-anchor': 'middle'
        }, g, p.v.toFixed(1));
      } else {
        const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
        const path = el('path', {
          d,
          'pathLength': 1,
          'vector-effect': 'non-scaling-stroke',
          class: 'fc-line'
        }, g);
        if (s.opacity != null) path.setAttribute('opacity', s.opacity);

        // Markers
        pts.forEach(p => {
          el('circle', {
            cx: p.x, cy: p.y,
            class: 'fc-marker'
          }, g);
        });
      }

      staggerIdx++;
    });

    // ---- Peak annotation ----------------------------------------------------
    const t = TAKEAWAYS[horizonH];
    const arr = DATA[horizonH][t.method];
    const idx = WINDOWS.indexOf(t.w);
    const peakV = arr[idx];
    const px = xFor(idx), py = yFor(peakV);

    const anno = el('g', {
      class: 'fc-annotation',
      style: animate ? ('--fc-delay:' + (staggerIdx * stagger + 400) + 'ms') : '--fc-delay:0ms'
    }, svg);

    // leader
    el('line', {
      x1: px, y1: py - 6,
      x2: px, y2: py - 22,
      class: 'fc-annotation-leader'
    }, anno);
    // value in Fraunces
    el('text', {
      x: px, y: py - 28,
      class: 'fc-annotation-value',
      'text-anchor': 'middle'
    }, anno, peakV.toFixed(1) + '%');
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // --------------------------- Controller ----------------------------------
  function init() {
    const root = document.querySelector('[data-forecast-slider]');
    if (!root) return;
    const svg = root.querySelector('.forecast-chart');
    if (!svg) return;
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const labelH = root.querySelector('[data-fc-h]');
    const labelWord = root.querySelector('[data-fc-time]');
    const takeaway = root.querySelector('[data-fc-takeaway]');
    const desc = svg.querySelector('desc');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function compose(template, v, gap) {
      return template
        .replace('{V}', v.toFixed(1))
        .replace('{GAP}', gap.toFixed(1));
    }

    function activate(h, { focus = false, animate = true } = {}) {
      tabs.forEach((t) => {
        const on = parseInt(t.dataset.horizon, 10) === h;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        t.classList.toggle('is-active', on);
        if (on && focus) t.focus({ preventScroll: true });
      });

      const info = HORIZONS.find(x => x.h === h);
      if (labelH) labelH.textContent = info.label;
      if (labelWord) labelWord.textContent = info.word;

      const t = TAKEAWAYS[h];
      const arr = DATA[h][t.method];
      const peakV = arr[WINDOWS.indexOf(t.w)];
      const base = bestBaseline(h);
      const gap = peakV - base;
      if (takeaway) {
        takeaway.innerHTML = compose(t.template, peakV, gap);
        if (animate && !reducedMotion) {
          takeaway.classList.remove('is-entering');
          // re-trigger animation
          void takeaway.offsetWidth;
          takeaway.classList.add('is-entering');
        }
      }
      if (desc) {
        desc.textContent = 'Line chart: macro-F1 across input windows for each method at horizon ' + info.label + '. CAMEL Probe peaks at ' + peakV.toFixed(1) + '%.';
      }

      // Announce title change (fade)
      const title = root.querySelector('.forecast-panel__title');
      if (title && animate && !reducedMotion) {
        title.classList.remove('is-entering');
        void title.offsetWidth;
        title.classList.add('is-entering');
      }

      renderChart(svg, h, { animate: animate && !reducedMotion });
    }

    // Click handlers
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        const h = parseInt(tab.dataset.horizon, 10);
        activate(h, { focus: false });
      });
      tab.addEventListener('keydown', (e) => {
        const n = tabs.length;
        let next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = n - 1;
        else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          activate(parseInt(tab.dataset.horizon, 10), { focus: false });
          return;
        }
        if (next >= 0) {
          e.preventDefault();
          activate(parseInt(tabs[next].dataset.horizon, 10), { focus: true });
        }
      });
    });

    // Initial render — start with h=60. If the section isn't yet in view,
    // defer the chart render until it is, to avoid burning the animation.
    activate(60, { animate: false });

    if ('IntersectionObserver' in window && !reducedMotion) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(ent => {
          if (ent.isIntersecting) {
            activate(60, { animate: true });
            io.disconnect();
          }
        });
      }, { threshold: 0.2 });
      io.observe(root);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
