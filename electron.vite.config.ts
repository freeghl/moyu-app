import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          hoverVideo: resolve('src/preload/hoverVideo.ts')
        }
      }
    }
  },
  renderer: {
    root: './src/renderer',
    server: {
      port: 9999,
      host: '127.0.0.1'
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'webview' } } }), tailwindcss()]
  }
})
