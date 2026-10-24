'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ajdIntro', Object.freeze({
  finish: (remember) => {
    if (location.protocol === 'file:') ipcRenderer.send('ajd:intro-done', remember === true);
  }
}));
