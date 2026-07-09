import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/editor",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
});
