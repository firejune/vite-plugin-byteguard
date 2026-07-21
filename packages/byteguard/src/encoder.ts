import { MAGIC, VERSION, ALG_XOR, ALG_AES_GCM } from './types'
import type { Algorithm } from './types'
import { xorEncode } from './algorithms/xor'
import { aesEncode } from './algorithms/aes'

/**
 * Encode a JS string into ByteGuard binary format.
 *
 * Binary layout:
 *   [Magic 4B] [Version 1B] [Algorithm 1B] [KeyLen 2B LE] [Key NB]
 *   [AES-GCM only: IVLen 1B] [IV MB]
 *   [Payload]
 */
export function encode(
  js: string,
  algorithm: Algorithm = 'xor',
  keySize: number = 32
): Uint8Array {
  const data = new TextEncoder().encode(js)

  if (algorithm === 'xor') {
    const { encoded, key } = xorEncode(data, keySize)
    return packBinary(ALG_XOR, key, encoded)
  } else {
    const { encoded, key, iv } = aesEncode(data, keySize)
    return packBinary(ALG_AES_GCM, key, encoded, iv)
  }
}

function packBinary(
  algorithm: number,
  key: Uint8Array,
  payload: Uint8Array,
  iv?: Uint8Array
): Uint8Array {
  const ivSection = iv ? 1 + iv.length : 0
  const headerSize = MAGIC.length + 1 + 1 + 2 + key.length + ivSection
  const result = new Uint8Array(headerSize + payload.length)
  let offset = 0

  // Magic "BGRD"
  result.set(MAGIC, offset)
  offset += MAGIC.length

  // Version
  result[offset++] = VERSION

  // Algorithm ID
  result[offset++] = algorithm

  // Key length (uint16 LE)
  result[offset++] = key.length & 0xff
  result[offset++] = (key.length >> 8) & 0xff

  // Key
  result.set(key, offset)
  offset += key.length

  // IV (AES-GCM only)
  if (iv) {
    result[offset++] = iv.length
    result.set(iv, offset)
    offset += iv.length
  }

  // Payload
  result.set(payload, offset)

  return result
}
