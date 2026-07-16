import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages at the custom domain https://korch.co/ (see public/CNAME).
// IMPORTANT: do not merge/deploy this until korch.co's DNS actually resolves to
// GitHub Pages — a root base path breaks the site if it's still being served
// from the old https://<user>.github.io/korchindex/ path (assets would 404
// looking for /assets/... instead of /korchindex/assets/...).
export default defineConfig({
  plugins: [react()],
  base: '/',
})
