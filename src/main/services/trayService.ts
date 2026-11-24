import { Menu, Tray, nativeImage } from 'electron'
import { resourcePath } from './assetPath'

let tray: Tray | null = null

export interface TrayHandlers {
  show: () => void
  hide: () => void
  quit: () => void
}

export interface TrayState {
  bossKey: string
  summonKey: string
  windowVisible: boolean
}

function acceleratorLabel(accelerator: string): string {
  if (!accelerator) return '未启用'
  return accelerator
    .replace(/CommandOrControl/gi, process.platform === 'darwin' ? 'Cmd' : 'Ctrl')
    .replace(/\+/g, ' + ')
}

function buildMenu(state: TrayState, handlers: TrayHandlers): Menu {
  return Menu.buildFromTemplate([
    {
      label: state.windowVisible ? '隐藏主窗口' : '显示主窗口',
      click: () => (state.windowVisible ? handlers.hide() : handlers.show())
    },
    { type: 'separator' },
    { label: `快速隐藏：${acceleratorLabel(state.bossKey)}`, enabled: false },
    { label: `全局唤起：${acceleratorLabel(state.summonKey)}`, enabled: false },
    { type: 'separator' },
    { label: '退出 DevBox', click: handlers.quit }
  ])
}

export function createTray(handlers: TrayHandlers, state: TrayState): Tray {
  const image = nativeImage.createFromPath(resourcePath('tray.png'))
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('DevBox')
  tray.setContextMenu(buildMenu(state, handlers))
  tray.on('click', () => handlers.show())
  return tray
}

export function updateTray(state: TrayState, handlers: TrayHandlers): void {
  if (!tray || tray.isDestroyed()) return
  tray.setContextMenu(buildMenu(state, handlers))
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
}
