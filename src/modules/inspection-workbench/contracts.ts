import type { VisionInspectionResult } from "@/vision/contracts";

export type ProjectOption = { id: string; name: string; location: string };
export type ProjectMember = { id: string; name: string; role: string };

export type WorkbenchEvidence = {
  id: string;
  inspectionId: string;
  sourceLabel: string;
  capturedAt: string;
  contentUrl: string;
  model: string | null;
  adapter: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  persons: WorkbenchPerson[];
};

export type DuplicateSuggestion = {
  id: number;
  evidenceId: string;
  candidateEvidenceId: string;
  sourceLabel: string;
  candidateSourceLabel: string;
  timeDeltaSeconds: number;
  similarity: number;
  method: "exact_sha256" | "dhash";
};

export type WorkbenchPerson = VisionInspectionResult["persons"][number];

export type WorkbenchFinding = VisionInspectionResult["findings"][number] & {
  reviewState: "pending" | "confirmed" | "dismissed";
  ownerId: string | null;
  owner: string | null;
  dueDate: string | null;
  hazardId: string | null;
  orderId: string | null;
  workflowState: "assigned" | "rectifying" | "pending_verification" | "closed" | null;
  rectificationEvidence: string | null;
  rectificationEvidenceUrl: string | null;
};

export type ExistingHazard = {
  id: string;
  title: string;
  zone: string;
  level: "低" | "中" | "高" | "重大";
  owner: string;
  status: string;
  detail: string;
};

export type WorkbenchSnapshot = {
  project: ProjectOption;
  projects: ProjectOption[];
  members: ProjectMember[];
  inspection: { id: string; name: string; executor: string; status: string; startedAt: string } | null;
  evidences: WorkbenchEvidence[];
  voidedEvidences: WorkbenchEvidence[];
  duplicateSuggestions: DuplicateSuggestion[];
  evidence: WorkbenchEvidence | null;
  persons: WorkbenchPerson[];
  findings: WorkbenchFinding[];
  hazards: ExistingHazard[];
};

export type WorkbenchCommand =
  | { type: "review_finding"; projectId: string; findingId: string; decision: "pending" | "confirmed" | "dismissed" }
  | { type: "assign_rectification"; projectId: string; findingId: string; ownerId: string; dueDate: string }
  | { type: "start_rectification"; projectId: string; findingId: string }
  | { type: "verify_rectification"; projectId: string; findingId: string; decision: "pass" | "return" }
  | { type: "void_evidence"; projectId: string; evidenceId: string; reason: string }
  | { type: "restore_evidence"; projectId: string; evidenceId: string }
  | { type: "keep_duplicate"; projectId: string; suggestionId: number }
  | { type: "keep_one_void_rest"; projectId: string; keepEvidenceId: string; suggestionIds: number[] };
