import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";

/** Serves api/*.ts handlers in dev so `vite dev` works without `vercel dev`. */
function vercelApiDev(): Plugin {
  return {
    name: "vercel-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const endpoint = req.url.replace("/api/", "").split("?")[0];
        let body = "";
        for await (const chunk of req) body += chunk;
        const mockReq = {
          method: req.method,
          headers: req.headers,
          body: body ? JSON.parse(body) : {},
        };
        const mockRes = {
          statusCode: 200,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: unknown) {
            res.statusCode = this.statusCode;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          },
        };
        try {
          const mod = await server.ssrLoadModule(`/api/${endpoint}.ts`);
          await mod.default(mockReq, mockRes);
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [
      vercelApiDev(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          id: "/",
          name: "Panelhaus — AI Comic Studio",
          short_name: "Panelhaus",
          description:
            "Create AI-powered comics on your phone. Write a story, generate panels, add speech bubbles, and export as PNG or GIF.",
          theme_color: "#0F172A",
          background_color: "#0F172A",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          lang: "en",
          start_url: "/",
          categories: ["entertainment", "graphics", "productivity"],
          prefer_related_applications: false,
          icons: [
            {
              src: "/icons/android-chrome-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/android-chrome-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          screenshots: [
            {
              src: "/screenshots/workshop.png",
              sizes: "863x1920",
              type: "image/png",
              form_factor: "narrow",
              label: "Write your comic story in the Workshop",
            },
            {
              src: "/screenshots/director.png",
              sizes: "863x1920",
              type: "image/png",
              form_factor: "narrow",
              label: "Generate AI panels in the Director",
            },
            {
              src: "/screenshots/editor.png",
              sizes: "863x1920",
              type: "image/png",
              form_factor: "narrow",
              label: "Add speech bubbles and export in the Editor",
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 365 * 24 * 60 * 60,
                },
              },
            },
          ],
        },
      }),
    ],
    define: {
      // API key is now server-side only (Vercel env vars)
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-pdf": ["jspdf"],
            "vendor-image": ["html-to-image"],
            "vendor-gif": ["modern-gif"],
            "vendor-motion": ["motion/react"],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
    },
  };
});
