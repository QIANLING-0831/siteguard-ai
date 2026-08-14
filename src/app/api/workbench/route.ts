import { getWorkbenchSnapshot } from "@/modules/inspection-workbench";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    return Response.json(getWorkbenchSnapshot(projectId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Loading workbench failed", error);
    return Response.json({ error: "workbench_unavailable" }, { status: 500 });
  }
}
