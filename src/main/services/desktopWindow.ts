import { screen } from 'electron'
import type { Point } from 'electron'
import * as koffi from 'koffi'

const DESKTOP_WINDOW_CLASSES = new Set([
  'Progman',
  'WorkerW',
  'SHELLDLL_DefView',
  'SysListView32',
  'Desktop'
])

const windowsApi = process.platform === 'win32' ? (() => {
  const user32 = koffi.load('user32.dll')
  const point = koffi.struct('HoverVideoPoint', { x: 'int32', y: 'int32' })
  return {
    windowFromPoint: user32.func('void * __stdcall WindowFromPoint(HoverVideoPoint point)'),
    getClassName: user32.func('int __stdcall GetClassNameW(void *hWnd, uint16_t *lpClassName, int nMaxCount)')
  }
})() : null

export function isCursorOnDesktop(cursor: Point): boolean {
  if (!windowsApi) return true

  const physical = screen.dipToScreenPoint(cursor)
  const hwnd = windowsApi.windowFromPoint({ x: physical.x, y: physical.y })
  if (!hwnd) return false

  const buffer = Buffer.alloc(512)
  const length = windowsApi.getClassName(hwnd, buffer, buffer.length / 2) as number
  if (!length) return false

  const className = buffer.toString('utf16le', 0, Math.min(length, buffer.length / 2) * 2)
  return DESKTOP_WINDOW_CLASSES.has(className)
}
