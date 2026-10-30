import fs from "node:fs";
export const defaults = () => ({ users: [], creators: [], bookings: [], payments: [], sessions: {}, events: {}, tokens: {}, audit: [], seq: 1 });
function wrap(d, save, extra = {}) { return { d, id: p => p + (d.seq++), save, ...extra }; }

// File store: fine for tests and a single small server. Synchronous.
export function createStore(file) {
  let d = defaults();
  if (file && fs.existsSync(file)) { try { d = { ...d, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch {} }
  return wrap(d, () => { if (!file) return; const t = file + ".tmp"; fs.writeFileSync(t, JSON.stringify(d)); fs.renameSync(t, file); });
}

// Postgres store: the whole state lives in one JSONB row with a version number.
// A second server instance that writes first makes this one fail loudly instead of overwriting its data.
export async function createPgStore(pool) {
  await pool.query("CREATE TABLE IF NOT EXISTS shootly_state (id int PRIMARY KEY, data jsonb NOT NULL, version bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())");
  const r = await pool.query("SELECT data, version FROM shootly_state WHERE id = 1");
  const d = defaults();
  let version = 0;
  if (r.rows[0]) { Object.assign(d, r.rows[0].data); version = Number(r.rows[0].version); }
  else await pool.query("INSERT INTO shootly_state (id, data, version) VALUES (1, $1::jsonb, 0) ON CONFLICT (id) DO NOTHING", [JSON.stringify(d)]);
  let chain = Promise.resolve();
  const save = () => {
    const run = chain.then(async () => {
      const res = await pool.query("UPDATE shootly_state SET data = $1::jsonb, version = version + 1, updated_at = now() WHERE id = 1 AND version = $2 RETURNING version", [JSON.stringify(d), version]);
      if (!res.rows.length) throw new Error("The database changed under this server. Run only one server instance.");
      version = Number(res.rows[0].version);
    });
    chain = run.catch(() => {});
    return run;
  };
  return wrap(d, save, { close: () => pool.end() });
}

export async function openStore(env, defaultFile) {
  if (env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5, ssl: env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined });
    return createPgStore(pool);
  }
  if (env.NODE_ENV === "production" && !env.DATA_FILE) throw new Error("Set DATABASE_URL (recommended) or DATA_FILE in production.");
  return createStore(env.DATA_FILE || defaultFile);
}
