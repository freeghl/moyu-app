import { join } from 'node:path'
import { app } from 'electron'

/** 解析 resources 目录下的静态资源，兼容开发态与打包后 */
export function resourcePath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, name)
    : join(__dirname, '../../resources', name)
}
