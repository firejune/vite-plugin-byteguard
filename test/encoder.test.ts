import { describe, it, expect } from 'vitest'
import { encode } from '../src/encoder'
import { MAGIC, VERSION, ALG_XOR, ALG_AES_GCM } from '../src/types'

describe('encoder', () => {
  describe('XOR encoding', () => {
    it('should produce valid binary header', () => {
      const result = encode('console.log("hello")', 'xor', 16)

      // Check magic bytes
      expect(result[0]).toBe(0x42) // B
      expect(result[1]).toBe(0x47) // G
      expect(result[2]).toBe(0x52) // R
      expect(result[3]).toBe(0x44) // D

      // Check version
      expect(result[4]).toBe(VERSION)

      // Check algorithm
      expect(result[5]).toBe(ALG_XOR)

      // Check key length (16, uint16 LE)
      expect(result[6]).toBe(16)
      expect(result[7]).toBe(0)
    })

    it('should round-trip encode/decode correctly', () => {
      const original = 'const x = "hello world"; console.log(x);'
      const keySize = 32
      const binary = encode(original, 'xor', keySize)

      // Extract key and payload from binary
      const kl = binary[6] | (binary[7] << 8)
      expect(kl).toBe(keySize)

      const key = binary.slice(8, 8 + kl)
      const payload = binary.slice(8 + kl)

      // XOR decode
      const decoded = new Uint8Array(payload.length)
      for (let i = 0; i < payload.length; i++) {
        decoded[i] = payload[i] ^ key[i % kl]
      }

      const result = new TextDecoder().decode(decoded)
      expect(result).toBe(original)
    })

    it('should handle empty string', () => {
      const binary = encode('', 'xor', 16)
      const kl = binary[6] | (binary[7] << 8)
      const payload = binary.slice(8 + kl)
      expect(payload.length).toBe(0)
    })

    it('should handle unicode content', () => {
      const original = 'const msg = "한글 테스트 🎴";'
      const binary = encode(original, 'xor', 32)

      const kl = binary[6] | (binary[7] << 8)
      const key = binary.slice(8, 8 + kl)
      const payload = binary.slice(8 + kl)

      const decoded = new Uint8Array(payload.length)
      for (let i = 0; i < payload.length; i++) {
        decoded[i] = payload[i] ^ key[i % kl]
      }

      expect(new TextDecoder().decode(decoded)).toBe(original)
    })

    it('should handle large content', () => {
      const original = 'x'.repeat(100_000)
      const binary = encode(original, 'xor', 64)

      const kl = binary[6] | (binary[7] << 8)
      const key = binary.slice(8, 8 + kl)
      const payload = binary.slice(8 + kl)

      const decoded = new Uint8Array(payload.length)
      for (let i = 0; i < payload.length; i++) {
        decoded[i] = payload[i] ^ key[i % kl]
      }

      expect(new TextDecoder().decode(decoded)).toBe(original)
    })

    it('should generate different keys per encode call', () => {
      const js = 'console.log(1)'
      const a = encode(js, 'xor', 16)
      const b = encode(js, 'xor', 16)

      const keyA = a.slice(8, 24)
      const keyB = b.slice(8, 24)

      // Keys should differ (random)
      expect(Buffer.from(keyA).equals(Buffer.from(keyB))).toBe(false)
    })
  })

  describe('AES-GCM encoding', () => {
    it('should produce valid binary header', () => {
      const result = encode('console.log("hello")', 'aes-gcm', 32)

      // Magic
      expect(result.slice(0, 4)).toEqual(MAGIC)

      // Version
      expect(result[4]).toBe(VERSION)

      // Algorithm
      expect(result[5]).toBe(ALG_AES_GCM)

      // Key length (32 bytes for AES-256)
      const kl = result[6] | (result[7] << 8)
      expect(kl).toBe(32)

      // IV length should be 12 (GCM standard)
      const ivLen = result[8 + kl]
      expect(ivLen).toBe(12)
    })

    it('should round-trip with Node.js crypto', async () => {
      const { createDecipheriv } = await import('node:crypto')
      const original = 'const game = { score: 100 };'
      const binary = encode(original, 'aes-gcm', 32)

      // Parse header
      const kl = binary[6] | (binary[7] << 8)
      const key = binary.slice(8, 8 + kl)
      const ivLen = binary[8 + kl]
      const iv = binary.slice(9 + kl, 9 + kl + ivLen)
      const encrypted = binary.slice(9 + kl + ivLen)

      // Separate ciphertext and auth tag (last 16 bytes)
      const authTag = encrypted.slice(encrypted.length - 16)
      const ciphertext = encrypted.slice(0, encrypted.length - 16)

      // Decrypt
      const algo = kl === 16 ? 'aes-128-gcm' : kl === 24 ? 'aes-192-gcm' : 'aes-256-gcm'
      const decipher = createDecipheriv(algo, key, iv)
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ])

      expect(decrypted.toString('utf-8')).toBe(original)
    })

    it('should normalize key sizes', () => {
      // keySize 10 → AES-128 (16 bytes)
      const small = encode('test', 'aes-gcm', 10)
      expect(small[6] | (small[7] << 8)).toBe(16)

      // keySize 20 → AES-192 (24 bytes)
      const medium = encode('test', 'aes-gcm', 20)
      expect(medium[6] | (medium[7] << 8)).toBe(24)

      // keySize 32 → AES-256 (32 bytes)
      const large = encode('test', 'aes-gcm', 32)
      expect(large[6] | (large[7] << 8)).toBe(32)
    })
  })
})
