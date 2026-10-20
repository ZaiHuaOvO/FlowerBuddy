import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const websiteRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distRoot = join(websiteRoot, 'docs', '.vitepress', 'dist')

function normalizeBase(value) {
  const trimmed = value.replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

const baseArgument = process.argv.find((argument) => argument.startsWith('--base='))
const base = normalizeBase(baseArgument ? baseArgument.slice('--base='.length) : '/FlowerBuddy/')

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function isIgnored(target) {
  return (
    target.startsWith('#') ||
    target.startsWith('mailto:') ||
    target.startsWith('tel:') ||
    target.startsWith('javascript:') ||
    target.startsWith('data:') ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  )
}

function fileCandidates(target, sourceFile) {
  const clean = decodeURIComponent(target.split('#')[0].split('?')[0])
  if (!clean) {
    return []
  }

  const absolute = clean.startsWith(base)
    ? join(distRoot, clean.slice(base.length))
    : clean.startsWith('/')
      ? null
      : resolve(dirname(sourceFile), clean)

  if (!absolute) {
    return []
  }
  if (clean.endsWith('/')) {
    return [join(absolute, 'index.html')]
  }
  const candidates = [absolute]
  if (!extname(absolute)) {
    candidates.push(`${absolute}.html`, join(absolute, 'index.html'))
  }
  return candidates
}

if (!existsSync(distRoot)) {
  console.error(`Build output not found: ${distRoot}`)
  console.error('Run "npm run build" first.')
  process.exit(1)
}

const htmlFiles = walk(distRoot).filter((file) => file.endsWith('.html'))
const checked = new Set()
const broken = []

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1]
    if (!target || isIgnored(target)) {
      continue
    }
    const key = `${file}\u0000${target}`
    if (checked.has(key)) {
      continue
    }
    checked.add(key)

    if (target.startsWith('/') && !target.startsWith(base)) {
      broken.push({ source: file, target, reason: 'outside configured base' })
      continue
    }

    const candidates = fileCandidates(target, file)
    if (candidates.length === 0) {
      broken.push({ source: file, target, reason: 'invalid path' })
      continue
    }
    if (!candidates.some((candidate) => existsSync(candidate))) {
      broken.push({ source: file, target, reason: 'file not found' })
    }
  }
}

const unique = [
  ...new Map(broken.map((item) => [`${item.source}\u0000${item.target}`, item])).values()
]

console.log(`base: ${base}`)
console.log(`html files: ${htmlFiles.length}`)
console.log(`internal links checked: ${checked.size}`)

if (unique.length > 0) {
  for (const item of unique) {
    console.error(`BROKEN [${item.reason}] ${item.target} in ${item.source}`)
  }
  console.error(`broken links: ${unique.length}`)
  process.exit(1)
}

console.log('no broken internal links')
