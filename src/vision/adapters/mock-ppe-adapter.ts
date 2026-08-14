import type { VisionAdapter, VisionInspectionResult } from "../contracts";

export class MockPpeAdapter implements VisionAdapter {
  async inspect(input: {
    inspectionId: string;
    evidenceId: string;
  }): Promise<VisionInspectionResult> {
    const model = "SiteGuard Mock PPE v1 · 流程演示";
    const persons = [
      { id: "person-1", box: { x: 0.08, y: 0.16, width: 0.23, height: 0.72 }, helmetStatus: "helmet" as const, confidence: 0.93 },
      { id: "person-2", box: { x: 0.38, y: 0.1, width: 0.24, height: 0.78 }, helmetStatus: "no_helmet" as const, confidence: 0.88 },
      { id: "person-3", box: { x: 0.69, y: 0.2, width: 0.2, height: 0.65 }, helmetStatus: "helmet" as const, confidence: 0.9 },
    ];

    return {
      inspectionId: input.inspectionId,
      evidenceId: input.evidenceId,
      model,
      adapter: "mock",
      reviewStatus: "pending_human_review",
      persons,
      findings: [
        {
          id: `finding-${input.evidenceId}-person-2`,
          inspectionId: input.inspectionId,
          evidenceId: input.evidenceId,
          subjectDetectionId: "person-2",
          title: "临边工作人员疑似未佩戴安全帽",
          label: "suspected_no_helmet",
          confidence: 0.88,
          severitySuggestion: "high",
          status: "pending_confirmation",
          model,
        },
      ],
    };
  }
}
