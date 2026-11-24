import type { ToolManifest } from '@shared/types'

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

  search(query: string): ToolManifest[] {
    const q = query.toLowerCase().trim()
    if (!q) return this.getAll()
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.keywords?.some((k) => k.toLowerCase().includes(q))
    )
  }
}

export const toolRegistry = new ToolRegistry()
