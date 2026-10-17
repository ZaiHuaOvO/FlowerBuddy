import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSenderValidator } from '../../src/main/ipc/validate-sender'

const rendererIndexPath = resolve('out', 'renderer', 'index.html')
const rendererIndexUrl = pathToFileURL(rendererIndexPath).href

describe('IPC sender validation', () => {
  it('accepts the packaged renderer entry', () => {
    const isTrusted = createSenderValidator({
      devServerUrl: undefined,
      rendererIndexPath
    })

    expect(isTrusted(rendererIndexUrl)).toBe(true)
  })

  it('ignores query strings and hashes on the packaged entry', () => {
    const isTrusted = createSenderValidator({
      devServerUrl: undefined,
      rendererIndexPath
    })

    expect(isTrusted(`${rendererIndexUrl}?view=pet#top`)).toBe(true)
  })

  it('rejects other local files', () => {
    const isTrusted = createSenderValidator({
      devServerUrl: undefined,
      rendererIndexPath
    })

    expect(isTrusted(pathToFileURL(resolve('out', 'main', 'index.js')).href)).toBe(false)
  })

  it('rejects remote pages', () => {
    const isTrusted = createSenderValidator({
      devServerUrl: undefined,
      rendererIndexPath
    })

    expect(isTrusted('https://example.com/')).toBe(false)
    expect(isTrusted('http://localhost:5173/')).toBe(false)
  })

  it('rejects missing, malformed and non-file URLs', () => {
    const isTrusted = createSenderValidator({
      devServerUrl: undefined,
      rendererIndexPath
    })

    expect(isTrusted(undefined)).toBe(false)
    expect(isTrusted('')).toBe(false)
    expect(isTrusted('not a url')).toBe(false)
    expect(isTrusted('about:blank')).toBe(false)
    expect(isTrusted('data:text/html,<h1>hi</h1>')).toBe(false)
  })

  it('accepts only the dev server origin while running in development', () => {
    const isTrusted = createSenderValidator({
      devServerUrl: 'http://localhost:5173',
      rendererIndexPath
    })

    expect(isTrusted('http://localhost:5173/')).toBe(true)
    expect(isTrusted('http://localhost:5173/index.html?x=1')).toBe(true)
    expect(isTrusted('http://localhost:5174/')).toBe(false)
    expect(isTrusted('http://127.0.0.1:5173/')).toBe(false)
    expect(isTrusted('https://example.com/')).toBe(false)
  })
})
