import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Publicada en https://gardon-hub.github.io/ciaa-operarios/
export default defineConfig({
  base: "/ciaa-operarios/",
  define: {
    __VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace("T", " ")),
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
