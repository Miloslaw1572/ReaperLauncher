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

    // Zabezpieczenie: jeśli gracz kliknie guzik zanim gra się w ogóle zainstaluje, tworzymy strukturę na siłę!
    if (!fs.existsSync(modsPath)) {
        fs.mkdirSync(modsPath, { recursive: true });
    }

    shell.openPath(modsPath);
});


ipcMain.on('start-game', (event, data) => {

    // ZMIANA: Teraz odbieramy "paczkę" danych (nick i ram)
    const username = data.username;
    const przydzielonyRam = data.ram;

    const launcher = new Client();
    const folderGry = path.join(app.getPath('appData'), '.reaperclient');

    // --- INTELIGENTNE KOPIOWANIE USTAWIEŃ GRACZA ---
    const oryginalnyMinecraft = path.join(app.getPath('appData'), '.minecraft');
    const plikOpcjiGracza = path.join(oryginalnyMinecraft, 'options.txt');
    const docelowyPlikOpcji = path.join(folderGry, 'options.txt');

    if (!fs.existsSync(docelowyPlikOpcji)) {
        if (fs.existsSync(plikOpcjiGracza)) {
            try {
                fs.copySync(plikOpcjiGracza, docelowyPlikOpcji);
                console.log("Pomyślnie zaimportowano stare ustawienia gracza z .minecraft!");
            } catch (err) {
                console.error("Nie udało się skopiować opcji: ", err);
            }
        }
    }

    // --- KOPIOWANIE DODATKOWYCH PLIKÓW ---
    const basepath = app.isPackaged ? process.resourcesPath : __dirname;
    const sciezkaDodatkoweWProjekcie = path.join(basepath, 'DodatkowePliki');

    try {
        if (fs.existsSync(sciezkaDodatkoweWProjekcie)) {
            fs.copySync(sciezkaDodatkoweWProjekcie, folderGry, { overwrite: false });
            console.log("Dodatkowe pliki i konfiguracje zostały skopiowane.");
        } else {
            console.error("Folder DodatkowePliki nie został znaleziony!");
        }
    } catch (err) {
        console.error("Wystąpił błąd podczas kopiowania plików: ", err);
    }

    // --- WSTRZYKIWANIE DOMYŚLNYCH KEYBINDÓW Z MODÓW ---
    const plikOpcjiWGrze = path.join(folderGry, 'options.txt');

    if (fs.existsSync(plikOpcjiWGrze)) {
        try {
            let opcjeTekst = fs.readFileSync(plikOpcjiWGrze, 'utf8');
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
                fs.writeFileSync(plikOpcjiWGrze, opcjeTekst, 'utf8');
                console.log("Wstrzyknięto brakujące keybindy z modów do options.txt!");
            }

        } catch (err) { console.error("Błąd podczas wstrzykiwania keybindów: ", err); }
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
            max: `${przydzielonyRam}G`, // ZMIANA: Dynamiczny RAM z ustawień Frontendu!
            min: "2G"
        },
        window: { width: 854, height: 480 },
        detached: false
    };

    // --- CZARNA SKRZYNKA (LOGI DLA KAŻDEGO KONTA OSOBNO) ---
    const plikLogow = path.join(folderGry, `launcher_crash_log_${username}.txt`);
    const logStream = fs.createWriteStream(plikLogow, { flags: 'w' });
    logStream.write(`=== ROZPOCZĘCIE URUCHAMIANIA KONTA: ${username} | PRZYDZIELONY RAM: ${przydzielonyRam}GB ===\n`);

    launcher.on('data', (e) => logStream.write("[GRA]: " + e + "\n"));
    launcher.on('error', (e) => logStream.write("[BŁĄD KRYTYCZNY]: " + e + "\n"));

    launcher.on('progress', (e) => event.reply('file-progress', e));
    launcher.on('arguments', () => event.reply('game-started'));

    launcher.on('close', (code) => {
        logStream.write("[KOD WYJŚCIA]: " + code + "\n");
        logStream.end();
        event.reply('game-closed');
    });

    // --- START GRY ---
    try {
        launcher.launch(opcje);
    } catch (err) {
        console.error(`Krytyczny błąd launchera dla konta ${username}:`, err);
    }
});