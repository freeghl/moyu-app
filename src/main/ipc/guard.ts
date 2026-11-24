import type { IpcMainInvokeEvent } from 'electron'

/** 只信任主窗口主框架发来的调用，阻止预览视图等子框架越权调用 IPC */
export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return event.senderFrame === event.sender.mainFrame
}
