import { registerWindowIpc } from './windowIpc'

export function registerAllIpc(): void {
  registerWindowIpc()
}

export { setupWindowEvents } from './windowIpc'
