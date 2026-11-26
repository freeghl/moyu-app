import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as si from 'systeminformation'
import type {
  DiskMetrics,
  KillProcessResult,
  NetworkMetrics,
  ProcessSnapshot,
  SystemMetrics,
  SystemSnapshot
} from '../../shared/system'

const execFileAsync = promisify(execFile)
let previousWindowsNetwork: { rx: number; tx: number; at: number } | null = null

async function optional<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch {
    return fallback
  }
}

function mapDisks(disks: si.Systeminformation.FsSizeData[]): DiskMetrics[] {
  return disks
    .filter((disk) => disk.size > 0)
    .map((disk) => ({
      fs: disk.fs,
      type: disk.type,
      mount: disk.mount,
      size: disk.size,
      used: disk.used,
      available: disk.available,
      use: disk.use
    }))
}

function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
    freebsd: 'FreeBSD',
    openbsd: 'OpenBSD',
    android: 'Android'
  }
  return labels[platform] ?? platform
}

async function getWindowsNetworkMetrics(): Promise<NetworkMetrics[]> {
  const { stdout } = await execFileAsync('netstat', ['-e'], {
    encoding: 'buffer',
    windowsHide: true
  })
  const output = new TextDecoder('gb18030').decode(stdout)
  const match = output.match(/^(?:字节|Bytes)\s+(\d+)\s+(\d+)/m)
  if (!match) return []

  const rxBytes = Number(match[1])
  const txBytes = Number(match[2])
  const now = Date.now()
  let rxSec: number | null = null
  let txSec: number | null = null

  if (previousWindowsNetwork) {
    const seconds = (now - previousWindowsNetwork.at) / 1000
    if (seconds > 0) {
      rxSec = Math.max(0, (rxBytes - previousWindowsNetwork.rx) / seconds)
      txSec = Math.max(0, (txBytes - previousWindowsNetwork.tx) / seconds)
    }
  }

  previousWindowsNetwork = { rx: rxBytes, tx: txBytes, at: now }
  return [
    {
      iface: 'all',
      ifaceName: '所有接口',
      operstate: 'up',
      rxBytes,
      txBytes,
      rxSec,
      txSec
    }
  ]
}

export const systemService = {
  async getSnapshot(): Promise<SystemSnapshot> {
    const capturedAt = new Date().toISOString()
    const [os, cpu, memory, disks, system, memoryModules, networkInterfaces, graphics, baseboard, bios, battery, storageDevices] =
      await Promise.all([
        si.osInfo(),
        si.cpu(),
        si.mem(),
        optional(si.fsSize(), []),
        optional(si.system(), {
          manufacturer: '',
          model: '',
          version: '',
          serial: '',
          uuid: '',
          sku: '',
          virtual: false
        }),
        optional(si.memLayout(), []),
        optional(si.networkInterfaces(), []),
        optional(si.graphics(), { controllers: [], displays: [] }),
        optional(si.baseboard(), null),
        optional(si.bios(), null),
        optional(si.battery(), null),
        optional(si.blockDevices(), [])
      ])

    return {
      capturedAt,
      host: {
        hostname: os.hostname,
        platform: os.platform,
        platformLabel: platformLabel(os.platform),
        arch: os.arch,
        kernel: os.kernel,
        osVersion: [os.distro, os.release].filter(Boolean).join(' '),
        osBuild: os.build,
        uptime: si.time().uptime
      },
      system: {
        manufacturer: system.manufacturer,
        model: system.model,
        version: system.version,
        virtual: system.virtual
      },
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        family: cpu.family,
        model: cpu.model,
        speed: cpu.speed * 1000,
        speedMax: cpu.speedMax * 1000,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors,
        socket: cpu.socket,
        cache: {
          l1d: cpu.cache.l1d,
          l1i: cpu.cache.l1i,
          l2: cpu.cache.l2,
          l3: cpu.cache.l3
        }
      },
      memoryTotal: memory.total,
      memoryModules: memoryModules.map((module) => ({
        bank: module.bank,
        size: module.size,
        type: module.type,
        clockSpeed: module.clockSpeed,
        formFactor: module.formFactor,
        manufacturer: module.manufacturer ?? ''
      })),
      disks: mapDisks(disks),
      storageDevices: storageDevices
        .filter((device) => Number(device.size) > 0)
        .map((device) => ({
          name: device.name,
          model: device.model,
          type: device.type,
          fsType: device.fsType,
          mount: device.mount,
          size: Number(device.size),
          removable: device.removable,
          protocol: device.protocol
        })),
      networkInterfaces: networkInterfaces.map((network) => ({
        iface: network.iface,
        ifaceName: network.ifaceName,
        ip4: network.ip4,
        ip6: network.ip6,
        mac: network.mac,
        type: network.type,
        speed: network.speed,
        virtual: network.virtual
      })),
      graphics: graphics.controllers.map((controller) => ({
        model: controller.model || controller.name || '未知显卡',
        vendor: controller.vendor,
        vram: controller.vram ? controller.vram * 1024 * 1024 : 0,
        driverVersion: controller.driverVersion ?? ''
      })),
      displays: graphics.displays.map((display) => ({
        model: display.model || display.deviceName || '显示器',
        vendor: display.vendor,
        main: display.main,
        resolutionX: display.currentResX ?? display.resolutionX ?? 0,
        resolutionY: display.currentResY ?? display.resolutionY ?? 0,
        refreshRate: display.currentRefreshRate ?? 0
      })),
      motherboard:
        baseboard && (baseboard.manufacturer || baseboard.model)
          ? {
              manufacturer: baseboard.manufacturer,
              model: baseboard.model,
              version: baseboard.version,
              memMax: baseboard.memMax,
              memSlots: baseboard.memSlots
            }
          : null,
      bios:
        bios && (bios.vendor || bios.version)
          ? {
              vendor: bios.vendor,
              version: bios.version,
              releaseDate: bios.releaseDate,
              revision: bios.revision
            }
          : null,
      battery:
        battery && battery.hasBattery
          ? {
              hasBattery: battery.hasBattery,
              percent: battery.percent,
              isCharging: battery.isCharging,
              timeRemaining: battery.timeRemaining,
              cycleCount: battery.cycleCount
            }
          : null
    }
  },

  async getMetrics(): Promise<SystemMetrics> {
    const [load, memory, disks, speed, temperature] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      optional(si.fsSize(), []),
      optional(si.cpuCurrentSpeed(), { min: 0, max: 0, avg: 0, cores: [] }),
      optional(si.cpuTemperature(), null)
    ])
    const network =
      process.platform === 'win32'
        ? await optional(getWindowsNetworkMetrics(), [])
        : (await optional(si.networkStats(), [])).map((network) => ({
            iface: network.iface,
            ifaceName: network.iface,
            operstate: network.operstate,
            rxBytes: network.rx_bytes,
            txBytes: network.tx_bytes,
            rxSec: network.rx_sec >= 0 ? network.rx_sec : null,
            txSec: network.tx_sec >= 0 ? network.tx_sec : null
          }))

    return {
      capturedAt: new Date().toISOString(),
      cpu: {
        currentLoad: load.currentLoad,
        currentLoadUser: load.currentLoadUser,
        currentLoadSystem: load.currentLoadSystem,
        currentLoadIdle: load.currentLoadIdle,
        loadAverage: load.avgLoad,
        cores: load.cpus.map((core, index) => ({ index, load: core.load })),
        speed: speed.avg * 1000,
        temperature:
          temperature && temperature.main > 0
            ? {
                main: temperature.main,
                max: temperature.max,
                sockets: temperature.socket ?? []
              }
            : null
      },
      memory: {
        total: memory.total,
        used: memory.used,
        free: memory.free,
        active: memory.active,
        available: memory.available,
        swaptotal: memory.swaptotal,
        swapused: memory.swapused,
        swapfree: memory.swapfree
      },
      disks: mapDisks(disks),
      network
    }
  },

  async getProcesses(): Promise<ProcessSnapshot> {
    const result = await si.processes()
    const processes = result.list
      .map((process) => ({
        pid: process.pid,
        name: process.name,
        pcpu: process.cpu,
        pmem: process.mem,
        memRss: process.memRss * 1024,
        state: process.state
      }))
      .sort((a, b) => b.memRss - a.memRss || b.pcpu - a.pcpu)
      .slice(0, 200)

    return {
      capturedAt: new Date().toISOString(),
      total: result.all,
      running: result.running,
      blocked: result.blocked,
      sleeping: result.sleeping,
      processes
    }
  },

  async killProcess(pid: number): Promise<KillProcessResult> {
    if (!Number.isInteger(pid) || pid <= 0) {
      return { pid, success: false, message: '无效的进程 PID' }
    }
    if (pid === process.pid) {
      return { pid, success: false, message: '不能结束当前应用主进程' }
    }

    try {
      process.kill(pid, 'SIGTERM')
      return { pid, success: true }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code === 'ESRCH') {
        return { pid, success: false, message: '进程不存在或已退出' }
      }
      if (code === 'EPERM') {
        return { pid, success: false, message: '权限不足，无法结束该进程' }
      }
      return {
        pid,
        success: false,
        message: error instanceof Error ? error.message : '结束进程失败'
      }
    }
  }
}
