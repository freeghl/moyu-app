import { registerWindowIpc } from './windowIpc'
import { registerMoyuPreviewIpc } from './moyuPreviewIpc'

export function registerAllIpc(): void {
  registerWindowIpc()
  registerMoyuPreviewIpc()
}

export { setupWindowEvents } from './windowIpc'
export { setupMoyuPreview, hideMoyuPreview } from './moyuPreviewIpc'
