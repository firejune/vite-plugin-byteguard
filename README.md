# vite-plugin-byteguard

Vite plugin that encodes JavaScript bundles into binary format, preventing casual source code exposure.

**How it works:** At build time, JS chunks are encoded into a custom binary format (`.bin`). At runtime, a tiny inline loader (~300B) decodes the binary and passes the JavaScript to the browser's native V8/JSC engine via `new Function()`. **Zero runtime performance impact** — only the initial decode adds a negligible overhead.

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
  exclude: ['**/worker*.js'],

  // Encoded file extension (default: 'bin')
  extension: 'bin'
})
```

## Algorithms

| Algorithm | Speed | Protection | Async Required |
|-----------|-------|------------|----------------|
| `xor` | ⚡ fastest | casual protection | No |
| `aes-gcm` | fast | strong encryption | Yes (WebCrypto) |

- **XOR**: Random key XOR encoding. Fast decode, synchronous. Good for preventing casual string searches on extracted APK/IPA bundles.
- **AES-GCM**: AES-256-GCM encryption via Node.js crypto (build) / WebCrypto (runtime). Stronger protection but requires async decoding.

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

## How It Protects

Your bundled JS goes from this (readable):
```js
class Game { calculateScore() { ... } }
```

To this (binary blob):
```
42 47 52 44 01 01 20 00 a3 f7 2b ... (unreadable binary)
```

At runtime, the loader decodes and passes it directly to the JS engine — **same V8 performance, unreadable on disk**.

## Limitations

- The inline loader script is visible in HTML (contains the decoding algorithm)
- A determined attacker can intercept the decoded JS in memory via DevTools
- This is **casual protection** — it prevents string searching, source browsing, and automated scraping of your JS bundles

## Use Cases

- Capacitor/Cordova mobile apps (prevent APK extraction → source reading)
- Electron apps (complement to bytenode for web-facing parts)
- Hybrid apps where JS source should not be trivially accessible

## License

MIT
