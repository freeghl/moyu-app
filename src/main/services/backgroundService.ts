import { app, dialog, nativeImage } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { createHash } from 'crypto'
import { copyFile, mkdir, readFile, stat, unlink } from 'fs/promises'
import { basename, extname, join } from 'path'
import type { BackgroundImage } from '@shared/types'
import { windowService } from './windowService'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp'
}

function getBackgroundDirectory(): string {
  return join(app.getPath('userData'), 'backgrounds')
}

function getExtension(filePath: string): string {
  return extname(filePath).slice(1).toLowerCase()
}

function resolveBackgroundPath(fileName: unknown): string | null {
  if (typeof fileName !== 'string' || !fileName || basename(fileName) !== fileName) {
    return null
  }

  if (!MIME_TYPES[getExtension(fileName)]) return null
  return join(getBackgroundDirectory(), fileName)
}

async function readValidatedImage(filePath: string): Promise<Buffer> {
  const fileStats = await stat(filePath)
  if (!fileStats.isFile()) throw new Error('请选择有效的图片文件。')
  if (fileStats.size > MAX_IMAGE_BYTES) throw new Error('图片大小不能超过 20 MB。')

  const image = nativeImage.createFromPath(filePath)
  if (image.isEmpty()) throw new Error('无法读取这张图片，请选择有效的图片文件。')

  const { width, height } = image.getSize()
  if (width * height > MAX_IMAGE_PIXELS) throw new Error('图片分辨率过高，请选择更小的图片。')

  return readFile(filePath)
}

function toDataUrl(buffer: Buffer, extension: string): string {
  return `data:${MIME_TYPES[extension]};base64,${buffer.toString('base64')}`
}

export const backgroundService = {
  async select(): Promise<BackgroundImage | null> {
    const parent = windowService.getMainWindow()
    const options: OpenDialogOptions = {
      title: '选择应用背景图片',
      properties: ['openFile'],
      filters: [{ name: '图片文件', extensions: Object.keys(MIME_TYPES) }]
    }
    const result = parent && !parent.isDestroyed()
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)

    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return null

    const extension = getExtension(filePath)
    if (!MIME_TYPES[extension]) throw new Error('仅支持 PNG、JPG、WEBP、GIF 和 BMP 图片。')

    const buffer = await readValidatedImage(filePath)
    const fileStats = await stat(filePath)
    const hash = createHash('sha256')
      .update(filePath)
      .update('\0')
      .update(fileStats.mtimeMs.toString())
      .digest('hex')
      .slice(0, 20)
    const fileName = `${hash}.${extension}`
    const targetPath = join(getBackgroundDirectory(), fileName)

    await mkdir(getBackgroundDirectory(), { recursive: true })
    await copyFile(filePath, targetPath)

    return {
      fileName,
      originalName: basename(filePath),
      dataUrl: toDataUrl(buffer, extension)
    }
  },

  async load(fileName: string): Promise<BackgroundImage | null> {
    const filePath = resolveBackgroundPath(fileName)
    if (!filePath) return null

    try {
      const extension = getExtension(filePath)
      const buffer = await readValidatedImage(filePath)
      return {
        fileName,
        originalName: fileName,
        dataUrl: toDataUrl(buffer, extension)
      }
    } catch {
      return null
    }
  },

  async remove(fileName: string): Promise<void> {
    const filePath = resolveBackgroundPath(fileName)
    if (!filePath) return

    try {
      await unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}
