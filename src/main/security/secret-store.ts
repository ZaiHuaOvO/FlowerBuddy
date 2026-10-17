import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import { AppError } from '../shared/errors'
import type { LoggerLike } from '../shared/logger'

const SECRET_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/
const SECRET_FILE_SCHEMA_VERSION = 1

export interface DecryptedSecret {
  result: string
  shouldReEncrypt: boolean
}

/** Injectable so tests can run without Electron's safeStorage. */
export interface SafeStorageBackend {
  isAvailable(): Promise<boolean>
  encrypt(plainText: string): Promise<Buffer>
  decrypt(encrypted: Buffer): Promise<DecryptedSecret>
}

interface SecretsFile {
  schemaVersion: number
  values: Record<string, string>
}

function assertSecretId(id: string): void {
  if (!SECRET_ID_PATTERN.test(id) || id.length > 128) {
    throw new AppError('INVALID_INPUT', '密钥标识不合法')
  }
}

function unavailableError(): AppError {
  return new AppError(
    'SECRET_STORAGE_UNAVAILABLE',
    '系统安全存储不可用，密钥不会以明文保存。请检查系统凭据服务后重试。'
  )
}

/**
 * Stores only Base64 ciphertext. Values never leave the main process and are
 * never written to config.json or logs.
 */
export class SecretStore {
  private values: Record<string, string> = {}

  constructor(
    private readonly filePath: string,
    private readonly backend: SafeStorageBackend,
    private readonly logger?: LoggerLike
  ) {}

  load(): void {
    if (!existsSync(this.filePath)) {
      this.values = {}
      return
    }

    try {
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'))
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed) ||
        (parsed as SecretsFile).schemaVersion !== SECRET_FILE_SCHEMA_VERSION ||
        typeof (parsed as SecretsFile).values !== 'object' ||
        (parsed as SecretsFile).values === null
      ) {
        throw new Error('invalid secret file shape')
      }

      const values: Record<string, string> = {}
      for (const [id, ciphertext] of Object.entries((parsed as SecretsFile).values)) {
        if (typeof ciphertext === 'string') {
          values[id] = ciphertext
        }
      }
      this.values = values
    } catch {
      this.backupCorruptFile()
      this.values = {}
      this.logger?.warn('secret store file was unreadable; backed up and reset')
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.backend.isAvailable()
    } catch {
      return false
    }
  }

  has(id: string): boolean {
    assertSecretId(id)
    return typeof this.values[id] === 'string'
  }

  listIds(): string[] {
    return Object.keys(this.values).sort()
  }

  async set(id: string, plainText: string): Promise<void> {
    assertSecretId(id)
    if (!(await this.isAvailable())) {
      throw unavailableError()
    }

    const encrypted = await this.backend.encrypt(plainText)
    this.values[id] = encrypted.toString('base64')
    this.writeNow()
  }

  async get(id: string): Promise<string | null> {
    assertSecretId(id)
    const stored = this.values[id]
    if (!stored) {
      return null
    }
    if (!(await this.isAvailable())) {
      throw unavailableError()
    }

    const decrypted = await this.backend.decrypt(Buffer.from(stored, 'base64'))
    if (decrypted.shouldReEncrypt) {
      const encrypted = await this.backend.encrypt(decrypted.result)
      this.values[id] = encrypted.toString('base64')
      this.writeNow()
    }
    return decrypted.result
  }

  async delete(id: string): Promise<void> {
    assertSecretId(id)
    if (!(id in this.values)) {
      return
    }
    delete this.values[id]
    this.writeNow()
  }

  async clear(): Promise<void> {
    this.values = {}
    this.writeNow()
  }

  private writeNow(): void {
    try {
      const payload: SecretsFile = {
        schemaVersion: SECRET_FILE_SCHEMA_VERSION,
        values: this.values
      }
      mkdirSync(dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.tmp`
      writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
      renameSync(temporaryPath, this.filePath)
    } catch (error) {
      throw new AppError('CONFIG_ERROR', '无法保存密钥，请检查用户数据目录权限', {
        cause: error
      })
    }
  }

  private backupCorruptFile(): void {
    try {
      if (existsSync(this.filePath)) {
        copyFileSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}.json`)
      }
    } catch {
      // Best effort.
    }
  }
}
