import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NODE_MODULES = join(ROOT, 'node_modules')
const OUTPUT_DIR = join(ROOT, 'licenses')
const OUTPUT_FILE = join(OUTPUT_DIR, 'THIRD_PARTY_LICENSES.md')

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

function licenseOf(pkg) {
  const license = pkg.license
  if (typeof license === 'string' && license.trim() !== '') {
    return license.trim()
  }
  if (license && typeof license === 'object' && typeof license.type === 'string') {
    return license.type
  }
  if (Array.isArray(pkg.licenses)) {
    const names = pkg.licenses
      .map((item) => (typeof item === 'string' ? item : item?.type))
      .filter((name) => typeof name === 'string' && name.trim() !== '')
    if (names.length > 0) {
      return names.join(' OR ')
    }
  }
  return 'UNKNOWN'
}

function repositoryOf(pkg) {
  const repository = pkg.repository
  if (typeof repository === 'string') {
    return repository
  }
  if (repository && typeof repository.url === 'string') {
    return repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
  }
  return typeof pkg.homepage === 'string' ? pkg.homepage : ''
}

function collectPackages(moduleDir, packages) {
  let entries
  try {
    entries = readdirSync(moduleDir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue
    }
    if (entry.name === '.bin' || entry.name === '.cache') {
      continue
    }

    const packageDir = join(moduleDir, entry.name)
    if (entry.name.startsWith('@')) {
      collectPackages(packageDir, packages)
      continue
    }

    const manifestPath = join(packageDir, 'package.json')
    if (existsSync(manifestPath)) {
      const pkg = readJson(manifestPath)
      if (pkg && typeof pkg.name === 'string' && typeof pkg.version === 'string') {
        packages.set(`${pkg.name}@${pkg.version}`, {
          name: pkg.name,
          version: pkg.version,
          license: licenseOf(pkg),
          repository: repositoryOf(pkg)
        })
      }
    }

    const nested = join(packageDir, 'node_modules')
    if (existsSync(nested)) {
      collectPackages(nested, packages)
    }
  }
}

const packages = new Map()
collectPackages(NODE_MODULES, packages)

if (packages.size === 0) {
  console.error('No installed packages found. Run `npm install` first.')
  process.exit(1)
}

const rows = [...packages.values()].sort((a, b) =>
  a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name)
)
const unknown = rows.filter((row) => row.license === 'UNKNOWN')

const lines = [
  '# FlowerBuddy 第三方依赖许可证清单',
  '',
  '本文件由 `npm run licenses` 根据 `node_modules` 中已安装依赖的 `package.json` 元数据生成，用于发布时说明依赖来源与许可证声明。',
  '它不替代各依赖包内实际附带的许可证文本；完整文本位于对应依赖包目录或打包产物中。',
  '',
  `- 生成时间：${new Date().toISOString()}`,
  `- 依赖条目：${rows.length}`,
  `- 未声明许可证：${unknown.length}`,
  '',
  '| 包 | 版本 | 许可证 | 仓库 |',
  '| --- | --- | --- | --- |',
  ...rows.map(
    (row) =>
      `| ${row.name} | ${row.version} | ${row.license} | ${row.repository.replace(/\|/g, '\\|')} |`
  ),
  ''
]

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8')

console.log(
  `Wrote ${OUTPUT_FILE} (${rows.length} packages, ${unknown.length} without license field)`
)
