import type { Plugin } from 'vite'
import type { OutputAsset, OutputChunk } from 'rollup'
import type { ByteGuardOptions } from './types'
import { encode } from './encoder'
import { generateLoader } from './decoder'

export type { ByteGuardOptions, Algorithm } from './types'

export default function byteguard(options: ByteGuardOptions = {}): Plugin {
  const {
    algorithm = 'xor',
    keySize = 32,
    exclude = [],
    extension = 'bin'
  } = options

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
        // Fix import.meta.url: inline scripts get page URL instead of asset URL.
        // Replace with a computed URL that resolves to the original asset path.
        const code = chunk.code.replace(
          /import\.meta\.url/g,
          `new URL("${fileName}",document.baseURI).href`
        )
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
        if (
          !String(asset.fileName).endsWith('.html') ||
          asset.type !== 'asset'
        )
          continue

        let html =
          typeof asset.source === 'string'
            ? asset.source
            : new TextDecoder().decode(asset.source)

        for (const [jsFileName, binFileName] of binMap) {
          const escaped = escapeRegex(jsFileName)
          const scriptRe = new RegExp(
            `<script([^>]*)src=["']([^"']*${escaped})["']([^>]*)>\\s*</script>`,
            'g'
          )

          html = html.replace(scriptRe, (_match, pre: string) => {
            const isModule = /type\s*=\s*["']module["']/.test(pre)
            const loader = generateLoader(
              `./${binFileName}`,
              algorithm,
              isModule
            )
            return `<script>${loader}</script>`
          })
        }

        ;(asset as OutputAsset).source = html
      }

      const names = [...binMap.values()].join(', ')
      console.log(
        `\x1b[36m[byteguard]\x1b[0m Encoded ${binMap.size} chunk(s) with ${algorithm}: ${names}`
      )
    }
  }
}

function isExcluded(fileName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
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
