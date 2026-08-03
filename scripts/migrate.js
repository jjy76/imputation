const { loadEnvLocal } = require('./load-env');
loadEnvLocal();

const { sql } = require('../lib/db');

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS antigen_frequency (
      id SERIAL PRIMARY KEY,
      locus TEXT NOT NULL,
      antigen TEXT NOT NULL,
      frequency NUMERIC NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_antigen_frequency_locus ON antigen_frequency (locus)`;

  await sql`
    CREATE TABLE IF NOT EXISTS allele_frequency (
      id SERIAL PRIMARY KEY,
      locus TEXT NOT NULL,
      allele TEXT NOT NULL,
      frequency NUMERIC NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_allele_frequency_locus ON allele_frequency (locus)`;

  await sql`
    CREATE TABLE IF NOT EXISTS haplotype_frequency (
      id SERIAL PRIMARY KEY,
      haplotype_type TEXT NOT NULL,
      a TEXT,
      b TEXT,
      drb1 TEXT,
      dqb1 TEXT,
      frequency NUMERIC NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_haplotype_frequency_type ON haplotype_frequency (haplotype_type)`;

  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
