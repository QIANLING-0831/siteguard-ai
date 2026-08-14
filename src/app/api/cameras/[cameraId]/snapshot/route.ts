import {
  captureCameraFrame,
  findServerCameraSource,
} from "@/infrastructure/camera/server-camera-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cameraId: string }> },
) {
  const { cameraId } = await params;
  const camera = findServerCameraSource(cameraId);
  if (!camera) return Response.json({ error: "camera_not_found" }, { status: 404 });

  try {
    const frame = await captureCameraFrame(camera);
    return new Response(new Uint8Array(frame), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${camera.id}-${Date.now()}.jpg"`,
      },
    });
  } catch (error) {
    console.error(`Failed to capture camera ${camera.id}`, error);
    return Response.json({ error: "camera_unavailable" }, { status: 502 });
  }
}
