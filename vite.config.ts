// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      input: {
        contentScript: "./src/content/contentScript.tsx",
        background: "./src/content/background.ts",
      },
      output: {
        dir: "dist",
        entryFileNames: "assets/[name].js",
        format: "es",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "styles/[name].[ext]";
          }
          return "assets/[name].[ext]";
        },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
