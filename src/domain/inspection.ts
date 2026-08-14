import { z } from "zod";

export const findingStatusSchema = z.enum([
  "pending_confirmation",
  "confirmed",
  "dismissed",
]);

export const hazardStatusSchema = z.enum([
  "open",
  "assigned",
  "rectifying",
  "pending_verification",
  "closed",
]);

export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const findingSchema = z.object({
  id: z.string().min(1),
  inspectionId: z.string().min(1),
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
  severitySuggestion: severitySchema,
  status: findingStatusSchema,
  model: z.string().min(1),
  evidenceId: z.string().min(1),
});

export type Finding = z.infer<typeof findingSchema>;
export type HazardStatus = z.infer<typeof hazardStatusSchema>;

export const allowedHazardTransitions: Record<HazardStatus, HazardStatus[]> = {
  open: ["assigned"],
  assigned: ["rectifying"],
  rectifying: ["pending_verification"],
  pending_verification: ["rectifying", "closed"],
  closed: [],
};

export function canTransitionHazard(from: HazardStatus, to: HazardStatus) {
  return allowedHazardTransitions[from].includes(to);
}
