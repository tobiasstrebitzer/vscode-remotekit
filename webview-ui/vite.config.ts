import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, Plugin } from 'vite'

const here = import.meta.dirname

function vendorCodicons(): Plugin {
  const from = resolve(here, '../node_modules/@vscode/codicons/dist')
  const to = resolve(here, '../dist/codicons')
  return {
    name: 'vendor-codicons',
    apply: 'build',
    closeBundle() {
      mkdirSync(to, { recursive: true })
      copyFileSync(resolve(from, 'codicon.css'), resolve(to, 'codicon.css'))
      copyFileSync(resolve(from, 'codicon.ttf'), resolve(to, 'codicon.ttf'))
    }
  }
}

export default defineConfig({
  root: here,
  base: './',
  plugins: [react(), vendorCodicons()],
  resolve: {
    alias: {
      '@shared': resolve(here, '../src/RemoteFileExplorer')
    }
  },
  build: {
    outDir: resolve(here, '../dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
})
