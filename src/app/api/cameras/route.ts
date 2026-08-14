import { listPublicCameraSources } from "@/infrastructure/camera/server-camera-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ cameras: listPublicCameraSources() });
}
