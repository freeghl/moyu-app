import { categoryName } from '@shared/categories'
import type { ToolManifest } from '@shared/types'

/** 单条工具的匹配得分，0 表示不匹配 */
function score(tool: ToolManifest, query: string): number {
  const name = tool.name.toLowerCase()
  const id = tool.id.toLowerCase()
  const description = tool.description.toLowerCase()
  const category = categoryName(tool.category).toLowerCase()

  if (name === query) return 120
  if (name.startsWith(query)) return 100
  if (name.includes(query)) return 80
  if (id.includes(query)) return 60
  if (tool.keywords?.some((keyword) => keyword.toLowerCase().includes(query))) return 55
  if (category.includes(query)) return 40
  if (description.includes(query)) return 20
  return 0
}

class ToolRegistry {
  private tools = new Map<string, ToolManifest>()

  constructor() {
    this.discoverTools()
  }

  private discoverTools(): void {
    const modules = import.meta.glob<{ default?: ToolManifest; manifest?: ToolManifest }>(
      '../tools/**/manifest.ts',
      { eager: true }
    )

    for (const path in modules) {
      const mod = modules[path]
      const manifest = mod.default || mod.manifest
      if (manifest && manifest.id) {
        this.register(manifest)
      }
    }
  }

  register(manifest: ToolManifest): void {
    this.tools.set(manifest.id, manifest)
  }

  get(id: string): ToolManifest | undefined {
    return this.tools.get(id)
  }

  getAll(): ToolManifest[] {
    return Array.from(this.tools.values())
  }

  getByCategory(category: string): ToolManifest[] {
    return this.getAll().filter((t) => t.category === category)
  }

  /** 按相关性排序；recent 中的工具优先，其次是最近用过的 */
  search(query: string, recent: readonly string[] = []): ToolManifest[] {
    const q = query.toLowerCase().trim()
    if (!q) return this.getAll()

    return this.getAll()
      .map((tool) => {
        const base = score(tool, q)
        if (!base) return { tool, total: 0 }
        const recentIndex = recent.indexOf(tool.id)
        const boost = recentIndex === -1 ? 0 : Math.max(0, 10 - recentIndex)
        return { tool, total: base + boost }
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.tool.name.localeCompare(b.tool.name))
      .map((item) => item.tool)
  }
}

export const toolRegistry = new ToolRegistry()
