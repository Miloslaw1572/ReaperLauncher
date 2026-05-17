const realFs = require('fs');
const gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(realFs);

const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth } = require('msmc');
const path = require('path');
const fs = require('fs-extra');
const { autoUpdater } = require('electron-updater');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 755,
        resizable: false,
        autoHideMenuBar: true,
        frame: false,
        title: 'ReaperLauncher',
        icon: path.join(__dirname, 'reaper_logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('set-version', app.getVersion());
    });

}

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(createWindow);

// --- SYSTEM AUTO-AKTUALIZACJI ---
app.whenReady().then(() => {
    // Rozpocznij sprawdzanie aktualizacji po odpaleniu okna
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
    }, 2000); // 2 sekundy opóźnienia, żeby okno zdążyło się wczytać
});

autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('update-message', 'Sprawdzanie dostępności aktualizacji...');
});

autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-message', 'Znaleziono nową wersję! Przygotowywanie...');
});

autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-message', 'Masz najnowszą wersję launchera.');
});

autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update-message', 'System aktualizacji działa tylko na skompilowanej wersji.');
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Pobieranie aktualizacji: ' + Math.round(progressObj.percent) + '%';
    if (mainWindow) mainWindow.webContents.send('update-message', log_message);
});

autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-message', 'Aktualizacja pobrana! Restartowanie w 3 sekundy...');
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 3000);
});

// --- OBSŁUGA WŁASNEGO PASKA TYTUŁOWEGO ---
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });

ipcMain.on('open-mods-folder', () => {
    const modsPath = path.join(app.getPath('appData'), '.reaperclient', 'mods');
    if (!fs.existsSync(modsPath)) { fs.mkdirSync(modsPath, { recursive: true }); }
    shell.openPath(modsPath);
});

ipcMain.on('login-microsoft', async(event) => {
    try {
        const authManager = new Auth("select_account");
        const xboxManager = await authManager.launch("electron");
        const token = await xboxManager.getMinecraft();
        const mclcAuth = token.mclc();
        event.reply('microsoft-login-success', { nick: mclcAuth.name, auth: mclcAuth });
    } catch (err) {
        event.reply('microsoft-login-error', "Logowanie zostało przerwane przez gracza lub wystąpił błąd.");
    }
});

function bezpieczneKopiowanieScentralizowane(src, dest) {
    if (!fs.existsSync(src)) return;
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
        fs.ensureDirSync(dest);
        const items = fs.readdirSync(src);
        for (const item of items) {
            bezpieczneKopiowanieScentralizowane(path.join(src, item), path.join(dest, item));
        }
    } else {
        const czyPlikXaero = dest.toLowerCase().includes('xaero');
        if (czyPlikXaero) {
            if (!fs.existsSync(dest)) {
                try { fs.copySync(src, dest); } catch (e) {}
            }
        } else {
            try { fs.copySync(src, dest, { overwrite: true }); } catch (e) {}
        }
    }
}

function utworzWirtualnyFolder(glowny, profilowy) {
    fs.ensureDirSync(glowny);
    try {
        const stat = fs.lstatSync(profilowy);
        if (stat.isSymbolicLink()) {
            fs.unlinkSync(profilowy);
        } else {
            fs.rmSync(profilowy, { recursive: true, force: true });
        }
    } catch (err) {}

    try {
        fs.symlinkSync(glowny, profilowy, 'junction');
    } catch (err) { console.error(err); }
}

ipcMain.on('start-game', async(event, data) => {
    try {
        if (!data || !data.account || !data.account.nick) {
            event.reply('game-closed');
            return;
        }

        const username = String(data.account.nick).trim();
        const przydzielonyRam = data.ram;
        const launcher = new Client();

        const mainDir = path.join(app.getPath('appData'), '.reaperclient');
        const profileDir = path.join(mainDir, 'profiles', username);

        fs.ensureDirSync(mainDir);
        fs.ensureDirSync(profileDir);

        const basepath = app.isPackaged ? process.resourcesPath : __dirname;
        const extraFiles = path.join(basepath, 'DodatkowePliki');

        if (fs.existsSync(extraFiles)) {
            bezpieczneKopiowanieScentralizowane(extraFiles, mainDir);
        }

        const folderyWspoldzielone = [
            'assets', 'libraries', 'versions', 'mods', 'xaero',
            'config', 'shaderpacks', 'resourcepacks', 'defaultconfigs'
        ];

        for (const folder of folderyWspoldzielone) {
            utworzWirtualnyFolder(path.join(mainDir, folder), path.join(profileDir, folder));
        }

        const serversDatGlowny = path.join(mainDir, 'servers.dat');
        const serversDatProfil = path.join(profileDir, 'servers.dat');
        if (fs.existsSync(serversDatGlowny) && !fs.existsSync(serversDatProfil)) {
            try { fs.copySync(serversDatGlowny, serversDatProfil); } catch (e) {}
        }

        const profileOptions = path.join(profileDir, 'options.txt');
        if (!fs.existsSync(profileOptions)) {
            const oryginalnyMC = path.join(app.getPath('appData'), '.minecraft', 'options.txt');
            const domyslneZLaunchera = path.join(mainDir, 'options.txt');

            if (fs.existsSync(oryginalnyMC)) {
                try { fs.copySync(oryginalnyMC, profileOptions); } catch (e) {}
            } else if (fs.existsSync(domyslneZLaunchera)) {
                try { fs.copySync(domyslneZLaunchera, profileOptions); } catch (e) {}
            }
        }

        if (fs.existsSync(profileOptions)) {
            try {
                let txt = fs.readFileSync(profileOptions, 'utf8');
                let changed = false;
                const binds = ["key_Start/Stop Rollowanie:key.keyboard.apostrophe", "key_Toggle Freelook:key.keyboard.left.alt", "menuBackgroundBlurriness:0"];
                binds.forEach(b => {
                    const keyName = b.split(':')[0] + ':';
                    if (!txt.includes(keyName)) {
                        if (!txt.endsWith('\n')) txt += '\n';
                        txt += b + '\n';
                        changed = true;
                    }
                });
                if (changed) fs.writeFileSync(profileOptions, txt, 'utf8');
            } catch (err) {}
        }

        const javaPath = path.join(mainDir, 'java', 'bin', 'javaw.exe');
        if (!fs.existsSync(javaPath)) {
            fs.writeFileSync(path.join(profileDir, 'launcher_log.txt'), "KRYTYCZNY BŁĄD: Brak plików Java!\n");
            event.reply('game-closed');
            return;
        }

        const screenArea = screen.getPrimaryDisplay().workAreaSize;

        let waznaAutoryzacja;
        if (data.account.type === 'premium') {
            waznaAutoryzacja = data.account.auth;
        } else {
            const tempAuth = Authenticator.getAuth(username);
            waznaAutoryzacja = tempAuth instanceof Promise ? await tempAuth : tempAuth;
        }

        let options = {
            authorization: waznaAutoryzacja,
            root: profileDir,
            javaPath: javaPath,
            version: { number: "1.21.5", type: "release", custom: "fabric-loader-0.19.2-1.21.5" },
            memory: { max: `${przydzielonyRam}G`, min: "2G" },
            window: { width: screenArea.width, height: screenArea.height },
            detached: false
        };

        const logStream = fs.createWriteStream(path.join(profileDir, 'launcher_log.txt'), { flags: 'w' });

        launcher.on('data', (e) => logStream.write("[GRA]: " + e + "\n"));
        launcher.on('progress', (e) => event.reply('file-progress', e));
        launcher.on('arguments', () => event.reply('game-started'));
        launcher.on('error', (e) => { event.reply('game-closed'); });
        launcher.on('close', (code) => {
            event.reply('game-closed');
            logStream.end();
        });

        launcher.launch(options).catch(err => { event.reply('game-closed'); });

    } catch (fatalErr) {
        event.reply('game-closed');
    }
});