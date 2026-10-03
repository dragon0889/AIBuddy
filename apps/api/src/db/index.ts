import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  /** Chạy nhiều câu lệnh không tham số (migration). */
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createPgliteDb(): Promise<Db> {
  const lite = new PGlite();
  await lite.waitReady;
  const wrap = (q: { query: PGlite["query"]; exec: PGlite["exec"] }): Pick<Db, "query" | "exec"> => ({
    async query(sql, params) {
      const r = await q.query(sql, params as unknown[]);
      return { rows: r.rows as never, rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(sql) {
      await q.exec(sql);
    },
  });
  const db: Db = {
    ...wrap(lite as never),
    tx: (fn) =>
      lite.transaction(async (t) => {
        const inner: Db = { ...wrap(t as never), tx: (f) => f(inner), close: async () => {} } as Db;
        return fn(inner);
      }),
    close: () => lite.close(),
  } as Db;
  return db;
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<pg.QueryResult> }): Pick<Db, "query" | "exec"> => ({
    async query(sql, params) {
      const r = await c.query(sql, params);
      return { rows: r.rows as never, rowCount: r.rowCount ?? r.rows.length };
    },
    async exec(sql) {
      await c.query(sql);
    },
  });
  return {
    ...wrap(pool),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inner: Db = { ...wrap(client), tx: (f) => f(inner), close: async () => {} } as Db;
        const out = await fn(inner);
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  } as Db;
}
