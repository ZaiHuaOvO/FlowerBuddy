import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const releaseDir = join(root, process.argv[2] ?? 'release')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = packageJson.version
const productName = packageJson.productName
const portableName = `${productName}-Portable-${version}-x64.exe`
const portablePath = join(releaseDir, portableName)
const readmePath = join(root, 'docs', 'README-使用说明.txt')
const licensesPath = join(root, 'licenses', 'THIRD_PARTY_LICENSES.md')
const outputPath = join(releaseDir, `${productName}-${version}-x64.zip`)

for (const [label, filePath] of [
  ['portable executable', portablePath],
  ['usage readme', readmePath],
  ['third-party licenses', licensesPath]
]) {
  if (!existsSync(filePath)) {
    console.error(`Missing ${label}: ${filePath}`)
    process.exit(1)
  }
}

const staging = mkdtempSync(join(tmpdir(), 'flowerbuddy-zip-'))
try {
  copyFileSync(portablePath, join(staging, portableName))
  copyFileSync(readmePath, join(staging, 'README-使用说明.txt'))
  copyFileSync(licensesPath, join(staging, 'THIRD_PARTY_LICENSES.md'))

  const destination = outputPath.replace(/'/g, "''")
  const source = join(staging, '*').replace(/'/g, "''")
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${source}' -DestinationPath '${destination}' -Force`
    ],
    { stdio: 'inherit' }
  )
} finally {
  rmSync(staging, { recursive: true, force: true })
}

mkdirSync(releaseDir, { recursive: true })
console.log(`Wrote ${outputPath} (${statSync(outputPath).size} bytes)`)
