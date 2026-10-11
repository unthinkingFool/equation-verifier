import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Autograd Explorer — Vite configuration.
//
// Plugin order matters: TanStack Start must run before the React plugin.
// Nitro only runs for production builds; during `vite dev` the app is served
// by Vite directly. Nitro auto-detects the hosting platform (Node, Vercel,
// Netlify, Cloudflare, ...) so the same build deploys almost anywhere.
export default defineConfig(({ command }) => ({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Route all server requests through src/server.ts, which wraps the
      // TanStack Start handler with friendly SSR error handling.
      server: { entry: "server" },
    }),
    viteReact(),
    ...(command === "build" ? [nitro()] : []),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    // Guarantee a single copy of React and the router across the bundle.
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
}));
