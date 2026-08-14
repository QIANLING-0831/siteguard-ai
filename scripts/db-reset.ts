import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { applySchema, seedDatabase } from "../src/persistence/schema.ts";

const root = resolve(import.meta.dirname, "..");
const filename = resolve(process.env.SITEGUARD_DB_PATH ?? join(root, ".runtime", "siteguard.sqlite"));
const runtimeRoot = resolve(root, ".runtime");
if (!filename.startsWith(`${runtimeRoot}\\`) && !process.env.SITEGUARD_DB_PATH) {
  throw new Error(`拒绝重置工作区之外的数据库: ${filename}`);
}

mkdirSync(dirname(filename), { recursive: true });
const db = new DatabaseSync(filename);
db.exec(`PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = OFF;
  DROP TABLE IF EXISTS audit_events;
  DROP TABLE IF EXISTS verifications;
  DROP TABLE IF EXISTS rectification_orders;
  DROP TABLE IF EXISTS hazard_cases;
  DROP TABLE IF EXISTS findings;
  DROP TABLE IF EXISTS observed_persons;
  DROP TABLE IF EXISTS evidence_duplicates;
  DROP TABLE IF EXISTS evidence;
  DROP TABLE IF EXISTS inspections;
  DROP TABLE IF EXISTS project_members;
  DROP TABLE IF EXISTS projects;
  PRAGMA foreign_keys = ON;`);
applySchema(db);
seedDatabase(db, root);
db.close();
console.log(`SiteGuard 数据库已创建并写入演示数据: ${filename}`);
