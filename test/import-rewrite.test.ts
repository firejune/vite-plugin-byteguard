import { describe, it, expect } from 'vitest'
import { resolvePath, rewriteDynamicImports } from '../src/index'

describe('resolvePath', () => {
  it('should resolve ./ relative path', () => {
    expect(resolvePath('assets/', './chunk.js')).toBe('assets/chunk.js')
  })

  it('should resolve ../ parent traversal', () => {
    expect(resolvePath('assets/js/', '../shared/util.js')).toBe(
      'assets/shared/util.js'
    )
  })

  it('should handle multiple ../ traversals', () => {
    expect(resolvePath('assets/js/deep/', '../../lib.js')).toBe(
      'assets/lib.js'
    )
  })

  it('should handle root-level entry (no directory)', () => {
    expect(resolvePath('', './chunk.js')).toBe('chunk.js')
  })

  it('should handle path without ./ prefix', () => {
    expect(resolvePath('assets/', './sub/chunk.js')).toBe(
      'assets/sub/chunk.js'
    )
  })
})

describe('rewriteDynamicImports', () => {
  it('should absolutize relative import paths', () => {
    const code = `import('./chunk-abc.js')`
    const result = rewriteDynamicImports(code, 'assets/')
    expect(result).toBe(
      `import(new URL("assets/chunk-abc.js",document.baseURI).href)`
    )
  })

  it('should handle double-quoted imports', () => {
    const code = `import("./chunk-abc.js")`
    const result = rewriteDynamicImports(code, 'assets/')
    expect(result).toBe(
      `import(new URL("assets/chunk-abc.js",document.baseURI).href)`
    )
  })

  it('should handle parent directory traversal', () => {
    const code = `import('../shared/util.js')`
    const result = rewriteDynamicImports(code, 'assets/js/')
    expect(result).toBe(
      `import(new URL("assets/shared/util.js",document.baseURI).href)`
    )
  })

  it('should not modify absolute or http imports', () => {
    const code = `import('https://cdn.example.com/lib.js')`
    const result = rewriteDynamicImports(code, 'assets/')
    expect(result).toBe(code)
  })

  it('should not modify bare module imports', () => {
    const code = `import('lodash')`
    const result = rewriteDynamicImports(code, 'assets/')
    expect(result).toBe(code)
  })

  it('should handle multiple imports in same code', () => {
    const code = `const a = import('./a.js'); const b = import('./b.js')`
    const result = rewriteDynamicImports(code, 'assets/')
    expect(result).toContain('assets/a.js')
    expect(result).toContain('assets/b.js')
  })

  it('should handle imports with spaces', () => {
    const code = `import( './chunk.js' )`
    const result = rewriteDynamicImports(code, 'assets/')
    expect(result).toBe(
      `import(new URL("assets/chunk.js",document.baseURI).href)`
    )
  })

  it('should handle Vite-style hashed chunk names', () => {
    const code = `import('./InformationDb-C3xK9f2a.js')`
    const result = rewriteDynamicImports(code, 'assets/')
    expect(result).toBe(
      `import(new URL("assets/InformationDb-C3xK9f2a.js",document.baseURI).href)`
    )
  })
})
