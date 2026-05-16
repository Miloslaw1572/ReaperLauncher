// --- ZABEZPIECZENIE PRZED BŁĘDAMI DOSTĘPU DO PLIKÓW (EMFILE) ---
const realFs = require('fs');
const gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(realFs);
// --------------------------------------------------------------

const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth } = require('msmc');
const path = require('path');
const fs = require('fs-extra');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        resizable: false,
        autoHideMenuBar: true,
        title: 'ReaperLauncher',
        icon: path.join(__dirname, 'reaper_logo.png'),
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.on('open-mods-folder', () => {
    const modsPath = path.join(app.getPath('appData'), '.reaperclient', 'mods');
    if (!fs.existsSync(modsPath)) { fs.mkdirSync(modsPath, { recursive: true }); }
    shell.openPath(modsPath);
});

// --- LOGIKA OKNA MICROSOFT ---
ipcMain.on('login-microsoft', async(event) => {
    try {
        const authManager = new Auth("select_account");
        const xboxManager = await authManager.launch("electron");
        const token = await xboxManager.getMinecraft();
        const mclcAuth = token.mclc();

        event.reply('microsoft-login-success', { nick: mclcAuth.name, auth: mclcAuth });
    } catch (err) {
        console.error("Błąd logowania Microsoft:", err);
        event.reply('microsoft-login-error', "Logowanie zostało przerwane przez gracza lub wystąpił błąd.");
    }
});

// --- GŁÓWNA LOGIKA URUCHAMIANIA GRY ---
ipcMain.on('start-game', (event, data) => {

    const account = data.account;
    const username = account.nick;
    const przydzielonyRam = data.ram;
    const launcher = new Client();

    const mainDir = path.join(app.getPath('appData'), '.reaperclient');
    const profileDir = path.join(mainDir, 'profiles', username);

    fs.ensureDirSync(mainDir);
    fs.ensureDirSync(profileDir);

    const basepath = app.isPackaged ? process.resourcesPath : __dirname;
    const extraFiles = path.join(basepath, 'DodatkowePliki');

    if (fs.existsSync(extraFiles)) {
        fs.copySync(extraFiles, mainDir, { overwrite: false });
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
    const screenArea = screen.getPrimaryDisplay().workAreaSize;

    const xaeroMinimapDir = path.join(mainDir, 'XaeroWaypoints').replace(/\\/g, '/');
    const xaeroWorldMapDir = path.join(mainDir, 'XaeroWorldMap').replace(/\\/g, '/');
    fs.ensureDirSync(xaeroMinimapDir);
    fs.ensureDirSync(xaeroWorldMapDir);

    // --- WYBÓR AUTORYZACJI ---
    const waznaAutoryzacja = account.type === 'premium' ? account.auth : Authenticator.getAuth(username);

    let options = {
        authorization: waznaAutoryzacja,
        root: profileDir,
        javaPath: javaPath,
        version: {
            number: "1.21.5",
            type: "release",
            custom: "fabric-loader-0.19.2-1.21.5"
        },
        memory: {
            max: `${przydzielonyRam}G`,
            min: "2G"
        },
        window: {
            width: screenArea.width,
            height: screenArea.height
        },
        customArgs: [
            `-Dxaero.minimap.waypoints=${xaeroMinimapDir}`,
            `-Dxaero.worldmap.dir=${xaeroWorldMapDir}`
        ],
        overrides: {
            path: {
                root: profileDir,
                meta: path.join(mainDir, 'versions'),
                assets: path.join(mainDir, 'assets'),
                library: path.join(mainDir, 'libraries'),
                version: path.join(mainDir, 'versions'),
                mods: path.join(mainDir, 'mods'),
                xaerowaypoints: path.join(mainDir, 'XaeroWaypoints'),
                xaeroworldmap: path.join(mainDir, 'XaeroWorldMap')
            }
        },
        detached: false
    };

    const logStream = fs.createWriteStream(path.join(profileDir, 'launcher_log.txt'), { flags: 'w' });
    launcher.on('data', (e) => logStream.write("[GRA]: " + e + "\n"));
    launcher.on('progress', (e) => event.reply('file-progress', e));
    launcher.on('arguments', () => event.reply('game-started'));

    launcher.on('close', (code) => {
        logStream.end();
        event.reply('game-closed');
    });

    try {
        launcher.launch(options);
    } catch (err) {
        console.error("Błąd krytyczny:", err);
    }
});