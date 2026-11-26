import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { createInterface, type Interface } from 'node:readline'
import type { ActivityProvider, ForegroundWindowInfo } from './types'

const PS_INIT_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class MoyuWin32Fg {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
function Get-MoyuFg {
  try {
    $hwnd = [MoyuWin32Fg]::GetForegroundWindow()
    if ($hwnd -eq [IntPtr]::Zero) {
      Write-Output '{"empty":true}'
      return
    }
    $pidOut = [uint32]0
    [void][MoyuWin32Fg]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
    $sb = New-Object System.Text.StringBuilder 512
    [void][MoyuWin32Fg]::GetWindowText($hwnd, $sb, 512)
    $procName = ''
    if ($pidOut -gt 0) {
      $proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
      if ($null -ne $proc) { $procName = $proc.ProcessName }
    }
    $payload = @{
      pid = [int]$pidOut
      appName = $procName
      windowTitle = $sb.ToString()
    } | ConvertTo-Json -Compress
    Write-Output $payload
  } catch {
    Write-Output '{"empty":true}'
  }
}
`

interface PendingRequest {
  resolve: (info: ForegroundWindowInfo | null) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Windows 轻量前台窗口采集器：
 * 常驻单实例 PowerShell 子进程，通过 stdin/stdout 串行响应，避免每 4s 冷启动进程带来的 CPU 抖动。
 */
export class WindowsForegroundProvider implements ActivityProvider {
  private child: ChildProcessByStdio<Writable, Readable, null> | null = null
  private rl: Interface | null = null
  private pending: PendingRequest | null = null
  private disposed = false

  private ensureWorker(): boolean {
    if (this.disposed || process.platform !== 'win32') return false
    if (this.child && !this.child.killed && this.child.exitCode === null) return true

    try {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore']
      })

      const rl = createInterface({ input: child.stdout, crlfDelay: Infinity })
      rl.on('line', (line) => {
        const req = this.pending
        if (!req) return
        this.pending = null
        clearTimeout(req.timer)
        req.resolve(this.parseLine(line))
      })

      const cleanup = (): void => {
        if (this.pending) {
          clearTimeout(this.pending.timer)
          this.pending.resolve(null)
          this.pending = null
        }
        this.rl?.close()
        this.rl = null
        this.child = null
      }

      child.on('exit', cleanup)
      child.on('error', cleanup)
      child.stdin.write(`${PS_INIT_SCRIPT}\n`)

      this.child = child
      this.rl = rl
      return true
    } catch {
      return false
    }
  }

  private parseLine(line: string): ForegroundWindowInfo | null {
    const trimmed = line.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as {
        empty?: boolean
        pid?: number
        appName?: string
        windowTitle?: string
      }
      if (parsed.empty || !parsed.appName) return null
      const appName = parsed.appName.trim()
      if (!appName) return null
      return {
        appKey: appName.toLowerCase(),
        appName,
        windowTitle: (parsed.windowTitle ?? '').trim(),
        pid: typeof parsed.pid === 'number' ? parsed.pid : 0
      }
    } catch {
      return null
    }
  }

  getForegroundWindow(): Promise<ForegroundWindowInfo | null> {
    if (process.platform !== 'win32' || this.disposed) {
      return Promise.resolve(null)
    }
    // 防重入：上一轮未返回时不叠加请求
    if (this.pending) {
      return Promise.resolve(null)
    }
    if (!this.ensureWorker() || !this.child) {
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending) {
          this.pending = null
          resolve(null)
        }
      }, 2500)

      this.pending = { resolve, timer }
      try {
        this.child!.stdin.write('Get-MoyuFg\n')
      } catch {
        clearTimeout(timer)
        this.pending = null
        resolve(null)
      }
    })
  }

  dispose(): void {
    this.disposed = true
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.resolve(null)
      this.pending = null
    }
    try {
      this.child?.stdin.write('exit\n')
      this.child?.kill()
    } catch {
      // ignore
    }
    this.rl?.close()
    this.rl = null
    this.child = null
  }
}

export function createActivityProvider(): ActivityProvider {
  if (process.platform === 'win32') {
    return new WindowsForegroundProvider()
  }
  return {
    getForegroundWindow: async () => null,
    dispose: () => undefined
  }
}
