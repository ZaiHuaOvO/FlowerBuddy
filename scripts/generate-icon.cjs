const { copyFileSync, mkdirSync } = require('node:fs')
const { dirname, join } = require('node:path')

const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'assets', 'brand', 'app-icon')

const OUTPUTS = [
  {
    source: join(SOURCE, 'FlowerBuddy.ico'),
    target: join(ROOT, 'assets', 'app-icon.ico')
  },
  {
    source: join(SOURCE, 'flowerbuddy-icon-transparent-1024.png'),
    target: join(ROOT, 'assets', 'app-icon.png')
  },
  {
    source: join(SOURCE, 'flowerbuddy-icon-transparent-64.png'),
    target: join(ROOT, 'assets', 'tray-icon.png')
  }
]

for (const output of OUTPUTS) {
  mkdirSync(dirname(output.target), { recursive: true })
  copyFileSync(output.source, output.target)
  console.log(`${output.source} -> ${output.target}`)
}
