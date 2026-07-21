import { randomBytes } from 'node:crypto'

export function xorEncode(
  data: Uint8Array,
  keySize: number
): { encoded: Uint8Array; key: Uint8Array } {
  const key = new Uint8Array(randomBytes(keySize))
  const encoded = new Uint8Array(data.length)

  for (let i = 0; i < data.length; i++) {
    encoded[i] = data[i] ^ key[i % key.length]
  }

  return { encoded, key }
}
