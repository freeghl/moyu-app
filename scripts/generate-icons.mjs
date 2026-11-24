// 生成应用图标与托盘图标（纯 Node 实现，不依赖图形库）
// 用法：node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'resources')

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const BOLT = [
  [0.58, 0.10],
  [0.31, 0.56],
  [0.49, 0.56],
  [0.42, 0.90],
  [0.70, 0.42],
  [0.52, 0.42]
]

function insidePolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function insideRoundedRect(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius)
  const cy = Math.min(Math.max(y, radius), 1 - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

function render(size, radius) {
  const samples = 4
  const rgba = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0
      let bolt = 0

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size
          const y = (py + (sy + 0.5) / samples) / size
          if (insideRoundedRect(x, y, radius)) {
            bg += 1
            if (insidePolygon(x, y, BOLT)) bolt += 1
          }
        }
      }

      const total = samples * samples
      const alpha = bg / total
      const index = (py * size + px) * 4
      if (!alpha) continue

      const t = (px / (size - 1) + py / (size - 1)) / 2
      const white = bolt / Math.max(bg, 1)
      const r = (99 + (139 - 99) * t) * (1 - white) + 255 * white
      const g = (102 + (92 - 102) * t) * (1 - white) + 255 * white
      const b = (241 + (246 - 241) * t) * (1 - white) + 255 * white

      rgba[index] = Math.round(r)
      rgba[index + 1] = Math.round(g)
      rgba[index + 2] = Math.round(b)
      rgba[index + 3] = Math.round(alpha * 255)
    }
  }

  return encodePng(size, rgba)
}

mkdirSync(outputDir, { recursive: true })
writeFileSync(join(outputDir, 'icon.png'), render(256, 0.22))
writeFileSync(join(outputDir, 'tray.png'), render(32, 0.2))
console.log('icons written to resources/')
