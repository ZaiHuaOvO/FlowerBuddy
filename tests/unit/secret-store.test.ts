import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SecretStore, type SafeStorageBackend } from '../../src/main/security/secret-store'
import { AppError } from '../../src/main/shared/errors'

const FAKE_KEY = 0x5a

function fakeEncrypt(plainText: string): Buffer {
  const bytes = Buffer.from(plainText, 'utf8')
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (bytes[index] ?? 0) ^ FAKE_KEY
  }
  return Buffer.from(`v1:${bytes.toString('base64')}`, 'utf8')
}

function fakeDecrypt(buffer: Buffer): string {
  const text = buffer.toString('utf8')
  if (!text.startsWith('v1:')) {
    throw new Error('invalid ciphertext')
  }
  const bytes = Buffer.from(text.slice(3), 'base64')
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (bytes[index] ?? 0) ^ FAKE_KEY
  }
  return bytes.toString('utf8')
}

class FakeBackend implements SafeStorageBackend {
  available = true
  shouldReEncrypt = false
  encryptCalls = 0

  async isAvailable(): Promise<boolean> {
    return this.available
  }

  async encrypt(plainText: string): Promise<Buffer> {
    this.encryptCalls += 1
    return fakeEncrypt(plainText)
  }

  async decrypt(encrypted: Buffer) {
    return {
      result: fakeDecrypt(encrypted),
      shouldReEncrypt: this.shouldReEncrypt
    }
  }
}

const temporaryDirectories: string[] = []

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-secrets-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('secret store', () => {
  it('round-trips a secret without exposing the plaintext on disk', async () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'secrets.enc.json')
    const backend = new FakeBackend()
    const store = new SecretStore(filePath, backend)
    store.load()

    await store.set('deepseek.apiKey', 'sk-test-secret-value')
    expect(store.has('deepseek.apiKey')).toBe(true)
    expect(store.listIds()).toEqual(['deepseek.apiKey'])
    await expect(store.get('deepseek.apiKey')).resolves.toBe('sk-test-secret-value')

    const raw = readFileSync(filePath, 'utf8')
    expect(raw).not.toContain('sk-test-secret-value')
    expect(JSON.parse(raw).values['deepseek.apiKey']).toMatch(/^djE6/)
  })

  it('never writes config.json when storing a secret', async () => {
    const directory = createTemporaryDirectory()
    const configPath = join(directory, 'config.json')
    writeFileSync(
      configPath,
      JSON.stringify({ schemaVersion: 2, app: {}, pet: {}, modules: {} }),
      'utf8'
    )

    const store = new SecretStore(join(directory, 'secrets.enc.json'), new FakeBackend())
    store.load()
    await store.set('esa.accessKeySecret', 'super-secret-access-key')

    expect(readFileSync(configPath, 'utf8')).not.toContain('super-secret-access-key')
  })

  it('refuses to save when encryption is unavailable and writes nothing', async () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'secrets.enc.json')
    const backend = new FakeBackend()
    backend.available = false
    const store = new SecretStore(filePath, backend)
    store.load()

    await expect(store.set('gmail.refreshToken', 'refresh-token-value')).rejects.toMatchObject({
      code: 'SECRET_STORAGE_UNAVAILABLE'
    })
    expect(existsSync(filePath)).toBe(false)
  })

  it('re-encrypts secrets when the platform asks for it', async () => {
    const directory = createTemporaryDirectory()
    const backend = new FakeBackend()
    const store = new SecretStore(join(directory, 'secrets.enc.json'), backend)
    store.load()

    await store.set('deepseek.apiKey', 'value')
    expect(backend.encryptCalls).toBe(1)

    backend.shouldReEncrypt = true
    await expect(store.get('deepseek.apiKey')).resolves.toBe('value')
    expect(backend.encryptCalls).toBe(2)
  })

  it('deletes and clears secrets', async () => {
    const directory = createTemporaryDirectory()
    const store = new SecretStore(join(directory, 'secrets.enc.json'), new FakeBackend())
    store.load()

    await store.set('deepseek.apiKey', 'one')
    await store.set('esa.accessKeyId', 'two')
    await store.delete('deepseek.apiKey')
    expect(store.listIds()).toEqual(['esa.accessKeyId'])

    await store.clear()
    expect(store.listIds()).toEqual([])
  })

  it('rejects malformed secret ids', async () => {
    const directory = createTemporaryDirectory()
    const store = new SecretStore(join(directory, 'secrets.enc.json'), new FakeBackend())
    store.load()

    await expect(store.set('../escape', 'value')).rejects.toBeInstanceOf(AppError)
    expect(() => store.has('not a valid id')).toThrow(AppError)
  })

  it('backs up an unreadable secret file and starts empty', () => {
    const directory = createTemporaryDirectory()
    const filePath = join(directory, 'secrets.enc.json')
    writeFileSync(filePath, '{ broken', 'utf8')

    const store = new SecretStore(filePath, new FakeBackend())
    store.load()

    expect(store.listIds()).toEqual([])
    expect(readdirSync(directory).some((name) => name.includes('.corrupt-'))).toBe(true)
  })
})
