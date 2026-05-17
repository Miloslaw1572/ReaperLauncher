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

// --- ZABEZPIECZENIE: BLOKADA WIELOKROTNEGO URUCHOMIENIA LAUNCHERA ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // Jeśli launcher już działa, natychmiast ubijamy ten drugi proces
    app.quit();
    process.exit(0);
}

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

// Jeśli ktoś próbuje otworzyć drugi launcher, po prostu wysuńmy ten pierwszy na wierzch
app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

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

// --- INTELIGENTNY SILNIK GŁĘBOKIEGO KOPIOWANIA PACZKI ---
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

// --- FUNKCJA TWORZĄCA BEZPIECZNE TUNELE (JUNCTIONS) ---
function utworzWirtualnyFolder(glowny, profilowy) {
    fs.ensureDirSync(glowny);
    try {
        fs.lstatSync(profilowy);
        fs.removeSync(profilowy);
    } catch (err) {}

    try {
        fs.symlinkSync(glowny, profilowy, 'junction');
        console.log(`[Junction] Połączono folder: ${profilowy}`);
    } catch (err) {
        console.error(`Nie udało się utworzyć tunelu dla ${profilowy}:`, err);
    }
}

// --- GŁÓWNA LOGIKA URUCHAMIANIA GRY ---
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

        // 1. Głębokie kopiowanie Twoich plików
        const basepath = app.isPackaged ? process.resourcesPath : __dirname;
        const extraFiles = path.join(basepath, 'DodatkowePliki');

        if (fs.existsSync(extraFiles)) {
            bezpieczneKopiowanieScentralizowane(extraFiles, mainDir);
        }

        // 2. Tworzenie wirtualnych folderów dla profilu
        const folderyWspoldzielone = [
            'assets', 'libraries', 'versions', 'mods',
            'xaero',
            'config', 'shaderpacks', 'resourcepacks', 'defaultconfigs'
        ];

        for (const folder of folderyWspoldzielone) {
            utworzWirtualnyFolder(path.join(mainDir, folder), path.join(profileDir, folder));
        }

        // Kopiowanie listy serwerów
        const serversDatGlowny = path.join(mainDir, 'servers.dat');
        const serversDatProfil = path.join(profileDir, 'servers.dat');
        if (fs.existsSync(serversDatGlowny) && !fs.existsSync(serversDatProfil)) {
            try { fs.copySync(serversDatGlowny, serversDatProfil); } catch (e) {}
        }

        // Ustawienia Gracza (options.txt)
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

        // Java
        const javaPath = path.join(mainDir, 'java', 'bin', 'javaw.exe');
        if (!fs.existsSync(javaPath)) {
            console.error("BŁĄD: Nie znaleziono Javy w ścieżce: " + javaPath);
            fs.writeFileSync(path.join(profileDir, 'launcher_log.txt'), "KRYTYCZNY BŁĄD: Brak plików Java!\n");
            event.reply('game-closed');
            return;
        }

        const screenArea = screen.getPrimaryDisplay().workAreaSize;

        // Autoryzacja
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
            detached: false
        };

        const logStream = fs.createWriteStream(path.join(profileDir, 'launcher_log.txt'), { flags: 'w' });
        logStream.write(`=== START PROFILU: ${username} | RAM: ${przydzielonyRam}GB ===\n`);

        launcher.on('data', (e) => logStream.write("[GRA]: " + e + "\n"));
        launcher.on('progress', (e) => event.reply('file-progress', e));
        launcher.on('arguments', () => event.reply('game-started'));

        launcher.on('error', (e) => {
            logStream.write("[BŁĄD LAUNCHERA]: " + e + "\n");
            console.error("Błąd silnika:", e);
            event.reply('game-closed');
        });

        launcher.on('close', (code) => {
            logStream.write(`\n=== ZAMKNIĘTO GRĘ (Kod wyjścia: ${code}) ===`);
            logStream.end();
            event.reply('game-closed');
        });

        launcher.launch(options).catch(err => {
            logStream.write("[BŁĄD KRYTYCZNY URUCHAMIANIA]: " + err + "\n");
            console.error("Błąd launch:", err);
            event.reply('game-closed');
        });

    } catch (fatalErr) {
        console.error("KRYTYCZNY BŁĄD PROCESU:", fatalErr);
        event.reply('game-closed');
    }
});