"use strict";
const {app, BrowserWindow, shell, session} = require("electron");

const APP_URL = "https://repair.ajdapp.org/";
const ORIGIN = new URL(APP_URL).origin;
let mainWindow;

function allowHostedURL(raw) {
  try {const url = new URL(raw);return url.protocol === "https:" && url.origin === ORIGIN;} catch (_) {return false;}
}
function openSafeExternal(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol === "https:" || u.protocol === "mailto:" || u.protocol === "tel:") {
      shell.openExternal(u.href).catch(() => {});
    }
  } catch (_) {}
}

function buildWindow() {
  const win = new BrowserWindow({
    title: "AJD's Wireless Repairs",
    width: 1280, height: 860, minWidth: 840, minHeight: 650,
    backgroundColor: "#0b1220",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  mainWindow = win;
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({url}) => {
    // Open all new windows in a normal browser, not a privileged shell.
    openSafeExternal(url);
    return {action: "deny"};
  });
  win.webContents.on("will-navigate", (event,url) => {
    if (allowHostedURL(url)) return;
    event.preventDefault();
    openSafeExternal(url);
  });
  win.webContents.on("will-redirect", (event,url) => {
    if (allowHostedURL(url)) return;
    event.preventDefault();
    openSafeExternal(url);
  });
  win.webContents.on("did-finish-load", () => {
    if (!allowHostedURL(win.webContents.getURL())) return;
    // Hide browser/PWA install promotion inside an already installed desktop app.
    win.webContents.insertCSS('[data-admin-install-button], #install-app-shortcut { display:none!important; }')
      .catch(() => {});
  });
  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  const trusted = (raw) => {
    try {return new URL(raw).origin === ORIGIN;} catch (_) {return false;}
  };
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => {
    return trusted(origin) && ["notifications","fullscreen","media"].includes(permission);
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const requestingURL = (details && details.requestingUrl) || wc.getURL();
    const okay = trusted(requestingURL) && (
      permission === "notifications" || permission === "fullscreen" ||
      (permission === "media" && (!details || !details.mediaTypes || !details.mediaTypes.includes("audio")))
    );
    callback(okay);
  });
  buildWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) buildWindow();
  });
});
app.on("window-all-closed", () => {if (process.platform !== "darwin") app.quit();});
