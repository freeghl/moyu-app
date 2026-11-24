import { registerWindowIpc } from './windowIpc'
import { registerSitePreviewIpc } from './sitePreviewIpc'
import { registerPreferencesIpc } from './preferencesIpc'

export function registerAllIpc(): void {
  registerWindowIpc()
  registerSitePreviewIpc()
  registerPreferencesIpc()
}

export { setupWindowEvents } from './windowIpc'
export { setupSitePreview, hideSitePreview } from './sitePreviewIpc'
