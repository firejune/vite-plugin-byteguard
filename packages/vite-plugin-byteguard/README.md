# vite-plugin-byteguard

Vite plugin that encodes JavaScript bundles into binary format, preventing casual source code exposure.

**How it works:** At build time, entry JS chunks are encoded into a custom binary format (`.bin`). At runtime, a tiny inline loader (~400B) decodes the binary and executes it via Blob URL. **Zero runtime performance impact** — only the initial decode adds negligible overhead.

## Install

```bash
npm install vite-plugin-byteguard -D
```

## Usage

```js
// vite.config.ts
import { defineConfig } from 'vite'
import byteguard from 'vite-plugin-byteguard'

export default defineConfig({
  plugins: [
    byteguard()
  ]
})
```

### Options

```ts
byteguard({
  // Encoding algorithm: 'xor' (default) or 'aes-gcm'
  algorithm: 'xor',

  // Key size in bytes (default: 32)
  keySize: 32,

  // Glob patterns to exclude from encoding
  exclude: [],

  // Encoded file extension (default: 'bin')
  extension: 'bin'
})
```

## What Gets Encoded

| Asset Type | Encoded? | Protection |
|------------|----------|------------|
| Entry JS chunks | ✅ Binary `.bin` | Unreadable on disk |
| Dynamic import chunks | ❌ `.js` as-is | Use with obfuscator |
| Web Workers | ❌ `.js` as-is | Use with obfuscator |
| CSS / Assets | ❌ Untouched | N/A |

> [!TIP]
> Pair with [rollup-plugin-obfuscator](https://www.npmjs.com/package/rollup-plugin-obfuscator) for full coverage — obfuscate all JS, then byteguard encodes the main bundle.

## Algorithms

| Algorithm | Speed | Protection | Async Required |
|-----------|-------|------------|----------------|
| `xor` | ⚡ fastest | casual protection | No |
| `aes-gcm` | fast | strong encryption | Yes (WebCrypto) |

## CSP Requirements

ByteGuard requires `'unsafe-inline'` and `blob:` in your Content Security Policy:

```html
<meta http-equiv="Content-Security-Policy"
  content="script-src 'self' 'unsafe-inline' blob:;" />

## How It Works

```
Build Time:
  index.js → [obfuscate] → [XOR encode] → index.bin
  import('./chunk.js') → import(new URL('assets/chunk.js', document.baseURI).href)

Runtime:
  index.html
    └─ <script> (inline loader, ~400B)
        ├─ fetch('./assets/index.bin')
        ├─ XOR decode
        └─ Blob URL → <script type="module" src="blob:...">
            └─ V8 executes natively
```

Workers continue to load as normal `.js` files. The plugin automatically rewrites `import.meta.url` and dynamic `import()` paths so that asset references resolve correctly from the Blob URL execution context. This ensures compatibility with WKWebView (iOS/Capacitor) and other strict module environments.

> [!TIP]
> If you use `rollup-plugin-obfuscator` with `stringArray` encoding, add `reservedStrings: ['\\.js$']` to prevent import paths from being encoded into the string array.

## Binary Format

```
Offset  Size    Description
0       4       Magic "BGRD" (0x42 0x47 0x52 0x44)
4       1       Version (0x01)
5       1       Algorithm (0x01=XOR, 0x02=AES-GCM)
6       2       Key length (uint16 LE)
8       N       Key bytes
--- AES-GCM only ---
8+N     1       IV length (12)
9+N     12      IV bytes
--- End ---
varies  rest    Encoded payload
```

## Limitations

- The inline loader script is visible in HTML (contains the decoding logic)
- A determined attacker can intercept the decoded JS in memory via DevTools
- This is **casual protection** — it prevents string searching, source browsing, and automated scraping of your JS bundles
- Workers remain as plain JS (use obfuscation for these)
- Dynamic import chunks remain as plain `.js` files, but their import paths are automatically resolved

## Use Cases

- **Capacitor/Cordova** mobile apps — prevent APK/IPA extraction → source reading
- **Electron** apps — complement bytenode for web-facing parts
- **Hybrid apps** where JS source should not be trivially accessible

## License

MIT
