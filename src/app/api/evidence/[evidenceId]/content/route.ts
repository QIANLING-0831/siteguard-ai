import { getEvidenceContent } from "@/modules/inspection-workbench";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  return params.then(({ evidenceId }) => {
    const evidence = getEvidenceContent(evidenceId);
    if (!evidence) return new Response("Not found", { status: 404 });
    const body = evidence.content.buffer.slice(
      evidence.content.byteOffset,
      evidence.content.byteOffset + evidence.content.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(evidence.fileName)}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  });
}
