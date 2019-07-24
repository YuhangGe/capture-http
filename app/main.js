/* eslint-env node */
const electron = require('electron');
// Module to control application life.
const app = electron.app;
const Menu = electron.Menu;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');
const isDevMode = process.env.NODE_ENV === 'development';
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;

function createWindow() {
  // Create the browser window.
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    width: width * 0.7 | 0,
    height: height * 0.8 | 0
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, isDevMode ? '../.tmp' : '', 'index.html'),
    protocol: 'file:',
    slashes: true,
    icon: path.join(__dirname, isDevMode ? '../assets' : 'assets', 'icons/png/64x64.png')
  }));

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

app.on('ready', function() {
  initialize();
  createMenu();
});
app.on('window-all-closed', function() {
  app.quit();
});

function initialize() {
  if (mainWindow === null) {
    createWindow();
  }
}

function createMenu() {
  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.
  const template = [];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'quit' }
      ]
    }, {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    });
  }

  if (isDevMode) {
    template.push({
      label: 'Development',
      submenu: [{
        role: 'toggledevtools'
      }, {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click() {
          mainWindow.reload();
        }
      }]
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
