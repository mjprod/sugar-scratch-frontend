// Self-hosts the dotlottie-web WASM binary under public/wasm so
// DotLottieReact/DotLottieWorker never depend on cdn.jsdelivr.net.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(
  here,
  '../node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm',
)
const destDir = resolve(here, '../public/wasm')
const dest = resolve(destDir, 'dotlottie-player.wasm')

if (!existsSync(src)) {
  console.warn(`[copy-dotlottie-wasm] source not found, skipping: ${src}`)
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log(`[copy-dotlottie-wasm] copied to ${dest}`)
