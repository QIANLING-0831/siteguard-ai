"use client";

/* eslint-disable @next/next/no-img-element -- evidence is served by an authenticated-style binary API route. */

import {
  AlertTriangle, Camera, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck,
  FileCheck2, HardHat, ImagePlus, Images, LoaderCircle, RefreshCw, RotateCcw, Search, ShieldAlert,
  Sparkles, Trash2, Upload, UserCheck, X,
} from "lucide-react";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";

import type { DuplicateSuggestion, WorkbenchCommand, WorkbenchEvidence, WorkbenchFinding, WorkbenchSnapshot } from "@/modules/inspection-workbench/contracts";
import CameraCapturePrototype from "./camera-capture-prototype";
import type { CapturedEvidence } from "./capture-types";
import NetworkCameraPrototype from "./network-camera-prototype";

type CameraMode = "local" | "site" | null;
type Draft = { ownerId: string; dueDate: string };
type ReviewFilter = "all" | "pending" | "ai_high" | "confirmed" | "in_progress" | "closed";
type ReviewLayout = "list" | "four" | "nine";
type DuplicateGroup = { candidateEvidenceId: string; candidateSourceLabel: string; suggestions: DuplicateSuggestion[] };
type DuplicateBulkPlan = { groupKey: string; keepEvidenceId: string; suggestionIds: number[]; evidenceIds: string[] };

const AI_HIGH_CONFIDENCE_THRESHOLD = 0.88;

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" | "success" | "warning" }) {
  const style = tone === "danger" ? "bg-[#fee8de] text-[#aa4e26]" : tone === "success" ? "bg-[#e2f2e9] text-[#2f7656]" : tone === "warning" ? "bg-[#fff1d8] text-[#946229]" : "bg-[#ecefe9] text-[#536159]";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{children}</span>;
}

function EvidencePreview({
  label,
  url,
  subject,
  onOpen,
}: {
  label: string;
  url: string;
  subject?: WorkbenchSnapshot["persons"][number];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-evidence-preview={subject ? "original" : "rectification"}
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-2xl border border-[#ded7c9] bg-[#171b18] text-left"
      aria-label={`${label}，点击查看大图`}
    >
      <img src={url} alt={label} className="block h-auto w-full" />
      {subject && (
        <span
          className="absolute border-[3px] border-[#ff5f42] shadow-[0_0_0_1px_rgba(0,0,0,.35)]"
          style={{ left: `${subject.box.x * 100}%`, top: `${subject.box.y * 100}%`, width: `${subject.box.width * 100}%`, height: `${subject.box.height * 100}%` }}
        />
      )}
      <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">{label}</span>
      <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-[#242b25] opacity-0 transition group-hover:opacity-100">查看大图</span>
    </button>
  );
}

function RapidReviewCard({
  finding,
  evidence,
  density,
  busy,
  onOpen,
  onReview,
}: {
  finding: WorkbenchFinding;
  evidence: WorkbenchEvidence | undefined;
  density: Exclude<ReviewLayout, "list">;
  busy: boolean;
  onOpen: () => void;
  onReview: (decision: "confirmed" | "dismissed") => void;
}) {
  const subject = evidence?.persons.find((person) => person.id === finding.subjectDetectionId);
  const isAiHigh = finding.confidence >= AI_HIGH_CONFIDENCE_THRESHOLD;
  const compact = density === "nine";
  return <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isAiHigh ? "border-[#c8d9ce]" : "border-[#efb28e]"}`}>
    <button type="button" onClick={onOpen} className="group relative block aspect-video w-full overflow-hidden bg-[#171b18] text-left" aria-label={`查看 ${finding.id} 审核原图`}>
      {evidence ? <img src={evidence.contentUrl} alt={finding.title} className="h-full w-full object-fill"/> : <span className="grid h-full place-items-center text-xs text-white/60">证据读取中</span>}
      {subject && <span className="absolute border-[3px] border-[#ff5f42] shadow-[0_0_0_1px_rgba(0,0,0,.45)]" style={{ left: `${subject.box.x * 100}%`, top: `${subject.box.y * 100}%`, width: `${subject.box.width * 100}%`, height: `${subject.box.height * 100}%` }}/>} 
      <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">{finding.id}</span>
      <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold text-white ${isAiHigh ? "bg-[#2f7656]" : "bg-[#d45b2a]"}`}>{Math.round(finding.confidence * 100)}%</span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-bold text-white">点击查看带框大图</span>
    </button>
    <div className={compact ? "p-3" : "p-4"}>
      <div className="flex flex-wrap items-center gap-1.5"><Pill tone={isAiHigh ? "success" : "danger"}>{isAiHigh ? "高置信抽检" : "人工复核优先"}</Pill><Pill tone="warning">待判断</Pill></div>
      <h3 className={`${compact ? "mt-2 text-sm" : "mt-3"} font-bold leading-5`}>{finding.title}</h3>
      <p className="mt-2 truncate text-[11px] text-[#817a6e]">{evidence?.sourceLabel ?? "现场证据"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => onReview("confirmed")} className="rounded-full bg-[#242b25] px-2 py-2 text-xs font-bold text-white disabled:opacity-50">确认隐患</button><button disabled={busy} onClick={() => onReview("dismissed")} className="rounded-full border border-[#d9d1c2] px-2 py-2 text-xs font-bold disabled:opacity-50">驳回 AI</button></div>
    </div>
  </article>;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "请求失败");
  return body;
}

export default function VariantBWorkbench() {
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [reviewLayout, setReviewLayout] = useState<ReviewLayout>("four");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
  const [duplicatePanelOpen, setDuplicatePanelOpen] = useState(false);
  const [duplicatePreviewId, setDuplicatePreviewId] = useState<string | null>(null);
  const [duplicateBulkPlan, setDuplicateBulkPlan] = useState<DuplicateBulkPlan | null>(null);
  const [voidedPanelOpen, setVoidedPanelOpen] = useState(false);
  const [voidCandidateId, setVoidCandidateId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("重复抓拍");
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [selectedEvidenceFindingId, setSelectedEvidenceFindingId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const uploadRef = useRef<HTMLInputElement>(null);

  const notify = (text: string, error = false) => {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 3600);
  };

  const loadSnapshot = async (projectId?: string) => {
    setLoading(true);
    try {
      const url = projectId ? `/api/workbench?projectId=${encodeURIComponent(projectId)}` : "/api/workbench";
      setSnapshot(await responseJson<WorkbenchSnapshot>(await fetch(url, { cache: "no-store" })));
    } catch (error) {
      notify(error instanceof Error ? error.message : "工作台加载失败", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/workbench", { cache: "no-store" })
      .then((response) => responseJson<WorkbenchSnapshot>(response))
      .then((data) => { if (active) setSnapshot(data); })
      .catch((error: unknown) => { if (active) setNotice({ text: error instanceof Error ? error.message : "工作台加载失败", error: true }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveInspectionEvidence = async (captured: CapturedEvidence) => {
    if (!snapshot) return;
    setCameraMode(null);
    setBusy("inspection");
    try {
      const form = new FormData();
      form.set("projectId", snapshot.project.id);
      form.set("purpose", "inspection");
      form.set("sourceLabel", captured.sourceLabel);
      form.set("image", captured.blob, `site-${Date.now()}.jpg`);
      const next = await responseJson<WorkbenchSnapshot>(await fetch("/api/workbench/evidence", { method: "POST", body: form }));
      setSnapshot(next);
      notify(`照片已入库：检测到 ${next.persons.length} 人，生成 ${next.findings.length} 条待确认 Finding`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "照片处理失败", true);
    } finally {
      setBusy(null);
    }
  };

  const uploadInspection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void saveInspectionEvidence({ blob: file, sourceLabel: `上传照片 · ${file.name}` });
    event.target.value = "";
  };

  const runCommand = async (command: WorkbenchCommand, success: string) => {
    const commandKey = "findingId" in command
      ? command.findingId
      : "evidenceId" in command
        ? command.evidenceId
        : command.type === "keep_duplicate"
          ? `duplicate-${command.suggestionId}`
          : `duplicate-group-${command.keepEvidenceId}`;
    setBusy(commandKey);
    try {
      const next = await responseJson<WorkbenchSnapshot>(await fetch("/api/workbench/command", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command),
      }));
      setSnapshot(next);
      notify(success);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "操作失败", true);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const confirmVoidEvidence = async () => {
    if (!snapshot || !voidCandidateId) return;
    const succeeded = await runCommand({ type: "void_evidence", projectId: snapshot.project.id, evidenceId: voidCandidateId, reason: voidReason }, "证据已作废并移入作废证据集合，原件与操作记录仍保留");
    if (!succeeded) return;
    setVoidCandidateId(null);
    setVoidedPanelOpen(true);
  };

  const confirmKeepOneVoidRest = async () => {
    if (!snapshot || !duplicateBulkPlan) return;
    const succeeded = await runCommand({
      type: "keep_one_void_rest",
      projectId: snapshot.project.id,
      keepEvidenceId: duplicateBulkPlan.keepEvidenceId,
      suggestionIds: duplicateBulkPlan.suggestionIds,
    }, `已保留 1 份主证据，并将其余 ${duplicateBulkPlan.evidenceIds.length - 1} 份移入作废证据集合`);
    if (!succeeded) return;
    setDuplicateBulkPlan(null);
    setVoidedPanelOpen(true);
  };

  const chooseDuplicateKeeper = (group: DuplicateGroup, keepEvidenceId: string) => {
    setDuplicateBulkPlan({
      groupKey: group.candidateEvidenceId,
      keepEvidenceId,
      suggestionIds: group.suggestions.map((item) => item.id),
      evidenceIds: [group.candidateEvidenceId, ...group.suggestions.map((item) => item.evidenceId)],
    });
  };

  const review = (finding: WorkbenchFinding, decision: "pending" | "confirmed" | "dismissed") => {
    if (!snapshot) return;
    const text = decision === "confirmed" ? "已人工确认，可继续选择负责人并派单" : decision === "dismissed" ? "已驳回 AI 建议，不会生成隐患" : "已撤销驳回，恢复待确认";
    void runCommand({ type: "review_finding", projectId: snapshot.project.id, findingId: finding.id, decision }, text);
  };

  const assign = (finding: WorkbenchFinding) => {
    if (!snapshot) return;
    const draft = drafts[finding.id] ?? { ownerId: "", dueDate: "" };
    if (!draft.ownerId || !draft.dueDate) return notify("请先选择责任人和整改期限", true);
    void runCommand({ type: "assign_rectification", projectId: snapshot.project.id, findingId: finding.id, ...draft }, "隐患已创建，整改单已派发并写入数据库");
  };

  const uploadRectification = async (finding: WorkbenchFinding, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !snapshot) return;
    setBusy(finding.id);
    try {
      const form = new FormData();
      form.set("projectId", snapshot.project.id);
      form.set("purpose", "rectification");
      form.set("findingId", finding.id);
      form.set("image", file);
      setSnapshot(await responseJson<WorkbenchSnapshot>(await fetch("/api/workbench/evidence", { method: "POST", body: form })));
      notify("整改证据已保存，状态已进入待复核");
    } catch (error) {
      notify(error instanceof Error ? error.message : "整改证据上传失败", true);
    } finally {
      event.target.value = "";
      setBusy(null);
    }
  };

  const reanalyze = async () => {
    const target = snapshot?.evidences.find((item) => item.id === selectedEvidenceId) ?? snapshot?.evidence;
    if (!target) return;
    setBusy("inspection");
    try {
      const blob = await (await fetch(target.contentUrl)).blob();
      await saveInspectionEvidence({ blob, sourceLabel: `${target.sourceLabel} · 重新检测` });
    } catch {
      setBusy(null);
      notify("重新检测失败", true);
    }
  };

  if (loading && !snapshot) return <main className="grid min-h-screen place-items-center bg-[#fbf7ef]"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#ee6f3d]"/><p className="mt-3 text-sm text-[#756f65]">正在读取项目数据库…</p></div></main>;
  if (!snapshot) return <main className="grid min-h-screen place-items-center bg-[#fbf7ef]"><button onClick={() => void loadSnapshot()} className="rounded-full bg-[#242b25] px-6 py-3 text-white">重新加载工作台</button></main>;

  const { project, projects, members, inspection, evidences, voidedEvidences, duplicateSuggestions, evidence, persons, findings, hazards } = snapshot;
  const activeEvidence = evidences.find((item) => item.id === selectedEvidenceId) ?? evidence;
  const activePersons = activeEvidence?.persons ?? [];
  const voidCandidate = evidences.find((item) => item.id === voidCandidateId) ?? null;
  const duplicatePreview = evidences.find((item) => item.id === duplicatePreviewId) ?? null;
  const duplicateBulkKeeper = duplicateBulkPlan ? evidences.find((item) => item.id === duplicateBulkPlan.keepEvidenceId) ?? null : null;
  const duplicateGroups = Array.from(duplicateSuggestions.reduce((groups, suggestion) => {
    const group = groups.get(suggestion.candidateEvidenceId) ?? {
      candidateEvidenceId: suggestion.candidateEvidenceId,
      candidateSourceLabel: suggestion.candidateSourceLabel,
      suggestions: [],
    };
    group.suggestions.push(suggestion);
    groups.set(suggestion.candidateEvidenceId, group);
    return groups;
  }, new Map<string, DuplicateGroup>()).values());
  const duplicateImageCount = new Set(duplicateSuggestions.flatMap((item) => [item.evidenceId, item.candidateEvidenceId])).size;
  const selectedHazard = hazards.find((item) => item.id === selectedHazardId) ?? null;
  const selectedEvidenceFinding = findings.find((item) => item.id === selectedEvidenceFindingId) ?? null;
  const selectedFindingEvidence = selectedEvidenceFinding ? evidences.find((item) => item.id === selectedEvidenceFinding.evidenceId) ?? null : null;
  const pendingFindings = findings.filter((item) => item.reviewState === "pending");
  const highConfidencePending = pendingFindings.filter((item) => item.confidence >= AI_HIGH_CONFIDENCE_THRESHOLD);
  const manualPriorityFindings = pendingFindings.filter((item) => item.confidence < AI_HIGH_CONFIDENCE_THRESHOLD);
  const automaticallyCompliant = persons.filter((item) => item.helmetStatus === "helmet" && item.confidence >= AI_HIGH_CONFIDENCE_THRESHOLD).length;
  const visibleFindings = findings.filter((item) => {
    const matchesSearch = `${item.id}${item.title}${item.owner ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = reviewFilter === "all" ||
      (reviewFilter === "pending" && item.reviewState === "pending" && item.confidence < AI_HIGH_CONFIDENCE_THRESHOLD) ||
      (reviewFilter === "ai_high" && item.reviewState === "pending" && item.confidence >= AI_HIGH_CONFIDENCE_THRESHOLD) ||
      (reviewFilter === "confirmed" && item.reviewState === "confirmed" && !item.workflowState) ||
      (reviewFilter === "in_progress" && item.workflowState !== null && item.workflowState !== "closed") ||
      (reviewFilter === "closed" && item.workflowState === "closed");
    return matchesSearch && matchesFilter;
  });
  const visibleHazards = reviewFilter === "all" ? hazards.filter((item) => `${item.id}${item.title}${item.owner}`.toLowerCase().includes(searchQuery.toLowerCase())) : [];
  const closed = findings.filter((item) => item.workflowState === "closed").length;
  const pending = pendingFindings.length;
  const rapidReviewEnabled = reviewFilter === "pending" || reviewFilter === "ai_high";

  return (
    <main className="min-h-screen bg-[#fbf7ef] text-[#222520]">
      {notice && <div className={`fixed right-5 top-5 z-[95] flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-xl ${notice.error ? "bg-[#a64c29]" : "bg-[#20372c]"}`}><CheckCircle2 size={18}/><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="关闭提示"><X size={15}/></button></div>}

      <header className="relative border-b border-[#ded8cb] bg-[#fbf7ef]/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#ee6f3d] text-white"><HardHat size={20}/></span><div><p className="font-bold">B 现场巡检工作台</p><p className="text-xs text-[#837c70]">{project.name} · {project.location}</p></div></div>
          <button onClick={() => setProjectMenuOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-[#d9d1c2] bg-white px-4 py-2 text-sm font-semibold">切换项目 <ChevronDown size={15}/></button>
        </div>
        {projectMenuOpen && <div className="absolute right-6 top-[68px] z-40 w-72 rounded-2xl border border-[#ded8cb] bg-white p-2 shadow-xl">{projects.map((item) => <button key={item.id} onClick={() => { setProjectMenuOpen(false); void loadSnapshot(item.id); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm ${project.id === item.id ? "bg-[#fff0e8] font-bold text-[#c9582c]" : "hover:bg-[#f6f2ea]"}`}><span><span className="block">{item.name}</span><span className="mt-0.5 block text-[11px] font-normal text-[#8a8378]">{item.location}</span></span>{project.id === item.id && <Check size={16}/>}</button>)}</div>}
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section data-workflow="multi-person-helmet-inspection" className="flex flex-col justify-between gap-6 border-b border-[#ddd5c7] pb-9 md:flex-row md:items-end">
          <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#d45b2a]">企业级 PPE 专项巡检</p><Pill tone="success">批次进行中</Pill></div><h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-[-.04em]">多摄像头连续采集，集中审核疑似未佩戴安全帽者。</h1><p className="mt-3 max-w-3xl leading-7 text-[#756f65]">一个巡检批次覆盖多个区域和多份现场证据。系统逐图检测多人并汇总 Finding，安全员按证据复核后才能立案、派单、整改与关闭；不做人脸识别，不把画面人员建立为实名档案。</p>{inspection && <p className="mt-4 text-sm font-semibold text-[#4f5d55]">{inspection.name} · 执行人 {inspection.executor} · 开始于 {new Date(inspection.startedAt).toLocaleString("zh-CN")}</p>}</div>
          <div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => setCameraMode("local")} className="inline-flex items-center gap-2 rounded-full border border-[#d9d1c2] bg-white px-5 py-3 text-sm font-semibold"><Camera size={17}/>本机拍摄</button><button onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-[#d9d1c2] bg-white px-5 py-3 text-sm font-semibold"><Upload size={17}/>上传照片</button><button onClick={() => setCameraMode("site")} className="inline-flex items-center gap-2 rounded-full bg-[#242b25] px-6 py-3 text-sm font-semibold text-white"><ShieldAlert size={17}/>工地摄像头</button><input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={uploadInspection}/></div>
        </section>

        <section className="grid gap-3 py-8 md:grid-cols-4">{[
          [Camera, "批量采集", evidences.length ? `${evidences.length} 份证据` : "等待采集", "多区域原图统一入库"],
          [Sparkles, "AI 全量识别", `${persons.length} 人`, `${automaticallyCompliant} 人高置信戴帽，自动通过初筛`],
          [UserCheck, "分级复核", `${manualPriorityFindings.length} 项重点人工复核`, `${highConfidencePending.length} 项高置信疑似结果单独归档`],
          [ClipboardCheck, "整改复核", `${closed} 项已关闭`, "证据、退回、关闭留痕"],
        ].map(([Icon, title, count, detail], index) => { const StepIcon = Icon as typeof Camera; return <div key={String(title)} className="relative rounded-3xl border border-[#ded7c9] bg-white/70 p-5"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-full bg-[#eee8dc]"><StepIcon size={18}/></span><span className="font-mono text-xs text-[#938b7e]">0{index + 1}</span></div><h2 className="mt-6 font-bold">{title as string}</h2><p className="mt-2 text-sm text-[#7a7469]">{detail as string}</p><p className="mt-4 text-xl font-bold">{count as string}</p>{index < 3 && <ChevronRight className="absolute -right-3 top-1/2 hidden text-[#bdb4a5] md:block" size={18}/>}</div>; })}</section>

        {duplicateSuggestions.length > 0 && <section className="mb-5 rounded-3xl border border-[#efc89f] bg-[#fff7e9] p-5" aria-label="疑似重复证据建议">
          <button type="button" onClick={() => setDuplicatePanelOpen((value) => !value)} aria-expanded={duplicatePanelOpen} className="flex w-full items-center justify-between gap-4 text-left">
            <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f5dfbd] text-[#8b5c22]"><Images size={19}/></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">发现疑似重复证据</h2><Pill tone="warning">{duplicateGroups.length} 组 · {duplicateImageCount} 张图</Pill></div><p className="mt-1 text-sm leading-6 text-[#765f42]">逐张查看图片，并直接在图片下方决定保留哪一张；其他同组证据可一键作废。</p></div></div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#8d542a] px-4 py-2 text-sm font-bold text-white">{duplicatePanelOpen ? "收起图片" : "展开图片"}<ChevronDown className={`transition ${duplicatePanelOpen ? "rotate-180" : ""}`} size={16}/></span>
          </button>
          {duplicatePanelOpen && <div className="mt-5 space-y-5 border-t border-[#e8c99f] pt-5">{duplicateGroups.map((group, groupIndex) => { const candidateEvidence = evidences.find((item) => item.id === group.candidateEvidenceId); return <article key={group.candidateEvidenceId} className="rounded-2xl bg-white/75 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">重复图组 {String(groupIndex + 1).padStart(2, "0")}</p><p className="mt-1 text-xs text-[#817a6e]">共 {group.suggestions.length + 1} 张；看完图片后，可直接在对应卡片下保留该图并作废其余证据</p></div><Pill tone="warning">最高相似度 {Math.round(Math.max(...group.suggestions.map((item) => item.similarity)) * 100)}%</Pill></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {candidateEvidence && <article className="overflow-hidden rounded-2xl border-2 border-[#6d8d79] bg-white"><button type="button" onClick={() => setDuplicatePreviewId(candidateEvidence.id)} className="relative block aspect-square w-full overflow-hidden bg-[#1d211e]" aria-label={`查看基准图 ${candidateEvidence.sourceLabel}`}><img src={candidateEvidence.contentUrl} alt={candidateEvidence.sourceLabel} className="h-full w-full object-cover"/><span className="absolute left-2 top-2 rounded-full bg-[#2f7656] px-2.5 py-1 text-[10px] font-bold text-white">比对基准</span><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-left text-[10px] font-bold text-white">点击查看大图</span></button><div className="p-3"><p className="truncate text-xs font-bold">{candidateEvidence.sourceLabel}</p><p className="mt-1 text-[10px] text-[#817a6e]">{new Date(candidateEvidence.capturedAt).toLocaleString("zh-CN")}</p><button onClick={() => chooseDuplicateKeeper(group, candidateEvidence.id)} className="mt-3 w-full rounded-full bg-[#2f7656] px-3 py-2 text-[11px] font-bold text-white">保留此图，其余全部作废</button></div></article>}
            {group.suggestions.map((suggestion) => { const item = evidences.find((evidenceItem) => evidenceItem.id === suggestion.evidenceId); if (!item) return null; return <article key={suggestion.id} className="overflow-hidden rounded-2xl border border-[#e1c39b] bg-white"><button type="button" onClick={() => setDuplicatePreviewId(item.id)} className="relative block aspect-square w-full overflow-hidden bg-[#1d211e]" aria-label={`查看疑似重复图 ${item.sourceLabel}`}><img src={item.contentUrl} alt={item.sourceLabel} className="h-full w-full object-cover"/><span className="absolute left-2 top-2 rounded-full bg-[#9a5b28] px-2.5 py-1 text-[10px] font-bold text-white">疑似重复</span><span className="absolute right-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">{Math.round(suggestion.similarity * 100)}%</span><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-left text-[10px] font-bold text-white">间隔 {suggestion.timeDeltaSeconds} 秒 · 点击查看</span></button><div className="p-3"><p className="truncate text-xs font-bold">{item.sourceLabel}</p><p className="mt-1 text-[10px] text-[#817a6e]">{new Date(item.capturedAt).toLocaleString("zh-CN")} · {suggestion.method === "exact_sha256" ? "文件相同" : "画面相似"}</p><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busy === `duplicate-${suggestion.id}`} onClick={() => void runCommand({ type: "keep_duplicate", projectId: project.id, suggestionId: suggestion.id }, "已保留两份证据，并记录人工决策")} className="rounded-full border border-[#d8b989] px-2 py-2 text-[11px] font-bold disabled:opacity-50">单独保留</button><button onClick={() => { setSelectedEvidenceId(suggestion.evidenceId); setVoidCandidateId(suggestion.evidenceId); setVoidReason("重复抓拍"); }} className="rounded-full bg-[#8d542a] px-2 py-2 text-[11px] font-bold text-white">仅作废此图</button></div><button onClick={() => chooseDuplicateKeeper(group, item.id)} className="mt-2 w-full rounded-full bg-[#2f7656] px-3 py-2 text-[11px] font-bold text-white">保留此图，其余全部作废</button></div></article>; })}
          </div></article>; })}</div>}
        </section>}

        <section className="rounded-[30px] border border-[#ded7c9] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">巡检证据批次</h2><p className="mt-1 text-sm text-[#817a6e]">{evidences.length - duplicateSuggestions.length} 份已纳入 · {duplicateSuggestions.length} 份重复待处理 · {new Set(evidences.map((item) => item.sourceLabel.split(" · ")[0])).size} 个采集点 · {persons.length} 名画面人员</p></div><div className="flex flex-wrap gap-2">{evidencePanelOpen && activeEvidence && <><button disabled={busy === activeEvidence.id} onClick={() => { setVoidCandidateId(activeEvidence.id); setVoidReason("重复抓拍"); }} className="inline-flex items-center gap-2 rounded-full border border-[#d6a894] px-4 py-2 text-sm font-bold text-[#9a4d2d] disabled:opacity-50"><Trash2 size={16}/>作废当前证据</button><button disabled={busy === "inspection"} onClick={() => void reanalyze()} className="inline-flex items-center gap-2 rounded-full border border-[#d9d1c2] px-4 py-2 text-sm font-bold disabled:opacity-50"><RefreshCw className={busy === "inspection" ? "animate-spin" : ""} size={16}/>重新检测当前证据</button></>}<button onClick={() => setEvidencePanelOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full bg-[#242b25] px-5 py-2.5 text-sm font-bold text-white">{evidencePanelOpen ? "收起证据" : `展开 ${evidences.length} 份证据`}<ChevronDown className={`transition ${evidencePanelOpen ? "rotate-180" : ""}`} size={16}/></button></div></div>
          {!evidencePanelOpen && activeEvidence && <div className="mt-5 grid gap-3 rounded-2xl bg-[#f6f2ea] p-4 sm:grid-cols-4">{[["AI 检测人员",persons.length],["高置信戴帽",automaticallyCompliant],["高置信疑似",highConfidencePending.length],["重点人工复核",manualPriorityFindings.length]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-white p-3"><p className="text-xs text-[#817a6e]">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>}
          {evidencePanelOpen && (!activeEvidence ? <button onClick={() => setCameraMode("local")} className="mt-6 grid min-h-64 w-full place-items-center rounded-3xl border-2 border-dashed border-[#d8d0c2] bg-[#faf7f0] text-center"><div><ImagePlus className="mx-auto text-[#aa9f8e]" size={34}/><p className="mt-3 font-bold">该项目还没有现场证据</p><p className="mt-1 text-sm text-[#817a6e]">点击使用本机摄像头拍摄</p></div></button> : <div className="mt-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{evidences.map((item) => { const itemFindings = findings.filter((finding) => finding.evidenceId === item.id); return <button key={item.id} onClick={() => setSelectedEvidenceId(item.id)} className={`overflow-hidden rounded-2xl border-2 text-left transition ${activeEvidence.id === item.id ? "border-[#ee6f3d] bg-[#fff6ef]" : "border-[#e2ddd3] bg-white hover:border-[#c9bfb1]"}`}><div className="relative aspect-video overflow-hidden bg-[#171b18]"><img src={item.contentUrl} alt={item.sourceLabel} className="h-full w-full object-cover"/><span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">{item.persons.length} 人 · {itemFindings.length} 条 Finding</span></div><div className="p-3"><p className="truncate text-sm font-bold">{item.sourceLabel}</p><p className="mt-1 text-[11px] text-[#817a6e]">{new Date(item.capturedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p></div></button>; })}</div><div className="mt-5 grid gap-6 lg:grid-cols-[1fr_290px]"><div className="relative overflow-hidden rounded-2xl bg-[#171b18]"><img src={activeEvidence.contentUrl} alt="当前选中的巡检现场证据" className="block h-auto w-full"/>{activePersons.map((person) => <div key={person.id} className={`absolute border-2 ${person.helmetStatus === "no_helmet" ? "border-[#ff6547]" : person.helmetStatus === "helmet" ? "border-[#66d39a]" : "border-[#f3c35d]"}`} style={{ left: `${person.box.x * 100}%`, top: `${person.box.y * 100}%`, width: `${person.box.width * 100}%`, height: `${person.box.height * 100}%` }}><span className={`absolute -top-6 left-[-2px] whitespace-nowrap px-2 py-1 text-[10px] font-bold text-white ${person.helmetStatus === "no_helmet" ? "bg-[#e94f32]" : person.helmetStatus === "helmet" ? "bg-[#2d8a5e]" : "bg-[#a77a2b]"}`}>{person.helmetStatus === "no_helmet" ? "疑似未戴" : person.helmetStatus === "helmet" ? "已戴" : "无法判断"} · {Math.round(person.confidence * 100)}%</span></div>)}{busy === "inspection" && <div className="absolute inset-0 grid place-items-center bg-black/65 text-white"><div className="text-center"><LoaderCircle className="mx-auto animate-spin"/><p className="mt-3 text-sm">正在分析并写入批次…</p></div></div>}</div><aside className="space-y-3"><div className="rounded-2xl bg-[#f5f0e6] p-4"><p className="text-xs text-[#817a6e]">当前证据来源</p><p className="mt-1 font-bold">{activeEvidence.sourceLabel}</p><p className="mt-1 text-xs text-[#817a6e]">{new Date(activeEvidence.capturedAt).toLocaleString("zh-CN")}</p></div><div className="grid grid-cols-3 gap-2">{[["人员", activePersons.length], ["戴帽", activePersons.filter((item) => item.helmetStatus === "helmet").length], ["疑似", findings.filter((item) => item.evidenceId === activeEvidence.id).length]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-[#f5f0e6] p-3 text-center"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-[10px] text-[#817a6e]">{label}</p></div>)}</div><div className="rounded-2xl border border-[#efc89f] bg-[#fff7e9] p-4 text-xs leading-5 text-[#815d2e]"><strong>模型：{activeEvidence.model ?? "尚未分析"}</strong><br/>适配器：{activeEvidence.adapter ?? "—"}<br/>高置信戴帽自动通过初筛；疑似违规仍需人工确认后才能立案。</div></aside></div></div>)}
        </section>

        <section className="mt-5 rounded-[26px] border border-[#d8d1c5] bg-[#f1eee8] p-4 sm:p-5" aria-label="作废证据集合">
          <button onClick={() => setVoidedPanelOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-white text-[#70685f]"><Trash2 size={18}/></span><div><h2 className="font-bold">作废证据集合</h2><p className="mt-0.5 text-xs text-[#817a6e]">{voidedEvidences.length} 份 · 原件和审计记录保留，不参与 AI 队列统计</p></div></div><ChevronDown className={`shrink-0 transition ${voidedPanelOpen ? "rotate-180" : ""}`} size={18}/></button>
          {voidedPanelOpen && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{voidedEvidences.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#d8d1c5] bg-white"><div className="relative aspect-video overflow-hidden bg-[#242824]"><img src={item.contentUrl} alt={`已作废：${item.sourceLabel}`} className="h-full w-full object-cover opacity-65 grayscale"/><span className="absolute left-2 top-2 rounded-full bg-[#5f5851]/90 px-2.5 py-1 text-[10px] font-bold text-white">已作废</span></div><div className="p-4"><p className="truncate text-sm font-bold">{item.sourceLabel}</p><p className="mt-2 text-xs leading-5 text-[#756f65]">原因：{item.voidReason ?? "未记录"}<br/>操作：{item.voidedBy ?? "—"} · {item.voidedAt ? new Date(item.voidedAt).toLocaleString("zh-CN") : "—"}</p><button disabled={busy === item.id} onClick={() => void runCommand({ type: "restore_evidence", projectId: project.id, evidenceId: item.id }, "证据已恢复到当前巡检批次")} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#d3ccc0] px-3 py-2 text-xs font-bold disabled:opacity-50"><RotateCcw size={14}/>恢复证据</button></div></article>)}{voidedEvidences.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfc7ba] p-6 text-center text-sm text-[#817a6e] sm:col-span-2 lg:col-span-3">暂无作废证据</div>}</div>}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">企业审核队列</h2><p className="mt-1 text-sm text-[#817a6e]">按状态集中处理整个巡检批次；每条 Finding 都绑定独立原图和人员框</p></div><div className="flex items-center gap-2">{searchOpen && <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索编号、区域或责任人" className="w-56 rounded-full border border-[#d9d1c2] bg-white px-4 py-2 text-sm outline-none focus:border-[#ee6f3d]"/>}<button onClick={() => { setSearchOpen((value) => !value); if (searchOpen) setSearchQuery(""); }} className="grid size-10 place-items-center rounded-full bg-white" aria-label="搜索事项">{searchOpen ? <X size={17}/> : <Search size={17}/>}</button></div></div>
            <div className="mb-4 rounded-2xl border border-[#d9e4dd] bg-[#eef5f1] p-4 text-sm leading-6 text-[#436052]"><strong>AI 已完成 {persons.length} 人全量初筛：</strong>{automaticallyCompliant} 人高置信戴帽无需人工逐一查看；{highConfidencePending.length} 条高置信疑似违规进入独立抽检队列；默认只展示 {manualPriorityFindings.length} 条不确定性较高、最需要人工判断的 Finding。疑似重复证据在人员决定前不进入审核队列；AI 结果未经人员确认不会自动立案。</div>
            <div className="mb-4 flex flex-wrap gap-2">{([['pending',`重点人工复核 ${manualPriorityFindings.length}`],['ai_high',`AI 高置信结果 ${highConfidencePending.length}`],['confirmed',`待派单 ${findings.filter((item) => item.reviewState === 'confirmed' && !item.workflowState).length}`],['in_progress',`整改/复核 ${findings.filter((item) => item.workflowState && item.workflowState !== 'closed').length}`],['closed',`已关闭 ${closed}`],['all',`全部 ${findings.length + hazards.length}`]] as Array<[ReviewFilter,string]>).map(([key,label]) => <button key={key} onClick={() => setReviewFilter(key)} className={`rounded-full px-4 py-2 text-sm font-bold ${reviewFilter === key ? "bg-[#242b25] text-white" : "border border-[#d9d1c2] bg-white text-[#5f665f]"}`}>{label}</button>)}</div>
            {rapidReviewEnabled && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ded7c9] bg-white p-3"><div><p className="text-sm font-bold">审核视图</p><p className="mt-0.5 text-xs text-[#817a6e]">宫格内可直接确认或驳回；点击图片查看带框大图</p></div><div className="flex rounded-full bg-[#eee9df] p-1" role="group" aria-label="审核图片布局">{([['list','单列'],['four','四宫格'],['nine','九宫格']] as Array<[ReviewLayout,string]>).map(([key,label]) => <button key={key} onClick={() => setReviewLayout(key)} aria-pressed={reviewLayout === key} className={`rounded-full px-4 py-2 text-xs font-bold transition ${reviewLayout === key ? "bg-[#242b25] text-white shadow-sm" : "text-[#62685f] hover:bg-white/70"}`}>{label}</button>)}</div></div>}
            {rapidReviewEnabled && reviewLayout !== "list" && <div data-review-layout={reviewLayout} className={`mb-4 grid items-start gap-3 ${reviewLayout === "four" ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
              {visibleFindings.map((finding) => <RapidReviewCard key={finding.id} finding={finding} evidence={evidences.find((item) => item.id === finding.evidenceId)} density={reviewLayout} busy={busy === finding.id} onOpen={() => setSelectedEvidenceFindingId(finding.id)} onReview={(decision) => review(finding, decision)}/>)}
              {visibleFindings.length === 0 && <div className="rounded-3xl border border-dashed border-[#d9d1c2] p-8 text-center text-sm text-[#817a6e] sm:col-span-2 xl:col-span-3">没有待审核图片</div>}
            </div>}
            <div className={rapidReviewEnabled && reviewLayout !== "list" ? "hidden" : "space-y-3"}>
              {visibleFindings.map((finding) => { const draft = drafts[finding.id] ?? { ownerId: "", dueDate: "" }; const isBusy = busy === finding.id; const findingEvidence = evidences.find((item) => item.id === finding.evidenceId); const subject = findingEvidence?.persons.find((person) => person.id === finding.subjectDetectionId); const isAiHigh = finding.confidence >= AI_HIGH_CONFIDENCE_THRESHOLD; return <article key={finding.id} className={`rounded-3xl border bg-white p-5 ${isAiHigh ? "border-[#c8d9ce]" : "border-[#efb28e]"}`}><div className="flex items-start gap-4"><span className={`mt-1 grid size-11 shrink-0 place-items-center rounded-2xl ${isAiHigh ? "bg-[#e6f2eb] text-[#2f7656]" : "bg-[#fff0e8] text-[#d85d2e]"}`}><Sparkles size={20}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Pill tone={isAiHigh ? "success" : "danger"}>{isAiHigh ? "AI 高置信初筛" : "人工复核优先"}</Pill><span className="text-xs text-[#91897d]">{finding.id}</span><Pill tone={finding.reviewState === "confirmed" ? "success" : finding.reviewState === "dismissed" ? "neutral" : "warning"}>{finding.reviewState === "pending" ? isAiHigh ? "待抽检确认" : "需人工判断" : finding.reviewState === "confirmed" ? "已确认" : "已驳回"}</Pill></div><h3 className="mt-3 font-bold">{finding.title}</h3><p className="mt-2 text-sm text-[#7a7469]">{findingEvidence?.sourceLabel ?? "现场证据"} · 对应 {finding.subjectDetectionId}</p><div className="mt-3 rounded-2xl bg-[#faf6ed] p-3 text-xs leading-5 text-[#726b60]">模型：{finding.model}<br/>置信度 {finding.confidence.toFixed(2)} · {isAiHigh ? "已由 AI 归入高置信疑似队列，人工只需抽检/立案确认" : "处于阈值边界，建议优先查看原图后判断"}</div>
                {findingEvidence && <div className={`mt-4 grid gap-3 ${finding.rectificationEvidenceUrl ? "md:grid-cols-2" : ""}`}><EvidencePreview label="整改前 · 原始现场证据" url={findingEvidence.contentUrl} subject={subject} onOpen={() => setSelectedEvidenceFindingId(finding.id)}/>{finding.rectificationEvidenceUrl && <EvidencePreview label="整改后 · 复核证据" url={finding.rectificationEvidenceUrl} onOpen={() => setSelectedEvidenceFindingId(finding.id)}/>}</div>}
                {finding.reviewState === "pending" && <div className="mt-4 flex flex-wrap gap-2"><button disabled={isBusy} onClick={() => review(finding, "confirmed")} className="inline-flex items-center gap-2 rounded-full bg-[#242b25] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><UserCheck size={16}/>确认是隐患</button><button disabled={isBusy} onClick={() => review(finding, "dismissed")} className="rounded-full border border-[#d9d1c2] px-4 py-2 text-sm font-bold disabled:opacity-50">驳回 AI 建议</button></div>}
                {finding.reviewState === "dismissed" && <button disabled={isBusy} onClick={() => review(finding, "pending")} className="mt-4 rounded-full border border-[#d9d1c2] px-4 py-2 text-sm font-bold">撤销驳回</button>}
                {finding.reviewState === "confirmed" && !finding.workflowState && <div className="mt-4 rounded-2xl border border-[#d9d1c2] bg-[#fbf8f2] p-4"><p className="text-sm font-bold">创建隐患并派发整改单</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-[#756f65]">责任人<select value={draft.ownerId} onChange={(event) => setDrafts((current) => ({ ...current, [finding.id]: { ...draft, ownerId: event.target.value } }))} className="mt-1 w-full rounded-xl border border-[#d9d1c2] bg-white px-3 py-2 text-sm"><option value="">请选择</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label><label className="text-xs text-[#756f65]">整改期限<select value={draft.dueDate} onChange={(event) => setDrafts((current) => ({ ...current, [finding.id]: { ...draft, dueDate: event.target.value } }))} className="mt-1 w-full rounded-xl border border-[#d9d1c2] bg-white px-3 py-2 text-sm"><option value="">请选择</option><option>24 小时内</option><option>3 天内</option><option>7 天内</option></select></label></div><button disabled={isBusy} onClick={() => assign(finding)} className="mt-3 rounded-full bg-[#ee6f3d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">生成隐患并派单</button></div>}
                {finding.workflowState && <div className="mt-4 rounded-2xl bg-[#edf3ef] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">{finding.hazardId} · 整改单 {finding.orderId}</p><p className="mt-1 text-xs text-[#607068]">责任人 {finding.owner} · 期限 {finding.dueDate}</p></div><Pill tone={finding.workflowState === "closed" ? "success" : "warning"}>{finding.workflowState === "assigned" ? "已派单" : finding.workflowState === "rectifying" ? "整改中" : finding.workflowState === "pending_verification" ? "待复核" : "已关闭"}</Pill></div>{finding.workflowState === "assigned" && <button disabled={isBusy} onClick={() => void runCommand({ type: "start_rectification", projectId: project.id, findingId: finding.id }, "责任人已接单，进入整改中")} className="mt-3 rounded-full bg-[#242b25] px-4 py-2 text-sm font-bold text-white">开始整改</button>}{finding.workflowState === "rectifying" && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#242b25] px-4 py-2 text-sm font-bold text-white"><Upload size={15}/>上传整改证据<input type="file" accept="image/*" className="hidden" onChange={(event) => void uploadRectification(finding, event)}/></label>}{finding.workflowState === "pending_verification" && <div className="mt-3"><p className="text-xs text-[#607068]">整改证据：{finding.rectificationEvidence}</p><div className="mt-2 flex flex-wrap gap-2"><button disabled={isBusy} onClick={() => void runCommand({ type: "verify_rectification", projectId: project.id, findingId: finding.id, decision: "pass" }, "复核通过，隐患已关闭且历史保留")} className="inline-flex items-center gap-2 rounded-full bg-[#2f7656] px-4 py-2 text-sm font-bold text-white"><FileCheck2 size={15}/>复核通过并关闭</button><button disabled={isBusy} onClick={() => void runCommand({ type: "verify_rectification", projectId: project.id, findingId: finding.id, decision: "return" }, "复核已退回，需重新整改")} className="rounded-full border border-[#b7c6bd] px-4 py-2 text-sm font-bold">退回整改</button></div></div>}{finding.workflowState === "closed" && <p className="mt-3 text-sm font-bold text-[#2f7656]">整改完成且复核通过，完整历史已保留。</p>}</div>}
              </div></div></article>; })}
              {visibleHazards.map((item) => <button key={item.id} onClick={() => setSelectedHazardId(item.id)} className="flex w-full items-start gap-4 rounded-3xl border border-[#ded7c9] bg-white p-5 text-left transition hover:border-[#ee6f3d]"><span className="mt-1 grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eef1eb] text-[#47594e]"><AlertTriangle size={20}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Pill tone={item.level === "重大" ? "danger" : "neutral"}>{item.level}风险</Pill><span className="text-xs text-[#91897d]">{item.id}</span></div><h3 className="mt-3 font-bold">{item.title}</h3><p className="mt-2 text-sm text-[#7a7469]">{item.zone} · 责任人 {item.owner} · {item.status}</p></div><ChevronRight className="text-[#aaa294]"/></button>)}
              {!visibleFindings.length && !visibleHazards.length && <div className="rounded-3xl border border-dashed border-[#d9d1c2] p-8 text-center text-sm text-[#817a6e]">没有匹配的事项</div>}
            </div>
          </div>
          <aside className="h-fit rounded-[30px] bg-[#232a24] p-6 text-white"><p className="text-sm text-white/55">AI 分流与闭环</p><p className="mt-2 text-5xl font-bold">{manualPriorityFindings.length}</p><p className="mt-2 text-sm text-white/55">当前重点人工复核数量</p><div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ef7a48] transition-all" style={{ width: `${persons.length ? automaticallyCompliant / persons.length * 100 : 0}%` }}/></div><div className="mt-8 space-y-4 text-sm">{[["AI 检测人员", persons.length], ["高置信戴帽", automaticallyCompliant], ["高置信疑似", highConfidencePending.length], ["重点人工复核", manualPriorityFindings.length], ["已关闭", closed]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between border-b border-white/10 pb-3"><span className="text-white/55">{label}</span><span className="font-semibold">{value}</span></div>)}</div><button onClick={() => setSummaryOpen(true)} className="mt-8 w-full rounded-full bg-white py-3 font-bold text-[#232a24]">查看本次巡检摘要</button></aside>
        </section>
      </div>

      {cameraMode === "local" && <CameraCapturePrototype onClose={() => setCameraMode(null)} onUsePhoto={(item) => void saveInspectionEvidence(item)}/>} 
      {cameraMode === "site" && <NetworkCameraPrototype onClose={() => setCameraMode(null)} onUseLocal={() => setCameraMode("local")} onUsePhoto={(item) => void saveInspectionEvidence(item)}/>} 

      {duplicatePreview && <div className="fixed inset-0 z-[85] overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-8"><section className="mx-auto max-w-5xl rounded-[28px] bg-[#fbf7ef] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-[#a55d26]">疑似重复证据 · 大图比对</p><h2 className="mt-1 font-bold">{duplicatePreview.sourceLabel}</h2><p className="mt-1 text-xs text-[#756f65]">拍摄于 {new Date(duplicatePreview.capturedAt).toLocaleString("zh-CN")}</p></div><button onClick={() => setDuplicatePreviewId(null)} className="grid size-10 shrink-0 place-items-center rounded-full bg-white" aria-label="关闭重复证据大图"><X size={18}/></button></div><img src={duplicatePreview.contentUrl} alt={duplicatePreview.sourceLabel} className="mt-5 block h-auto max-h-[72vh] w-full rounded-2xl bg-[#171b18] object-contain"/><p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#686157]">请对照同组基准图判断人员位置、机械状态、材料摆放和画面时间变化。相似度只用于排序，最终是否属于重复证据由工作人员决定。</p></section></div>}

      {duplicateBulkPlan && duplicateBulkKeeper && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"><section className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white"><div className="grid md:grid-cols-[240px_1fr]"><div className="relative min-h-56 bg-[#1e241f]"><img src={duplicateBulkKeeper.contentUrl} alt="选定保留的主证据" className="absolute inset-0 h-full w-full object-cover"/><span className="absolute left-3 top-3 rounded-full bg-[#2f7656] px-3 py-1.5 text-xs font-bold text-white">将保留的主证据</span></div><div className="p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#a24f2c]">重复证据 · 批量治理</p><h2 className="mt-1 text-xl font-bold">保留这一张，其余全部作废？</h2></div><button onClick={() => setDuplicateBulkPlan(null)} className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3eee5]" aria-label="取消批量作废"><X size={17}/></button></div><p className="mt-3 text-sm leading-6 text-[#756f65]">{duplicateBulkKeeper.sourceLabel}<br/>{new Date(duplicateBulkKeeper.capturedAt).toLocaleString("zh-CN")}</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#edf4ef] p-3"><p className="text-xs text-[#607068]">保留主证据</p><p className="mt-1 text-2xl font-bold text-[#2f7656]">1 份</p></div><div className="rounded-xl bg-[#fff1e8] p-3"><p className="text-xs text-[#8a624d]">移入作废集合</p><p className="mt-1 text-2xl font-bold text-[#a14f2d]">{duplicateBulkPlan.evidenceIds.length - 1} 份</p></div></div><p className="mt-4 rounded-xl border border-[#edc9ad] bg-[#fff8ef] p-3 text-xs leading-5 text-[#825e45]">这是整组原子操作：若任一待作废证据已经关联正式隐患或整改记录，整批都不会执行。原图不会物理删除，人员可在作废证据集合中恢复。</p><div className="mt-5 flex gap-2"><button onClick={() => setDuplicateBulkPlan(null)} className="flex-1 rounded-full border border-[#d9d1c2] py-2.5 text-sm font-bold">取消</button><button disabled={busy === `duplicate-group-${duplicateBulkPlan.keepEvidenceId}`} onClick={() => void confirmKeepOneVoidRest()} className="flex-1 rounded-full bg-[#a14f2d] py-2.5 text-sm font-bold text-white disabled:opacity-50">确认批量处理</button></div></div></div></section></div>}

      {voidCandidate && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"><section className="w-full max-w-xl overflow-hidden rounded-[28px] bg-white"><div className="grid sm:grid-cols-[190px_1fr]"><div className="relative min-h-44 bg-[#252925]"><img src={voidCandidate.contentUrl} alt="待作废的现场证据" className="absolute inset-0 h-full w-full object-cover"/><span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold text-white">待作废证据</span></div><div className="p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#a24f2c]">证据治理</p><h2 className="mt-1 text-xl font-bold">确认作废这份证据？</h2></div><button onClick={() => setVoidCandidateId(null)} className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3eee5]" aria-label="取消作废"><X size={17}/></button></div><p className="mt-3 text-sm leading-6 text-[#756f65]">{voidCandidate.sourceLabel}<br/>{new Date(voidCandidate.capturedAt).toLocaleString("zh-CN")}</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f6f2ea] p-3"><p className="text-xs text-[#817a6e]">受影响画面人员</p><p className="mt-1 text-xl font-bold">{voidCandidate.persons.length}</p></div><div className="rounded-xl bg-[#f6f2ea] p-3"><p className="text-xs text-[#817a6e]">退出审核队列的 Finding</p><p className="mt-1 text-xl font-bold">{findings.filter((item) => item.evidenceId === voidCandidate.id).length}</p></div></div><label className="mt-4 block text-xs font-bold text-[#6e675d]">作废原因<select value={voidReason} onChange={(event) => setVoidReason(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d1c2] bg-white px-3 py-2.5 text-sm"><option>重复抓拍</option><option>画面模糊</option><option>区域错误</option><option>误上传</option><option>隐私问题</option><option>其他无效证据</option></select></label><p className="mt-3 text-xs leading-5 text-[#8a624d]">不会物理删除文件。若证据已关联正式隐患或整改记录，系统会拒绝作废。</p><div className="mt-5 flex gap-2"><button onClick={() => setVoidCandidateId(null)} className="flex-1 rounded-full border border-[#d9d1c2] py-2.5 text-sm font-bold">取消</button><button disabled={busy === voidCandidate.id} onClick={() => void confirmVoidEvidence()} className="flex-1 rounded-full bg-[#a14f2d] py-2.5 text-sm font-bold text-white disabled:opacity-50">确认作废</button></div></div></div></section></div>}

      {selectedHazard && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"><section className="w-full max-w-lg rounded-[28px] bg-white p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-[#d45b2a]">{selectedHazard.id}</p><h2 className="mt-2 text-xl font-bold">{selectedHazard.title}</h2></div><button onClick={() => setSelectedHazardId(null)} className="grid size-9 place-items-center rounded-full bg-[#f3eee5]" aria-label="关闭详情"><X size={17}/></button></div><p className="mt-4 text-sm leading-6 text-[#756f65]">{selectedHazard.detail}</p><div className="mt-5 grid grid-cols-3 gap-2">{[["区域", selectedHazard.zone], ["责任人", selectedHazard.owner], ["状态", selectedHazard.status]].map(([label, value]) => <div key={label} className="rounded-2xl bg-[#f6f2ea] p-3"><p className="text-[10px] text-[#817a6e]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>)}</div><button onClick={() => setSelectedHazardId(null)} className="mt-6 w-full rounded-full bg-[#242b25] py-3 text-sm font-bold text-white">返回工作台</button></section></div>}

      {selectedEvidenceFinding && selectedFindingEvidence && <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"><section className="mx-auto max-w-6xl rounded-[28px] bg-[#fbf7ef] p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-[#d45b2a]">{selectedEvidenceFinding.id} · 证据对比</p><h2 className="mt-2 text-xl font-bold">{selectedEvidenceFinding.title}</h2><p className="mt-2 text-sm text-[#756f65]">来源：{selectedFindingEvidence.sourceLabel}。红框对应本条 Finding 的画面人员；请结合原图和整改后证据作出人工判断。</p></div><button onClick={() => setSelectedEvidenceFindingId(null)} className="grid size-10 shrink-0 place-items-center rounded-full bg-white" aria-label="关闭证据大图"><X size={18}/></button></div><div className={`mt-6 grid gap-5 ${selectedEvidenceFinding.rectificationEvidenceUrl ? "lg:grid-cols-2" : ""}`}><EvidencePreview label="整改前 · 原始现场证据" url={selectedFindingEvidence.contentUrl} subject={selectedFindingEvidence.persons.find((person) => person.id === selectedEvidenceFinding.subjectDetectionId)} onOpen={() => {}}/>{selectedEvidenceFinding.rectificationEvidenceUrl && <EvidencePreview label="整改后 · 复核证据" url={selectedEvidenceFinding.rectificationEvidenceUrl} onOpen={() => {}}/>}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4"><div><p className="text-sm font-bold">人工审核状态</p><p className="mt-1 text-xs text-[#756f65]">{selectedEvidenceFinding.workflowState === "pending_verification" ? "整改证据已提交，等待复核" : selectedEvidenceFinding.reviewState === "pending" ? "AI Finding 尚未确认" : "证据已关联到当前闭环记录"}</p></div><button onClick={() => setSelectedEvidenceFindingId(null)} className="rounded-full bg-[#242b25] px-5 py-2.5 text-sm font-bold text-white">返回处理卡片</button></div></section></div>}

      {summaryOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"><section className="w-full max-w-xl rounded-[28px] bg-white p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-[#d45b2a]">巡检批次摘要</p><h2 className="mt-2 text-2xl font-bold">{project.name} · {inspection?.name ?? "多人安全帽巡检"}</h2></div><button onClick={() => setSummaryOpen(false)} className="grid size-9 place-items-center rounded-full bg-[#f3eee5]" aria-label="关闭摘要"><X size={17}/></button></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["证据", evidences.length], ["检测人员", persons.length], ["Finding", findings.length], ["已关闭", closed]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-[#f6f2ea] p-4 text-center"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[#817a6e]">{label}</p></div>)}</div><div className="mt-5 rounded-2xl border border-[#ded7c9] p-4 text-sm leading-7 text-[#656d67]"><p><strong>批次开始：</strong>{inspection ? new Date(inspection.startedAt).toLocaleString("zh-CN") : "尚未开始"}</p><p><strong>覆盖来源：</strong>{new Set(evidences.map((item) => item.sourceLabel.split(" · ")[0])).size} 个摄像头/采集点</p><p><strong>待人工确认：</strong>{pending} 项</p><p><strong>当前结论：</strong>{findings.length ? "AI Finding 已汇总到人工审核与整改闭环" : "本批次暂无待确认 Finding"}</p></div><button onClick={() => setSummaryOpen(false)} className="mt-6 w-full rounded-full bg-[#242b25] py-3 text-sm font-bold text-white">确认并返回工作台</button></section></div>}
    </main>
  );
}
