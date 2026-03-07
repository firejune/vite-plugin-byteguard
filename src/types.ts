export type Algorithm = 'xor' | 'aes-gcm'

export interface ByteGuardOptions {
  /** Encoding algorithm. Default: 'xor' */
  algorithm?: Algorithm
  /** Encryption key size in bytes. Default: 32 */
  keySize?: number
  /** Glob patterns to exclude from encoding */
  exclude?: string[]
  /** Encoded file extension. Default: 'bin' */
  extension?: string
}

/** Binary format magic bytes: "BGRD" */
export const MAGIC = new Uint8Array([0x42, 0x47, 0x52, 0x44])
export const VERSION = 0x01
export const ALG_XOR = 0x01
export const ALG_AES_GCM = 0x02
