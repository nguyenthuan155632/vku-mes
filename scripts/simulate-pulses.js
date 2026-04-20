#!/usr/bin/env node
// Demo pulse generator. Usage:
//   node scripts/simulate-pulses.js --base http://localhost:3000 --token dev-token --password supervisor123 [--duration 60]

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
  return acc;
}, []));

const base = args.base ?? 'http://localhost:3000';
const token = args.token ?? process.env.PULSE_INGEST_TOKEN;
const password = args.password ?? process.env.SUPERVISOR_PASSWORD ?? 'supervisor123';
const durationSec = args.duration ? Number(args.duration) : Infinity;

if (!token) { console.error('Missing --token or PULSE_INGEST_TOKEN'); process.exit(1); }

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const cookie = res.headers.get('set-cookie');
  return cookie?.split(';')[0] ?? '';
}

async function listWorkcenters(cookie) {
  const res = await fetch(`${base}/api/workcenters`, { headers: { cookie } });
  if (!res.ok) throw new Error(`workcenters list failed: ${res.status}`);
  return res.json();
}

async function sendPulse(wcId, qty) {
  const res = await fetch(`${base}/api/pulse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ workcenter_id: wcId, qty, source: 'sensor' })
  });
  if (!res.ok) console.warn(`pulse failed ${res.status}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const silentUntil = new Map();

(async () => {
  const cookie = await login();
  const wcs = (await listWorkcenters(cookie)).filter((w) => w.targetQtyPerHour > 0);
  if (!wcs.length) { console.error('no workcenters with positive target'); process.exit(1); }
  console.log(`simulating pulses for ${wcs.length} workcenters`);

  const start = Date.now();
  while ((Date.now() - start) / 1000 < durationSec) {
    // 5% chance to silence a random workcenter for 12 minutes
    if (Math.random() < 0.05) {
      const victim = wcs[Math.floor(Math.random() * wcs.length)];
      silentUntil.set(victim.id, Date.now() + 12 * 60_000);
      console.log(`silencing WC ${victim.code} for 12 minutes`);
    }
    const wc = wcs[Math.floor(Math.random() * wcs.length)];
    if ((silentUntil.get(wc.id) ?? 0) > Date.now()) { await sleep(1000); continue; }
    const qty = 1 + Math.floor(Math.random() * 3);
    await sendPulse(wc.id, qty);
    await sleep(2000 + Math.random() * 3000);
  }
  console.log('simulator done');
})().catch((e) => { console.error(e); process.exit(1); });
