import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { loadAppEnv } from "./vite.env";

export default defineConfig(({ mode }) => {
  const { define } = loadAppEnv(mode, process.cwd());

  return {
    plugins: [react()],
    build: {
      target: "esnext",
    },
    define,
  };
});
