import { registerWindowIpc } from './windowIpc'
import { registerSitePreviewIpc } from './sitePreviewIpc'
import { registerPreferencesIpc } from './preferencesIpc'
import { registerBackgroundIpc } from './backgroundIpc'
import { registerSystemIpc } from './systemIpc'
import { registerAiIpc } from './aiIpc'
import { registerTimeCoachIpc } from './timeCoachIpc'

export function registerAllIpc(): void {
  registerWindowIpc()
  registerSitePreviewIpc()
  registerPreferencesIpc()
  registerBackgroundIpc()
  registerSystemIpc()
  registerAiIpc()
  registerTimeCoachIpc()
}

export { setupWindowEvents } from './windowIpc'
export { setupSitePreview, hideSitePreview } from './sitePreviewIpc'
export { setupTimeCoachEvents } from './timeCoachIpc'
