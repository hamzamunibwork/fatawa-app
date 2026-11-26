// الفتاوى الميسّرة — تطبيق ويندوز وماك (Electron)
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

function wwwDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'www') : path.join(__dirname, 'www');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900, height: 860, minWidth: 360, minHeight: 500,
    title: 'Al-Fatawa Al-Muyassara', backgroundColor: '#F5F3EC', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  // تحميل التلاوة للاستماع بلا إنترنت: يُسمح للصفحة بقراءة ملفات everyayah
  win.webContents.session.webRequest.onHeadersReceived({ urls: ['https://everyayah.com/*'] }, (d, cb) => {
    const h = d.responseHeaders || {};
    Object.keys(h).forEach(k => { if (k.toLowerCase() === 'access-control-allow-origin') delete h[k]; });
    h['Access-Control-Allow-Origin'] = ['*'];
    cb({ responseHeaders: h });
  });
  win.loadFile(path.join(wwwDir(), 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('page-title-updated', e => e.preventDefault());
}

if (process.platform === 'darwin') {
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
} else Menu.setApplicationMenu(null);

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
