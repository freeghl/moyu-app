import { registerWindowIpc } from './windowIpc'
import { registerSitePreviewIpc } from './sitePreviewIpc'
import { registerPreferencesIpc } from './preferencesIpc'
import { registerBackgroundIpc } from './backgroundIpc'
import { registerSystemIpc } from './systemIpc'

export function registerAllIpc(): void {
  registerWindowIpc()
  registerSitePreviewIpc()
  registerPreferencesIpc()
  registerBackgroundIpc()
  registerSystemIpc()
}

export { setupWindowEvents } from './windowIpc'
export { setupSitePreview, hideSitePreview } from './sitePreviewIpc'
