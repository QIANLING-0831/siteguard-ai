import "server-only";

import { MockPpeAdapter } from "./adapters/mock-ppe-adapter";
import { UltralyticsPpeAdapter } from "./adapters/ultralytics-ppe-adapter";
import type { VisionAdapter } from "./contracts";

export function getVisionAdapter(): VisionAdapter {
  const mock = new MockPpeAdapter();
  if (process.env.VISION_ADAPTER === "mock") return mock;

  const primary = new UltralyticsPpeAdapter();
  return {
    async inspect(input) {
      if (!input.image?.length) return mock.inspect(input);
      try {
        return await primary.inspect(input);
      } catch (error) {
        console.error("Ultralytics adapter unavailable; using explicit mock fallback", error);
        const fallback = await mock.inspect(input);
        return {
          ...fallback,
          adapter: "mock-fallback",
          model: `${fallback.model} · Ultralytics 不可用时回退`,
          findings: fallback.findings.map((finding) => ({
            ...finding,
            model: `${finding.model} · Ultralytics 不可用时回退`,
          })),
        };
      }
    },
  };
}
