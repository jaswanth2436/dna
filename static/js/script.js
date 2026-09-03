(function () {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────────────── */
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const loader = document.getElementById('pageLoader');
  const toastContainer = document.getElementById('toastContainer');
  let chartsInitialized = false;

  /* ─── Theme ──────────────────────────────────────────────────────────── */
  function currentTheme() {
    return localStorage.getItem('hbb-theme') || 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-bs-theme', theme);
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
      }
    }
    // Update Plotly charts if they exist
    refreshPlotlyTheme(theme);
  }

  /* ─── Toast ─────────────────────────────────────────────────────────── */
  function showToast(message, variant) {
    variant = variant || 'primary';
    if (!toastContainer || !window.bootstrap) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'toast align-items-center border-0';
    wrapper.role = 'alert';
    wrapper.ariaLive = 'assertive';
    wrapper.ariaAtomic = 'true';
    wrapper.innerHTML =
      '<div class="d-flex">' +
        '<div class="toast-body">' +
          '<span class="badge text-bg-' + variant + ' me-2">HBB</span>' + message +
        '</div>' +
        '<button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
      '</div>';
    toastContainer.appendChild(wrapper);
    const toast = new bootstrap.Toast(wrapper, { delay: 2800 });
    wrapper.addEventListener('hidden.bs.toast', function () { wrapper.remove(); });
    toast.show();
  }

  /* ─── Loader ─────────────────────────────────────────────────────────── */
  function hideLoader() {
    if (loader) {
      loader.classList.add('hidden');
      window.setTimeout(function () { if (loader && loader.parentNode) loader.remove(); }, 400);
    }
  }

  /* ─── Counters ───────────────────────────────────────────────────────── */
  function initCounters() {
    var counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    function animate(element) {
      var target = Number(element.dataset.counter || 0);
      var suffix = target % 1 !== 0 ? 1 : 0;
      var duration = 1200;
      var start = performance.now();
      function step(now) {
        var progress = Math.min((now - start) / duration, 1);
        var value = target * (1 - Math.pow(1 - progress, 3));
        element.textContent = suffix ? value.toFixed(1) : Math.round(value).toString();
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (counter) { observer.observe(counter); });
  }

  /* ─── Mutation table filter ──────────────────────────────────────────── */
  function initMutationFilter() {
    var search = document.getElementById('mutationSearch');
    var position = document.getElementById('positionFilter');
    var rows = Array.from(document.querySelectorAll('#mutationTableBody tr'));
    var emptyState = document.getElementById('mutationEmptyState');
    if (!search || !position || !rows.length) return;

    function filterRows() {
      var query = search.value.trim().toLowerCase();
      var selected = position.value;
      var visibleCount = 0;
      rows.forEach(function (row) {
        var haystack = row.dataset.mutation || '';
        var rowPosition = Number(row.dataset.position || '0');
        var matchesQuery = !query || haystack.includes(query);
        var matchesPosition =
          selected === 'all' ||
          (selected === '1-20' && rowPosition >= 1 && rowPosition <= 20) ||
          (selected === '21-40' && rowPosition >= 21 && rowPosition <= 40) ||
          (selected === '41-80' && rowPosition >= 41 && rowPosition <= 80) ||
          (selected === '81+' && rowPosition >= 81);
        var visible = matchesQuery && matchesPosition;
        row.classList.toggle('d-none', !visible);
        if (visible) visibleCount += 1;
      });
      if (emptyState) emptyState.classList.toggle('d-none', visibleCount !== 0);
    }

    search.addEventListener('input', filterRows);
    position.addEventListener('change', filterRows);
  }

  /* ─── Mutation detail modal ──────────────────────────────────────────── */
  function initMutationDetail() {
    var tbody = document.getElementById('mutationTableBody');
    var modal = document.getElementById('mutationDetailModal');
    if (!tbody || !modal) return;

    var bsModal = new bootstrap.Modal(modal);

    tbody.addEventListener('click', function (e) {
      var row = e.target.closest('tr');
      if (!row) return;

      var mutation = row.dataset.mutation || '';
      var position = row.dataset.position || '';
      var wildAa = row.dataset.wild || '';
      var mutantAa = row.dataset.mutant || '';
      var significance = row.dataset.significance || '';
      var disease = row.dataset.disease || '';
      var prediction = row.dataset.prediction || '';
      var deltaG = row.dataset.deltag || 'N/A';
      var confidence = row.dataset.confidence || 'N/A';
      var stabilityScore = row.dataset.stability || 'N/A';

      // Populate modal fields
      function set(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
      }

      set('mdMutation', mutation.split(' ')[0].toUpperCase());
      set('mdPosition', position);
      set('mdWild', wildAa);
      set('mdMutant', mutantAa);
      set('mdDisease', disease);
      set('mdPrediction', prediction);
      set('mdDeltaG', deltaG !== 'N/A' ? deltaG + ' kcal/mol' : 'N/A');
      set('mdConfidence', confidence !== 'N/A' ? confidence + '%' : 'N/A');
      set('mdStabilityScore', stabilityScore !== 'N/A' ? stabilityScore + '/100' : 'N/A');

      // Significance badge
      var sigBadge = document.getElementById('mdSignificance');
      if (sigBadge) {
        var cls = 'neutral';
        var sigLower = significance.toLowerCase();
        if (sigLower.includes('pathogenic')) cls = 'danger';
        else if (sigLower.includes('benign')) cls = 'success';
        else if (sigLower.includes('uncertain')) cls = 'warning';
        sigBadge.className = 'status-badge ' + cls + ' fs-6';
        sigBadge.textContent = significance;
      }

      // Prediction badge
      var predBadge = document.getElementById('mdPredBadge');
      if (predBadge) {
        var predLower = prediction.toLowerCase();
        var predCls = 'neutral';
        if (predLower.includes('high')) predCls = 'danger';
        else if (predLower.includes('low')) predCls = 'success';
        else if (predLower.includes('moderate')) predCls = 'warning';
        predBadge.className = 'status-badge ' + predCls;
        predBadge.textContent = prediction;
      }

      // Render mini stability chart if data available
      if (confidence !== 'N/A' && stabilityScore !== 'N/A' && deltaG !== 'N/A') {
        renderMutationMiniChart(
          parseFloat(confidence),
          parseFloat(stabilityScore),
          parseFloat(deltaG)
        );
      } else {
        var chartWrap = document.getElementById('mutationMiniChartWrap');
        if (chartWrap) chartWrap.style.display = 'none';
      }

      bsModal.show();
    });
  }

  function renderMutationMiniChart(confidence, stabilityScore, deltaG) {
    var wrap = document.getElementById('mutationMiniChartWrap');
    var canvas = document.getElementById('mutationMiniChart');
    if (!canvas || !window.Chart) return;
    if (wrap) wrap.style.display = '';

    // Destroy existing
    var existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    var chartStyle = getComputedStyle(document.documentElement);
    var textColor = chartStyle.getPropertyValue('--text').trim() || '#fff';
    var muted = chartStyle.getPropertyValue('--text-muted').trim() || 'rgba(255,255,255,0.7)';
    var primary = chartStyle.getPropertyValue('--primary').trim() || '#5bf0d0';
    var secondary = chartStyle.getPropertyValue('--secondary').trim() || '#7b8cff';
    var accent = chartStyle.getPropertyValue('--accent').trim() || '#a855f7';
    var danger = chartStyle.getPropertyValue('--danger').trim() || '#ff6b81';

    // Normalize deltaG to 0-100 range for display (invert: positive = good)
    var dgDisplay = Math.min(100, Math.max(0, 50 + deltaG * 20));

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Confidence', 'Stability Score', 'ΔΔG Impact'],
        datasets: [{
          data: [confidence, stabilityScore, dgDisplay],
          backgroundColor: [primary, secondary, deltaG < 0 ? danger : accent],
          borderRadius: 10,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                if (ctx.dataIndex === 2) return 'ΔΔG: ' + deltaG + ' kcal/mol';
                return ctx.parsed.y.toFixed(1);
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: muted }, grid: { display: false } },
          y: {
            ticks: { color: muted },
            grid: { color: 'rgba(148,163,184,0.12)' },
            min: 0, max: 100
          }
        },
        animation: { duration: 700, easing: 'easeOutQuart' }
      }
    });
  }

  /* ─── Chart helpers ──────────────────────────────────────────────────── */
  function getChartStyle() {
    var cs = getComputedStyle(document.documentElement);
    return {
      textColor: cs.getPropertyValue('--text').trim() || '#fff',
      muted: cs.getPropertyValue('--text-muted').trim() || 'rgba(255,255,255,0.7)',
      primary: cs.getPropertyValue('--primary').trim() || '#5bf0d0',
      secondary: cs.getPropertyValue('--secondary').trim() || '#7b8cff',
      accent: cs.getPropertyValue('--accent').trim() || '#a855f7',
    };
  }

  function safeChart(canvasId, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    return new Chart(canvas, config);
  }

  /* ─── Dashboard charts ───────────────────────────────────────────────── */
  function initCharts() {
    var data = window.dashboardData;
    if (!data || !window.Chart || !window.Plotly) return;
    if (chartsInitialized) return;
    chartsInitialized = true;

    var s = getChartStyle();

    // Mutation Frequency — Bar
    safeChart('mutationFrequencyChart', {
      type: 'bar',
      data: {
        labels: data.charts.mutation_frequency.labels,
        datasets: [{
          label: 'Position',
          data: data.charts.mutation_frequency.values,
          backgroundColor: [s.primary, s.secondary, s.accent, '#f7b955', '#ff6b81', '#61f3cf'],
          borderRadius: 12,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: s.muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
          y: { ticks: { color: s.muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
        },
        animation: { duration: 1500, easing: 'easeOutQuart' },
      },
    });

    // Mutation Distribution — Doughnut
    safeChart('mutationDistributionChart', {
      type: 'doughnut',
      data: {
        labels: data.charts.mutation_distribution.labels,
        datasets: [{
          data: data.charts.mutation_distribution.values,
          backgroundColor: [s.accent, s.primary, s.secondary],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: s.textColor } },
        },
        animation: { duration: 1500, easing: 'easeOutQuart' },
      },
    });

    // Stability — Line
    safeChart('stabilityChart', {
      type: 'line',
      data: {
        labels: data.charts.stability.labels,
        datasets: [{
          label: 'Stability Score',
          data: data.charts.stability.values,
          borderColor: s.primary,
          backgroundColor: 'rgba(91,240,208,0.16)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: s.secondary,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: s.muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
          y: { ticks: { color: s.muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
        },
        animation: { duration: 1500, easing: 'easeOutQuart' },
      },
    });

    // Clinical Significance — Pie
    safeChart('clinicalChart', {
      type: 'pie',
      data: {
        labels: data.charts.clinical.labels,
        datasets: [{
          data: data.charts.clinical.values,
          backgroundColor: [s.primary, s.secondary, s.accent, '#f7b955'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: s.textColor } },
        },
        animation: { duration: 1500, easing: 'easeOutQuart' },
      },
    });

    // Heatmap — Plotly
    var heatmap = document.getElementById('heatmapChart');
    if (heatmap) {
      Plotly.newPlot(heatmap, [{
        type: 'heatmap',
        x: data.charts.heatmap.x,
        y: data.charts.heatmap.y,
        z: data.charts.heatmap.z,
        customdata: data.charts.heatmap.z_raw,
        colorscale: [[0, '#0f172a'], [0.35, '#5bf0d0'], [0.7, '#7b8cff'], [1, '#a855f7']],
        hovertemplate: '%{y}<br>%{x}: %{customdata:.2f}<extra></extra>',
        hoverongaps: false,
      }], {
        margin: { l: 90, r: 20, t: 10, b: 50 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: s.textColor, family: 'Manrope, sans-serif' },
        xaxis: { tickfont: { color: s.muted } },
        yaxis: { tickfont: { color: s.muted }, automargin: true },
      }, { displayModeBar: false, responsive: true });
    }

    // Timeline — Plotly
    var timeline = document.getElementById('timelineChart');
    if (timeline) {
      Plotly.newPlot(timeline, [{
        type: 'scatter',
        mode: 'lines+markers',
        x: data.charts.timeline.labels,
        y: data.charts.timeline.values,
        line: { color: s.primary, width: 4 },
        marker: { size: 9, color: s.accent },
      }], {
        margin: { l: 55, r: 20, t: 10, b: 50 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: s.textColor, family: 'Manrope, sans-serif' },
        xaxis: { gridcolor: 'rgba(148,163,184,0.15)' },
        yaxis: { gridcolor: 'rgba(148,163,184,0.15)' },
      }, { displayModeBar: false, responsive: true });
    }
  }

  /* ─── Stability page charts ───────────────────────────────────────────── */
  function initStabilityCharts() {
    var stabilityJson = document.getElementById('stability-data');
    if (!stabilityJson || !window.Plotly) return;

    var data;
    try { data = JSON.parse(stabilityJson.textContent); } catch (e) { return; }
    if (!data || !data.length) return;

    var s = getChartStyle();
    var mutations = data.map(function (d) { return d.mutation; });
    var deltaGs = data.map(function (d) { return d.delta_g; });
    var confidences = data.map(function (d) { return d.confidence_score; });
    var stabilityScores = data.map(function (d) { return d.stability_score; });

    // ΔΔG bar chart
    var dgChart = document.getElementById('stabilityDeltaGChart');
    if (dgChart) {
      var colors = deltaGs.map(function (v) { return v < 0 ? '#ff6b81' : '#5bf0d0'; });
      Plotly.newPlot(dgChart, [{
        type: 'bar',
        x: mutations,
        y: deltaGs,
        marker: { color: colors, line: { width: 0 } },
        hovertemplate: '<b>%{x}</b><br>ΔΔG: %{y:.2f} kcal/mol<extra></extra>',
      }], {
        title: { text: 'ΔΔG Values (kcal/mol)', font: { color: s.textColor, family: 'Space Grotesk, sans-serif', size: 16 } },
        margin: { l: 55, r: 20, t: 50, b: 55 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: s.textColor, family: 'Manrope, sans-serif' },
        xaxis: { tickfont: { color: s.muted }, gridcolor: 'rgba(148,163,184,0.12)' },
        yaxis: { tickfont: { color: s.muted }, gridcolor: 'rgba(148,163,184,0.12)', zeroline: true, zerolinecolor: 'rgba(255,255,255,0.25)' },
        shapes: [{ type: 'line', x0: -0.5, x1: mutations.length - 0.5, y0: 0, y1: 0, line: { color: 'rgba(255,255,255,0.25)', width: 1, dash: 'dot' } }]
      }, { displayModeBar: false, responsive: true });
    }

    // Confidence + Stability grouped bar
    var compChart = document.getElementById('stabilityCompChart');
    if (compChart) {
      Plotly.newPlot(compChart, [
        {
          type: 'bar',
          name: 'Confidence Score',
          x: mutations,
          y: confidences,
          marker: { color: s.secondary },
          hovertemplate: '<b>%{x}</b><br>Confidence: %{y}%<extra></extra>',
        },
        {
          type: 'bar',
          name: 'Stability Score',
          x: mutations,
          y: stabilityScores,
          marker: { color: s.accent },
          hovertemplate: '<b>%{x}</b><br>Stability: %{y}<extra></extra>',
        }
      ], {
        title: { text: 'Confidence & Stability Scores', font: { color: s.textColor, family: 'Space Grotesk, sans-serif', size: 16 } },
        barmode: 'group',
        margin: { l: 55, r: 20, t: 50, b: 55 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: s.textColor, family: 'Manrope, sans-serif' },
        xaxis: { tickfont: { color: s.muted }, gridcolor: 'rgba(148,163,184,0.12)' },
        yaxis: { tickfont: { color: s.muted }, gridcolor: 'rgba(148,163,184,0.12)' },
        legend: { font: { color: s.textColor }, bgcolor: 'transparent' },
      }, { displayModeBar: false, responsive: true });
    }
  }

  /* ─── Plotly theme refresh ───────────────────────────────────────────── */
  var plotlyPanels = ['heatmapChart', 'timelineChart', 'stabilityDeltaGChart', 'stabilityCompChart'];

  function refreshPlotlyTheme(theme) {
    if (!window.Plotly) return;
    var s = getChartStyle();
    plotlyPanels.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.data) return;
      Plotly.relayout(el, {
        'font.color': s.textColor,
        'xaxis.tickfont.color': s.muted,
        'yaxis.tickfont.color': s.muted,
      });
    });
  }

  /* ─── 3Dmol.js viewer helpers ────────────────────────────────────────── */
  function create3DmolViewer(containerId, opts) {
    if (!window.$3Dmol) return null;
    var el = document.getElementById(containerId);
    if (!el) return null;

    // Remove loading fallback once viewer is ready
    var fallback = el.querySelector('.ngl-fallback, .ngl-loading-state');

    var viewer = $3Dmol.createViewer(el, {
      backgroundColor: 'transparent',
      antialias: true,
      id: containerId + '-canvas',
    });

    $3Dmol.download('pdb:' + (opts.pdb || '1A3N'), viewer, {}, function () {
      var style = opts.style || { cartoon: { color: 'spectrum' } };
      viewer.setStyle({}, style);
      if (opts.surface) {
        viewer.addSurface($3Dmol.SurfaceType.VWS, {
          opacity: 0.15,
          color: 'white',
        });
      }
      viewer.zoomTo();
      viewer.render();
      if (opts.spin) viewer.spin('y', 1);
      if (fallback) fallback.style.opacity = '0';
    });

    window.addEventListener('resize', function () { viewer.resize(); });
    return viewer;
  }

  function initMolViewers() {
    if (!window.$3Dmol) return;

    // Index hero viewer (auto-spin)
    create3DmolViewer('nglHeroViewer', { pdb: '1A3N', spin: true });

    // Protein page inline viewer
    create3DmolViewer('nglInlineViewer', { pdb: '1A3N', spin: false });

    // Dashboard viewer (auto-spin)
    create3DmolViewer('nglDashboardViewer', { pdb: '1A3N', spin: true });

    // Protein modal viewer — lazy-init on first open
    var proteinModal = document.getElementById('proteinModal');
    if (proteinModal) {
      var modalViewer = null;
      var spinning = false;
      var controlsBound = false;

      proteinModal.addEventListener('shown.bs.modal', function () {
        if (modalViewer) { modalViewer.resize(); return; }
        modalViewer = create3DmolViewer('nglModalViewer', {
          pdb: '1A3N',
          spin: false,
          surface: true,
          style: { cartoon: { color: 'chainHetatm' } },
        });
        if (!modalViewer || controlsBound) return;
        controlsBound = true;

        var btnCartoon = document.getElementById('nglBtnCartoon');
        var btnSurface = document.getElementById('nglBtnSurface');
        var btnBall    = document.getElementById('nglBtnBall');
        var btnSpin    = document.getElementById('nglBtnSpin');

        if (btnCartoon) btnCartoon.addEventListener('click', function () {
          modalViewer.setStyle({}, { cartoon: { color: 'spectrum' } });
          modalViewer.render();
        });
        if (btnSurface) btnSurface.addEventListener('click', function () {
          modalViewer.setStyle({}, {});
          modalViewer.addSurface($3Dmol.SurfaceType.VWS, { opacity: 0.85, color: 'white' });
          modalViewer.render();
        });
        if (btnBall) btnBall.addEventListener('click', function () {
          modalViewer.setStyle({}, { stick: {}, sphere: { scale: 0.3 } });
          modalViewer.render();
        });
        if (btnSpin) btnSpin.addEventListener('click', function () {
          spinning = !spinning;
          modalViewer.spin(spinning ? 'y' : false);
          btnSpin.innerHTML = spinning
            ? '<i class="bi bi-pause-fill me-1"></i>Stop Spin'
            : '<i class="bi bi-arrow-clockwise me-1"></i>Spin';
        });
      });

      proteinModal.addEventListener('hidden.bs.modal', function () {
        if (modalViewer) modalViewer.spin(false);
        spinning = false;
      });
    }
  }

  /* ─── Page init ─────────────────────────────────────────────────────── */
  function initPage() {
    applyTheme(currentTheme());
    initCounters();
    initMutationFilter();
    initMutationDetail();
    initCharts();
    initStabilityCharts();
    initMolViewers();
    window.setTimeout(hideLoader, 350);

    if (themeToggle && !themeToggle.dataset.bound) {
      themeToggle.dataset.bound = 'true';
      themeToggle.addEventListener('click', function () {
        var nextTheme = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem('hbb-theme', nextTheme);
        applyTheme(nextTheme);
        showToast('Switched to ' + nextTheme + ' mode', 'info');
      });
    }
  }

  /* ─── Boot: wait for all deferred scripts ───────────────────────────── */
  // We wait for window.load to ensure Chart.js, Plotly, 3Dmol, and Bootstrap
  // are all fully available before initializing anything.
  window.addEventListener('load', function () {
    initPage();
  });

  // Expose public API
  window.showHBBToast = showToast;
})();
