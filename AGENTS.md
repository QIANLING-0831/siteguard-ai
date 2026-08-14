<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SiteGuard AI project rules

- Read `CONTEXT.md` before changing domain terms or workflow states.
- An AI observation is a `Finding`, not a confirmed `HazardCase`; only human
  confirmation may promote it.
- Keep visual inference behind an adapter. Domain workflows must run with the
  mock adapter when Ultralytics is unavailable.
- Never display unverified accuracy claims. Show model name, confidence, and
  human-review status on AI-assisted results.
- The route under `/prototype/` is throwaway UI used to choose a direction; do
  not treat it as production architecture.
