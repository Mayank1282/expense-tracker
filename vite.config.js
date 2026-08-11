import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
            fonts: [
                bunny('Space Grotesk', { weights: [500, 700] }),
                bunny('IBM Plex Mono', { weights: [400, 500, 600] }),
            ],
        }),
        react(),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
    // No manualChunks here, deliberately.
    //
    // Naming three.js and Recharts as manual chunks looks like it isolates them,
    // but it does the opposite: forcing a module into a named chunk hoists it to
    // a STATIC import of the entry, so every page — the login screen included —
    // downloaded 885KB of three.js it would never use, and the lazy/idle/WebGL
    // guards around the 3D layer became decorative. Left alone, the bundler
    // respects the real `import()` boundaries and three.js only ships to the
    // browser once the scene actually mounts.
});
