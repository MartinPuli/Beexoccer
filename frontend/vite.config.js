import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Tailored Vite config: enables React Fast Refresh and sets a friendly dev server port.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5175
    },
    css: {
        devSourcemap: true
    }
});
