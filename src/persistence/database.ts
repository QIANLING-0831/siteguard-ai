import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { applySchema, seedDatabase } from "./schema";

const globalDatabase = globalThis as typeof globalThis & { siteGuardDb?: DatabaseSync };

export function getDatabase() {
  if (globalDatabase.siteGuardDb) return globalDatabase.siteGuardDb;
  const filename = process.env.SITEGUARD_DB_PATH ?? join(process.cwd(), ".runtime", "siteguard.sqlite");
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  applySchema(db);
  seedDatabase(db);
  globalDatabase.siteGuardDb = db;
  return db;
}
