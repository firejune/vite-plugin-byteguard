import type { Algorithm } from './types'

/**
 * Generate minimal inline loader script for the browser.
 * The loader fetches the .bin file, decodes it, and executes via V8.
 */
export function generateLoader(
  binPath: string,
  algorithm: Algorithm,
  isModule: boolean
): string {
  const decode =
    algorithm === 'xor' ? xorDecodeSnippet() : aesDecodeSnippet()

  const execute = isModule
    ? `const s=document.createElement('script');s.type='module';s.src=URL.createObjectURL(new Blob([t],{type:'text/javascript'}));document.head.appendChild(s)`
    : `(new Function(t))()`

  return `(async()=>{const r=await fetch('${binPath}');const b=new Uint8Array(await r.arrayBuffer());${decode}${execute}})()`
}

/** XOR decode: extract key from header, XOR payload */
function xorDecodeSnippet(): string {
  return [
    `const kl=b[6]|b[7]<<8`,
    `const k=b.slice(8,8+kl)`,
    `const d=b.slice(8+kl)`,
    `const o=new Uint8Array(d.length)`,
    `for(let i=0;i<d.length;i++)o[i]=d[i]^k[i%kl]`,
    `const t=new TextDecoder().decode(o);`
  ].join(';')
}

/** AES-GCM decode: extract key+IV from header, decrypt via WebCrypto */
function aesDecodeSnippet(): string {
  return [
    `const kl=b[6]|b[7]<<8`,
    `const k=b.slice(8,8+kl)`,
    `const il=b[8+kl]`,
    `const iv=b.slice(9+kl,9+kl+il)`,
    `const d=b.slice(9+kl+il)`,
    `const ck=await crypto.subtle.importKey('raw',k,'AES-GCM',false,['decrypt'])`,
    `const dc=await crypto.subtle.decrypt({name:'AES-GCM',iv},ck,d)`,
    `const t=new TextDecoder().decode(dc);`
  ].join(';')
}
