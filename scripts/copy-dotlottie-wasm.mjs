// Self-hosts the dotlottie-web WASM binary under public/wasm so
// DotLottieReact/DotLottieWorker never depend on cdn.jsdelivr.net.
// The file name carries the dotlottie-web version (see src/lib/lottie/wasmPath.ts)
// so hosts can serve it with an immutable cache header.
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

// wasmPath.ts hard-codes the package.json pin (enforced by deferredLottie.self-check.ts).
const pinned = readJson(resolve(here, '../package.json')).dependencies['@lottiefiles/dotlottie-web']

// dotlottie-react runs whichever dotlottie-web it resolves (a nested copy wins),
// and the wasm must come from that same copy.
const nestedPkg = resolve(
  here,
  '../node_modules/@lottiefiles/dotlottie-react/node_modules/@lottiefiles/dotlottie-web',
)
const hoistedPkg = resolve(here, '../node_modules/@lottiefiles/dotlottie-web')
const pkgDir = existsSync(resolve(nestedPkg, 'package.json')) ? nestedPkg : hoistedPkg
const src = resolve(pkgDir, 'dist/dotlottie-player.wasm')

if (!existsSync(src)) {
  console.warn(`[copy-dotlottie-wasm] source not found, skipping: ${src}`)
  process.exit(0)
}

const { version } = readJson(resolve(pkgDir, 'package.json'))
if (version !== pinned) {
  console.error(
    `[copy-dotlottie-wasm] dotlottie-react resolves @lottiefiles/dotlottie-web ${version} ` +
      `(${pkgDir}) but package.json pins ${pinned}. Align the pin, ` +
      'DOTLOTTIE_WEB_VERSION in src/lib/lottie/wasmPath.ts and the dotlottie-react range.',
  )
  process.exit(1)
}

const destDir = resolve(here, '../public/wasm')
const destName = `dotlottie-player.${version}.wasm`
const dest = resolve(destDir, destName)

mkdirSync(destDir, { recursive: true })
for (const name of readdirSync(destDir)) {
  if (/^dotlottie-player(\..+)?\.wasm$/.test(name) && name !== destName) {
    unlinkSync(resolve(destDir, name))
  }
}
copyFileSync(src, dest)
console.log(`[copy-dotlottie-wasm] copied to ${dest}`)
