import { Menu, Tray, nativeImage } from 'electron'

const FALLBACK_ICON =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export interface TrayActions {
  openSettings(): void
  unlockCards(): void
  togglePet(): void
  quit(): void
}

export class AppTray {
  private tray: Tray | null = null
  private petVisible = true

  constructor(
    private readonly iconPath: string,
    private readonly actions: TrayActions
  ) {}

  create(): void {
    if (this.tray) {
      return
    }

    const image = nativeImage.createFromPath(this.iconPath)
    const icon = image.isEmpty()
      ? nativeImage.createFromBuffer(Buffer.from(FALLBACK_ICON, 'base64'))
      : image

    this.tray = new Tray(icon)
    this.tray.setToolTip('花伴')
    this.tray.setContextMenu(this.buildMenu())
    this.tray.on('double-click', () => this.actions.openSettings())
  }

  setPetVisible(visible: boolean): void {
    this.petVisible = visible
    this.tray?.setContextMenu(this.buildMenu())
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  private buildMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: this.petVisible ? '隐藏桌宠' : '显示桌宠',
        click: () => this.actions.togglePet()
      },
      { label: '打开设置', click: () => this.actions.openSettings() },
      { label: '解锁全部桌面卡片', click: () => this.actions.unlockCards() },
      { type: 'separator' },
      { label: '退出 花伴', click: () => this.actions.quit() }
    ])
  }
}
