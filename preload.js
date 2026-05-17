const { contextBridge, ipcRenderer, shell } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        const validChannels = ['open-mods-folder', 'login-microsoft', 'start-game', 'window-minimize', 'window-close'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        // ZMIANA: Dodano 'set-version' do listy
        const validChannels = ['microsoft-login-success', 'microsoft-login-error', 'file-progress', 'game-started', 'game-closed', 'update-message', 'set-version'];
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