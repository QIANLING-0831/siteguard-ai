import { z } from "zod";

import { executeWorkbenchCommand } from "@/modules/inspection-workbench";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("review_finding"), projectId: z.string(), findingId: z.string(), decision: z.enum(["pending", "confirmed", "dismissed"]) }),
  z.object({ type: z.literal("assign_rectification"), projectId: z.string(), findingId: z.string(), ownerId: z.string(), dueDate: z.string().min(1) }),
  z.object({ type: z.literal("start_rectification"), projectId: z.string(), findingId: z.string() }),
  z.object({ type: z.literal("verify_rectification"), projectId: z.string(), findingId: z.string(), decision: z.enum(["pass", "return"]) }),
  z.object({ type: z.literal("void_evidence"), projectId: z.string(), evidenceId: z.string(), reason: z.string().trim().min(2).max(120) }),
  z.object({ type: z.literal("restore_evidence"), projectId: z.string(), evidenceId: z.string() }),
  z.object({ type: z.literal("keep_duplicate"), projectId: z.string(), suggestionId: z.number().int().positive() }),
  z.object({
    type: z.literal("keep_one_void_rest"),
    projectId: z.string(),
    keepEvidenceId: z.string().min(1),
    suggestionIds: z.array(z.number().int().positive()).min(1).max(100),
  }),
]);

export async function POST(request: Request) {
  try {
    return Response.json(executeWorkbenchCommand(commandSchema.parse(await request.json())));
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
