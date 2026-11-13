const { app, BrowserWindow, Menu, session, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 950,
    backgroundColor: '#0b1220',
    title: 'EMS-SCADA Dashboard',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  // Allow the dashboard (file://) to fetch from Modbus/SCADA gateways on the LAN
  // without CORS errors.
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const headers = { ...details.responseHeaders };
    Object.keys(headers).forEach(k => {
      if (k.toLowerCase().startsWith('access-control-')) delete headers[k];
    });
    headers['Access-Control-Allow-Origin'] = ['*'];
    headers['Access-Control-Allow-Headers'] = ['*'];
    headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, OPTIONS'];
    cb({ responseHeaders: headers });
  });

  // Open external links in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => app.quit());
