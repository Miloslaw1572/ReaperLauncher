const { contextBridge, ipcRenderer, shell } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        const validChannels = ['open-mods-folder', 'login-microsoft', 'start-game', 'window-minimize', 'window-close', 'get-version'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        // ZMIANA: Dodano 'update-state' oraz 'launcher-error'
        const validChannels = ['microsoft-login-success', 'microsoft-login-error', 'file-progress', 'game-started', 'game-closed', 'update-message', 'set-version', 'update-state', 'launcher-error'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    getTotalMemory: () => {
        return os.totalmem();
    },
    openLink: (url) => {
        shell.openExternal(url);
    }
});