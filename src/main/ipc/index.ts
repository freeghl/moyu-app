import { registerWindowIpc } from './windowIpc'
import { registerBackgroundIpc } from './backgroundIpc'
import { registerSystemIpc } from './systemIpc'

export function registerAllIpc(): void {
  registerWindowIpc()
  registerBackgroundIpc()
  registerSystemIpc()
}

export { setupWindowEvents } from './windowIpc'
