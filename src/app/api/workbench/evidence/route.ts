import { addInspectionEvidence, addRectificationEvidence, getWorkbenchSnapshot, recordVisionResult } from "@/modules/inspection-workbench";
import { getVisionAdapter } from "@/vision/get-vision-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const projectId = String(form.get("projectId") ?? "");
    const purpose = String(form.get("purpose") ?? "inspection");
    const image = form.get("image");
    if (!projectId || !(image instanceof File) || image.size === 0) throw new Error("请选择有效的现场照片");
    const content = Buffer.from(await image.arrayBuffer());
    if (purpose === "rectification") {
      const findingId = String(form.get("findingId") ?? "");
      return Response.json(addRectificationEvidence({ projectId, findingId, fileName: image.name, mimeType: image.type || "application/octet-stream", content }));
    }
    const sourceLabel = String(form.get("sourceLabel") ?? image.name);
    const ids = await addInspectionEvidence({ projectId, sourceLabel, fileName: image.name, mimeType: image.type || "application/octet-stream", content });
    const result = await getVisionAdapter().inspect({ ...ids, image: content });
    recordVisionResult(result);
    return Response.json(getWorkbenchSnapshot(projectId));
  } catch (error) {
    console.error("Saving evidence failed", error);
    const message = error instanceof Error ? error.message : "证据保存失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
