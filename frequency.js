(function () {
  const SEARCH_PLACEHOLDERS = {
    antigen: { A: 'A2', B: 'B44', C: 'Cw1', DRB1: 'DR4', DQB1: 'DQ7' },
    allele: { A: '24:02', B: '44:03', C: '01:02', DRB1: '13:02', DQB1: '03:01' },
  };

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

    function syncSearchPlaceholder() {
      const example = SEARCH_PLACEHOLDERS[kind][select.value];
      search.placeholder = example ? `e.g. ${example}` : '';
    }

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
      syncSearchPlaceholder();
      select.addEventListener('change', () => {
        syncSearchPlaceholder();
        loadRows();
      });
      search.addEventListener('input', debounce(loadRows, 250));
      await loadRows();
    } catch (err) {
      select.innerHTML = '<option value="">Unavailable</option>';
      renderMessage(tbody, 2, 'Could not load loci.');
    }
  }

  async function setupHaplotypeSection() {
    const select = document.querySelector('[data-freq-locus="haplotype"]');
    const searchFields = document.querySelector('[data-freq-search-fields="haplotype"]');
    const table = document.querySelector('[data-freq-table="haplotype"]');
    const thead = table ? table.querySelector('thead') : null;
    const tbody = table ? table.querySelector('tbody') : null;
    if (!select || !searchFields || !thead || !tbody) return;

    select.innerHTML = HAPLOTYPE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('');

    function currentSearchInputs() {
      return Array.from(searchFields.querySelectorAll('[data-freq-search-col]'));
    }

    function syncSearchFields() {
      const columns = HAPLOTYPE_COLUMNS[select.value];
      const previous = {};
      currentSearchInputs().forEach((input) => {
        previous[input.dataset.freqSearchCol] = input.value;
      });

      searchFields.innerHTML = columns
        .map(
          ([col, label]) => `
            <div>
              <label class="freq-label" for="haplotype-search-${col}">Search ${label}</label>
              <input id="haplotype-search-${col}" class="freq-search" type="search" placeholder="e.g. 02:01" data-freq-search-col="${col}">
            </div>
          `
        )
        .join('');

      currentSearchInputs().forEach((input) => {
        const col = input.dataset.freqSearchCol;
        if (previous[col]) input.value = previous[col];
        input.addEventListener('input', debounce(loadRows, 250));
      });
    }

    async function loadRows() {
      const type = select.value;
      const columns = HAPLOTYPE_COLUMNS[type];
      const searchValues = {};
      let hasQuery = false;
      currentSearchInputs().forEach((input) => {
        const val = input.value.trim();
        if (val) {
          searchValues[input.dataset.freqSearchCol] = val;
          hasQuery = true;
        }
      });

      thead.innerHTML =
        '<tr>' + columns.map(([, label]) => `<th>${label}</th>`).join('') + '<th>Frequency</th></tr>';
      renderMessage(tbody, columns.length + 1, 'Loading…');
      try {
        const params = new URLSearchParams({ kind: 'haplotype', type });
        for (const [col, val] of Object.entries(searchValues)) params.set(col, val);
        const res = await fetch(`/api/frequency?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        if (!data.rows.length) {
          renderMessage(
            tbody,
            columns.length + 1,
            hasQuery ? 'No matches for that search.' : 'No data yet for this combination.'
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

    syncSearchFields();
    select.addEventListener('change', () => {
      syncSearchFields();
      loadRows();
    });
    await loadRows();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupSimpleSection('antigen');
    setupSimpleSection('allele');
    setupHaplotypeSection();
  });
})();
