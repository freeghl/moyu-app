const { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen } = require('electron');
const path = require('path');

let mainWindow;
let isBossMode = true;
let cursorTimer = null;

// 老板模式下轮询系统光标位置。
// webview 是独立进程，鼠标进入后宿主页面收不到 mousemove，
// 因此用 OS 级光标坐标来可靠判断"悬停 / 移开"。
function startCursorTracking() {
  if (cursorTimer) return;
  cursorTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isMinimized() || !mainWindow.isVisible()) return;
    const b = mainWindow.getContentBounds();
    const p = screen.getCursorScreenPoint();
    mainWindow.webContents.send('cursor-pos', { x: p.x - b.x, y: p.y - b.y });
  }, 45);
}

function stopCursorTracking() {
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
}

// 默认摸鱼站点列表
const DEFAULT_SITES = [
  { name: 'Twitter / X', url: 'https://x.com', icon: '🐦' },
  { name: 'TikTok', url: 'https://www.tiktok.com', icon: '🎵' },
  { name: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
  { name: 'Reddit', url: 'https://www.reddit.com', icon: '🤖' },
  { name: 'Instagram', url: 'https://www.instagram.com', icon: '📷' },
  { name: 'Bilibili', url: 'https://www.bilibili.com', icon: '📺' },
  { name: '微博', url: 'https://weibo.com', icon: '🔥' },
  { name: '知乎', url: 'https://www.zhihu.com', icon: '💡' },
];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Visual Studio Code',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
    frame: false,
    titleBarStyle: 'hidden',
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    stopCursorTracking();
    mainWindow = null;
  });

  mainWindow.setTitle(isBossMode ? 'Visual Studio Code - main.py' : 'Visual Studio Code');
}

function registerShortcuts() {
  // Alt+Q: 切换老板模式
  globalShortcut.register('Alt+Q', () => {
    if (mainWindow) {
      isBossMode = !isBossMode;
      mainWindow.webContents.send('toggle-boss-mode', isBossMode);
      mainWindow.setTitle(isBossMode ? 'Visual Studio Code - main.py' : 'Visual Studio Code');
      if (isBossMode) startCursorTracking();
      else stopCursorTracking();
    }
  });

  // Alt+W: 快速最小化
  globalShortcut.register('Alt+W', () => {
    if (mainWindow) mainWindow.minimize();
  });

  // Alt+H: 隐藏窗口
  globalShortcut.register('Alt+H', () => {
    if (mainWindow) mainWindow.hide();
  });

  // Alt+S: 重新显示
  globalShortcut.register('Alt+S', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// IPC 通信
ipcMain.handle('get-default-sites', () => DEFAULT_SITES);
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window-close', () => mainWindow?.close());

// App 生命周期
app.whenReady().then(() => {
  createWindow();
  registerShortcuts();
  if (isBossMode) startCursorTracking();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  stopCursorTracking();
  globalShortcut.unregisterAll();
});
