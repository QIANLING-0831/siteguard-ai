import "server-only";

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type EvidenceFingerprint = {
  sha256: string;
  visualHash: string | null;
};

function pythonExecutable() {
  const local = join(process.cwd(), ".venv", "Scripts", "python.exe");
  return existsSync(local) ? local : process.platform === "win32" ? "python" : "python3";
}

async function calculateVisualHash(content: Buffer): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(pythonExecutable(), [join(process.cwd(), "services", "evidence", "fingerprint.py")], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { output += chunk; });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const result = JSON.parse(output) as { visualHash?: string };
        resolve(result.visualHash && /^[0-9a-f]{16}$/.test(result.visualHash) ? result.visualHash : null);
      } catch {
        resolve(null);
      }
    });
    child.stdin.end(content);
  });
}

export async function fingerprintEvidence(content: Buffer): Promise<EvidenceFingerprint> {
  return {
    sha256: createHash("sha256").update(content).digest("hex"),
    visualHash: await calculateVisualHash(content),
  };
}

export function visualHashSimilarity(left: string | null, right: string | null) {
  if (!left || !right || !/^[0-9a-f]{16}$/.test(left) || !/^[0-9a-f]{16}$/.test(right)) return null;
  const differentBits = (BigInt(`0x${left}`) ^ BigInt(`0x${right}`)).toString(2).replaceAll("0", "").length;
  return 1 - differentBits / 64;
}
