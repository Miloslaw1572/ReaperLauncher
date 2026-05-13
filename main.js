// --- BRAMKARZ DLA PLIKÓW (NAPRAWA BŁĘDU EMFILE) ---
const realFs = require('fs');
const gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(realFs);
// --------------------------------------------------

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { Client, Authenticator } = require('minecraft-launcher-core');
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
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// --- OTWIERANIE FOLDERU MODÓW ---
ipcMain.on('open-mods-folder', () => {
    const modsPath = path.join(app.getPath('appData'), '.reaperclient', 'mods');
    if (!fs.existsSync(modsPath)) { fs.mkdirSync(modsPath, { recursive: true }); }
    shell.openPath(modsPath);
});


ipcMain.on('start-game', (event, data) => {

    const username = data.username;
    const przydzielonyRam = data.ram;

    const launcher = new Client();
    const folderGry = path.join(app.getPath('appData'), '.reaperclient');

    // --- SYSTEM ZARZĄDZANIA PROFILAMI (options.txt) ---
    const oryginalnyMinecraft = path.join(app.getPath('appData'), '.minecraft');
    const plikOpcjiGracza = path.join(oryginalnyMinecraft, 'options.txt');
    const docelowyPlikOpcji = path.join(folderGry, 'options.txt');
    const plikOpcjiProfilu = path.join(folderGry, `options_${username}.txt`); // Plik docelowy dla danego nicku

    // KROK 1: Przed uruchomieniem wgrywamy ustawienia tego konkretnego gracza
    if (fs.existsSync(plikOpcjiProfilu)) {
        try {
            fs.copySync(plikOpcjiProfilu, docelowyPlikOpcji);
            console.log(`Załadowano osobiste ustawienia dla profilu: ${username}`);
        } catch (err) { console.error("Błąd ładowania opcji: ", err); }
    } else {
        // Jeśli ten gracz nie ma jeszcze swojego pliku opcji, sprawdzamy czy stary MC go miał
        if (!fs.existsSync(docelowyPlikOpcji) && fs.existsSync(plikOpcjiGracza)) {
            try {
                fs.copySync(plikOpcjiGracza, docelowyPlikOpcji);
                console.log("Zaimportowano bazowe opcje z .minecraft");
            } catch (err) { console.error(err); }
        }
    }
    // ----------------------------------------------------

    // --- KOPIOWANIE DODATKOWYCH PLIKÓW ---
    const basepath = app.isPackaged ? process.resourcesPath : __dirname;
    const sciezkaDodatkoweWProjekcie = path.join(basepath, 'DodatkowePliki');

    try {
        if (fs.existsSync(sciezkaDodatkoweWProjekcie)) {
            fs.copySync(sciezkaDodatkoweWProjekcie, folderGry, { overwrite: false });
        }
    } catch (err) {}

    // --- WSTRZYKIWANIE DOMYŚLNYCH KEYBINDÓW Z MODÓW ---
    if (fs.existsSync(docelowyPlikOpcji)) {
        try {
            let opcjeTekst = fs.readFileSync(docelowyPlikOpcji, 'utf8');
            let czyZaktualizowano = false;
            const domyslneKlawisze = [
                "key_Start/Stop Rollowanie:key.keyboard.apostrophe",
                "key_Toggle Freelook:key.keyboard.left.alt"
            ];

            domyslneKlawisze.forEach(linijka => {
                const nazwaKlawisza = linijka.split(':')[0] + ':';
                if (!opcjeTekst.includes(nazwaKlawisza)) {
                    if (!opcjeTekst.endsWith('\n')) { opcjeTekst += '\n'; }
                    opcjeTekst += linijka + '\n';
                    czyZaktualizowano = true;
                }
            });

            if (czyZaktualizowano) {
                fs.writeFileSync(docelowyPlikOpcji, opcjeTekst, 'utf8');
            }
        } catch (err) {}
    }

    // --- OPCJE URUCHAMIANIA ---
    const sciezkaDoJavy = path.join(folderGry, 'java', 'bin', 'javaw.exe');

    let opcje = {
        authorization: Authenticator.getAuth(username),
        root: folderGry,
        javaPath: sciezkaDoJavy,
        version: {
            number: "1.21.5",
            type: "release",
            custom: "fabric-loader-0.19.2-1.21.5"
        },
        memory: {
            max: `${przydzielonyRam}G`,
            min: "2G"
        },
        window: { width: 854, height: 480 },
        detached: false
    };

    // --- CZARNA SKRZYNKA ---
    const plikLogow = path.join(folderGry, `launcher_crash_log_${username}.txt`);
    const logStream = fs.createWriteStream(plikLogow, { flags: 'w' });
    logStream.write(`=== URUCHAMIANIE KONTA: ${username} | PRZYDZIELONY RAM: ${przydzielonyRam}GB ===\n`);

    launcher.on('data', (e) => logStream.write("[GRA]: " + e + "\n"));
    launcher.on('error', (e) => logStream.write("[BŁĄD KRYTYCZNY]: " + e + "\n"));

    launcher.on('progress', (e) => event.reply('file-progress', e));
    launcher.on('arguments', () => event.reply('game-started'));

    launcher.on('close', (code) => {
        // KROK 2: Po zamknięciu gry, zapisujemy aktualny options.txt jako profil gracza
        try {
            if (fs.existsSync(docelowyPlikOpcji)) {
                fs.copySync(docelowyPlikOpcji, plikOpcjiProfilu);
                console.log(`Zapisano zmiany w ustawieniach dla profilu: ${username}`);
            }
        } catch (err) { console.error("Błąd zapisu profilu:", err); }

        logStream.write("[KOD WYJŚCIA]: " + code + "\n");
        logStream.end();
        event.reply('game-closed');
    });

    try { launcher.launch(opcje); } catch (err) { console.error(err); }
});