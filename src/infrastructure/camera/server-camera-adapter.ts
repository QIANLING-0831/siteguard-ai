import "server-only";

import { spawn } from "node:child_process";
import { z } from "zod";

const cameraSourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  name: z.string().min(1),
  location: z.string().min(1),
  inputUrl: z.string().refine(
    (value) => /^(rtsp|rtsps|http|https):\/\//i.test(value),
    "inputUrl must use RTSP(S) or HTTP(S)",
  ),
  playbackUrl: z.string().url(),
});

const cameraSourcesSchema = z.array(cameraSourceSchema);

export type ServerCameraSource = z.infer<typeof cameraSourceSchema>;
export type PublicCameraSource = Omit<ServerCameraSource, "inputUrl">;

export function listServerCameraSources(): ServerCameraSource[] {
  const raw = process.env.CAMERA_SOURCES_JSON;
  if (!raw) return [];

  try {
    return cameraSourcesSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.error("CAMERA_SOURCES_JSON is invalid", error);
    return [];
  }
}

export function listPublicCameraSources(): PublicCameraSource[] {
  return listServerCameraSources().map(({ id, name, location, playbackUrl }) => ({
    id,
    name,
    location,
    playbackUrl,
  }));
}

export function findServerCameraSource(id: string) {
  return listServerCameraSources().find((camera) => camera.id === id);
}

export function captureCameraFrame(camera: ServerCameraSource) {
  return new Promise<Buffer>((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    const inputArgs = camera.inputUrl.toLowerCase().startsWith("rtsp")
      ? ["-rtsp_transport", "tcp"]
      : [];
    const child = spawn(
      /* turbopackIgnore: true */ ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        ...inputArgs,
        "-i",
        camera.inputUrl,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ],
      { windowsHide: true },
    );

    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    let size = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error("Camera snapshot timed out"));
    }, 12_000);

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(Buffer.concat(chunks));
    }

    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) {
        child.kill();
        finish(new Error("Camera snapshot exceeded 12 MB"));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0 && chunks.length > 0) finish();
      else finish(new Error(Buffer.concat(errors).toString("utf8") || `FFmpeg exited with code ${code}`));
    });
  });
}
