import { z } from "zod";

export const normalizedBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const personDetectionSchema = z.object({
  id: z.string().min(1),
  box: normalizedBoxSchema,
  helmetStatus: z.enum(["helmet", "no_helmet", "uncertain"]),
  confidence: z.number().min(0).max(1),
});

export const visionFindingSchema = z.object({
  id: z.string().min(1),
  inspectionId: z.string().min(1),
  evidenceId: z.string().min(1),
  subjectDetectionId: z.string().min(1),
  title: z.string().min(1),
  label: z.literal("suspected_no_helmet"),
  confidence: z.number().min(0).max(1),
  severitySuggestion: z.enum(["low", "medium", "high", "critical"]),
  status: z.literal("pending_confirmation"),
  model: z.string().min(1),
});

export const visionInspectionResultSchema = z.object({
  inspectionId: z.string().min(1),
  evidenceId: z.string().min(1),
  model: z.string().min(1),
  adapter: z.string().min(1),
  reviewStatus: z.literal("pending_human_review"),
  persons: z.array(personDetectionSchema),
  findings: z.array(visionFindingSchema),
});

export type VisionInspectionResult = z.infer<typeof visionInspectionResultSchema>;

export type VisionInspectionInput = {
  inspectionId: string;
  evidenceId: string;
  image?: Buffer;
};

export interface VisionAdapter {
  inspect(input: VisionInspectionInput): Promise<VisionInspectionResult>;
}
