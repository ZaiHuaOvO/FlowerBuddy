import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const releaseDir = join(root, process.argv[2] ?? 'release')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = packageJson.version
const artifactBase = 'FlowerBuddy'
const portableName = `${artifactBase}-Portable-${version}-x64.exe`
const portablePath = join(releaseDir, portableName)
const readmePath = join(root, 'docs', 'README-使用说明.txt')
const licensesPath = join(root, 'licenses', 'THIRD_PARTY_LICENSES.md')
const licensePath = join(root, 'LICENSE')
const assetsLicensePath = join(root, 'ASSETS-LICENSE.md')
const outputPath = join(releaseDir, `${artifactBase}-${version}-x64.zip`)

for (const [label, filePath] of [
  ['portable executable', portablePath],
  ['usage readme', readmePath],
  ['third-party licenses', licensesPath],
  ['project license', licensePath],
  ['assets license', assetsLicensePath]
]) {
  if (!existsSync(filePath)) {
    console.error(`Missing ${label}: ${filePath}`)
    process.exit(1)
  }
}

const staging = mkdtempSync(join(tmpdir(), 'flowerbuddy-zip-'))
try {
  copyFileSync(portablePath, join(staging, portableName))
  const usageReadme = readFileSync(readmePath, 'utf8').replaceAll('{{version}}', version)
  writeFileSync(join(staging, 'README-使用说明.txt'), usageReadme, 'utf8')
  copyFileSync(licensesPath, join(staging, 'THIRD_PARTY_LICENSES.md'))
  copyFileSync(licensePath, join(staging, 'LICENSE.txt'))
  copyFileSync(assetsLicensePath, join(staging, 'ASSETS-LICENSE.txt'))

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
