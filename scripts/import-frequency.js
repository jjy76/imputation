const fs = require('fs');
const path = require('path');

const { loadEnvLocal } = require('./load-env');
loadEnvLocal();

const { sql } = require('../lib/db');
const { parseCsv } = require('./parse-csv');

const HAPLOTYPE_TYPES = ['A~B~DRB1', 'B~DRB1', 'B~DRB1~DQB1', 'A~B~DRB1~DQB1'];
const HAPLOTYPE_LOCI = { a: 'A', b: 'B', drb1: 'DRB1', dqb1: 'DQB1' };

function readCsv(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  return parseCsv(fs.readFileSync(resolved, 'utf8'));
}

function toFrequency(value, rowNum) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Row ${rowNum}: invalid frequency "${value}"`);
  }
  return num;
}

async function importAntigen(filePath) {
  const records = readCsv(filePath);
  const rows = records.map((r, i) => ({
    locus: r.locus,
    antigen: r.antigen,
    frequency: toFrequency(r.frequency, i + 2),
  }));

  await sql`TRUNCATE antigen_frequency`;
  for (const row of rows) {
    await sql`INSERT INTO antigen_frequency (locus, antigen, frequency) VALUES (${row.locus}, ${row.antigen}, ${row.frequency})`;
  }
  console.log(`Imported ${rows.length} antigen frequency rows.`);
}

async function importAllele(filePath) {
  const records = readCsv(filePath);
  const rows = records.map((r, i) => ({
    locus: r.locus,
    allele: r.allele,
    frequency: toFrequency(r.frequency, i + 2),
  }));

  await sql`TRUNCATE allele_frequency`;
  for (const row of rows) {
    await sql`INSERT INTO allele_frequency (locus, allele, frequency) VALUES (${row.locus}, ${row.allele}, ${row.frequency})`;
  }
  console.log(`Imported ${rows.length} allele frequency rows.`);
}

function toHaplotypeRow(r, haplotypeType, rowNum) {
  const row = { haplotype_type: haplotypeType, frequency: toFrequency(r.frequency, rowNum) };
  for (const [col, header] of Object.entries(HAPLOTYPE_LOCI)) {
    row[col] = r[header.toLowerCase()] || null;
  }
  return row;
}

async function insertHaplotypeRows(haplotypeType, rows) {
  await sql`DELETE FROM haplotype_frequency WHERE haplotype_type = ${haplotypeType}`;
  for (const row of rows) {
    await sql`
      INSERT INTO haplotype_frequency (haplotype_type, a, b, drb1, dqb1, frequency)
      VALUES (${row.haplotype_type}, ${row.a}, ${row.b}, ${row.drb1}, ${row.dqb1}, ${row.frequency})
    `;
  }
  console.log(`Imported ${rows.length} haplotype frequency rows for ${haplotypeType}.`);
}

// Supports two CSV shapes:
// 1. A combined file with a "Type" column covering multiple haplotype
//    combos (each combo's rows replaced independently).
// 2. A single-combo file, paired with an explicit haplotypeType argument.
async function importHaplotype(filePath, haplotypeType) {
  const records = readCsv(filePath);
  const hasTypeColumn = records.length > 0 && 'type' in records[0];

  if (hasTypeColumn) {
    const byType = new Map();
    records.forEach((r, i) => {
      const type = r.type;
      if (!HAPLOTYPE_TYPES.includes(type)) {
        throw new Error(`Row ${i + 2}: unknown haplotype type "${type}". Expected one of: ${HAPLOTYPE_TYPES.join(', ')}`);
      }
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(toHaplotypeRow(r, type, i + 2));
    });

    for (const [type, rows] of byType) {
      await insertHaplotypeRows(type, rows);
    }
    return;
  }

  if (!haplotypeType) {
    throw new Error(
      `This file has no "Type" column, so a haplotype type argument is required. Expected one of: ${HAPLOTYPE_TYPES.join(', ')}`
    );
  }
  if (!HAPLOTYPE_TYPES.includes(haplotypeType)) {
    throw new Error(
      `Unknown haplotype type "${haplotypeType}". Expected one of: ${HAPLOTYPE_TYPES.join(', ')}`
    );
  }

  const rows = records.map((r, i) => toHaplotypeRow(r, haplotypeType, i + 2));
  await insertHaplotypeRows(haplotypeType, rows);
}

async function main() {
  const [kind, filePath, extra] = process.argv.slice(2);

  if (!kind || !filePath) {
    console.error(
      'Usage:\n' +
        '  node scripts/import-frequency.js antigen <file.csv>\n' +
        '  node scripts/import-frequency.js allele <file.csv>\n' +
        '  node scripts/import-frequency.js haplotype <file.csv>              (file has a "Type" column)\n' +
        '  node scripts/import-frequency.js haplotype <file.csv> "A~B~DRB1"   (single-combo file)'
    );
    process.exit(1);
  }

  if (kind === 'antigen') {
    await importAntigen(filePath);
  } else if (kind === 'allele') {
    await importAllele(filePath);
  } else if (kind === 'haplotype') {
    await importHaplotype(filePath, extra);
  } else {
    console.error(`Unknown kind "${kind}". Expected: antigen | allele | haplotype`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
