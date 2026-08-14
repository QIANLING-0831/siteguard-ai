import { z } from "zod";

import { getVisionAdapter } from "@/vision/get-vision-adapter";
import { visionInspectionResultSchema } from "@/vision/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  inspectionId: z.string().min(1),
  evidenceId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let values: z.infer<typeof requestSchema>;
    let image: Buffer | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      values = requestSchema.parse({
        inspectionId: form.get("inspectionId"),
        evidenceId: form.get("evidenceId"),
      });
      const file = form.get("image");
      if (file instanceof File) image = Buffer.from(await file.arrayBuffer());
    } else {
      values = requestSchema.parse(await request.json());
    }

    const result = await getVisionAdapter().inspect({ ...values, image });
    return Response.json(visionInspectionResultSchema.parse(result));
  } catch (error) {
    console.error("Vision inspection failed", error);
    return Response.json({ error: "invalid_inspection_request" }, { status: 400 });
  }
}
