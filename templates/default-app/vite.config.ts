import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Android serves the compiled app below /assets/www/. Relative URLs keep
// generated JS, CSS, and imported assets inside that WebView asset directory.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: "0.0.0.0" },
});
