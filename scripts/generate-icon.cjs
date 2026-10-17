const { app, BrowserWindow } = require('electron')
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { dirname, join } = require('node:path')

const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'assets', 'default-pet', 'flower.png')
const ICON_OUTPUT = join(ROOT, 'assets', 'app-icon.ico')
const PNG_OUTPUT = join(ROOT, 'assets', 'app-icon.png')
const TRAY_OUTPUT = join(ROOT, 'assets', 'tray-icon.png')
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256]
const MASTER_SIZE = 1024
const TRAY_SIZE = 64

function buildIco(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)

  const directory = Buffer.alloc(16 * frames.length)
  let offset = header.length + directory.length

  frames.forEach((frame, index) => {
    const entry = index * 16
    const dimension = frame.size >= 256 ? 0 : frame.size
    directory[entry] = dimension
    directory[entry + 1] = dimension
    directory[entry + 2] = 0
    directory[entry + 3] = 0
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(frame.data.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += frame.data.length
  })

  return Buffer.concat([header, directory, ...frames.map((frame) => frame.data)])
}

function decodeDataUrl(result, key) {
  const value = result[key]
  if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,')) {
    throw new Error(`missing png frame: ${key}`)
  }
  return Buffer.from(value.slice('data:image/png;base64,'.length), 'base64')
}

async function generate() {
  const sourceBuffer = readFileSync(SOURCE)
  const sourceDataUrl = `data:image/png;base64,${sourceBuffer.toString('base64')}`

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

  const result = await window.webContents.executeJavaScript(`(async () => {
    const image = new Image()
    image.src = ${JSON.stringify(sourceDataUrl)}
    await image.decode()

    const source = document.createElement('canvas')
    source.width = image.naturalWidth
    source.height = image.naturalHeight
    const sourceContext = source.getContext('2d')
    sourceContext.drawImage(image, 0, 0)
    const { data } = sourceContext.getImageData(0, 0, source.width, source.height)

    let minX = source.width
    let minY = source.height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        if (data[(y * source.width + x) * 4 + 3] < 8) {
          continue
        }
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (maxX < 0) {
      throw new Error('source image is fully transparent')
    }

    const cropWidth = maxX - minX + 1
    const cropHeight = maxY - minY + 1
    const available = ${MASTER_SIZE} * 0.9
    const scale = Math.min(available / cropWidth, available / cropHeight)
    const drawWidth = Math.round(cropWidth * scale)
    const drawHeight = Math.round(cropHeight * scale)
    const offsetX = Math.round((${MASTER_SIZE} - drawWidth) / 2)
    const offsetY = Math.round((${MASTER_SIZE} - drawHeight) / 2)

    const master = document.createElement('canvas')
    master.width = ${MASTER_SIZE}
    master.height = ${MASTER_SIZE}
    const masterContext = master.getContext('2d')
    masterContext.imageSmoothingEnabled = true
    masterContext.imageSmoothingQuality = 'high'
    masterContext.drawImage(
      source,
      minX,
      minY,
      cropWidth,
      cropHeight,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    )

    const render = (size) => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(master, 0, 0, size, size)
      return canvas.toDataURL('image/png')
    }

    const frames = {}
    for (const size of ${JSON.stringify(ICON_SIZES)}) {
      frames['s' + size] = render(size)
    }
    return {
      ...frames,
      tray: render(${TRAY_SIZE}),
      png: render(256),
      crop: { x: minX, y: minY, width: cropWidth, height: cropHeight },
      source: { width: source.width, height: source.height }
    }
  })()`)

  const frames = ICON_SIZES.map((size) => ({ size, data: decodeDataUrl(result, `s${size}`) }))
  mkdirSync(dirname(ICON_OUTPUT), { recursive: true })
  writeFileSync(ICON_OUTPUT, buildIco(frames))
  writeFileSync(PNG_OUTPUT, decodeDataUrl(result, 'png'))
  writeFileSync(TRAY_OUTPUT, decodeDataUrl(result, 'tray'))

  console.log(
    JSON.stringify(
      {
        source: result.source,
        crop: result.crop,
        outputs: {
          icon: ICON_OUTPUT,
          png: PNG_OUTPUT,
          tray: TRAY_OUTPUT
        }
      },
      null,
      2
    )
  )
  window.destroy()
}

app
  .whenReady()
  .then(generate)
  .then(
    () => app.quit(),
    (error) => {
      console.error(error)
      app.quit()
    }
  )
