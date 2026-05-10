// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Cloudflare plugin disabled to allow Vercel deployment.
// The TanStack Start build emits a Web Fetch handler at dist/server/index.js
// which is wrapped by api/server.ts for Vercel Node.js Functions.
export default defineConfig({
  cloudflare: false,
  vite: {
    server: {
      port: 8085,
    },
    build: {
      target: "es2022",
    },
  },
});
