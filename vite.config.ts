import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// @ts-expect-error type error without @types/node package
import process from "node:process";
// @ts-expect-error type error without @types/node package
import { resolve, join } from "node:path";
// @ts-expect-error type error without @types/node package
import { readFileSync, existsSync, mkdirSync, cpSync, statSync } from "node:fs";

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf-8"));

const PDFJS_ASSET_DIRS = ["cmaps", "standard_fonts", "wasm", "iccs"];

function pdfjsOfflineAssetsPlugin() {
  const pdfjsRoot = resolve(import.meta.dirname, "node_modules/pdfjs-dist");

  return {
    name: "pdfjs-offline-assets",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url?.split("?")[0] || "";
        if (!url.startsWith("/pdfjs/")) return next();

        const relPath = url.slice("/pdfjs/".length);
        if (relPath.includes("..")) return next();

        const filePath = join(pdfjsRoot, relPath);
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          if (filePath.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          } else if (filePath.endsWith(".mjs") || filePath.endsWith(".js")) {
            res.setHeader("Content-Type", "application/javascript");
          } else {
            res.setHeader("Content-Type", "application/octet-stream");
          }
          res.end(readFileSync(filePath));
          return;
        }
        next();
      });
    },
    closeBundle() {
      const outPdfjsDir = resolve(import.meta.dirname, "dist/pdfjs");
      for (const dir of PDFJS_ASSET_DIRS) {
        const srcDir = join(pdfjsRoot, dir);
        const destDir = join(outPdfjsDir, dir);
        if (existsSync(srcDir)) {
          mkdirSync(destDir, { recursive: true });
          cpSync(srcDir, destDir, { recursive: true });
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [vue(), pdfjsOfflineAssetsPlugin()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        notes: resolve(import.meta.dirname, "notes.html"),
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
