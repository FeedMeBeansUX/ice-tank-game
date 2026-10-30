import { defineConfig } from 'vite';

// Build label shown in the corner of the game, so a playtester can tell which
// version is loaded. On GitHub, GITHUB_SHA is the commit being published.
const commit = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  // Relative paths, so the build works at https://feedmebeansux.github.io/ice-tank-game/
  base: './',
  define: {
    __BUILD_LABEL__: JSON.stringify(`${commit} · ${builtAt} UTC`),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Pages: the game, the tank line-up preview (tanks.html) and the detail studies (heavy, agile, stealth, laser, shotgun, artillery, rocket .html).
    rollupOptions: {
      input: {
        main: 'index.html',
        tanks: 'tanks.html',
        heavy: 'heavy.html',
        agile: 'agile.html',
        stealth: 'stealth.html',
        laser: 'laser.html',
        shotgun: 'shotgun.html',
        artillery: 'artillery.html',
        rocket: 'rocket.html',
      },
    },
  },
});
