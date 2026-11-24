import { app } from 'electron'

class Lifecycle {
  private quitting = false

  isQuitting(): boolean {
    return this.quitting
  }

  markQuitting(): void {
    this.quitting = true
  }

  quit(): void {
    this.quitting = true
    app.quit()
  }
}

export const lifecycle = new Lifecycle()
