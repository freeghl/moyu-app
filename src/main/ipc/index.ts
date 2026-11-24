import { registerWindowIpc } from './windowIpc'
import { registerMoyuPreviewIpc } from './moyuPreviewIpc'
import { registerPreferencesIpc } from './preferencesIpc'

export function registerAllIpc(): void {
  registerWindowIpc()
  registerMoyuPreviewIpc()
  registerPreferencesIpc()
}

export { setupWindowEvents } from './windowIpc'
export { setupMoyuPreview, hideMoyuPreview } from './moyuPreviewIpc'
