export interface ForegroundWindowInfo {
  appKey: string
  appName: string
  windowTitle: string
  pid: number
}

export interface ActivityProvider {
  getForegroundWindow(): Promise<ForegroundWindowInfo | null>
  dispose(): void
}
