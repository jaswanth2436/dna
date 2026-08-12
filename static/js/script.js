(function () {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const loader = document.getElementById('pageLoader');
  const toastContainer = document.getElementById('toastContainer');

  function currentTheme() {
    return localStorage.getItem('hbb-theme') || 'light';
  }

  function applyTheme(theme) {
    root.setAttribute('data-bs-theme', theme);
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
      }
    }
  }

  function showToast(message, variant = 'primary') {
    if (!toastContainer || !window.bootstrap) {
      return;
    }

    const toastId = `toast-${Date.now()}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'toast align-items-center border-0';
    wrapper.id = toastId;
    wrapper.role = 'alert';
    wrapper.ariaLive = 'assertive';
    wrapper.ariaAtomic = 'true';
    wrapper.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <span class="badge text-bg-${variant} me-2">HBB</span>${message}
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    toastContainer.appendChild(wrapper);
    const toast = new bootstrap.Toast(wrapper, { delay: 2800 });
    wrapper.addEventListener('hidden.bs.toast', () => wrapper.remove());
    toast.show();
  }

  function hideLoader() {
    if (loader) {
      loader.classList.add('hidden');
      window.setTimeout(() => loader.remove(), 400);
    }
  }

  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) {
      return;
    }

    const animate = (element) => {
      const target = Number(element.dataset.counter || 0);
      const suffix = target % 1 !== 0 ? 1 : 0;
      const duration = 1200;
      const start = performance.now();

      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const value = target * (1 - Math.pow(1 - progress, 3));
        element.textContent = suffix ? value.toFixed(1) : Math.round(value).toString();
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      }

      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach((counter) => observer.observe(counter));
  }

  function initMutationFilter() {
    const search = document.getElementById('mutationSearch');
    const position = document.getElementById('positionFilter');
    const rows = Array.from(document.querySelectorAll('#mutationTableBody tr'));
    const emptyState = document.getElementById('mutationEmptyState');
    if (!search || !position || !rows.length) {
      return;
    }

    const filterRows = () => {
      const query = search.value.trim().toLowerCase();
      const selected = position.value;
      let visibleCount = 0;

      rows.forEach((row) => {
        const haystack = row.dataset.mutation || '';
        const rowPosition = Number(row.dataset.position || '0');
        const matchesQuery = !query || haystack.includes(query);
        const matchesPosition =
          selected === 'all' ||
          (selected === '1-20' && rowPosition >= 1 && rowPosition <= 20) ||
          (selected === '21-40' && rowPosition >= 21 && rowPosition <= 40) ||
          (selected === '41-80' && rowPosition >= 41 && rowPosition <= 80) ||
          (selected === '81+' && rowPosition >= 81);

        const visible = matchesQuery && matchesPosition;
        row.classList.toggle('d-none', !visible);
        if (visible) {
          visibleCount += 1;
        }
      });

      if (emptyState) {
        emptyState.classList.toggle('d-none', visibleCount !== 0);
      }
    };

    search.addEventListener('input', filterRows);
    position.addEventListener('change', filterRows);
  }

  function initCharts() {
    const data = window.dashboardData;
    if (!data || !window.Chart || !window.Plotly) {
      return;
    }

    const chartStyle = getComputedStyle(document.documentElement);
    const textColor = chartStyle.getPropertyValue('--text').trim() || '#fff';
    const muted = chartStyle.getPropertyValue('--text-muted').trim() || 'rgba(255,255,255,0.7)';
    const primary = chartStyle.getPropertyValue('--primary').trim() || '#5bf0d0';
    const secondary = chartStyle.getPropertyValue('--secondary').trim() || '#7b8cff';
    const accent = chartStyle.getPropertyValue('--accent').trim() || '#a855f7';

    const barCanvas = document.getElementById('mutationFrequencyChart');
    if (barCanvas) {
      new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: data.charts.mutation_frequency.labels,
          datasets: [{
            label: 'Position',
            data: data.charts.mutation_frequency.values,
            backgroundColor: [primary, secondary, accent, '#f7b955', '#ff6b81', '#61f3cf'],
            borderRadius: 12,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
            y: { ticks: { color: muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
          },
          animation: { duration: 1500, easing: 'easeOutQuart' },
        },
      });
    }

    const distributionCanvas = document.getElementById('mutationDistributionChart');
    if (distributionCanvas) {
      new Chart(distributionCanvas, {
        type: 'doughnut',
        data: {
          labels: data.charts.mutation_distribution.labels,
          datasets: [{
            data: data.charts.mutation_distribution.values,
            backgroundColor: [accent, primary, secondary],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor } },
          },
          animation: { duration: 1500, easing: 'easeOutQuart' },
        },
      });
    }

    const stabilityCanvas = document.getElementById('stabilityChart');
    if (stabilityCanvas) {
      new Chart(stabilityCanvas, {
        type: 'line',
        data: {
          labels: data.charts.stability.labels,
          datasets: [{
            label: 'Stability Score',
            data: data.charts.stability.values,
            borderColor: primary,
            backgroundColor: 'rgba(91,240,208,0.16)',
            fill: true,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: secondary,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
            y: { ticks: { color: muted }, grid: { color: 'rgba(148,163,184,0.15)' } },
          },
          animation: { duration: 1500, easing: 'easeOutQuart' },
        },
      });
    }

    const clinicalCanvas = document.getElementById('clinicalChart');
    if (clinicalCanvas) {
      new Chart(clinicalCanvas, {
        type: 'pie',
        data: {
          labels: data.charts.clinical.labels,
          datasets: [{
            data: data.charts.clinical.values,
            backgroundColor: [primary, secondary, accent, '#f7b955'],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor } },
          },
          animation: { duration: 1500, easing: 'easeOutQuart' },
        },
      });
    }

    const heatmap = document.getElementById('heatmapChart');
    if (heatmap) {
      Plotly.newPlot(heatmap, [{
        type: 'heatmap',
        x: data.charts.heatmap.x,
        y: data.charts.heatmap.y,
        z: data.charts.heatmap.z,
        colorscale: [[0, '#0f172a'], [0.35, '#5bf0d0'], [0.7, '#7b8cff'], [1, '#a855f7']],
        hoverongaps: false,
      }], {
        margin: { l: 90, r: 20, t: 10, b: 50 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: textColor, family: 'Manrope, sans-serif' },
      }, { displayModeBar: false, responsive: true });
    }

    const timeline = document.getElementById('timelineChart');
    if (timeline) {
      Plotly.newPlot(timeline, [{
        type: 'scatter',
        mode: 'lines+markers',
        x: data.charts.timeline.labels,
        y: data.charts.timeline.values,
        line: { color: primary, width: 4 },
        marker: { size: 9, color: accent },
      }], {
        margin: { l: 55, r: 20, t: 10, b: 50 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: textColor, family: 'Manrope, sans-serif' },
        xaxis: { gridcolor: 'rgba(148,163,184,0.15)' },
        yaxis: { gridcolor: 'rgba(148,163,184,0.15)' },
      }, { displayModeBar: false, responsive: true });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme());
    initCounters();
    initMutationFilter();
    initCharts();
    window.setTimeout(hideLoader, 250);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const nextTheme = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem('hbb-theme', nextTheme);
        applyTheme(nextTheme);
        showToast(`Switched to ${nextTheme} mode`, 'info');
      });
    }
  });

  window.addEventListener('load', hideLoader);
  window.showHBBToast = showToast;
})();
