export async function register() {
  // Only start the worker inside the Node.js runtime (not the Edge runtime).
  // Next.js guarantees register() is called exactly once per process.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./worker/index');
  }
}
