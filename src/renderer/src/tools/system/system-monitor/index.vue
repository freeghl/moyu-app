<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTabStore } from '../../../stores'
import type {
  ProcessMetrics,
  ProcessSnapshot,
  SystemMetrics,
  SystemSnapshot
} from '@shared/system'

type ProcessSortKey = 'name' | 'pcpu' | 'pmem' | 'memRss'
type SortDirection = 'asc' | 'desc'

const AUTO_REFRESH_INTERVAL = 3000

const tabStore = useTabStore()
const snapshot = ref<SystemSnapshot | null>(null)
const metrics = ref<SystemMetrics | null>(null)
const processSnapshot = ref<ProcessSnapshot | null>(null)
const snapshotError = ref('')
const metricsError = ref('')
const processError = ref('')
const loadingSnapshot = ref(true)
const loadingMetrics = ref(false)
const loadingProcesses = ref(false)
const refreshingAll = ref(false)
const autoRefresh = ref(false)
const processQuery = ref('')
const processSortKey = ref<ProcessSortKey>('pcpu')
const processSortDirection = ref<SortDirection>('desc')
const cpuHistory = ref<number[]>([])
const networkHistory = ref<Array<{ rx: number; tx: number }>>([])
const confirmingPid = ref<number | null>(null)
const killingPid = ref<number | null>(null)
const killFeedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)

let disposed = false
let autoRefreshTimer: ReturnType<typeof setTimeout> | null = null
let confirmTimer: ReturnType<typeof setTimeout> | null = null
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const apiAvailable = computed(() => Boolean(window.api?.system))
const isActive = computed(() => tabStore.activeTab?.toolId === 'system-monitor')
const cpuLoad = computed(() => metrics.value?.cpu.currentLoad ?? 0)
const memoryPercent = computed(() => {
  if (!metrics.value || metrics.value.memory.total === 0) return 0
  return (metrics.value.memory.used / metrics.value.memory.total) * 100
})
const diskPercent = computed(() => {
  if (!metrics.value?.disks.length) return 0
  const totalSize = metrics.value.disks.reduce((sum, disk) => sum + disk.size, 0)
  const totalUsed = metrics.value.disks.reduce((sum, disk) => sum + disk.used, 0)
  return totalSize > 0 ? (totalUsed / totalSize) * 100 : 0
})
const visibleNetwork = computed(() => {
  const network = metrics.value?.network ?? []
  const active = network.filter((item) => item.operstate === 'up')
  return active.length ? active : network
})
const hasActiveNetwork = computed(() => visibleNetwork.value.some((item) => item.operstate === 'up'))
const networkTotals = computed(() =>
  visibleNetwork.value.reduce(
    (totals, item) => ({
      rx: totals.rx + (item.rxSec ?? 0),
      tx: totals.tx + (item.txSec ?? 0)
    }),
    { rx: 0, tx: 0 }
  )
)
const networkChartMax = computed(() =>
  Math.max(1, ...networkHistory.value.flatMap((point) => [point.rx, point.tx]))
)
const cpuChartPoints = computed(() =>
  chartPoints(cpuHistory.value.length ? cpuHistory.value : [0, 0], 100, 320, 58)
)
const networkRxPoints = computed(() =>
  chartPoints(networkHistory.value.map((point) => point.rx), networkChartMax.value, 640, 74)
)
const networkTxPoints = computed(() =>
  chartPoints(networkHistory.value.map((point) => point.tx), networkChartMax.value, 640, 74)
)
const lastUpdated = computed(() => (metrics.value ? formatTime(metrics.value.capturedAt) : '等待数据'))
const uptimeText = computed(() => {
  if (!snapshot.value) return '--'
  const elapsed = Math.max(0, (Date.now() - new Date(snapshot.value.capturedAt).getTime()) / 1000)
  return formatUptime(snapshot.value.host.uptime + elapsed)
})
const cpuTone = computed(() => loadTone(cpuLoad.value))
const memoryTone = computed(() => loadTone(memoryPercent.value))
const diskTone = computed(() => loadTone(diskPercent.value))
const filteredProcesses = computed(() => {
  const query = processQuery.value.trim().toLowerCase()
  const list = processSnapshot.value?.processes ?? []
  const filtered = query
    ? list.filter((process) => process.name.toLowerCase().includes(query) || String(process.pid).includes(query))
    : list

  return [...filtered].sort((a, b) => {
    const direction = processSortDirection.value === 'asc' ? 1 : -1
    if (processSortKey.value === 'name') return a.name.localeCompare(b.name, 'zh-CN') * direction
    return (a[processSortKey.value] - b[processSortKey.value]) * direction
  })
})
const visibleProcesses = computed(() => filteredProcesses.value)

function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : decimals)} ${units[index]}`
}

function formatRate(bytesPerSecond: number | null): string {
  if (bytesPerSecond === null) return '--'
  return `${formatBytes(bytesPerSecond)}/s`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${Math.max(1, minutes)} 分钟`
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value))
}

function formatFrequency(value: number): string {
  if (!value) return '--'
  return value >= 1000 ? `${(value / 1000).toFixed(2)} GHz` : `${Math.round(value)} MHz`
}

function formatCache(value: number): string {
  if (!value) return '--'
  return value >= 1024 ? `${(value / 1024).toFixed(1)} MB` : `${Math.round(value)} KB`
}

function formatBatteryTime(minutes: number): string {
  if (minutes < 0) return '计算中'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return hours > 0 ? `${hours} 小时 ${rest} 分` : `${rest} 分钟`
}

function formatMac(value: string): string {
  return value && !/^(?:00:){5}00$/i.test(value) ? value : '无 MAC'
}

function storageType(value: string): string {
  const labels: Record<string, string> = {
    disk: '磁盘',
    hdd: '机械硬盘',
    ssd: '固态硬盘',
    nvme: 'NVMe 固态硬盘'
  }
  return labels[value.toLowerCase()] ?? (value || '存储设备')
}

function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`
}

function chartPoints(values: number[], max: number, width: number, height: number): string {
  const source = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]
  return source
    .map((value, index) => {
      const x = (index / (source.length - 1)) * width
      const y = height - (Math.max(0, Math.min(max, value)) / max) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function loadTone(value: number): string {
  if (value >= 90) return 'var(--p-danger)'
  if (value >= 70) return 'var(--p-warning)'
  return 'var(--p-accent)'
}

function processState(state: string): string {
  const normalized = state.trim().toLowerCase()
  const states: Record<string, string> = {
    r: '运行',
    s: '睡眠',
    d: '等待',
    z: '僵尸',
    t: '停止',
    i: '空闲',
    w: '等待',
    l: '锁定',
    running: '运行',
    sleeping: '睡眠',
    stopped: '停止',
    unknown: '未知'
  }
  return states[normalized] ?? (state.trim() || '未知')
}

function toggleSort(key: ProcessSortKey): void {
  if (processSortKey.value === key) {
    processSortDirection.value = processSortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  processSortKey.value = key
  processSortDirection.value = key === 'name' ? 'asc' : 'desc'
}

async function loadSnapshot(): Promise<void> {
  if (!window.api?.system || (loadingSnapshot.value && snapshot.value)) return
  loadingSnapshot.value = true
  snapshotError.value = ''
  try {
    snapshot.value = await window.api.system.getSnapshot()
  } catch (error) {
    snapshotError.value = error instanceof Error ? error.message : '无法读取硬件配置'
  } finally {
    loadingSnapshot.value = false
  }
}

async function refreshMetrics(): Promise<void> {
  if (!window.api?.system || loadingMetrics.value) return
  loadingMetrics.value = true
  metricsError.value = ''
  try {
    const next = await window.api.system.getMetrics()
    if (disposed || !isActive.value || document.hidden) return
    metrics.value = next
    cpuHistory.value = [...cpuHistory.value.slice(-39), next.cpu.currentLoad]
    const totals = next.network
      .filter((item) => item.operstate === 'up')
      .reduce(
        (sum, item) => ({
          rx: sum.rx + (item.rxSec ?? 0),
          tx: sum.tx + (item.txSec ?? 0)
        }),
        { rx: 0, tx: 0 }
      )
    networkHistory.value = [...networkHistory.value.slice(-39), totals]
  } catch (error) {
    metricsError.value = error instanceof Error ? error.message : '无法读取实时资源数据'
  } finally {
    loadingMetrics.value = false
  }
}

async function refreshProcesses(): Promise<void> {
  if (!window.api?.system || loadingProcesses.value) return
  loadingProcesses.value = true
  processError.value = ''
  try {
    const next = await window.api.system.getProcesses()
    if (!disposed && isActive.value && !document.hidden) processSnapshot.value = next
  } catch (error) {
    processError.value = error instanceof Error ? error.message : '无法读取进程列表'
  } finally {
    loadingProcesses.value = false
  }
}

async function refreshAll(): Promise<void> {
  if (!apiAvailable.value) {
    snapshotError.value = '系统数据仅在桌面应用中可用'
    loadingSnapshot.value = false
    return
  }
  if (refreshingAll.value) return
  refreshingAll.value = true
  try {
    await Promise.all([
      snapshot.value ? Promise.resolve() : loadSnapshot(),
      refreshMetrics(),
      refreshProcesses()
    ])
  } finally {
    refreshingAll.value = false
    if (autoRefresh.value) scheduleAutoRefresh()
  }
}

function clearAutoRefreshTimer(): void {
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

function scheduleAutoRefresh(): void {
  clearAutoRefreshTimer()
  if (disposed || !autoRefresh.value || !apiAvailable.value || !isActive.value || document.hidden) return
  autoRefreshTimer = setTimeout(() => {
    autoRefreshTimer = null
    void runAutoRefreshTick()
  }, AUTO_REFRESH_INTERVAL)
}

async function runAutoRefreshTick(): Promise<void> {
  if (disposed || !autoRefresh.value || !apiAvailable.value || !isActive.value || document.hidden) return
  if (!refreshingAll.value) {
    await Promise.all([
      snapshot.value ? Promise.resolve() : loadSnapshot(),
      refreshMetrics(),
      refreshProcesses()
    ])
  }
  scheduleAutoRefresh()
}

function toggleAutoRefresh(): void {
  if (!apiAvailable.value) return
  autoRefresh.value = !autoRefresh.value
}

function handleVisibilityChange(): void {
  if (document.hidden) {
    clearAutoRefreshTimer()
    return
  }
  if (autoRefresh.value && isActive.value) {
    void runAutoRefreshTick()
  }
}

function showKillFeedback(type: 'success' | 'error', text: string): void {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  killFeedback.value = { type, text }
  feedbackTimer = setTimeout(() => {
    killFeedback.value = null
    feedbackTimer = null
  }, 4000)
}

function requestKill(pid: number): void {
  if (killingPid.value !== null) return
  if (confirmTimer) clearTimeout(confirmTimer)
  confirmingPid.value = pid
  confirmTimer = setTimeout(() => {
    if (confirmingPid.value === pid) confirmingPid.value = null
    confirmTimer = null
  }, 4000)
}

function cancelKill(): void {
  if (confirmTimer) {
    clearTimeout(confirmTimer)
    confirmTimer = null
  }
  confirmingPid.value = null
}

async function confirmKill(process: ProcessMetrics): Promise<void> {
  if (!window.api?.system || killingPid.value !== null) return
  if (confirmTimer) {
    clearTimeout(confirmTimer)
    confirmTimer = null
  }
  killingPid.value = process.pid
  try {
    const result = await window.api.system.killProcess(process.pid)
    if (result.success) {
      if (processSnapshot.value) {
        processSnapshot.value = {
          ...processSnapshot.value,
          total: Math.max(0, processSnapshot.value.total - 1),
          processes: processSnapshot.value.processes.filter((item) => item.pid !== process.pid)
        }
      }
      showKillFeedback('success', `已结束进程 ${process.name} (PID ${process.pid})`)
      void refreshProcesses()
    } else {
      showKillFeedback('error', result.message || `无法结束进程 ${process.name} (PID ${process.pid})`)
    }
  } catch (error) {
    showKillFeedback('error', error instanceof Error ? error.message : '结束进程失败')
  } finally {
    killingPid.value = null
    confirmingPid.value = null
  }
}

watch(autoRefresh, (enabled) => {
  if (enabled) {
    void runAutoRefreshTick()
  } else {
    clearAutoRefreshTimer()
  }
})

watch(isActive, (active) => {
  if (active && autoRefresh.value && !document.hidden) {
    void runAutoRefreshTick()
  } else if (!active) {
    clearAutoRefreshTimer()
  }
})

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void refreshAll()
})

onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  clearAutoRefreshTimer()
  if (confirmTimer) clearTimeout(confirmTimer)
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<template>
  <div class="system-monitor" data-type="software">
    <div class="monitor-wrap">
      <header class="monitor-header" data-enter>
        <div class="monitor-title">
          <div class="eyebrow"><span class="live-dot"></span>本机系统监控</div>
          <h1>系统资源，一目了然。</h1>
          <p>按需查看硬件配置、资源占用与进程性能。</p>
        </div>
        <div class="monitor-actions">
          <button
            class="auto-refresh-toggle"
            :class="{ 'is-active': autoRefresh }"
            type="button"
            role="switch"
            :aria-checked="autoRefresh"
            :disabled="!apiAvailable"
            @click="toggleAutoRefresh"
          >
            <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
            <span>自动刷新</span>
            <span v-if="autoRefresh" class="switch-interval">3s</span>
          </button>
          <button
            class="primary-action"
            type="button"
            :disabled="!apiAvailable || refreshingAll || loadingMetrics || loadingProcesses"
            @click="refreshAll"
          >
            <svg class="refresh-icon" :class="{ spinning: refreshingAll || loadingMetrics }" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6v5h-5M4 18v-5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6.1 8.2A7 7 0 0 1 18.8 10M5.2 14a7 7 0 0 0 12.7 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            {{ refreshingAll ? '正在刷新…' : '刷新系统数据' }}
          </button>
        </div>
      </header>

      <section class="host-strip" aria-label="主机信息">
        <div>
          <span class="host-label">主机</span>
          <strong>{{ snapshot?.host.hostname || '读取中' }}</strong>
        </div>
        <div>
          <span class="host-label">系统</span>
          <strong>{{ snapshot?.host.osVersion || snapshot?.host.platformLabel || '读取中' }}</strong>
        </div>
        <div>
          <span class="host-label">处理器</span>
          <strong class="truncate">{{ snapshot?.cpu.brand || '读取中' }}</strong>
        </div>
        <div>
          <span class="host-label">运行时间</span>
          <strong>{{ uptimeText }}</strong>
        </div>
        <div>
          <span class="host-label">最后更新</span>
          <strong class="mono">{{ lastUpdated }}</strong>
        </div>
      </section>

      <div v-if="!apiAvailable || (snapshotError && !snapshot && !metrics)" class="state-card state-card--error" role="alert">
        <div>
          <h2>系统数据不可用</h2>
          <p>{{ snapshotError }}</p>
        </div>
        <button class="secondary-action" type="button" @click="refreshAll">重新读取系统数据</button>
      </div>

      <div v-else-if="loadingSnapshot && !snapshot && !metrics" class="loading-grid" role="status" aria-label="正在读取系统数据">
        <div v-for="item in 4" :key="item" class="loading-card"><span></span><span></span><span></span></div>
      </div>

      <template v-else>
        <div v-if="snapshotError || metricsError || processError" class="error-row" role="alert">
          <span>{{ snapshotError || metricsError || processError }}</span>
          <button type="button" @click="refreshAll">重试</button>
        </div>

        <section class="monitor-section" aria-labelledby="resource-heading">
          <div class="section-heading">
            <div>
              <span class="section-index">01</span>
              <h2 id="resource-heading">资源占用</h2>
            </div>
            <span class="section-status" :class="{ 'is-live': autoRefresh }">
              <span class="live-dot"></span>
              {{ autoRefresh ? '自动刷新中 · 3s' : '手动刷新模式' }}
            </span>
          </div>

          <div class="resource-grid">
            <article class="metric-card metric-card--cpu">
              <div class="card-heading">
                <div><span class="card-kicker">CPU</span><h3>处理器负载</h3></div>
                <span class="data-badge">{{ metrics?.cpu.speed ? formatFrequency(metrics.cpu.speed) : '--' }}</span>
              </div>
              <div class="cpu-body">
                <div class="load-ring" :style="{ '--load': `${cpuLoad}%`, '--tone': cpuTone }" role="img" :aria-label="`CPU 负载 ${formatPercent(cpuLoad)}`">
                  <div><strong>{{ cpuLoad.toFixed(0) }}<small>%</small></strong><span>总负载</span></div>
                </div>
                <div class="cpu-details">
                  <div class="cpu-numbers">
                    <div><span>用户</span><strong>{{ (metrics?.cpu.currentLoadUser ?? 0).toFixed(1) }}%</strong></div>
                    <div><span>系统</span><strong>{{ (metrics?.cpu.currentLoadSystem ?? 0).toFixed(1) }}%</strong></div>
                    <div><span>空闲</span><strong>{{ (metrics?.cpu.currentLoadIdle ?? 0).toFixed(1) }}%</strong></div>
                  </div>
                  <div class="core-grid" aria-label="各核心负载">
                    <div
                      v-for="core in metrics?.cpu.cores ?? []"
                      :key="core.index"
                      class="core-cell"
                      :style="{ '--core-load': `${Math.max(8, core.load)}%`, '--core-tone': loadTone(core.load) }"
                      :title="`核心 ${core.index + 1}：${formatPercent(core.load)}`"
                    >
                      <span>{{ String(core.index + 1).padStart(2, '0') }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="trend-row">
                <div class="trend-copy"><span>最近 {{ cpuHistory.length }} 次采样</span><strong :style="{ color: cpuTone }">{{ formatPercent(cpuLoad) }}</strong></div>
                <svg class="trend-chart" viewBox="0 0 320 58" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 29H320" class="chart-grid-line" />
                  <polyline :points="cpuChartPoints" :style="{ stroke: cpuTone }" />
                </svg>
              </div>
              <div class="card-foot">
                <span>{{ snapshot?.cpu.physicalCores ?? '--' }} 核 / {{ snapshot?.cpu.cores ?? '--' }} 线程</span>
                <span v-if="metrics?.cpu.temperature">温度 {{ metrics.cpu.temperature.main.toFixed(0) }}°C</span>
                <span v-else>温度不可用</span>
              </div>
            </article>

            <article class="metric-card">
              <div class="card-heading">
                <div><span class="card-kicker">MEMORY</span><h3>内存占用</h3></div>
                <span class="data-badge">{{ snapshot ? formatBytes(snapshot.memoryTotal, 0) : '--' }}</span>
              </div>
              <div class="big-reading" :style="{ color: memoryTone }">
                <strong>{{ metrics ? memoryPercent.toFixed(0) : '--' }}<small>%</small></strong>
                <span>{{ metrics ? `${formatBytes(metrics.memory.used)} 已用` : '等待数据' }}</span>
              </div>
              <div class="progress-track" role="progressbar" aria-label="内存占用" :aria-valuenow="Math.round(memoryPercent)" aria-valuemin="0" aria-valuemax="100">
                <span :style="{ width: `${memoryPercent}%`, background: memoryTone }"></span>
              </div>
              <dl class="metric-list">
                <div><dt>可用</dt><dd>{{ metrics ? formatBytes(metrics.memory.available) : '--' }}</dd></div>
                <div><dt>活跃</dt><dd>{{ metrics ? formatBytes(metrics.memory.active) : '--' }}</dd></div>
                <div><dt>交换空间</dt><dd>{{ metrics?.memory.swaptotal ? formatBytes(metrics.memory.swapused) : '未启用' }}</dd></div>
              </dl>
              <div v-if="metrics?.memory.swaptotal" class="swap-row">
                <span>Swap</span>
                <div class="progress-track progress-track--slim"><span :style="{ width: `${(metrics.memory.swapused / metrics.memory.swaptotal) * 100}%` }"></span></div>
                <strong>{{ formatPercent((metrics.memory.swapused / metrics.memory.swaptotal) * 100) }}</strong>
              </div>
            </article>

            <article class="metric-card">
              <div class="card-heading">
                <div><span class="card-kicker">STORAGE</span><h3>磁盘空间</h3></div>
                <span class="data-badge">{{ metrics?.disks.length ?? 0 }} 个卷</span>
              </div>
              <div class="big-reading" :style="{ color: diskTone }">
                <strong>{{ metrics ? diskPercent.toFixed(0) : '--' }}<small>%</small></strong>
                <span>整体已用</span>
              </div>
              <div class="disk-list">
                <div v-for="disk in metrics?.disks ?? []" :key="disk.mount" class="disk-item">
                  <div class="disk-item__head"><span :title="disk.mount">{{ disk.mount }}</span><strong>{{ disk.use.toFixed(0) }}%</strong></div>
                  <div class="progress-track progress-track--slim"><span :style="{ width: `${disk.use}%`, background: loadTone(disk.use) }"></span></div>
                  <div class="disk-item__meta"><span>{{ formatBytes(disk.used) }} / {{ formatBytes(disk.size, 0) }}</span><span>{{ disk.type || disk.fs }}</span></div>
                </div>
                <p v-if="metrics && !metrics.disks.length" class="empty-copy">未检测到磁盘卷。</p>
              </div>
            </article>

            <article class="metric-card metric-card--network">
              <div class="card-heading">
                <div><span class="card-kicker">NETWORK</span><h3>网络吞吐</h3></div>
                <span class="data-badge">{{ visibleNetwork.length }} {{ hasActiveNetwork ? '个活跃接口' : '个接口' }}</span>
              </div>
              <div class="network-summary">
                <div><span class="network-dot network-dot--rx"></span><small>下载</small><strong>{{ formatRate(networkTotals.rx) }}</strong></div>
                <div><span class="network-dot network-dot--tx"></span><small>上传</small><strong>{{ formatRate(networkTotals.tx) }}</strong></div>
                <div class="network-total"><small>累计接收</small><strong>{{ formatBytes(visibleNetwork.reduce((sum, item) => sum + item.rxBytes, 0), 0) }}</strong></div>
              </div>
              <div class="network-chart">
                <svg viewBox="0 0 640 74" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 18.5H640M0 37H640M0 55.5H640" class="chart-grid-line" />
                  <polyline :points="networkRxPoints" class="network-line network-line--rx" />
                  <polyline :points="networkTxPoints" class="network-line network-line--tx" />
                </svg>
              </div>
              <div class="network-interfaces">
                <div v-for="network in visibleNetwork" :key="network.iface" class="network-interface">
                  <div><strong>{{ network.ifaceName }}</strong><span>{{ network.operstate === 'up' ? '已连接' : network.operstate }}</span></div>
                  <dl><div><dt>接收</dt><dd>{{ formatRate(network.rxSec) }}</dd></div><div><dt>发送</dt><dd>{{ formatRate(network.txSec) }}</dd></div></dl>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="monitor-section" aria-labelledby="process-heading">
          <div class="section-heading">
            <div><span class="section-index">02</span><h2 id="process-heading">进程性能</h2></div>
            <span class="section-meta">
              {{ processQuery.trim() ? `匹配 ${visibleProcesses.length} / ${processSnapshot?.total ?? 0} 个进程` : `共 ${processSnapshot?.total ?? 0} 个进程` }}
            </span>
          </div>
          <div class="process-panel">
            <div class="process-toolbar">
              <label class="search-field">
                <span class="sr-only">搜索进程</span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8" /><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
                <input v-model="processQuery" type="search" placeholder="搜索进程名称或 PID" autocomplete="off">
              </label>
              <div class="process-legend"><span><i class="legend-dot legend-dot--cpu"></i>CPU</span><span><i class="legend-dot legend-dot--memory"></i>内存</span></div>
            </div>
            <div v-if="killFeedback" class="process-feedback" :class="`process-feedback--${killFeedback.type}`" role="status">
              <span>{{ killFeedback.text }}</span>
              <button type="button" @click="killFeedback = null">关闭</button>
            </div>
            <div class="process-table-wrap">
              <table class="process-table">
                <caption class="sr-only">本机进程资源占用，点击列标题可排序</caption>
                <thead>
                  <tr>
                    <th scope="col"><button type="button" @click="toggleSort('name')">进程名称<span :class="{ sorted: processSortKey === 'name' }">{{ processSortKey === 'name' ? (processSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button></th>
                    <th scope="col">PID</th>
                    <th scope="col" :aria-sort="processSortKey === 'pcpu' ? (processSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"><button type="button" @click="toggleSort('pcpu')">CPU<span :class="{ sorted: processSortKey === 'pcpu' }">{{ processSortKey === 'pcpu' ? (processSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button></th>
                    <th scope="col" :aria-sort="processSortKey === 'pmem' ? (processSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"><button type="button" @click="toggleSort('pmem')">内存<span :class="{ sorted: processSortKey === 'pmem' }">{{ processSortKey === 'pmem' ? (processSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button></th>
                    <th scope="col" :aria-sort="processSortKey === 'memRss' ? (processSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"><button type="button" @click="toggleSort('memRss')">物理内存<span :class="{ sorted: processSortKey === 'memRss' }">{{ processSortKey === 'memRss' ? (processSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button></th>
                    <th scope="col">状态</th>
                    <th scope="col" class="th-action">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="process in visibleProcesses" :key="process.pid">
                    <td><div class="process-name"><span class="process-icon">{{ process.name.slice(0, 1).toUpperCase() }}</span><strong :title="process.name">{{ process.name }}</strong></div></td>
                    <td class="mono">{{ process.pid }}</td>
                    <td><div class="table-meter"><span :style="{ width: `${Math.min(100, process.pcpu)}%`, background: 'var(--p-accent)' }"></span><strong>{{ process.pcpu.toFixed(1) }}%</strong></div></td>
                    <td><div class="table-meter"><span :style="{ width: `${Math.min(100, process.pmem * 4)}%`, background: 'var(--p-mint)' }"></span><strong>{{ process.pmem.toFixed(1) }}%</strong></div></td>
                    <td class="mono">{{ formatBytes(process.memRss) }}</td>
                    <td><span class="state-pill" :class="{ 'state-pill--running': process.state === 'R' }">{{ processState(process.state) }}</span></td>
                    <td class="td-action">
                      <div v-if="confirmingPid === process.pid" class="kill-actions">
                        <button class="kill-btn kill-btn--confirm" type="button" :disabled="killingPid === process.pid" @click="confirmKill(process)">
                          {{ killingPid === process.pid ? '结束中…' : '确认' }}
                        </button>
                        <button class="kill-btn kill-btn--cancel" type="button" :disabled="killingPid === process.pid" @click="cancelKill">取消</button>
                      </div>
                      <button v-else class="kill-btn" type="button" :disabled="killingPid !== null" @click="requestKill(process.pid)">结束</button>
                    </td>
                  </tr>
                  <tr v-if="!visibleProcesses.length"><td colspan="7" class="table-empty">{{ loadingProcesses ? '正在读取进程…' : processQuery ? '没有匹配的进程。' : '暂无进程数据。' }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="monitor-section" aria-labelledby="hardware-heading">
          <div class="section-heading">
            <div><span class="section-index">03</span><h2 id="hardware-heading">硬件配置</h2></div>
            <span class="section-meta">{{ snapshot?.host.arch ?? '--' }} · {{ snapshot?.host.kernel ?? '--' }}</span>
          </div>
          <div class="hardware-grid">
            <article class="hardware-card hardware-card--wide">
              <div class="hardware-title"><span>处理器</span><strong>{{ snapshot?.cpu.brand || '未知处理器' }}</strong></div>
              <dl class="hardware-list">
                <div><dt>制造商</dt><dd>{{ snapshot?.cpu.manufacturer || '--' }}</dd></div>
                <div><dt>架构</dt><dd>{{ snapshot?.cpu.family || '--' }}</dd></div>
                <div><dt>核心 / 线程</dt><dd>{{ snapshot?.cpu.physicalCores ?? '--' }} / {{ snapshot?.cpu.cores ?? '--' }}</dd></div>
                <div><dt>基础频率</dt><dd>{{ snapshot ? formatFrequency(snapshot.cpu.speed) : '--' }}</dd></div>
                <div><dt>最高频率</dt><dd>{{ snapshot ? formatFrequency(snapshot.cpu.speedMax) : '--' }}</dd></div>
                <div><dt>插槽</dt><dd>{{ snapshot?.cpu.socket || '--' }}</dd></div>
                <div><dt>二级缓存</dt><dd>{{ snapshot ? formatCache(snapshot.cpu.cache.l2) : '--' }}</dd></div>
                <div><dt>三级缓存</dt><dd>{{ snapshot ? formatCache(snapshot.cpu.cache.l3) : '--' }}</dd></div>
              </dl>
            </article>

            <article class="hardware-card">
              <div class="hardware-title"><span>内存</span><strong>{{ snapshot ? formatBytes(snapshot.memoryTotal, 0) : '--' }}</strong></div>
              <dl class="hardware-list">
                <div><dt>插槽</dt><dd>{{ snapshot?.motherboard?.memSlots ?? '--' }}</dd></div>
                <div><dt>最大容量</dt><dd>{{ snapshot?.motherboard?.memMax ? formatBytes(snapshot.motherboard.memMax, 0) : '--' }}</dd></div>
                <div v-for="module in snapshot?.memoryModules ?? []" :key="`${module.bank}-${module.size}`"><dt>{{ module.bank || '内存条' }}</dt><dd>{{ formatBytes(module.size, 0) }} · {{ module.type || '--' }}{{ module.clockSpeed ? ` · ${module.clockSpeed} MT/s` : '' }}</dd></div>
              </dl>
            </article>

            <article class="hardware-card">
              <div class="hardware-title"><span>图形系统</span><strong>{{ snapshot?.graphics[0]?.model || '未知显卡' }}</strong></div>
              <dl class="hardware-list">
                <div v-for="gpu in snapshot?.graphics ?? []" :key="`${gpu.vendor}-${gpu.model}`"><dt>显卡</dt><dd>{{ gpu.model }}<small>{{ gpu.vendor }} · {{ gpu.vram ? formatBytes(gpu.vram, 0) : '显存不可用' }}</small></dd></div>
                <div v-for="display in snapshot?.displays ?? []" :key="`${display.vendor}-${display.model}`"><dt>显示器</dt><dd>{{ display.model }}<small>{{ display.resolutionX }} × {{ display.resolutionY }}{{ display.refreshRate ? ` · ${display.refreshRate} Hz` : '' }}</small></dd></div>
                <div v-if="!snapshot?.graphics.length"><dt>状态</dt><dd>未检测到独立显卡信息</dd></div>
              </dl>
            </article>

            <article class="hardware-card">
              <div class="hardware-title"><span>存储设备</span><strong>{{ snapshot?.storageDevices.length ?? 0 }} 个设备</strong></div>
              <dl class="hardware-list">
                <div v-for="device in snapshot?.storageDevices ?? []" :key="device.name"><dt>{{ device.name }}</dt><dd>{{ device.model || storageType(device.type) }}<small>{{ formatBytes(device.size, 0) }} · {{ device.protocol || device.fsType || '--' }}</small></dd></div>
                <div v-if="!snapshot?.storageDevices.length"><dt>状态</dt><dd>未检测到物理存储设备</dd></div>
              </dl>
            </article>

            <article class="hardware-card">
              <div class="hardware-title"><span>网络接口</span><strong>{{ snapshot?.networkInterfaces.length ?? 0 }} 个接口</strong></div>
              <dl class="hardware-list hardware-list--network">
                <div v-for="network in snapshot?.networkInterfaces ?? []" :key="`${network.iface}-${network.ifaceName}`"><dt>{{ network.ifaceName }}</dt><dd>{{ network.ip4 || network.ip6 || '未分配地址' }}<small>{{ formatMac(network.mac) }} · {{ network.speed ? `${network.speed} Mbps` : network.type }}</small></dd></div>
                <div v-if="!snapshot?.networkInterfaces.length"><dt>状态</dt><dd>未检测到网络接口</dd></div>
              </dl>
            </article>

            <article class="hardware-card">
              <div class="hardware-title"><span>主板与系统</span><strong>{{ snapshot?.system.model || snapshot?.motherboard?.model || '本机设备' }}</strong></div>
              <dl class="hardware-list">
                <div><dt>设备厂商</dt><dd>{{ snapshot?.system.manufacturer || '--' }}</dd></div>
                <div><dt>主板</dt><dd>{{ snapshot?.motherboard ? `${snapshot.motherboard.manufacturer} ${snapshot.motherboard.model}` : '--' }}</dd></div>
                <div><dt>BIOS</dt><dd>{{ snapshot?.bios ? `${snapshot.bios.vendor} ${snapshot.bios.version}` : '--' }}</dd></div>
                <div><dt>系统版本</dt><dd>{{ snapshot?.host.osVersion || '--' }}</dd></div>
                <div><dt>系统构建</dt><dd>{{ snapshot?.host.osBuild || '--' }}</dd></div>
                <div v-if="snapshot?.battery"><dt>电池</dt><dd>{{ snapshot.battery.percent.toFixed(0) }}% · {{ snapshot.battery.isCharging ? '充电中' : formatBatteryTime(snapshot.battery.timeRemaining) }}<small v-if="snapshot.battery.cycleCount">循环次数 {{ snapshot.battery.cycleCount }}</small></dd></div>
              </dl>
            </article>
          </div>
        </section>
      </template>

      <footer class="monitor-footer">
        <span>数据仅在本机读取，不会上传。</span>
        <span class="mono">systeminformation · {{ snapshot?.host.platform ?? 'desktop' }}</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.system-monitor {
  --p-bg: #0a0d14;
  --p-surface: #131824;
  --p-surface-2: #171e2c;
  --p-ink: #e9edf3;
  --p-muted: #8891a1;
  --p-faint: #5e6879;
  --p-accent: #5ab9fc;
  --p-mint: #4fd1a5;
  --p-warning: #f5b94c;
  --p-danger: #fb7185;
  --p-line: rgba(148, 163, 184, 0.14);
  --p-line-strong: rgba(148, 163, 184, 0.24);
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 28px 30px 34px;
  background: var(--p-bg);
  color: var(--p-ink);
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  user-select: text;
}

.monitor-wrap { max-width: 1380px; margin: 0 auto; }
.monitor-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; }
.eyebrow { display: flex; align-items: center; gap: 8px; color: var(--p-accent); font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--p-mint); box-shadow: 0 0 0 4px rgba(79, 209, 165, 0.1); }
.monitor-title h1 { margin: 12px 0 8px; font-size: clamp(26px, 3vw, 38px); font-weight: 650; letter-spacing: -0.045em; line-height: 1.12; }
.monitor-title p { margin: 0; color: var(--p-muted); font-size: 15px; }
.monitor-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.auto-refresh-toggle { display: inline-flex; min-height: 42px; align-items: center; gap: 9px; padding: 0 14px; border: 1px solid var(--p-line-strong); border-radius: 999px; background: var(--p-surface); color: var(--p-muted); font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease; }
.auto-refresh-toggle:hover:not(:disabled) { border-color: rgba(90, 185, 252, 0.45); color: var(--p-ink); }
.auto-refresh-toggle:disabled { cursor: not-allowed; opacity: 0.45; }
.auto-refresh-toggle.is-active { border-color: rgba(79, 209, 165, 0.45); background: rgba(79, 209, 165, 0.08); color: var(--p-ink); }
.switch-track { position: relative; display: inline-flex; width: 32px; height: 18px; align-items: center; border-radius: 999px; background: #263042; transition: background-color 180ms ease; }
.switch-thumb { width: 12px; height: 12px; border-radius: 50%; background: var(--p-muted); transform: translateX(3px); transition: transform 180ms ease, background-color 180ms ease; }
.auto-refresh-toggle.is-active .switch-track { background: rgba(79, 209, 165, 0.35); }
.auto-refresh-toggle.is-active .switch-thumb { background: var(--p-mint); transform: translateX(17px); }
.switch-interval { padding: 2px 6px; border-radius: 999px; background: rgba(79, 209, 165, 0.14); color: var(--p-mint); font-family: "Cascadia Code", Consolas, monospace; font-size: 11px; font-weight: 600; }
.primary-action, .secondary-action { display: inline-flex; min-height: 42px; align-items: center; justify-content: center; gap: 8px; padding: 0 17px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; transition: transform 150ms ease, background-color 150ms ease, border-color 150ms ease, color 150ms ease; }
.primary-action { border: 1px solid var(--p-accent); background: var(--p-accent); color: #07121b; }
.secondary-action { border: 1px solid var(--p-line-strong); background: transparent; color: var(--p-ink); }
.primary-action:hover:not(:disabled), .secondary-action:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
.primary-action:active:not(:disabled), .secondary-action:active:not(:disabled) { transform: translateY(0) scale(0.98); }
.primary-action:disabled, .secondary-action:disabled { cursor: not-allowed; opacity: 0.45; }
.refresh-icon { width: 16px; height: 16px; }
.spinning { animation: spin 900ms linear infinite; }
.host-strip { display: grid; grid-template-columns: 1fr 1.5fr 2fr 1fr 0.8fr; gap: 18px; margin-top: 26px; padding: 16px 0; border-top: 1px solid var(--p-line); border-bottom: 1px solid var(--p-line); }
.host-strip > div { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.host-label { color: var(--p-faint); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.host-strip strong { overflow: hidden; color: var(--p-ink); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.mono { font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace; font-variant-numeric: tabular-nums; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.monitor-section { margin-top: 30px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
.section-heading > div { display: flex; align-items: center; gap: 10px; }
.section-index { color: var(--p-accent); font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; }
.section-heading h2 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }
.section-status, .section-meta { display: inline-flex; align-items: center; gap: 7px; color: var(--p-muted); font-size: 12px; }
.section-status .live-dot { width: 5px; height: 5px; box-shadow: none; background: var(--p-faint); transition: background-color 180ms ease, box-shadow 180ms ease; }
.section-status.is-live { color: var(--p-mint); }
.section-status.is-live .live-dot { background: var(--p-mint); box-shadow: 0 0 0 4px rgba(79, 209, 165, 0.14); }
.resource-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
.metric-card { min-width: 0; padding: 19px; border: 1px solid var(--p-line); border-radius: 14px; background: var(--p-surface); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025); }
.metric-card--cpu { grid-column: span 6; }
.metric-card:not(.metric-card--cpu):not(.metric-card--network) { grid-column: span 3; }
.metric-card--network { grid-column: span 12; }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.card-kicker { display: block; margin-bottom: 5px; color: var(--p-faint); font-family: "Cascadia Code", Consolas, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; }
.card-heading h3 { margin: 0; font-size: 15px; font-weight: 650; }
.data-badge { flex-shrink: 0; padding: 5px 9px; border: 1px solid var(--p-line); border-radius: 999px; color: var(--p-muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; }
.cpu-body { display: grid; grid-template-columns: 122px minmax(0, 1fr); gap: 20px; align-items: center; margin-top: 20px; }
.load-ring { display: grid; width: 118px; height: 118px; place-items: center; border-radius: 50%; background: conic-gradient(var(--tone) var(--load), #242c3b 0); }
.load-ring::before { grid-area: 1 / 1; width: 98px; height: 98px; border-radius: 50%; background: var(--p-surface); content: ""; }
.load-ring > div { z-index: 1; grid-area: 1 / 1; display: flex; flex-direction: column; align-items: center; }
.load-ring strong { font-size: 28px; font-weight: 650; letter-spacing: -0.06em; line-height: 1; }
.load-ring small { margin-left: 2px; color: var(--p-muted); font-size: 14px; font-weight: 500; }
.load-ring span { margin-top: 6px; color: var(--p-faint); font-size: 12px; }
.cpu-details { min-width: 0; }
.cpu-numbers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cpu-numbers > div { display: flex; flex-direction: column; gap: 5px; }
.cpu-numbers span { color: var(--p-faint); font-size: 12px; }
.cpu-numbers strong { font-family: "Cascadia Code", Consolas, monospace; font-size: 14px; font-weight: 600; }
.core-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px; margin-top: 15px; }
.core-cell { position: relative; display: flex; height: 31px; align-items: flex-end; overflow: hidden; padding: 4px; border: 1px solid var(--p-line); border-radius: 4px; background: #0e1420; }
.core-cell::before { position: absolute; inset: auto 0 0; height: var(--core-load); background: color-mix(in srgb, var(--core-tone) 28%, transparent); content: ""; }
.core-cell span { z-index: 1; color: var(--p-muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; }
.trend-row { margin-top: 17px; padding-top: 13px; border-top: 1px solid var(--p-line); }
.trend-copy { display: flex; align-items: center; justify-content: space-between; color: var(--p-faint); font-size: 12px; }
.trend-copy strong { font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; }
.trend-chart { display: block; width: 100%; height: 48px; margin-top: 6px; overflow: visible; }
.trend-chart polyline { fill: none; stroke-width: 1.8; vector-effect: non-scaling-stroke; }
.chart-grid-line { fill: none; stroke: rgba(148, 163, 184, 0.09); stroke-width: 1; vector-effect: non-scaling-stroke; }
.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; color: var(--p-faint); font-size: 12px; }
.big-reading { display: flex; flex-direction: column; gap: 6px; margin-top: 24px; }
.big-reading strong { font-size: 34px; font-weight: 650; letter-spacing: -0.06em; line-height: 1; }
.big-reading small { margin-left: 3px; font-size: 16px; font-weight: 500; }
.big-reading span { color: var(--p-muted); font-size: 12px; }
.progress-track { height: 6px; overflow: hidden; margin-top: 16px; border-radius: 999px; background: #242c3b; }
.progress-track > span { display: block; height: 100%; border-radius: inherit; transition: width 350ms ease; }
.progress-track--slim { height: 4px; margin-top: 8px; }
.metric-list { display: flex; flex-direction: column; gap: 11px; margin: 19px 0 0; }
.metric-list > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.metric-list dt { color: var(--p-faint); font-size: 12px; }
.metric-list dd { margin: 0; color: var(--p-ink); font-family: "Cascadia Code", Consolas, monospace; font-size: 13px; }
.swap-row { display: grid; grid-template-columns: auto 1fr auto; gap: 9px; align-items: center; margin-top: 17px; padding-top: 13px; border-top: 1px solid var(--p-line); color: var(--p-faint); font-size: 11px; }
.swap-row .progress-track { margin: 0; }
.swap-row strong { color: var(--p-muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 11px; font-weight: 500; }
.disk-list { display: flex; flex-direction: column; gap: 15px; margin-top: 19px; }
.disk-item__head, .disk-item__meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.disk-item__head span { overflow: hidden; color: var(--p-ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.disk-item__head strong { color: var(--p-muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; font-weight: 500; }
.disk-item__meta { margin-top: 6px; color: var(--p-faint); font-family: "Cascadia Code", Consolas, monospace; font-size: 11px; }
.empty-copy { margin: 0; color: var(--p-faint); font-size: 13px; }
.network-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px; }
.network-summary > div { position: relative; display: flex; flex-direction: column; gap: 6px; padding-left: 15px; }
.network-summary small { color: var(--p-faint); font-size: 12px; }
.network-summary strong { font-family: "Cascadia Code", Consolas, monospace; font-size: 20px; font-weight: 600; letter-spacing: -0.04em; }
.network-dot { position: absolute; top: 4px; left: 0; width: 6px; height: 6px; border-radius: 50%; }
.network-dot--rx { background: var(--p-accent); }
.network-dot--tx { background: var(--p-mint); }
.network-total { border-left: 1px solid var(--p-line); }
.network-total strong { color: var(--p-muted); font-size: 16px; }
.network-chart { margin-top: 14px; padding: 0 2px; }
.network-chart svg { display: block; width: 100%; height: 64px; }
.network-line { fill: none; stroke-width: 1.6; vector-effect: non-scaling-stroke; }
.network-line--rx { stroke: var(--p-accent); }
.network-line--tx { stroke: var(--p-mint); }
.network-interfaces { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.network-interface { min-width: 0; padding: 12px; border: 1px solid var(--p-line); border-radius: 9px; background: rgba(9, 13, 20, 0.45); }
.network-interface > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.network-interface strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.network-interface span { color: var(--p-mint); font-size: 11px; }
.network-interface dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 11px 0 0; }
.network-interface dl > div { display: flex; flex-direction: column; gap: 4px; }
.network-interface dt { color: var(--p-faint); font-size: 11px; }
.network-interface dd { margin: 0; color: var(--p-muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 11px; }
.process-panel { overflow: hidden; border: 1px solid var(--p-line); border-radius: 14px; background: var(--p-surface); }
.process-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 16px; border-bottom: 1px solid var(--p-line); }
.search-field { display: flex; width: min(360px, 100%); min-height: 40px; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid var(--p-line); border-radius: 9px; background: #0e1420; color: var(--p-faint); transition: border-color 150ms ease, box-shadow 150ms ease; }
.search-field:focus-within { border-color: rgba(90, 185, 252, 0.55); box-shadow: 0 0 0 3px rgba(90, 185, 252, 0.1); }
.search-field svg { width: 16px; height: 16px; flex-shrink: 0; }
.search-field input { width: 100%; border: 0; outline: none; background: transparent; color: var(--p-ink); font: inherit; font-size: 13px; }
.search-field input:focus-visible { outline: none; }
.search-field input::placeholder { color: var(--p-faint); }
.process-legend { display: flex; gap: 14px; color: var(--p-faint); font-size: 11px; }
.process-legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend-dot { width: 6px; height: 6px; border-radius: 50%; }
.legend-dot--cpu { background: var(--p-accent); }
.legend-dot--memory { background: var(--p-mint); }
.process-feedback { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--p-line); font-size: 13px; }
.process-feedback--success { background: rgba(79, 209, 165, 0.08); color: var(--p-mint); }
.process-feedback--error { background: rgba(251, 113, 133, 0.08); color: #fda4af; }
.process-feedback button { padding: 3px 10px; border: 1px solid currentColor; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: 11px; cursor: pointer; opacity: 0.85; }
.process-feedback button:hover { opacity: 1; }
.process-table-wrap { max-height: 460px; overflow: auto; scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.24) transparent; }
.process-table-wrap::-webkit-scrollbar { width: 8px; height: 8px; }
.process-table-wrap::-webkit-scrollbar-track { background: transparent; }
.process-table-wrap::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(148, 163, 184, 0.22); }
.process-table-wrap::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.36); }
.process-table { width: 100%; min-width: 820px; border-collapse: collapse; font-size: 13px; }
.process-table th { position: sticky; top: 0; z-index: 2; padding: 0; border-bottom: 1px solid var(--p-line); background: #101521; color: var(--p-faint); font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }
.process-table th:first-child { padding-left: 16px; }
.process-table th.th-action, .process-table td.td-action { padding-right: 16px; text-align: right; }
.process-table th button { display: inline-flex; min-height: 40px; align-items: center; gap: 7px; padding: 0 12px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.process-table th button:hover { color: var(--p-ink); }
.process-table th button span { color: var(--p-faint); }
.process-table th button span.sorted { color: var(--p-accent); }
.process-table td { height: 46px; padding: 0 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.08); color: var(--p-muted); }
.process-table td:first-child { padding-left: 16px; }
.process-table tbody tr:last-child td { border-bottom: 0; }
.process-table tbody tr:hover { background: rgba(90, 185, 252, 0.035); }
.process-name { display: flex; min-width: 0; align-items: center; gap: 9px; }
.process-icon { display: grid; width: 24px; height: 24px; flex-shrink: 0; place-items: center; border: 1px solid var(--p-line); border-radius: 6px; background: #1a2231; color: var(--p-accent); font-size: 11px; font-weight: 700; }
.process-name strong { max-width: 260px; overflow: hidden; color: var(--p-ink); font-size: 13px; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
.table-meter { display: flex; min-width: 92px; align-items: center; gap: 8px; }
.table-meter > span { width: 38px; height: 4px; flex-shrink: 0; border-radius: 999px; opacity: 0.85; }
.table-meter strong { min-width: 44px; color: var(--p-muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; font-weight: 500; }
.state-pill { display: inline-flex; min-width: 42px; justify-content: center; padding: 4px 8px; border: 1px solid var(--p-line); border-radius: 999px; color: var(--p-faint); font-size: 11px; }
.state-pill--running { border-color: rgba(79, 209, 165, 0.25); background: rgba(79, 209, 165, 0.08); color: var(--p-mint); }
.kill-actions { display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; }
.kill-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 0 10px; border: 1px solid rgba(251, 113, 133, 0.28); border-radius: 6px; background: rgba(251, 113, 133, 0.06); color: #fda4af; font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease; }
.kill-btn:hover:not(:disabled) { border-color: rgba(251, 113, 133, 0.6); background: rgba(251, 113, 133, 0.16); color: #fecdd3; }
.kill-btn:disabled { cursor: not-allowed; opacity: 0.45; }
.kill-btn--confirm { border-color: var(--p-danger); background: var(--p-danger); color: #19070b; font-weight: 650; }
.kill-btn--confirm:hover:not(:disabled) { border-color: var(--p-danger); background: #f43f5e; color: #fff; }
.kill-btn--cancel { border-color: var(--p-line-strong); background: transparent; color: var(--p-muted); }
.kill-btn--cancel:hover:not(:disabled) { border-color: var(--p-muted); background: rgba(148, 163, 184, 0.1); color: var(--p-ink); }
.table-empty { height: 120px !important; color: var(--p-faint) !important; text-align: center; }
.hardware-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.hardware-card { min-width: 0; padding: 18px; border: 1px solid var(--p-line); border-radius: 14px; background: var(--p-surface); }
.hardware-card--wide { grid-column: span 2; }
.hardware-title { display: flex; flex-direction: column; gap: 7px; padding-bottom: 14px; border-bottom: 1px solid var(--p-line); }
.hardware-title span { color: var(--p-faint); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.hardware-title strong { overflow: hidden; color: var(--p-ink); font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.hardware-list { display: flex; flex-direction: column; gap: 12px; margin: 15px 0 0; }
.hardware-list > div { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 12px; align-items: start; }
.hardware-list dt { color: var(--p-faint); font-size: 12px; }
.hardware-list dd { min-width: 0; margin: 0; color: var(--p-muted); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
.hardware-list dd small { display: block; margin-top: 2px; color: var(--p-faint); font-family: "Cascadia Code", Consolas, monospace; font-size: 11px; }
.hardware-list--network dd { font-family: "Cascadia Code", Consolas, monospace; }
.monitor-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 30px; padding-top: 16px; border-top: 1px solid var(--p-line); color: var(--p-faint); font-size: 11px; }
.state-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 26px; padding: 22px; border: 1px solid var(--p-line); border-radius: 14px; background: var(--p-surface); }
.state-card--error { border-color: rgba(251, 113, 133, 0.3); }
.state-card h2 { margin: 0 0 6px; font-size: 16px; }
.state-card p { margin: 0; color: var(--p-muted); font-size: 13px; }
.error-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; padding: 11px 13px; border: 1px solid rgba(251, 113, 133, 0.25); border-radius: 9px; background: rgba(251, 113, 133, 0.06); color: #fda4af; font-size: 13px; }
.error-row button { flex-shrink: 0; min-height: 32px; padding: 0 10px; border: 1px solid rgba(251, 113, 133, 0.3); border-radius: 999px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.loading-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 30px; }
.loading-card { display: flex; min-height: 190px; flex-direction: column; gap: 18px; padding: 20px; border: 1px solid var(--p-line); border-radius: 14px; background: var(--p-surface); }
.loading-card span { display: block; height: 12px; border-radius: 999px; background: linear-gradient(90deg, #1a2231, #263145, #1a2231); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; }
.loading-card span:nth-child(2) { width: 68%; height: 34px; }
.loading-card span:nth-child(3) { width: 86%; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; padding: 0; margin: -1px; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--p-accent); outline-offset: 2px; }
.search-field input:focus-visible { outline: none; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { to { background-position: -200% 0; } }

@media (max-width: 1100px) {
  .system-monitor { padding: 24px; }
  .host-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .metric-card--cpu { grid-column: span 7; }
  .metric-card:not(.metric-card--cpu):not(.metric-card--network) { grid-column: span 5; }
  .metric-card:not(.metric-card--cpu):not(.metric-card--network) + .metric-card:not(.metric-card--cpu):not(.metric-card--network) { grid-column: span 12; }
  .hardware-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .network-interfaces { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .system-monitor { padding: 20px 16px 28px; }
  .monitor-header { align-items: flex-start; flex-direction: column; gap: 18px; }
  .monitor-actions { width: 100%; justify-content: flex-start; }
  .primary-action { flex: 1; }
  .host-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric-card--cpu, .metric-card:not(.metric-card--cpu):not(.metric-card--network), .metric-card:not(.metric-card--cpu):not(.metric-card--network) + .metric-card:not(.metric-card--cpu):not(.metric-card--network), .metric-card--network { grid-column: span 12; }
  .cpu-body { grid-template-columns: 110px minmax(0, 1fr); gap: 14px; }
  .load-ring { width: 104px; height: 104px; }
  .load-ring::before { width: 86px; height: 86px; }
  .core-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .network-summary { gap: 12px; }
  .network-summary strong { font-size: 15px; }
  .network-total strong { font-size: 13px; }
  .network-interfaces { grid-template-columns: 1fr; }
  .hardware-grid { grid-template-columns: 1fr; }
  .hardware-card--wide { grid-column: span 1; }
  .process-toolbar { align-items: stretch; flex-direction: column; gap: 10px; }
  .process-legend { justify-content: flex-end; }
  .process-table-wrap { max-height: 380px; }
  .monitor-footer { align-items: flex-start; flex-direction: column; gap: 7px; }
  .state-card { align-items: flex-start; flex-direction: column; }
  .loading-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
</style>
