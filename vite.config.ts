import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import manifest from "./src/manifest";

export default defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: "build",
      rollupOptions: {
        output: {
          chunkFileNames: "assets/chunk-[hash].js",
        },
      },

      // 🔥 Remove console.log and debugger in production build
      // terserOptions: {
      //   compress: {
      //     drop_console: true,
      //     drop_debugger: true,
      //   },
      // },
      minify: "terser", // <-- required for terserOptions to work
    },

    plugins: [crx({ manifest }), react()],

    legacy: {
      skipWebSocketTokenCheck: true,
    },
  };
});
