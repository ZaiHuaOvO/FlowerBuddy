import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'

// Dev needs 'unsafe-inline' for the React refresh preamble and ws for HMR.
const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: flowerbuddy-pet: flowerbuddy-memo:",
  "font-src 'self' data:",
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: flowerbuddy-pet: flowerbuddy-memo:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'flowerbuddy-csp',
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? DEV_CSP : PROD_CSP
      const marker = '<!-- CSP -->'
      if (!html.includes(marker)) {
        throw new Error(`index.html is missing the ${marker} placeholder`)
      }
      return html.replace(marker, `<meta http-equiv="Content-Security-Policy" content="${csp}" />`)
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    build: {
      minify: 'esbuild'
    },
    plugins: [react(), contentSecurityPolicy()]
  }
})
