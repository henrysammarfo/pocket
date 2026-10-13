import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../../drizzle/schema";

function createDb() {
  const url = process.env["DATABASE_URL"] || process.env["DATABASE_URL_UNPOOLED"] || process.env["POSTGRES_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not configured. Attach Neon via Vercel Storage Marketplace.");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

/** Lazy Neon + Drizzle client — safe when env is missing at build time. */
export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

export type Db = ReturnType<typeof getDb>;
