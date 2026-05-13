// --- BRAMKARZ DLA PLIKÓW (NAPRAWA BŁĘDU EMFILE) ---
const realFs = require('fs');
const gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(realFs);
// --------------------------------------------------

const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const { Client, Authenticator } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs-extra');

let mainWindow;
let runningGamesCount = 0;

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

// --- OTWIERANIE GŁÓWNEGO FOLDERU MODÓW ---
ipcMain.on('open-mods-folder', () => {
    const modsPath = path.join(app.getPath('appData'), '.reaperclient', 'mods');
    if (!fs.existsSync(modsPath)) { fs.mkdirSync(modsPath, { recursive: true }); }
    shell.openPath(modsPath);
});

ipcMain.on('start-game', (event, data) => {
    const username = data.username;
    const przydzielonyRam = data.ram;
    const launcher = new Client();

    const mainDir = path.join(app.getPath('appData'), '.reaperclient');
    const profileDir = path.join(mainDir, 'profiles', username);
    fs.ensureDirSync(profileDir);

    // --- SYNCHRONIZACJA MODÓW ---
    const mainMods = path.join(mainDir, 'mods');
    const profileMods = path.join(profileDir, 'mods');
    if (fs.existsSync(mainMods)) {
        fs.copySync(mainMods, profileMods, { overwrite: true });
    }

    // --- LOGIKA "PIERWSZEGO URUCHOMIENIA" USTAWIEŃ ---
    const profileOptions = path.join(profileDir, 'options.txt');
    const mialJuzOpcje = fs.existsSync(profileOptions); // Sprawdzamy, czy to pierwszy raz

    const basepath = app.isPackaged ? process.resourcesPath : __dirname;
    const extraFiles = path.join(basepath, 'DodatkowePliki');

    // Kopiujemy paczkę "DodatkowePliki" (nie nadpisując tego co gracz już ma)
    if (fs.existsSync(extraFiles)) {
        fs.copySync(extraFiles, profileDir, { overwrite: false });
    }

    // Jeśli gracz odpala profil PIERWSZY RAZ:
    if (!mialJuzOpcje) {
        const oryginalnyMinecraft = path.join(app.getPath('appData'), '.minecraft');
        const plikOpcjiZMC = path.join(oryginalnyMinecraft, 'options.txt');

        // Priorytet 1: Ustawienia z oryginalnego .minecraft (jeśli istnieją)
        if (fs.existsSync(plikOpcjiZMC)) {
            try {
                fs.copySync(plikOpcjiZMC, profileOptions, { overwrite: true });
                console.log(`[PIERWSZE URUCHOMIENIE] Skopiowano ustawienia z .minecraft dla: ${username}`);
            } catch (err) { console.error(err); }
        } else {
            // Priorytet 2: Zostawiamy ustawienia z DodatkowePliki
            console.log(`[PIERWSZE URUCHOMIENIE] Brak .minecraft, użyto konfiguracji z DodatkowePliki dla: ${username}`);
        }
    } else {
        console.log(`[KOLEJNE URUCHOMIENIE] Użyto zapisanych ustawień gracza dla: ${username}`);
    }

    // --- WSTRZYKIWANIE KEYBINDÓW ---
    if (fs.existsSync(profileOptions)) {
        try {
            let txt = fs.readFileSync(profileOptions, 'utf8');
            let changed = false;
            const binds = ["key_Start/Stop Rollowanie:key.keyboard.apostrophe", "key_Toggle Freelook:key.keyboard.left.alt"];
            binds.forEach(b => {
                const key = b.split(':')[0] + ':';
                if (!txt.includes(key)) {
                    if (!txt.endsWith('\n')) txt += '\n';
                    txt += b + '\n';
                    changed = true;
                }
            });
            if (changed) fs.writeFileSync(profileOptions, txt, 'utf8');
        } catch (err) {}
    }

    // --- OPCJE URUCHAMIANIA ---
    const javaPath = path.join(mainDir, 'java', 'bin', 'javaw.exe');
    const screenArea = screen.getPrimaryDisplay().workAreaSize;

    let opcje = {
        authorization: Authenticator.getAuth(username),
        root: profileDir,
        javaPath: javaPath,
        version: {
            number: "1.21.5",
            type: "release",
            custom: "fabric-loader-0.19.2-1.21.5"
        },
        memory: { max: `${przydzielonyRam}G`, min: "2G" },
        window: { width: screenArea.width, height: screenArea.height },
        overrides: {
            path: {
                root: profileDir,
                meta: path.join(mainDir, 'versions'),
                assets: path.join(mainDir, 'assets'),
                library: path.join(mainDir, 'libraries'),
                version: path.join(mainDir, 'versions')
            }
        },
        detached: false
    };

    // --- LOGI I START ---
    const logFile = path.join(profileDir, `launcher_log.txt`);
    const logStream = fs.createWriteStream(logFile, { flags: 'w' });

    launcher.on('data', (e) => logStream.write("[GRA]: " + e + "\n"));
    launcher.on('progress', (e) => event.reply('file-progress', e));
    launcher.on('arguments', () => event.reply('game-started'));

    launcher.on('close', (code) => {
        logStream.write("[KOD WYJŚCIA]: " + code + "\n");
        logStream.end();
        event.reply('game-closed');
    });

    try { launcher.launch(opcje); } catch (err) { console.error(err); }
});