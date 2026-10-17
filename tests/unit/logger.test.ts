import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Logger, redactString, redactValue } from '../../src/main/shared/logger'

const temporaryDirectories: string[] = []

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'flowerbuddy-logs-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('log redaction', () => {
  it('redacts credential-like keys recursively', () => {
    expect(
      redactValue({
        authorization: 'Bearer abc123',
        apiKey: 'sk-12345678901234567890',
        nested: { email: 'user@example.com', body: 'mail body' },
        keep: 42,
        list: [{ token: 'x' }, 'visible']
      })
    ).toEqual({
      authorization: '[REDACTED]',
      apiKey: '[REDACTED]',
      nested: { email: '[REDACTED]', body: '[REDACTED]' },
      keep: 42,
      list: [{ token: '[REDACTED]' }, 'visible']
    })
  })

  it('redacts inline token patterns', () => {
    expect(redactString('Authorization: Bearer abc.def.ghi')).toBe(
      'Authorization: Bearer [REDACTED]'
    )
    expect(redactString('key=sk-1234567890abcdefghij')).toBe('key=[REDACTED]')
    expect(redactString('AccessKey LTAIabcdefghijklmnop')).toBe('AccessKey [REDACTED]')
  })
})

describe('logger', () => {
  it('writes redacted JSON lines and never the plaintext secret', () => {
    const directory = createTemporaryDirectory()
    const logger = new Logger(directory)

    logger.info('started', {
      apiKey: 'sk-live-1234567890abcdef',
      authorization: 'Bearer top-secret-token'
    })
    logger.error('failed with token=abcdef123456')

    const content = readFileSync(join(directory, 'app.log'), 'utf8')
    expect(content).not.toContain('sk-live-1234567890abcdef')
    expect(content).not.toContain('top-secret-token')
    expect(content).not.toContain('abcdef123456')
    expect(content).toContain('[REDACTED]')
    expect(content).toContain('"level":"info"')
    expect(content).toContain('"level":"error"')
  })
})
