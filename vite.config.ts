import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons.svg"],
      manifest: {
        name: "Amibel",
        short_name: "Amibel",
        description: "Bibel lesen, verstehen und erforschen mit KI-gestütztem Chat.",
        theme_color: "#FCF9F3",
        background_color: "#FCF9F3",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,wasm}"],
        runtimeCaching: [
          {
            urlPattern: /\/bible-data\/bible\.db$/,
            handler: "CacheFirst",
            options: {
              cacheName: "bible-db",
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/sqljs\/.*\.wasm$/,
            handler: "CacheFirst",
            options: { cacheName: "sqljs-wasm" },
          },
        ],
      },
    }),
  ],
});
