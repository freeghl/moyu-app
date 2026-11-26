export interface CpuCoreUsage {
  index: number
  load: number
}

export interface CpuTemperature {
  main: number
  max: number
  sockets: number[]
}

export interface CpuMetrics {
  currentLoad: number
  currentLoadUser: number
  currentLoadSystem: number
  currentLoadIdle: number
  loadAverage: number
  cores: CpuCoreUsage[]
  speed: number
  temperature: CpuTemperature | null
}

export interface MemoryMetrics {
  total: number
  used: number
  free: number
  active: number
  available: number
  swaptotal: number
  swapused: number
  swapfree: number
}

export interface DiskMetrics {
  fs: string
  type: string
  mount: string
  size: number
  used: number
  available: number
  use: number
}

export interface NetworkMetrics {
  iface: string
  ifaceName: string
  operstate: string
  rxBytes: number
  txBytes: number
  rxSec: number | null
  txSec: number | null
}

export interface ProcessMetrics {
  pid: number
  name: string
  pcpu: number
  pmem: number
  memRss: number
  state: string
}

export interface StorageDevice {
  name: string
  model: string
  type: string
  fsType: string
  mount: string
  size: number
  removable: boolean
  protocol: string
}

export interface DisplayInfo {
  model: string
  vendor: string
  main: boolean
  resolutionX: number
  resolutionY: number
  refreshRate: number
}

export interface SystemSnapshot {
  capturedAt: string
  host: {
    hostname: string
    platform: string
    platformLabel: string
    arch: string
    kernel: string
    osVersion: string
    osBuild: string
    uptime: number
  }
  system: {
    manufacturer: string
    model: string
    version: string
    virtual: boolean
  }
  cpu: {
    manufacturer: string
    brand: string
    family: string
    model: string
    speed: number
    speedMax: number
    cores: number
    physicalCores: number
    processors: number
    socket: string
    cache: {
      l1d: number
      l1i: number
      l2: number
      l3: number
    }
  }
  memoryTotal: number
  memoryModules: Array<{
    bank: string
    size: number
    type: string
    clockSpeed: number | null
    formFactor: string
    manufacturer: string
  }>
  disks: DiskMetrics[]
  storageDevices: StorageDevice[]
  networkInterfaces: Array<{
    iface: string
    ifaceName: string
    ip4: string
    ip6: string
    mac: string
    type: string
    speed: number | null
    virtual: boolean
  }>
  graphics: Array<{
    model: string
    vendor: string
    vram: number | null
    driverVersion: string
  }>
  displays: DisplayInfo[]
  motherboard: {
    manufacturer: string
    model: string
    version: string
    memMax: number | null
    memSlots: number | null
  } | null
  bios: {
    vendor: string
    version: string
    releaseDate: string
    revision: string
  } | null
  battery: {
    hasBattery: boolean
    percent: number
    isCharging: boolean
    timeRemaining: number
    cycleCount: number
  } | null
}

export interface SystemMetrics {
  capturedAt: string
  cpu: CpuMetrics
  memory: MemoryMetrics
  disks: DiskMetrics[]
  network: NetworkMetrics[]
}

export interface ProcessSnapshot {
  capturedAt: string
  total: number
  running: number
  blocked: number
  sleeping: number
  processes: ProcessMetrics[]
}

export interface KillProcessResult {
  pid: number
  success: boolean
  message?: string
}

export interface SystemAPI {
  getSnapshot: () => Promise<SystemSnapshot>
  getMetrics: () => Promise<SystemMetrics>
  getProcesses: () => Promise<ProcessSnapshot>
  killProcess: (pid: number) => Promise<KillProcessResult>
}
