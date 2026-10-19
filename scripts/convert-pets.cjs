const { app, BrowserWindow } = require('electron')
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { dirname, extname, join } = require('node:path')

const ROOT = join(__dirname, '..')
const MAX_SIZE = 512

const JOBS = [
  {
    source: join(ROOT, 'assets', 'pet-source.webp'),
    output: join(ROOT, 'assets', 'default-pet', 'flower.png')
  },
  {
    source: join(ROOT, 'assets', 'pet-preset-source', 'flower-cat.png'),
    output: join(ROOT, 'assets', 'pet-presets', 'flower-cat.png')
  },
  {
    source: join(ROOT, 'assets', 'pet-preset-source', 'cat-pair.webp'),
    output: join(ROOT, 'assets', 'pet-presets', 'cat-pair.png')
  },
  {
    source: join(ROOT, 'assets', 'pet-preset-source', 'schoolgirl.webp'),
    output: join(ROOT, 'assets', 'pet-presets', 'schoolgirl.png')
  }
]

const MIME_TYPES = {
  '.png': 'image/png',
  '.webp': 'image/webp'
}

async function convert(window, job) {
  const mime = MIME_TYPES[extname(job.source).toLowerCase()]
  if (!mime) {
    throw new Error(`unsupported source format: ${job.source}`)
  }

  const sourceBuffer = readFileSync(job.source)
  const sourceDataUrl = `data:${mime};base64,${sourceBuffer.toString('base64')}`

  const result = await window.webContents.executeJavaScript(`(async () => {
    const image = new Image()
    image.src = ${JSON.stringify(sourceDataUrl)}
    await image.decode()

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = image.naturalWidth
    sourceCanvas.height = image.naturalHeight
    const sourceContext = sourceCanvas.getContext('2d')
    sourceContext.drawImage(image, 0, 0)

    const { data } = sourceContext.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height
    )

    let minX = sourceCanvas.width
    let minY = sourceCanvas.height
    let maxX = -1
    let maxY = -1
    let transparentPixels = 0

    for (let y = 0; y < sourceCanvas.height; y += 1) {
      for (let x = 0; x < sourceCanvas.width; x += 1) {
        const alpha = data[(y * sourceCanvas.width + x) * 4 + 3]
        if (alpha < 8) {
          transparentPixels += 1
          continue
        }
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }

    if (maxX < 0) throw new Error('source image is fully transparent')

    const padding = Math.max(
      2,
      Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * 0.01)
    )
    minX = Math.max(0, minX - padding)
    minY = Math.max(0, minY - padding)
    maxX = Math.min(sourceCanvas.width - 1, maxX + padding)
    maxY = Math.min(sourceCanvas.height - 1, maxY + padding)

    const cropWidth = maxX - minX + 1
    const cropHeight = maxY - minY + 1
    const scale = Math.min(
      ${MAX_SIZE} / cropWidth,
      ${MAX_SIZE} / cropHeight,
      1
    )
    const width = Math.max(1, Math.round(cropWidth * scale))
    const height = Math.max(1, Math.round(cropHeight * scale))

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = width
    outputCanvas.height = height
    const outputContext = outputCanvas.getContext('2d')
    outputContext.imageSmoothingEnabled = true
    outputContext.imageSmoothingQuality = 'high'
    outputContext.drawImage(
      sourceCanvas,
      minX,
      minY,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height
    )

    return {
      source: { width: image.naturalWidth, height: image.naturalHeight },
      crop: { x: minX, y: minY, width: cropWidth, height: cropHeight },
      output: { width, height },
      transparentPixels,
      dataUrl: outputCanvas.toDataURL('image/png')
    }
  })()`)

  const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '')
  mkdirSync(dirname(job.output), { recursive: true })
  writeFileSync(job.output, Buffer.from(base64, 'base64'))

  const report = { ...result }
  delete report.dataUrl
  return { ...report, sourcePath: job.source, outputPath: job.output }
}

async function convertAll() {
  const window = new BrowserWindow({
    show: false,
    width: 200,
    height: 200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  await window.loadURL('about:blank')

  for (const job of JOBS) {
    const report = await convert(window, job)
    console.log(JSON.stringify(report, null, 2))
  }
}

app
  .whenReady()
  .then(convertAll)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    app.quit()
  })
