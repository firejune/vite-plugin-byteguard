import type { Plugin } from 'vite'
import type { OutputAsset, OutputChunk } from 'rollup'
import type { ByteGuardOptions } from './types'
import { encode } from './encoder'
import { generateLoader } from './decoder'

export type { ByteGuardOptions, Algorithm } from './types'

export default function byteguard(options: ByteGuardOptions = {}): Plugin {
  const { algorithm = 'xor', keySize = 32, exclude = [], extension = 'bin' } = options

  return {
    name: 'vite-plugin-byteguard',
    apply: 'build',
    enforce: 'post',

    generateBundle(_, bundle) {
      const jsChunks = new Map<string, OutputChunk>()

      // Collect entry JS chunks only (skip workers, dynamic imports, etc.)
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk' || !fileName.endsWith('.js')) continue
        if (!chunk.isEntry) continue
        if (isExcluded(fileName, exclude)) continue
        jsChunks.set(fileName, chunk)
      }

      if (jsChunks.size === 0) return

      // Encode each entry chunk → .bin
      const binMap = new Map<string, string>()
      for (const [fileName, chunk] of jsChunks) {
        // The directory prefix of the entry chunk (e.g. "assets/")
        const dir = fileName.substring(0, fileName.lastIndexOf('/') + 1)

        const code = chunk.code
          // Fix import.meta.url: inline scripts get page URL instead of asset URL.
          // Replace with a computed URL that resolves to the original asset path.
          .replace(/import\.meta\.url/g, `new URL("${fileName}",document.baseURI).href`)
          // Vite 8(Rolldown): __VITE_PRELOAD__ references are injected by Vite's preload optimizer.
          // In local execution (Capacitor/Electron) they are unnecessary. Replace with void 0.
          .replace(/__VITE_PRELOAD__/g, 'void 0')
          // Fix dynamic import(): relative paths resolve against the document URL
          // in inline/Blob script context, not the original asset directory.
          // Convert relative paths to absolute URLs via document.baseURI.
          .replace(/import\(\s*["'](\.[^"']+)['"]\s*\)/g, (_, relPath: string) => {
            const absPath = resolvePath(dir, relPath)
            return `import(new URL("${absPath}",document.baseURI).href)`
          })
        const encoded = encode(code, algorithm, keySize)
        const binFileName = fileName.replace(/\.js$/, `.${extension}`)

        this.emitFile({
          type: 'asset',
          fileName: binFileName,
          source: encoded
        })

        binMap.set(fileName, binFileName)
        delete bundle[fileName]
      }

      // Update HTML: replace <script> tags with inline loader
      for (const [, asset] of Object.entries(bundle)) {
        if (!String(asset.fileName).endsWith('.html') || asset.type !== 'asset') continue

        let html = typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source)

        for (const [jsFileName, binFileName] of binMap) {
          const escaped = escapeRegex(jsFileName)
          const scriptRe = new RegExp(`<script([^>]*)src=["']([^"']*${escaped})["']([^>]*)>\\s*</script>`, 'g')

          html = html.replace(scriptRe, (_match, pre: string) => {
            const isModule = /type\s*=\s*["']module["']/.test(pre)
            const loader = generateLoader(`./${binFileName}`, algorithm, isModule)
            return `<script>${loader}</script>`
          })
        }

        ;(asset as OutputAsset).source = html
      }

      const names = [...binMap.values()].join(', ')
      console.log(`\x1b[36m[byteguard]\x1b[0m Encoded ${binMap.size} chunk(s) with ${algorithm}: ${names}`)
    }
  }
}

function isExcluded(fileName: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.includes('*')) {
      const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      return re.test(fileName)
    }
    return fileName.includes(pattern)
  })
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolve a relative path against a directory prefix.
 * e.g. resolvePath('assets/', './chunk.js') → 'assets/chunk.js'
 *      resolvePath('assets/js/', '../shared/util.js') → 'assets/shared/util.js'
 */
export function resolvePath(dir: string, relPath: string): string {
  const parts = (dir + relPath).split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') resolved.pop()
    else if (part !== '.' && part !== '') resolved.push(part)
  }
  return resolved.join('/')
}

/**
 * Rewrite relative dynamic import() paths in code to absolute URLs.
 * Exported for testing purposes.
 */
export function rewriteDynamicImports(code: string, dir: string): string {
  return code
    .replace(/__VITE_PRELOAD__/g, 'void 0')
    .replace(/import\(\s*["'](\.[^"']+)['"]\s*\)/g, (_, relPath: string) => {
      const absPath = resolvePath(dir, relPath)
      return `import(new URL("${absPath}",document.baseURI).href)`
    })
}
