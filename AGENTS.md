# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Selected visual direction

- Use option 1 as the source of truth: `/Users/lijiahao/.codex/generated_images/019ff140-87dd-7802-96fd-8af2a9f8716f/exec-35d54ae1-9560-428b-aa9a-f33fa3f27ce3.png`.
- Keep the visual language restrained and operational: white surfaces, cool gray borders, EventMesh blue actions, green health states, compact enterprise density, and low-radius cards.
- The first deliverable contains two working screens: cluster overview and cluster detail. Use realistic local data until the backend contracts stabilize.
