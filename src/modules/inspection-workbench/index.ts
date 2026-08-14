import "server-only";

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { fingerprintEvidence, visualHashSimilarity } from "@/infrastructure/evidence-similarity";
import { getDatabase } from "@/persistence/database";
import type { VisionInspectionResult } from "@/vision/contracts";
import type { ExistingHazard, WorkbenchCommand, WorkbenchEvidence, WorkbenchSnapshot } from "./contracts";

type Row = Record<string, string | number | null>;

function rows(db: DatabaseSync, sql: string, ...params: string[]) {
  return db.prepare(sql).all(...params) as Row[];
}

function row(db: DatabaseSync, sql: string, ...params: string[]) {
  return db.prepare(sql).get(...params) as Row | undefined;
}

function severityLabel(value: string): ExistingHazard["level"] {
  return ({ low: "低", medium: "中", high: "高", critical: "重大" } as const)[value as "low"] ?? "中";
}

function statusLabel(value: string) {
  return ({ open: "待派单", assigned: "已派单", rectifying: "整改中", pending_verification: "待复核", closed: "已关闭" } as Record<string, string>)[value] ?? value;
}

function audit(db: DatabaseSync, projectId: string, entityType: string, entityId: string, action: string, detail: string) {
  db.prepare("INSERT INTO audit_events(project_id,entity_type,entity_id,action,detail,created_at) VALUES (?,?,?,?,?,?)")
    .run(projectId, entityType, entityId, action, detail, new Date().toISOString());
}

function sourceOrigin(label: string) {
  return label.split(" · ")[0].trim();
}

function mapEvidence(db: DatabaseSync, evidenceRow: Row): WorkbenchEvidence {
  return {
    id: String(evidenceRow.id), inspectionId: String(evidenceRow.inspection_id), sourceLabel: String(evidenceRow.source_label),
    capturedAt: String(evidenceRow.created_at), contentUrl: `/api/evidence/${evidenceRow.id}/content`,
    model: evidenceRow.model ? String(evidenceRow.model) : null, adapter: evidenceRow.adapter ? String(evidenceRow.adapter) : null,
    status: String(evidenceRow.status) as "active" | "voided",
    voidReason: evidenceRow.void_reason ? String(evidenceRow.void_reason) : null,
    voidedAt: evidenceRow.voided_at ? String(evidenceRow.voided_at) : null,
    voidedBy: evidenceRow.voided_by ? String(evidenceRow.voided_by) : null,
    persons: rows(db, "SELECT external_id,x,y,width,height,helmet_status,confidence FROM observed_persons WHERE evidence_id=? ORDER BY rowid", String(evidenceRow.id)).map((item) => ({
      id: String(item.external_id),
      box: { x: Number(item.x), y: Number(item.y), width: Number(item.width), height: Number(item.height) },
      helmetStatus: String(item.helmet_status) as "helmet" | "no_helmet" | "uncertain",
      confidence: Number(item.confidence),
    })),
  };
}

export function getWorkbenchSnapshot(requestedProjectId?: string): WorkbenchSnapshot {
  const db = getDatabase();
  const projects = rows(db, "SELECT id,name,location FROM projects ORDER BY rowid").map((item) => ({
    id: String(item.id), name: String(item.name), location: String(item.location),
  }));
  const project = projects.find((item) => item.id === requestedProjectId) ?? projects[0];
  if (!project) throw new Error("项目数据库尚未初始化");

  const members = rows(db, "SELECT id,name,role FROM project_members WHERE project_id=? ORDER BY rowid", project.id).map((item) => ({
    id: String(item.id), name: String(item.name), role: String(item.role),
  }));
  const inspectionRow = row(db, `SELECT id,area,executor,status,created_at FROM inspections
    WHERE project_id=? ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END,created_at DESC,rowid DESC LIMIT 1`, project.id);
  const inspection = inspectionRow ? {
    id: String(inspectionRow.id), name: String(inspectionRow.area), executor: String(inspectionRow.executor),
    status: String(inspectionRow.status), startedAt: String(inspectionRow.created_at),
  } : null;
  const evidenceRows = inspection ? rows(db, `SELECT id,inspection_id,source_label,created_at,model,adapter,status,void_reason,voided_at,voided_by
    FROM evidence WHERE inspection_id=? AND purpose='inspection' AND status='active' ORDER BY created_at DESC,rowid DESC`, inspection.id) : [];
  const voidedEvidenceRows = inspection ? rows(db, `SELECT id,inspection_id,source_label,created_at,model,adapter,status,void_reason,voided_at,voided_by
    FROM evidence WHERE inspection_id=? AND purpose='inspection' AND status='voided' ORDER BY voided_at DESC,rowid DESC`, inspection.id) : [];
  const evidences = evidenceRows.map((item) => mapEvidence(db, item));
  const voidedEvidences = voidedEvidenceRows.map((item) => mapEvidence(db, item));
  const evidence = evidences[0] ?? null;
  const pendingDuplicateEvidenceIds = inspection ? new Set(rows(db, `SELECT evidence_id FROM evidence_duplicates
    WHERE inspection_id=? AND decision='suggested'`, inspection.id).map((item) => String(item.evidence_id))) : new Set<string>();
  const persons = evidences.filter((item) => !pendingDuplicateEvidenceIds.has(item.id)).flatMap((item) => item.persons);

  const findings = inspection ? rows(db, `SELECT f.*,h.id AS hazard_id,r.id AS order_id,r.status AS workflow_state,
      r.owner_id,m.name AS owner,r.due_label,r.rectification_evidence_id,re.file_name AS rectification_file
    FROM findings f
    JOIN evidence active_evidence ON active_evidence.id=f.evidence_id AND active_evidence.status='active'
    LEFT JOIN hazard_cases h ON h.finding_id=f.id
    LEFT JOIN rectification_orders r ON r.hazard_case_id=h.id
    LEFT JOIN project_members m ON m.id=r.owner_id
    LEFT JOIN evidence re ON re.id=r.rectification_evidence_id
    WHERE f.inspection_id=? AND NOT EXISTS (
      SELECT 1 FROM evidence_duplicates pending_duplicate
      WHERE pending_duplicate.evidence_id=f.evidence_id AND pending_duplicate.decision='suggested'
    ) ORDER BY f.created_at DESC,f.rowid DESC`, inspection.id).map((item) => ({
      id: String(item.id), inspectionId: String(item.inspection_id), evidenceId: String(item.evidence_id),
      subjectDetectionId: String(item.subject_detection_id), title: String(item.title), label: "suspected_no_helmet" as const,
      confidence: Number(item.confidence), severitySuggestion: String(item.severity_suggestion) as "low" | "medium" | "high" | "critical",
      status: "pending_confirmation" as const, model: String(item.model),
      reviewState: item.status === "confirmed" ? "confirmed" as const : item.status === "dismissed" ? "dismissed" as const : "pending" as const,
      ownerId: item.owner_id ? String(item.owner_id) : null, owner: item.owner ? String(item.owner) : null,
      dueDate: item.due_label ? String(item.due_label) : null, hazardId: item.hazard_id ? String(item.hazard_id) : null,
      orderId: item.order_id ? String(item.order_id) : null,
      workflowState: item.workflow_state ? String(item.workflow_state) as "assigned" | "rectifying" | "pending_verification" | "closed" : null,
      rectificationEvidence: item.rectification_file ? String(item.rectification_file) : null,
      rectificationEvidenceUrl: item.rectification_evidence_id ? `/api/evidence/${item.rectification_evidence_id}/content` : null,
    })) : [];

  const hazards = rows(db, `SELECT h.id,h.title,h.zone,h.severity,h.status,h.detail,m.name AS owner
    FROM hazard_cases h LEFT JOIN rectification_orders r ON r.hazard_case_id=h.id
    LEFT JOIN project_members m ON m.id=r.owner_id
    WHERE h.project_id=? AND h.finding_id IS NULL ORDER BY h.created_at DESC,h.id DESC`, project.id).map((item) => ({
      id: String(item.id), title: String(item.title), zone: String(item.zone), level: severityLabel(String(item.severity)),
      owner: item.owner ? String(item.owner) : "未指派", status: statusLabel(String(item.status)), detail: String(item.detail),
    }));

  const duplicateSuggestions = inspection ? rows(db, `SELECT d.id,d.evidence_id,d.candidate_evidence_id,d.time_delta_seconds,d.similarity,d.method,
      current.source_label,current.status,candidate.source_label AS candidate_source_label,candidate.status AS candidate_status
    FROM evidence_duplicates d
    JOIN evidence current ON current.id=d.evidence_id
    JOIN evidence candidate ON candidate.id=d.candidate_evidence_id
    WHERE d.inspection_id=? AND d.decision='suggested' AND current.status='active' AND candidate.status='active'
    ORDER BY d.created_at DESC,d.id DESC`, inspection.id).map((item) => ({
      id: Number(item.id), evidenceId: String(item.evidence_id), candidateEvidenceId: String(item.candidate_evidence_id),
      sourceLabel: String(item.source_label), candidateSourceLabel: String(item.candidate_source_label),
      timeDeltaSeconds: Number(item.time_delta_seconds), similarity: Number(item.similarity),
      method: String(item.method) as "exact_sha256" | "dhash",
    })) : [];

  return { project, projects, members, inspection, evidences, voidedEvidences, duplicateSuggestions, evidence, persons, findings, hazards };
}

export async function addInspectionEvidence(input: { projectId: string; sourceLabel: string; fileName: string; mimeType: string; content: Buffer }) {
  const db = getDatabase();
  if (!row(db, "SELECT id FROM projects WHERE id=?", input.projectId)) throw new Error("项目不存在");
  const activeInspection = row(db, "SELECT id FROM inspections WHERE project_id=? AND status='active' ORDER BY created_at DESC,rowid DESC LIMIT 1", input.projectId);
  const inspectionId = activeInspection ? String(activeInspection.id) : `inspection-${randomUUID()}`;
  const evidenceId = `evidence-${randomUUID()}`;
  const now = new Date().toISOString();
  const fingerprint = await fingerprintEvidence(input.content);
  const candidateRows = activeInspection ? rows(db, `SELECT id,source_label,created_at,content_sha256,visual_hash FROM evidence
    WHERE inspection_id=? AND purpose='inspection' AND status='active' AND created_at>=? ORDER BY created_at DESC`,
    inspectionId, new Date(Date.now() - 5 * 60_000).toISOString()) : [];
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!activeInspection) db.prepare("INSERT INTO inspections(id,project_id,area,executor,status,created_at) VALUES (?,?,?,?,?,?)")
      .run(inspectionId, input.projectId, "全场安全帽专项巡检", "当前操作员", "active", now);
    db.prepare("INSERT INTO evidence(id,inspection_id,purpose,source_label,file_name,mime_type,content,created_at,content_sha256,visual_hash) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(evidenceId, inspectionId, "inspection", input.sourceLabel, input.fileName, input.mimeType, input.content, now, fingerprint.sha256, fingerprint.visualHash);
    for (const candidate of candidateRows) {
      const exact = candidate.content_sha256 === fingerprint.sha256;
      const similarity = exact ? 1 : sourceOrigin(String(candidate.source_label)) === sourceOrigin(input.sourceLabel)
        ? visualHashSimilarity(fingerprint.visualHash, candidate.visual_hash ? String(candidate.visual_hash) : null) : null;
      if (similarity === null || similarity < 0.92) continue;
      const timeDeltaSeconds = Math.max(0, Math.round((Date.parse(now) - Date.parse(String(candidate.created_at))) / 1000));
      db.prepare(`INSERT OR IGNORE INTO evidence_duplicates(
        inspection_id,evidence_id,candidate_evidence_id,time_delta_seconds,similarity,method,decision,created_at
      ) VALUES (?,?,?,?,?,?,?,?)`).run(
        inspectionId, evidenceId, candidate.id, timeDeltaSeconds, similarity, exact ? "exact_sha256" : "dhash", "suggested", now,
      );
    }
    audit(db, input.projectId, "Evidence", evidenceId, "captured", input.sourceLabel);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { inspectionId, evidenceId };
}

export function recordVisionResult(result: VisionInspectionResult) {
  const db = getDatabase();
  const inspection = row(db, "SELECT project_id FROM inspections WHERE id=?", result.inspectionId);
  if (!inspection) throw new Error("巡检不存在");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE evidence SET model=?,adapter=? WHERE id=? AND inspection_id=?")
      .run(result.model, result.adapter, result.evidenceId, result.inspectionId);
    db.prepare("DELETE FROM findings WHERE evidence_id=?").run(result.evidenceId);
    db.prepare("DELETE FROM observed_persons WHERE evidence_id=?").run(result.evidenceId);
    const addPerson = db.prepare("INSERT INTO observed_persons(id,evidence_id,external_id,x,y,width,height,helmet_status,confidence) VALUES (?,?,?,?,?,?,?,?,?)");
    result.persons.forEach((person) => addPerson.run(`${result.evidenceId}:${person.id}`, result.evidenceId, person.id, person.box.x, person.box.y, person.box.width, person.box.height, person.helmetStatus, person.confidence));
    const addFinding = db.prepare("INSERT INTO findings(id,inspection_id,evidence_id,subject_detection_id,title,label,confidence,severity_suggestion,status,model,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    result.findings.forEach((finding) => addFinding.run(finding.id, finding.inspectionId, finding.evidenceId, finding.subjectDetectionId, finding.title, finding.label, finding.confidence, finding.severitySuggestion, "pending_confirmation", finding.model, new Date().toISOString()));
    audit(db, String(inspection.project_id), "Inspection", result.inspectionId, "ai_analyzed", `${result.model}; ${result.persons.length} persons; ${result.findings.length} findings`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function nextBusinessId(db: DatabaseSync, table: "hazard_cases" | "rectification_orders", prefix: "H" | "R") {
  const result = row(db, `SELECT COALESCE(MAX(CAST(SUBSTR(id,3) AS INTEGER)),100)+1 AS next FROM ${table}`);
  return `${prefix}-${String(Number(result?.next ?? 101)).padStart(3, "0")}`;
}

function executeEvidenceGovernanceCommand(command: Extract<WorkbenchCommand,
  { type: "void_evidence" | "restore_evidence" | "keep_duplicate" | "keep_one_void_rest" }>) {
  const db = getDatabase();
  const now = new Date().toISOString();

  if (command.type === "keep_one_void_rest") {
    db.exec("BEGIN IMMEDIATE");
    try {
      const suggestions = command.suggestionIds.map((suggestionId) => row(db, `SELECT d.id,d.evidence_id,d.candidate_evidence_id
        FROM evidence_duplicates d JOIN inspections i ON i.id=d.inspection_id
        WHERE d.id=? AND d.decision='suggested' AND i.project_id=?`, String(suggestionId), command.projectId));
      if (suggestions.some((item) => !item)) throw new Error("重复图组已经变化，请刷新后重试");

      const candidateIds = new Set(suggestions.map((item) => String(item?.candidate_evidence_id)));
      if (candidateIds.size !== 1) throw new Error("只能批量处理同一个重复图组");

      const groupEvidenceIds = new Set(suggestions.flatMap((item) => [String(item?.candidate_evidence_id), String(item?.evidence_id)]));
      if (!groupEvidenceIds.has(command.keepEvidenceId)) throw new Error("所选主证据不属于当前重复图组");

      const evidenceRows = Array.from(groupEvidenceIds, (evidenceId) => row(db, `SELECT e.id,e.status,e.purpose
        FROM evidence e JOIN inspections i ON i.id=e.inspection_id
        WHERE e.id=? AND i.project_id=?`, evidenceId, command.projectId));
      if (evidenceRows.some((item) => !item || item.purpose !== "inspection" || item.status !== "active")) {
        throw new Error("图组内存在已作废或无效证据，请刷新后重试");
      }

      const voidEvidenceIds = Array.from(groupEvidenceIds).filter((evidenceId) => evidenceId !== command.keepEvidenceId);
      for (const evidenceId of voidEvidenceIds) {
        const formalLink = row(db, `SELECT COUNT(*) AS count FROM hazard_cases h
          JOIN findings f ON f.id=h.finding_id WHERE f.evidence_id=?`, evidenceId);
        const rectificationLink = row(db, "SELECT COUNT(*) AS count FROM rectification_orders WHERE rectification_evidence_id=?", evidenceId);
        if (Number(formalLink?.count ?? 0) > 0 || Number(rectificationLink?.count ?? 0) > 0) {
          throw new Error("图组内有证据已进入隐患或整改闭环，本次批量操作未执行");
        }
      }

      for (const evidenceId of voidEvidenceIds) {
        const reason = `同类型重复证据批量作废；保留主证据 ${command.keepEvidenceId}`;
        db.prepare(`UPDATE evidence SET status='voided',void_reason=?,voided_at=?,voided_by='李工' WHERE id=?`)
          .run(reason, now, evidenceId);
        audit(db, command.projectId, "Evidence", evidenceId, "voided_as_duplicate", reason);
      }
      for (const suggestionId of command.suggestionIds) {
        db.prepare("UPDATE evidence_duplicates SET decision='voided' WHERE id=?").run(suggestionId);
      }
      audit(db, command.projectId, "Evidence", command.keepEvidenceId, "kept_as_duplicate_master", `保留为主证据，批量作废 ${voidEvidenceIds.length} 份同组证据`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return getWorkbenchSnapshot(command.projectId);
  }

  if (command.type === "keep_duplicate") {
    const suggestion = row(db, `SELECT d.id FROM evidence_duplicates d
      JOIN inspections i ON i.id=d.inspection_id WHERE d.id=? AND d.decision='suggested' AND i.project_id=?`, String(command.suggestionId), command.projectId);
    if (!suggestion) throw new Error("疑似重复记录不存在或不属于当前项目");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE evidence_duplicates SET decision='kept' WHERE id=?").run(command.suggestionId);
      audit(db, command.projectId, "DuplicateSuggestion", String(command.suggestionId), "kept_both", "人工决定保留两份证据");
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return getWorkbenchSnapshot(command.projectId);
  }

  const evidence = row(db, `SELECT e.id,e.status,e.purpose FROM evidence e
    JOIN inspections i ON i.id=e.inspection_id WHERE e.id=? AND i.project_id=?`, command.evidenceId, command.projectId);
  if (!evidence || evidence.purpose !== "inspection") throw new Error("巡检证据不存在或不属于当前项目");

  db.exec("BEGIN IMMEDIATE");
  try {
    if (command.type === "void_evidence") {
      if (evidence.status !== "active") throw new Error("该证据已经作废");
      const formalLink = row(db, `SELECT COUNT(*) AS count FROM hazard_cases h
        JOIN findings f ON f.id=h.finding_id WHERE f.evidence_id=?`, command.evidenceId);
      const rectificationLink = row(db, "SELECT COUNT(*) AS count FROM rectification_orders WHERE rectification_evidence_id=?", command.evidenceId);
      if (Number(formalLink?.count ?? 0) > 0 || Number(rectificationLink?.count ?? 0) > 0) {
        throw new Error("该证据已进入隐患或整改闭环，不能直接作废");
      }
      db.prepare(`UPDATE evidence SET status='voided',void_reason=?,voided_at=?,voided_by='李工' WHERE id=?`)
        .run(command.reason.trim(), now, command.evidenceId);
      db.prepare("UPDATE evidence_duplicates SET decision='voided' WHERE decision='suggested' AND (evidence_id=? OR candidate_evidence_id=?)")
        .run(command.evidenceId, command.evidenceId);
      audit(db, command.projectId, "Evidence", command.evidenceId, "voided", command.reason.trim());
    } else {
      if (evidence.status !== "voided") throw new Error("该证据当前不是作废状态");
      db.prepare("UPDATE evidence SET status='active',void_reason=NULL,voided_at=NULL,voided_by=NULL WHERE id=?").run(command.evidenceId);
      db.prepare("UPDATE evidence_duplicates SET decision='suggested' WHERE decision='voided' AND (evidence_id=? OR candidate_evidence_id=?)")
        .run(command.evidenceId, command.evidenceId);
      audit(db, command.projectId, "Evidence", command.evidenceId, "restored", "从作废证据集合恢复");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getWorkbenchSnapshot(command.projectId);
}

export function executeWorkbenchCommand(command: WorkbenchCommand) {
  if (command.type === "void_evidence" || command.type === "restore_evidence" || command.type === "keep_duplicate" || command.type === "keep_one_void_rest") {
    return executeEvidenceGovernanceCommand(command);
  }
  const db = getDatabase();
  const finding = row(db, `SELECT f.*,i.project_id FROM findings f JOIN inspections i ON i.id=f.inspection_id WHERE f.id=?`, command.findingId);
  if (!finding || finding.project_id !== command.projectId) throw new Error("Finding 不存在或不属于当前项目");
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (command.type === "review_finding") {
      if (row(db, "SELECT id FROM hazard_cases WHERE finding_id=?", command.findingId) && command.decision !== "confirmed") throw new Error("已生成整改单的 Finding 不能驳回");
      const status = command.decision === "pending" ? "pending_confirmation" : command.decision;
      db.prepare("UPDATE findings SET status=?,reviewed_at=? WHERE id=?").run(status, command.decision === "pending" ? null : now, command.findingId);
      audit(db, command.projectId, "Finding", command.findingId, `review_${command.decision}`, "人工审核");
    } else if (command.type === "assign_rectification") {
      if (finding.status !== "confirmed") throw new Error("必须先由人员确认 Finding");
      if (row(db, "SELECT id FROM hazard_cases WHERE finding_id=?", command.findingId)) throw new Error("该 Finding 已经派单");
      const owner = row(db, "SELECT id,name FROM project_members WHERE id=? AND project_id=?", command.ownerId, command.projectId);
      if (!owner) throw new Error("责任人不属于当前项目");
      const hazardId = nextBusinessId(db, "hazard_cases", "H");
      const orderId = nextBusinessId(db, "rectification_orders", "R");
      db.prepare("INSERT INTO hazard_cases(id,project_id,finding_id,title,zone,severity,status,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(hazardId, command.projectId, command.findingId, finding.title, "2号楼 · 三层东侧", finding.severity_suggestion, "assigned", "由人工确认 AI Finding 后创建。", now);
      db.prepare("INSERT INTO rectification_orders(id,hazard_case_id,owner_id,due_label,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
        .run(orderId, hazardId, command.ownerId, command.dueDate, "assigned", now, now);
      audit(db, command.projectId, "RectificationOrder", orderId, "assigned", `${owner.name}; ${command.dueDate}`);
    } else {
      const order = row(db, `SELECT r.*,h.id AS hazard_id FROM rectification_orders r JOIN hazard_cases h ON h.id=r.hazard_case_id WHERE h.finding_id=?`, command.findingId);
      if (!order) throw new Error("整改单不存在");
      if (command.type === "start_rectification") {
        if (order.status !== "assigned") throw new Error("只有已派单状态可以开始整改");
        db.prepare("UPDATE rectification_orders SET status='rectifying',updated_at=? WHERE id=?").run(now, order.id);
        db.prepare("UPDATE hazard_cases SET status='rectifying' WHERE id=?").run(order.hazard_id);
        audit(db, command.projectId, "RectificationOrder", String(order.id), "rectification_started", "责任人接单");
      } else {
        if (order.status !== "pending_verification") throw new Error("当前状态不能复核");
        const nextStatus = command.decision === "pass" ? "closed" : "rectifying";
        db.prepare("UPDATE rectification_orders SET status=?,updated_at=? WHERE id=?").run(nextStatus, now, order.id);
        db.prepare("UPDATE hazard_cases SET status=?,closed_at=? WHERE id=?").run(nextStatus, command.decision === "pass" ? now : null, order.hazard_id);
        db.prepare("INSERT INTO verifications(id,order_id,decision,note,created_at) VALUES (?,?,?,?,?)")
          .run(`verification-${randomUUID()}`, order.id, command.decision, command.decision === "pass" ? "复核通过并关闭" : "复核退回，需重新整改", now);
        audit(db, command.projectId, "Verification", String(order.id), `verification_${command.decision}`, "人工复核");
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getWorkbenchSnapshot(command.projectId);
}

export function addRectificationEvidence(input: { projectId: string; findingId: string; fileName: string; mimeType: string; content: Buffer }) {
  const db = getDatabase();
  const order = row(db, `SELECT r.id,r.status,r.hazard_case_id,f.inspection_id FROM rectification_orders r
    JOIN hazard_cases h ON h.id=r.hazard_case_id JOIN findings f ON f.id=h.finding_id
    WHERE f.id=? AND h.project_id=?`, input.findingId, input.projectId);
  if (!order || order.status !== "rectifying") throw new Error("当前整改单不能上传整改证据");
  const id = `evidence-${randomUUID()}`;
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO evidence(id,inspection_id,purpose,source_label,file_name,mime_type,content,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, order.inspection_id, "rectification", "整改证据", input.fileName, input.mimeType, input.content, now);
    db.prepare("UPDATE rectification_orders SET rectification_evidence_id=?,status='pending_verification',updated_at=? WHERE id=?")
      .run(id, now, order.id);
    db.prepare("UPDATE hazard_cases SET status='pending_verification' WHERE id=?").run(order.hazard_case_id);
    audit(db, input.projectId, "Evidence", id, "rectification_evidence_uploaded", input.fileName);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getWorkbenchSnapshot(input.projectId);
}

export function getEvidenceContent(evidenceId: string) {
  const result = getDatabase().prepare("SELECT content,mime_type,file_name FROM evidence WHERE id=?").get(evidenceId) as { content: Uint8Array; mime_type: string; file_name: string } | undefined;
  if (!result) return null;
  return { content: result.content, mimeType: result.mime_type, fileName: result.file_name };
}
