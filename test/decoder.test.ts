import { describe, it, expect } from 'vitest'
import { generateLoader } from '../src/decoder'

describe('decoder', () => {
  it('should generate XOR module loader', () => {
    const loader = generateLoader('./assets/index.bin', 'xor', true)

    expect(loader).toContain('fetch')
    expect(loader).toContain('./assets/index.bin')
    expect(loader).toContain('URL.createObjectURL')
    expect(loader).toContain('revokeObjectURL')
    expect(loader).toContain('document.head.appendChild')
    // XOR specific: should have XOR decoding loop
    expect(loader).toContain('o[i]=d[i]^k[i%kl]')
  })

  it('should generate XOR classic loader', () => {
    const loader = generateLoader('./assets/index.bin', 'xor', false)

    expect(loader).toContain('new Function(t)')
    expect(loader).not.toContain("type='module'")
  })

  it('should generate AES-GCM module loader', () => {
    const loader = generateLoader('./assets/index.bin', 'aes-gcm', true)

    expect(loader).toContain('crypto.subtle.importKey')
    expect(loader).toContain('crypto.subtle.decrypt')
    expect(loader).toContain('AES-GCM')
    expect(loader).toContain('URL.createObjectURL')
  })

  it('should generate AES-GCM classic loader', () => {
    const loader = generateLoader('./assets/index.bin', 'aes-gcm', false)

    expect(loader).toContain('crypto.subtle.decrypt')
    expect(loader).toContain('new Function(t)')
  })

  it('should produce compact output', () => {
    const loader = generateLoader('./a.bin', 'xor', true)
    // Loader should be reasonably small (< 500 chars)
    expect(loader.length).toBeLessThan(600)
  })
})
