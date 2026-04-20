import { Pool } from 'pg';

const SEED = [
  { code: 'WC01', name: 'Máy Đóng Gói 01',    target_qty_per_hour: 600 },
  { code: 'WC02', name: 'Máy Nén Khí 02',     target_qty_per_hour: 0   },
  { code: 'WC03', name: 'Máy Kiểm Tra QC 03', target_qty_per_hour: 450 },
  { code: 'WC04', name: 'Máy Phay CNC 04',    target_qty_per_hour: 200 }
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  for (const wc of SEED) {
    await pool.query(
      `INSERT INTO workcenters (code, name, target_qty_per_hour)
       VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
      [wc.code, wc.name, wc.target_qty_per_hour]
    );
  }
  console.log(`[seed] ${SEED.length} workcenters ready`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
