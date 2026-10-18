import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Publicada en https://gardon-hub.github.io/ciaa-operarios/
export default defineConfig({
  base: "/ciaa-operarios/",
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
