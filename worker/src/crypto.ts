const encoder = new TextEncoder()
const decoder = new TextDecoder()
const WQ_ID_AAD = encoder.encode('WQ Meeting Calendar WQ_ID v1')

export function normalizeWqId(value: string): string {
  return value.trim().toUpperCase()
}

export function wqIdHint(value: string): string {
  const normalized = normalizeWqId(value)
  return normalized.length <= 4 ? normalized : `••••${normalized.slice(-4)}`
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function wqIdEncryptionKey(secret: string): Promise<CryptoKey> {
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(`wq-id-encryption-v1\0${secret}`))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptWqId(value: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: WQ_ID_AAD },
    await wqIdEncryptionKey(secret),
    encoder.encode(normalizeWqId(value))
  )
  const ciphertext = new Uint8Array(encrypted)
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv)
  combined.set(ciphertext, iv.length)
  return `v1.${base64Url(combined)}`
}

export async function decryptWqId(value: string, secret: string): Promise<string> {
  if (!value.startsWith('v1.')) throw new Error('UNSUPPORTED_WQ_ID_CIPHERTEXT')
  const combined = fromBase64Url(value.slice(3))
  if (combined.length <= 28) throw new Error('INVALID_WQ_ID_CIPHERTEXT')
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12), additionalData: WQ_ID_AAD },
    await wqIdEncryptionKey(secret),
    combined.slice(12)
  )
  return decoder.decode(decrypted)
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return hex(new Uint8Array(digest))
}

export async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return hex(new Uint8Array(signature))
}

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
