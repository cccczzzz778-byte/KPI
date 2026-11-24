import pg from "pg";

const { Pool } = pg;

type GlobalWithPool = typeof globalThis & { __kpiPgPool?: pg.Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL sozlanmagan.");
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getKpiDatabase() {
  const globalForPool = globalThis as GlobalWithPool;
  if (!globalForPool.__kpiPgPool) globalForPool.__kpiPgPool = createPool();
  return { pool: globalForPool.__kpiPgPool };
}
