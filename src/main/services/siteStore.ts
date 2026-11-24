import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { defaultSites, type Site, type SiteChange, type SiteChangeResult } from '@shared/sitePreview'

function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const address = value.trim()
  if (!/^https:\/\//i.test(address) || !URL.canParse(address)) return
  const url = new URL(address)
  if (!url.username && !url.password) return url.href
}

function isSavedSite(value: unknown): value is Site {
  if (!value || typeof value !== 'object') return false
  const site = value as Partial<Site>
  return typeof site.id === 'string' && typeof site.name === 'string' && Boolean(normalizeUrl(site.url))
}

class SiteStore {
  private sites?: Promise<Site[]>
  private writes = Promise.resolve()

  private get filePath(): string {
    return join(app.getPath('userData'), 'sites.json')
  }

  /** 旧版本使用的文件名，用于平滑迁移 */
  private get legacyPath(): string {
    return join(app.getPath('userData'), 'moyu-sites.json')
  }

  list(): Promise<Site[]> {
    return this.writes.then(() => this.read())
  }

  change(change: SiteChange): Promise<SiteChangeResult> {
    const result = this.writes.then(() => this.apply(change))
    this.writes = result.then(() => undefined, () => undefined)
    return result
  }

  private read(): Promise<Site[]> {
    this.sites ??= this.load().catch((error) => {
      this.sites = undefined
      throw error
    })
    return this.sites
  }

  private async load(): Promise<Site[]> {
    const saved = await this.readFrom(this.filePath)
    if (saved) return saved

    // 首次运行新文件名时，把旧文件里的站点接过来
    const legacy = await this.readFrom(this.legacyPath)
    if (!legacy) return [...defaultSites]

    await this.persist(legacy).catch(() => undefined)
    return legacy
  }

  private async readFrom(path: string): Promise<Site[] | undefined> {
    try {
      const saved: unknown = JSON.parse(await readFile(path, 'utf8'))
      return Array.isArray(saved) && saved.every(isSavedSite) ? saved : undefined
    } catch {
      // 文件不存在或内容损坏都回退默认值，不把错误抛给界面
      return undefined
    }
  }

  private async apply(change: SiteChange): Promise<SiteChangeResult> {
    const sites = await this.read()
    if (change?.type === 'remove') {
      if (!sites.some((site) => site.id === change.id)) return { error: '该网站已不存在' }
      const updated = sites.filter((site) => site.id !== change.id)
      await this.persist(updated)
      return { sites: updated }
    }

    if (change?.type !== 'save' || typeof change.name !== 'string') return { error: '网站信息无效' }
    const name = change.name.trim()
    const url = normalizeUrl(change.url)
    if (!name) return { error: '请输入网站名称' }
    if (!url) return { error: '请输入以 https:// 开头且不含账号密码的网址' }
    if (change.id !== undefined && !sites.some((site) => site.id === change.id)) return { error: '该网站已不存在' }
    if (sites.some((site) => site.url === url && site.id !== change.id)) return { error: '该网址已添加' }

    const site = { id: change.id ?? randomUUID(), name, url }
    const updated = change.id === undefined ? [...sites, site] : sites.map((item) => item.id === change.id ? site : item)
    await this.persist(updated)
    return { sites: updated, selectedId: change.id === undefined ? site.id : undefined }
  }

  private async persist(sites: Site[]): Promise<void> {
    const destination = this.filePath
    const temporary = `${destination}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(sites, null, 2), { flag: 'wx' })
      await rename(temporary, destination)
      this.sites = Promise.resolve(sites)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }
}

export const siteStore = new SiteStore()
