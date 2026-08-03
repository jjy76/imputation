const { sql } = require('../lib/db');

const HAPLOTYPE_TYPES = ['A~B~DRB1', 'B~DRB1', 'B~DRB1~DQB1', 'A~B~DRB1~DQB1'];
const HAPLOTYPE_LOCUS_COLUMNS = { A: 'a', B: 'b', DRB1: 'drb1', DQB1: 'dqb1' };

module.exports = async function handler(req, res) {
  const { kind, locus, type, meta, q } = req.query;

  try {
    if (kind === 'antigen' || kind === 'allele') {
      const table = kind === 'antigen' ? 'antigen_frequency' : 'allele_frequency';
      const column = kind === 'antigen' ? 'antigen' : 'allele';

      if (meta) {
        const rows = await sql.query(
          `SELECT DISTINCT locus FROM ${table} ORDER BY locus`
        );
        res.status(200).json({ loci: rows.map((r) => r.locus) });
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

    if (kind === 'haplotype') {
      if (!type || !HAPLOTYPE_TYPES.includes(type)) {
        res.status(400).json({
          error: `Missing or invalid "type" query param. Expected one of: ${HAPLOTYPE_TYPES.join(', ')}`,
        });
        return;
      }

      const params = [type];
      let whereQ = '';
      if (q) {
        params.push(`%${q}%`);
        const p = `$${params.length}`;
        const column = HAPLOTYPE_LOCUS_COLUMNS[locus];
        whereQ = column
          ? ` AND ${column} ILIKE ${p}`
          : ` AND (a ILIKE ${p} OR b ILIKE ${p} OR drb1 ILIKE ${p} OR dqb1 ILIKE ${p})`;
      }

      const rows = await sql.query(
        `SELECT a, b, drb1, dqb1, frequency FROM haplotype_frequency WHERE haplotype_type = $1${whereQ} ORDER BY frequency DESC`,
        params
      );
      res.status(200).json({ rows });
      return;
    }

    res.status(400).json({ error: 'Missing or invalid "kind" query param. Expected: antigen | allele | haplotype' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
