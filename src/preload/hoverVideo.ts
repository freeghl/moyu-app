import { ipcRenderer } from 'electron'

window.addEventListener('wheel', (event) => {
  if (!event.isTrusted || event.deltaY === 0) return
  event.preventDefault()
  event.stopImmediatePropagation()
  ipcRenderer.send('hover-video:wheel', event.deltaY < 0 ? -1 : 1)
}, { capture: true, passive: false })
