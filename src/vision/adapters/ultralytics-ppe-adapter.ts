import "server-only";

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { VisionAdapter, VisionInspectionInput, VisionInspectionResult } from "../contracts";
import { visionInspectionResultSchema } from "../contracts";

export class UltralyticsPpeAdapter implements VisionAdapter {
  async inspect(input: VisionInspectionInput): Promise<VisionInspectionResult> {
    if (!input.image?.length) throw new Error("Ultralytics adapter requires an image");

    const runtimeDir = path.join(process.cwd(), ".runtime", "vision-input");
    await mkdir(runtimeDir, { recursive: true });
    const imagePath = path.join(runtimeDir, `${randomUUID()}.jpg`);
    await writeFile(imagePath, input.image);

    const python = process.env.VISION_PYTHON_PATH
      || path.join(process.cwd(), ".venv", "Scripts", "python.exe");
    const script = path.join(process.cwd(), "services", "vision", "infer_ppe.py");

    try {
      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(
          /* turbopackIgnore: true */ python,
          [
            script,
            "--image", imagePath,
            "--inspection-id", input.inspectionId,
            "--evidence-id", input.evidenceId,
          ],
          { cwd: process.cwd(), windowsHide: true },
        );
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error("Ultralytics inference timed out"));
        }, 45_000);

        child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
        child.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        child.on("close", (code) => {
          clearTimeout(timeout);
          if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"));
          else reject(new Error(Buffer.concat(stderr).toString("utf8") || `Python exited with ${code}`));
        });
      });

      const jsonLine = output.trim().split(/\r?\n/).at(-1);
      if (!jsonLine) throw new Error("Ultralytics adapter returned no result");
      return visionInspectionResultSchema.parse(JSON.parse(jsonLine));
    } finally {
      await rm(imagePath, { force: true });
    }
  }
}
