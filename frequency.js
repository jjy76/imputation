(function () {
  const HAPLOTYPE_TYPES = ['A~B~DRB1', 'B~DRB1', 'B~DRB1~DQB1', 'A~B~DRB1~DQB1'];
  const HAPLOTYPE_COLUMNS = {
    'A~B~DRB1': [['a', 'A'], ['b', 'B'], ['drb1', 'DRB1']],
    'B~DRB1': [['b', 'B'], ['drb1', 'DRB1']],
    'B~DRB1~DQB1': [['b', 'B'], ['drb1', 'DRB1'], ['dqb1', 'DQB1']],
    'A~B~DRB1~DQB1': [['a', 'A'], ['b', 'B'], ['drb1', 'DRB1'], ['dqb1', 'DQB1']],
  };

  function renderMessage(tbody, colspan, message) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="freq-empty">${message}</td></tr>`;
  }

  function formatFrequency(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(4) : value;
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  async function setupSimpleSection(kind) {
    const select = document.querySelector(`[data-freq-locus="${kind}"]`);
    const search = document.querySelector(`[data-freq-search="${kind}"]`);
    const tbody = document.querySelector(`[data-freq-table="${kind}"] tbody`);
    if (!select || !search || !tbody) return;

    async function loadRows() {
      const locus = select.value;
      const q = search.value.trim();
      renderMessage(tbody, 2, 'Loading…');
      try {
        const params = new URLSearchParams({ kind, locus });
        if (q) params.set('q', q);
        const res = await fetch(`/api/frequency?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        if (!data.rows.length) {
          renderMessage(tbody, 2, q ? 'No matches for that search.' : 'No data yet for this locus.');
          return;
        }
        tbody.innerHTML = data.rows
          .map((r) => `<tr><td>${r.name}</td><td>${formatFrequency(r.frequency)}</td></tr>`)
          .join('');
      } catch (err) {
        renderMessage(tbody, 2, 'Could not load data.');
      }
    }

    try {
      const res = await fetch(`/api/frequency?kind=${kind}&meta=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const loci = data.loci || [];
      if (!loci.length) {
        select.innerHTML = '<option value="">No data yet</option>';
        renderMessage(tbody, 2, 'No data has been imported yet.');
        return;
      }
      select.innerHTML = loci.map((l) => `<option value="${l}">${l}</option>`).join('');
      select.addEventListener('change', loadRows);
      search.addEventListener('input', debounce(loadRows, 250));
      await loadRows();
    } catch (err) {
      select.innerHTML = '<option value="">Unavailable</option>';
      renderMessage(tbody, 2, 'Could not load loci.');
    }
  }

  async function setupHaplotypeSection() {
    const select = document.querySelector('[data-freq-locus="haplotype"]');
    const searchLocus = document.querySelector('[data-freq-search-locus="haplotype"]');
    const search = document.querySelector('[data-freq-search="haplotype"]');
    const table = document.querySelector('[data-freq-table="haplotype"]');
    const thead = table ? table.querySelector('thead') : null;
    const tbody = table ? table.querySelector('tbody') : null;
    if (!select || !searchLocus || !search || !thead || !tbody) return;

    select.innerHTML = HAPLOTYPE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('');

    function syncSearchLocusOptions() {
      const columns = HAPLOTYPE_COLUMNS[select.value];
      const previous = searchLocus.value;
      searchLocus.innerHTML =
        '<option value="">All loci</option>' +
        columns.map(([, label]) => `<option value="${label}">${label}</option>`).join('');
      if (columns.some(([, label]) => label === previous)) {
        searchLocus.value = previous;
      }
    }

    async function loadRows() {
      const type = select.value;
      const q = search.value.trim();
      const locus = searchLocus.value;
      const columns = HAPLOTYPE_COLUMNS[type];
      thead.innerHTML =
        '<tr>' + columns.map(([, label]) => `<th>${label}</th>`).join('') + '<th>Frequency</th></tr>';
      renderMessage(tbody, columns.length + 1, 'Loading…');
      try {
        const params = new URLSearchParams({ kind: 'haplotype', type });
        if (q) params.set('q', q);
        if (q && locus) params.set('locus', locus);
        const res = await fetch(`/api/frequency?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        if (!data.rows.length) {
          renderMessage(
            tbody,
            columns.length + 1,
            q ? 'No matches for that search.' : 'No data yet for this combination.'
          );
          return;
        }
        tbody.innerHTML = data.rows
          .map((r) => {
            const cells = columns.map(([col]) => `<td>${r[col] ?? ''}</td>`).join('');
            return `<tr>${cells}<td>${formatFrequency(r.frequency)}</td></tr>`;
          })
          .join('');
      } catch (err) {
        renderMessage(tbody, columns.length + 1, 'Could not load data.');
      }
    }

    syncSearchLocusOptions();
    select.addEventListener('change', () => {
      syncSearchLocusOptions();
      loadRows();
    });
    searchLocus.addEventListener('change', loadRows);
    search.addEventListener('input', debounce(loadRows, 250));
    await loadRows();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupSimpleSection('antigen');
    setupSimpleSection('allele');
    setupHaplotypeSection();
  });
})();
