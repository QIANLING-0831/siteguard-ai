import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL, role TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), area TEXT NOT NULL,
  executor TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES inspections(id), purpose TEXT NOT NULL,
  source_label TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, content BLOB NOT NULL,
  model TEXT, adapter TEXT, created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', void_reason TEXT, voided_at TEXT, voided_by TEXT,
  content_sha256 TEXT, visual_hash TEXT
);
CREATE TABLE IF NOT EXISTS evidence_duplicates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL REFERENCES inspections(id),
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  candidate_evidence_id TEXT NOT NULL REFERENCES evidence(id),
  time_delta_seconds INTEGER NOT NULL,
  similarity REAL NOT NULL,
  method TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'suggested',
  created_at TEXT NOT NULL,
  UNIQUE(evidence_id, candidate_evidence_id)
);
CREATE TABLE IF NOT EXISTS observed_persons (
  id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL REFERENCES evidence(id), external_id TEXT NOT NULL,
  x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL, height REAL NOT NULL,
  helmet_status TEXT NOT NULL, confidence REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES inspections(id), evidence_id TEXT NOT NULL REFERENCES evidence(id),
  subject_detection_id TEXT NOT NULL, title TEXT NOT NULL, label TEXT NOT NULL, confidence REAL NOT NULL,
  severity_suggestion TEXT NOT NULL, status TEXT NOT NULL, model TEXT NOT NULL,
  created_at TEXT NOT NULL, reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS hazard_cases (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), finding_id TEXT UNIQUE REFERENCES findings(id),
  title TEXT NOT NULL, zone TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL,
  detail TEXT NOT NULL, created_at TEXT NOT NULL, closed_at TEXT
);
CREATE TABLE IF NOT EXISTS rectification_orders (
  id TEXT PRIMARY KEY, hazard_case_id TEXT NOT NULL UNIQUE REFERENCES hazard_cases(id),
  owner_id TEXT NOT NULL REFERENCES project_members(id), due_label TEXT NOT NULL, status TEXT NOT NULL,
  rectification_evidence_id TEXT REFERENCES evidence(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES rectification_orders(id), decision TEXT NOT NULL,
  note TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL REFERENCES projects(id), entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_inspection ON findings(inspection_id);
CREATE INDEX IF NOT EXISTS idx_hazards_project ON hazard_cases(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_duplicates_inspection ON evidence_duplicates(inspection_id, decision);
`;

export function applySchema(db: DatabaseSync) {
  db.exec(SCHEMA_SQL);
  const columns = new Set((db.prepare("PRAGMA table_info(evidence)").all() as Array<{ name: string }>).map((item) => item.name));
  const migrations = [
    ["status", "TEXT NOT NULL DEFAULT 'active'"],
    ["void_reason", "TEXT"],
    ["voided_at", "TEXT"],
    ["voided_by", "TEXT"],
    ["content_sha256", "TEXT"],
    ["visual_hash", "TEXT"],
  ] as const;
  migrations.forEach(([name, definition]) => {
    if (!columns.has(name)) db.exec(`ALTER TABLE evidence ADD COLUMN ${name} ${definition}`);
  });
  db.exec("CREATE INDEX IF NOT EXISTS idx_evidence_inspection_status ON evidence(inspection_id,status,created_at DESC)");
}

export function seedDatabase(db: DatabaseSync, root = process.cwd()) {
  const projectCount = Number((db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number }).count);
  if (projectCount > 0) return;

  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const project = db.prepare("INSERT INTO projects(id,name,location) VALUES (?,?,?)");
    project.run("project-1", "科创中心二期", "滨江区 · 智造路 88 号");
    project.run("project-2", "滨江人才公寓", "滨江区 · 江虹路");
    project.run("project-3", "地铁 8 号线三标段", "三标段施工区");

    const member = db.prepare("INSERT INTO project_members(id,project_id,name,role) VALUES (?,?,?,?)");
    [["member-li", "李工", "安全员"], ["member-wang", "王强", "施工负责人"], ["member-zhao", "赵敏", "项目经理"], ["member-chen", "陈安全", "复核人"]]
      .forEach(([id, name, role]) => member.run(id, "project-1", name, role));
    member.run("member-2-li", "project-2", "李工", "安全员");
    member.run("member-3-wang", "project-3", "王强", "施工负责人");

    db.prepare("INSERT INTO inspections(id,project_id,area,executor,status,created_at) VALUES (?,?,?,?,?,?)")
      .run("inspection-demo-1", "project-1", "全场安全帽专项巡检 · 早班", "李工", "active", now);

    type SeedPerson = [number, number, number, number, "helmet" | "no_helmet" | "uncertain", number];
    const evidenceSpecs: Array<{ file: string; mime: string; source: string; zone: string; people: SeedPerson[] }> = [
      { file: "construction-workers-tools.jpg", mime: "image/jpeg", source: "北门固定摄像头 01 · 基坑作业区", zone: "基坑作业区", people: [
        [0.04,0.17,0.21,0.42,"no_helmet",0.81],[0.29,0.13,0.20,0.49,"no_helmet",0.84],[0.70,0.42,0.25,0.51,"uncertain",0.63],
      ] },
      { file: "ironworkers.jpg", mime: "image/jpeg", source: "塔楼固定摄像头 03 · 钢结构作业面", zone: "钢结构作业面", people: [
        [0.04,0.28,0.38,0.55,"helmet",0.94],[0.42,0.18,0.43,0.66,"helmet",0.92],
      ] },
      { file: "site-floor.png", mime: "image/png", source: "2号楼摄像头 08 · 三层钢筋作业面", zone: "2号楼三层钢筋作业面", people: [
        [0.04,0.43,0.10,0.44,"no_helmet",0.87],[0.15,0.28,0.09,0.34,"no_helmet",0.91],[0.25,0.08,0.08,0.20,"helmet",0.93],[0.37,0.07,0.07,0.20,"helmet",0.92],
        [0.45,0.16,0.08,0.23,"helmet",0.90],[0.43,0.32,0.10,0.30,"helmet",0.95],[0.63,0.20,0.09,0.34,"no_helmet",0.88],[0.78,0.24,0.09,0.35,"helmet",0.93],
        [0.67,0.62,0.11,0.28,"helmet",0.91],[0.32,0.60,0.12,0.36,"helmet",0.94],[0.24,0.15,0.06,0.17,"helmet",0.89],[0.91,0.19,0.08,0.30,"helmet",0.90],
      ] },
      { file: "underground-mep.png", mime: "image/png", source: "地下室摄像头 B2-04 · 机电安装区", zone: "地下室B2机电安装区", people: [
        [0.04,0.37,0.10,0.34,"helmet",0.94],[0.22,0.15,0.07,0.23,"helmet",0.91],[0.27,0.37,0.11,0.48,"no_helmet",0.90],[0.41,0.36,0.07,0.31,"helmet",0.92],
        [0.52,0.38,0.08,0.24,"helmet",0.88],[0.65,0.14,0.07,0.34,"helmet",0.91],[0.72,0.37,0.06,0.19,"helmet",0.86],[0.74,0.36,0.13,0.48,"no_helmet",0.89],
        [0.86,0.35,0.08,0.25,"helmet",0.93],[0.55,0.36,0.07,0.25,"uncertain",0.68],
      ] },
      { file: "facade-scaffold.png", mime: "image/png", source: "外立面摄像头 11 · 脚手架与材料区", zone: "外立面脚手架与材料区", people: [
        [0.14,0.03,0.08,0.23,"helmet",0.94],[0.43,0.04,0.08,0.22,"helmet",0.91],[0.65,0.06,0.09,0.20,"helmet",0.92],[0.28,0.39,0.08,0.20,"helmet",0.89],
        [0.17,0.55,0.08,0.25,"helmet",0.93],[0.28,0.64,0.07,0.24,"helmet",0.90],[0.56,0.57,0.08,0.27,"helmet",0.91],[0.62,0.63,0.08,0.24,"no_helmet",0.87],
        [0.68,0.62,0.08,0.25,"no_helmet",0.90],[0.73,0.62,0.08,0.26,"no_helmet",0.89],[0.84,0.61,0.08,0.27,"helmet",0.92],
      ] },
      { file: "rebar-yard.png", mime: "image/png", source: "材料场摄像头 06 · 钢筋加工与卸料区", zone: "钢筋加工与卸料区", people: [
        [0.11,0.09,0.10,0.22,"no_helmet",0.86],[0.19,0.03,0.08,0.23,"no_helmet",0.88],[0.16,0.33,0.08,0.24,"helmet",0.91],[0.29,0.39,0.09,0.29,"helmet",0.93],
        [0.43,0.22,0.07,0.22,"helmet",0.92],[0.52,0.47,0.09,0.22,"helmet",0.94],[0.68,0.36,0.08,0.24,"no_helmet",0.90],[0.74,0.16,0.07,0.23,"helmet",0.89],
        [0.80,0.22,0.07,0.22,"helmet",0.91],[0.86,0.38,0.08,0.25,"no_helmet",0.88],[0.77,0.61,0.10,0.25,"helmet",0.92],[0.17,0.69,0.10,0.28,"no_helmet",0.89],
        [0.29,0.84,0.09,0.15,"no_helmet",0.83],[0.91,0.06,0.05,0.14,"no_helmet",0.84],
      ] },
    ];
    const addEvidence = db.prepare("INSERT INTO evidence(id,inspection_id,purpose,source_label,file_name,mime_type,content,model,adapter,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
    const addPerson = db.prepare("INSERT INTO observed_persons(id,evidence_id,external_id,x,y,width,height,helmet_status,confidence) VALUES (?,?,?,?,?,?,?,?,?)");
    const addFinding = db.prepare("INSERT INTO findings(id,inspection_id,evidence_id,subject_detection_id,title,label,confidence,severity_suggestion,status,model,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    let findingNumber = 1;
    evidenceSpecs.forEach((spec, evidenceIndex) => {
      const evidenceId = `evidence-demo-${evidenceIndex + 1}`;
      const createdAt = new Date(Date.now() - (evidenceSpecs.length - 1 - evidenceIndex) * 5 * 60_000).toISOString();
      const content = readFileSync(join(root, "public", "demo", spec.file));
      addEvidence.run(evidenceId, "inspection-demo-1", "inspection", spec.source, spec.file, spec.mime, content, "SiteGuard 合成场景演示标注 v2", "seeded-demo", createdAt);
      db.prepare("UPDATE evidence SET content_sha256=? WHERE id=?").run(createHash("sha256").update(content).digest("hex"), evidenceId);
      spec.people.forEach(([x,y,width,height,status,confidence], personIndex) => {
        const personId = `person-${personIndex + 1}`;
        addPerson.run(`${evidenceId}:${personId}`, evidenceId, personId, x, y, width, height, status, confidence);
        if (status === "no_helmet") {
          addFinding.run(`finding-demo-${findingNumber++}`, "inspection-demo-1", evidenceId, personId, `${spec.zone}作业人员疑似未佩戴安全帽`, "suspected_no_helmet", confidence, "high", "pending_confirmation", "SiteGuard 合成场景演示标注 v2", createdAt);
        }
      });
    });

    const duplicateContent = readFileSync(join(root, "public", "demo", "site-floor.png"));
    const duplicateCreatedAt = new Date(Date.now() - 14.5 * 60_000).toISOString();
    db.prepare(`INSERT INTO evidence(
      id,inspection_id,purpose,source_label,file_name,mime_type,content,model,adapter,created_at,
      status,void_reason,voided_at,voided_by,content_sha256
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      "evidence-demo-7", "inspection-demo-1", "inspection", "2号楼摄像头 08 · 三层钢筋作业面 · 连续抓拍",
      "site-floor-duplicate.png", "image/png", duplicateContent, "SiteGuard 合成场景演示标注 v2", "seeded-demo",
      duplicateCreatedAt, "voided", "连续抓拍重复画面（演示）", now, "李工",
      createHash("sha256").update(duplicateContent).digest("hex"),
    );
    db.prepare(`INSERT INTO evidence_duplicates(
      inspection_id,evidence_id,candidate_evidence_id,time_delta_seconds,similarity,method,decision,created_at
    ) VALUES (?,?,?,?,?,?,?,?)`).run(
      "inspection-demo-1", "evidence-demo-7", "evidence-demo-3", 30, 1, "exact_sha256", "voided", now,
    );

    Array.from({ length: 8 }, (_, duplicateIndex) => {
      const evidenceId = `evidence-demo-${duplicateIndex + 8}`;
      const timeDeltaSeconds = 45 + duplicateIndex * 15;
      const pendingDuplicateCreatedAt = new Date(Date.now() - 15 * 60_000 + timeDeltaSeconds * 1000).toISOString();
      db.prepare(`INSERT INTO evidence(
        id,inspection_id,purpose,source_label,file_name,mime_type,content,model,adapter,created_at,content_sha256
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        evidenceId, "inspection-demo-1", "inspection", `2号楼摄像头 08 · 三层钢筋作业面 · 连续抓拍 ${String(duplicateIndex + 2).padStart(2, "0")}`,
        `site-floor-pending-duplicate-${duplicateIndex + 1}.png`, "image/png", duplicateContent, "SiteGuard 合成场景演示标注 v2", "seeded-demo",
        pendingDuplicateCreatedAt, createHash("sha256").update(duplicateContent).digest("hex"),
      );
      evidenceSpecs[2].people.forEach(([x,y,width,height,status,confidence], personIndex) => {
        const personId = `person-${personIndex + 1}`;
        addPerson.run(`${evidenceId}:${personId}`, evidenceId, personId, x, y, width, height, status, confidence);
        if (status === "no_helmet") {
          addFinding.run(`finding-demo-${findingNumber++}`, "inspection-demo-1", evidenceId, personId, "2号楼三层钢筋作业面作业人员疑似未佩戴安全帽", "suspected_no_helmet", confidence, "high", "pending_confirmation", "SiteGuard 合成场景演示标注 v2", pendingDuplicateCreatedAt);
        }
      });
      db.prepare(`INSERT INTO evidence_duplicates(
        inspection_id,evidence_id,candidate_evidence_id,time_delta_seconds,similarity,method,decision,created_at
      ) VALUES (?,?,?,?,?,?,?,?)`).run(
        "inspection-demo-1", evidenceId, "evidence-demo-3", timeDeltaSeconds, 1, "exact_sha256", "suggested", now,
      );
    });

    const hazard = db.prepare("INSERT INTO hazard_cases(id,project_id,finding_id,title,zone,severity,status,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?)");
    hazard.run("H-023", "project-1", null, "材料堆放侵占消防通道", "地下室 · B2区", "critical", "rectifying", "现场复查发现消防通道净宽不足，整改期限为今日 18:00。", now);
    hazard.run("H-021", "project-1", null, "配电箱防护门未关闭", "1号楼 · 首层", "medium", "pending_verification", "责任班组已上传整改照片，等待安全员复核。", now);
    const order = db.prepare("INSERT INTO rectification_orders(id,hazard_case_id,owner_id,due_label,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
    order.run("R-023", "H-023", "member-wang", "今日 18:00", "rectifying", now, now);
    order.run("R-021", "H-021", "member-zhao", "24 小时内", "pending_verification", now, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
