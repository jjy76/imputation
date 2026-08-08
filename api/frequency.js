const { sql } = require('../lib/db');

const HAPLOTYPE_TYPES = [
  'A~B~DRB1', 'B~DRB1', 'B~DRB1~DQB1', 'A~B~DRB1~DQB1',
  // -- added: full A/B/C/DRB1/DQB1 loci combinations --
  'A~B', 'A~C', 'A~DRB1', 'A~DQB1', 'B~C', 'B~DQB1', 'C~DRB1', 'C~DQB1', 'DRB1~DQB1',
  'A~B~C', 'A~B~DQB1', 'A~C~DRB1', 'A~C~DQB1', 'A~DRB1~DQB1', 'B~C~DRB1', 'B~C~DQB1', 'C~DRB1~DQB1',
  'A~B~C~DRB1', 'A~B~C~DQB1', 'A~C~DRB1~DQB1', 'B~C~DRB1~DQB1',
  'A~B~C~DRB1~DQB1',
];
const HAPLOTYPE_LOCUS_COLUMNS = { A: 'a', B: 'b', C: 'c', DRB1: 'drb1', DQB1: 'dqb1' };
const HAPLOTYPE_TABLES = { haplotype: 'haplotype_frequency', 'antigen-haplotype': 'antigen_haplotype_frequency' };
const LOCUS_ORDER = ['A', 'B', 'C', 'DRB1', 'DQB1'];

function sortLoci(loci) {
  return [...loci].sort((x, y) => {
    const ix = LOCUS_ORDER.indexOf(x);
    const iy = LOCUS_ORDER.indexOf(y);
    if (ix === -1 && iy === -1) return x.localeCompare(y);
    if (ix === -1) return 1;
    if (iy === -1) return -1;
    return ix - iy;
  });
}

module.exports = async function handler(req, res) {
  const { kind, locus, type, meta, q } = req.query;

  try {
    if (kind === 'antigen' || kind === 'allele') {
      const table = kind === 'antigen' ? 'antigen_frequency' : 'allele_frequency';
      const column = kind === 'antigen' ? 'antigen' : 'allele';

      if (meta) {
        const rows = await sql.query(`SELECT DISTINCT locus FROM ${table}`);
        res.status(200).json({ loci: sortLoci(rows.map((r) => r.locus)) });
        return;
      }

      if (!locus) {
        res.status(400).json({ error: 'Missing required "locus" query param.' });
        return;
      }

      const params = [locus];
      let whereQ = '';
      if (q) {
        params.push(`%${q}%`);
        whereQ = ` AND ${column} ILIKE $${params.length}`;
      }

      const rows = await sql.query(
        `SELECT ${column} AS name, frequency FROM ${table} WHERE locus = $1${whereQ} ORDER BY frequency DESC`,
        params
      );
      res.status(200).json({ rows });
      return;
    }

    if (kind === 'haplotype' || kind === 'antigen-haplotype') {
      const table = HAPLOTYPE_TABLES[kind];
      if (!type || !HAPLOTYPE_TYPES.includes(type)) {
        res.status(400).json({
          error: `Missing or invalid "type" query param. Expected one of: ${HAPLOTYPE_TYPES.join(', ')}`,
        });
        return;
      }

      const params = [type];
      const conditions = [];
      for (const column of Object.values(HAPLOTYPE_LOCUS_COLUMNS)) {
        const val = req.query[column];
        if (val) {
          params.push(`%${val}%`);
          conditions.push(`${column} ILIKE $${params.length}`);
        }
      }
      const whereExtra = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';

      const rows = await sql.query(
        `SELECT a, b, c, drb1, dqb1, frequency FROM ${table} WHERE haplotype_type = $1${whereExtra} ORDER BY frequency DESC`,
        params
      );
      res.status(200).json({ rows });
      return;
    }

    res.status(400).json({
      error: 'Missing or invalid "kind" query param. Expected: antigen | allele | haplotype | antigen-haplotype',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
