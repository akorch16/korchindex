import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages at https://<user>.github.io/korchindex/
export default defineConfig({
  plugins: [react()],
  base: '/korchindex/',
})
