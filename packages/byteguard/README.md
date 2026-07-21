# byteguard

Encodes JS bundles into a binary format for casual source code protection.
Bundler-agnostic core — no `vite` or `rollup` imports.

**Not encryption, not DRM** — it raises the cost of reading a shipped bundle from
*open the file* to *reverse-engineer the loader*. Anything the runtime executes is
still recoverable by a determined attacker.

Most users want the adapter instead:

- [`vite-plugin-byteguard`](https://www.npmjs.com/package/vite-plugin-byteguard)

Use this package directly only when writing an adapter for another bundler.

## API

```js
import { encode, generateLoader } from 'byteguard'

// Encode a bundle into the binary container
const { data, key } = encode(source, 'xor', 32)

// Generate the inline loader that fetches, decodes and runs it
const loader = generateLoader('assets/index.bin', 'xor', true)
```

| Export | Purpose |
| --- | --- |
| `encode` | Source → binary container (`BGRD` magic, versioned header) |
| `generateLoader` | Minimal inline browser loader for an encoded file |
| `xorEncode` / `aesEncode` | Algorithms |
| `MAGIC` `VERSION` `ALG_XOR` `ALG_AES_GCM` | Container constants |

Algorithms: `xor` (default) and `aes-gcm`.

## License

MIT
