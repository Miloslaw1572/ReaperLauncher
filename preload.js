const { contextBridge, ipcRenderer, shell } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        // Dodano: 'get-installed-mods'
        const validChannels = ['open-mods-folder', 'login-microsoft', 'start-game', 'window-minimize', 'window-close', 'get-version', 'open-user-mods-folder', 'download-modrinth', 'get-installed-mods'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        // Dodano: 'installed-mods-list'
        const validChannels = ['microsoft-login-success', 'microsoft-login-error', 'file-progress', 'game-started', 'game-closed', 'update-message', 'set-version', 'update-state', 'launcher-error', 'mod-download-done', 'mod-download-error', 'installed-mods-list'];
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