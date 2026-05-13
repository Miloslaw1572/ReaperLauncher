const { ipcRenderer } = require('electron');
const os = require('os');

// --- POBIERANIE ELEMENTÓW ---
const btnEmptyAddAccount = document.getElementById('btnEmptyAddAccount');
const accountSelectorContainer = document.getElementById('accountSelectorContainer');
const customSelectToggle = document.getElementById('customSelectToggle');
const selectedAccountName = document.getElementById('selectedAccountName');
const customDropdown = document.getElementById('customDropdown');
const btnPlus = document.getElementById('btnPlus');

const addAccountModal = document.getElementById('addAccountModal');
const modalNickInput = document.getElementById('modalNickInput');
const modalAddBtn = document.getElementById('modalAddBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalError = document.getElementById('modalError');

const deleteAccountModal = document.getElementById('deleteAccountModal');
const modalDeleteConfirmBtn = document.getElementById('modalDeleteConfirmBtn');
const modalDeleteCancelBtn = document.getElementById('modalDeleteCancelBtn');

const settingsModal = document.getElementById('settingsModal');
const settingsAccountLabel = document.getElementById('settingsAccountLabel');
const ramSlider = document.getElementById('ramSlider');
const ramInput = document.getElementById('ramInput');

const btnGraj = document.getElementById('playBtn');
const poleStatusu = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// --- ZMIENNE STANOWE ---
let accounts = JSON.parse(localStorage.getItem('reaper_accounts')) || [];
let selectedAccount = localStorage.getItem('reaper_last_nick') || null;
let ramProfiles = JSON.parse(localStorage.getItem('reaper_ram_profiles')) || {};
let runningInstances = 0;
let isLaunching = false;
let accountToDelete = null;
let launchCooldown; // Zmienna pilnująca blokady czasu

// --- OBLICZANIE RAMU (50% komputera) ---
const totalRAMBytes = os.totalmem();
const totalRAMGB = totalRAMBytes / (1024 * 1024 * 1024);
const maxRAMAllowed = Math.max(2, Math.floor(totalRAMGB / 2));

ramSlider.max = maxRAMAllowed;
ramInput.max = maxRAMAllowed;

function syncRamDisplay(value) {
    let num = parseInt(value);
    if (isNaN(num) || num < 2) num = 2;
    if (num > maxRAMAllowed) num = maxRAMAllowed;
    ramSlider.value = num;
    ramInput.value = num;
}

// --- TOP MENU ---
document.getElementById('btnOpenMods').onclick = () => {
    ipcRenderer.send('open-mods-folder');
};

document.getElementById('btnSettings').onclick = () => {
    if (!selectedAccount) {
        poleStatusu.innerText = "Najpierw dodaj lub wybierz konto!";
        poleStatusu.style.color = "#ff4c4c";
        return;
    }
    let ramForSelected = ramProfiles[selectedAccount] || 2;
    settingsAccountLabel.innerText = selectedAccount;
    syncRamDisplay(ramForSelected);
    settingsModal.style.display = 'flex';
};

document.getElementById('modalSettingsCancelBtn').onclick = () => {
    settingsModal.style.display = 'none';
};

document.getElementById('modalSettingsSaveBtn').onclick = () => {
    syncRamDisplay(ramInput.value);
    ramProfiles[selectedAccount] = parseInt(ramInput.value);
    localStorage.setItem('reaper_ram_profiles', JSON.stringify(ramProfiles));
    settingsModal.style.display = 'none';
    poleStatusu.innerText = `Zapisano ustawienia dla profilu: ${selectedAccount}`;
    poleStatusu.style.color = "#2ecc71";
};

ramSlider.oninput = (e) => syncRamDisplay(e.target.value);
ramInput.onchange = (e) => syncRamDisplay(e.target.value);


// --- RYSOWANIE INTERFEJSU KONT ---
function renderAccounts() {
    if (accounts.length === 0) {
        btnEmptyAddAccount.style.display = 'block';
        accountSelectorContainer.style.display = 'none';
        selectedAccount = null;
        aktualizujPrzyciskGraj();
        return;
    }

    btnEmptyAddAccount.style.display = 'none';
    accountSelectorContainer.style.display = 'flex';

    if (!accounts.includes(selectedAccount)) {
        selectedAccount = accounts[0];
    }

    selectedAccountName.innerText = selectedAccount;
    localStorage.setItem('reaper_last_nick', selectedAccount);

    customDropdown.innerHTML = '';
    accounts.forEach(acc => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'dropdown-item';

        itemDiv.onclick = (e) => {
            e.stopPropagation();
            selectedAccount = acc;
            zamknijListeRozwijana();
            renderAccounts();
        };

        const nameSpan = document.createElement('span');
        nameSpan.innerText = acc;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-acc';
        deleteBtn.innerText = '✖';
        deleteBtn.title = "Usuń to konto";

        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            accountToDelete = acc;
            deleteAccountModal.style.display = 'flex';
            zamknijListeRozwijana();
        };

        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(deleteBtn);
        customDropdown.appendChild(itemDiv);
    });

    aktualizujPrzyciskGraj();
}

function zamknijListeRozwijana() {
    customDropdown.style.display = 'none';
    customSelectToggle.classList.remove('active');
}

customSelectToggle.onclick = (e) => {
    e.stopPropagation();
    const czyZamkniete = customDropdown.style.display === 'none' || customDropdown.style.display === '';

    if (czyZamkniete) {
        customDropdown.style.display = 'block';
        customSelectToggle.classList.add('active');
    } else {
        zamknijListeRozwijana();
    }
};

document.addEventListener('click', () => { zamknijListeRozwijana(); });
customDropdown.onclick = (e) => { e.stopPropagation(); }

// --- LOGIKA MODALI KONT ---
function otworzModal() {
    addAccountModal.style.display = 'flex';
    modalError.style.display = 'none';
    modalNickInput.value = '';
    modalNickInput.focus();
}

function zamknijModal() { addAccountModal.style.display = 'none'; }

btnEmptyAddAccount.onclick = otworzModal;
btnPlus.onclick = otworzModal;
modalCancelBtn.onclick = zamknijModal;

modalAddBtn.onclick = () => {
    const nick = modalNickInput.value.trim();
    if (nick.length < 3) { modalError.innerText = "Nick musi mieć min. 3 litery!";
        modalError.style.display = 'block'; return; }
    if (accounts.includes(nick)) { modalError.innerText = "To konto już istnieje!";
        modalError.style.display = 'block'; return; }

    accounts.push(nick);
    localStorage.setItem('reaper_accounts', JSON.stringify(accounts));
    selectedAccount = nick;
    zamknijModal();
    renderAccounts();
};

modalDeleteCancelBtn.onclick = () => {
    deleteAccountModal.style.display = 'none';
    accountToDelete = null;
};

modalDeleteConfirmBtn.onclick = () => {
    if (accountToDelete) {
        accounts = accounts.filter(a => a !== accountToDelete);
        localStorage.setItem('reaper_accounts', JSON.stringify(accounts));

        delete ramProfiles[accountToDelete];
        localStorage.setItem('reaper_ram_profiles', JSON.stringify(ramProfiles));

        renderAccounts();
    }
    deleteAccountModal.style.display = 'none';
    accountToDelete = null;
};


// --- LOGIKA URUCHAMIANIA GRY ---
function aktualizujPrzyciskGraj() {
    if (accounts.length === 0) {
        btnGraj.disabled = true;
        btnGraj.innerText = "Brak konta";
        btnGraj.style.backgroundColor = "#555";
    } else if (isLaunching) {
        btnGraj.disabled = true;
        btnGraj.innerText = "Uruchamianie...";
        btnGraj.style.backgroundColor = "#555";
    } else if (runningInstances >= 2) {
        btnGraj.disabled = true;
        btnGraj.innerText = "Max 2 gry naraz!";
        btnGraj.style.backgroundColor = "#c0392b";
    } else {
        btnGraj.disabled = false;
        btnGraj.innerText = "GRAJ";
        btnGraj.style.backgroundColor = "#27ae60";
    }
}

btnGraj.addEventListener('click', () => {
    if (isLaunching || runningInstances >= 2 || accounts.length === 0) return;

    isLaunching = true;
    aktualizujPrzyciskGraj();

    poleStatusu.style.color = "#ccc";
    poleStatusu.innerText = "Sprawdzanie i przygotowywanie plików...";
    progressContainer.style.display = "block";
    progressBar.value = 0;
    progressText.innerText = "0%";

    const finalRam = ramProfiles[selectedAccount] || 2;
    ipcRenderer.send('start-game', { username: selectedAccount, ram: finalRam });
});

// --- ODBIERANIE DANYCH ---
ipcRenderer.on('file-progress', (event, data) => {
    const pobrane = data.task;
    const wszystkie = data.total;
    const typ = data.type;
    if (wszystkie === 0) return;

    const procent = Math.round((pobrane / wszystkie) * 100);
    progressBar.value = procent;

    let nazwaEtapu = "Pobieranie plików";
    if (typ === 'assets') nazwaEtapu = "Pobieranie tekstur i dźwięków";
    else if (typ === 'classes' || typ === 'libraries') nazwaEtapu = "Pobieranie bibliotek gry";
    else if (typ === 'natives') nazwaEtapu = "Pobieranie rdzenia";

    progressText.innerText = `${nazwaEtapu}: ${pobrane} / ${wszystkie} (${procent}%)`;
});

ipcRenderer.on('game-started', () => {
    // Od razu zliczamy, że gra działa, ale NIE odblokowujemy jeszcze przycisku!
    runningInstances++;
    progressContainer.style.display = "none";

    poleStatusu.style.color = "#e67e22"; // Pomarańczowy kolor (ostrzegawczy)
    poleStatusu.innerText = "Uruchamianie... (Poczekaj chwilę na wczytanie plików gry)";

    // Ustawiamy timer: Po 15 sekundach przycisk się odblokuje
    launchCooldown = setTimeout(() => {
        isLaunching = false;
        poleStatusu.style.color = "#2ecc71"; // Zielony
        poleStatusu.innerText = "Gra załadowana! Możesz odpalić kolejne konto.";
        aktualizujPrzyciskGraj();
    }, 15000);
});

ipcRenderer.on('game-closed', () => {
    runningInstances--;
    if (runningInstances < 0) runningInstances = 0;

    // Gdyby jakimś cudem gra wysypała się (crash) przed upływem 15 sekund,
    // musimy awaryjnie odblokować przycisk, przerywając timer.
    if (isLaunching && runningInstances === 0) {
        clearTimeout(launchCooldown);
        isLaunching = false;
    }

    poleStatusu.style.color = "#ccc";
    poleStatusu.innerText = `Gra zamknięta. (Uruchomione: ${runningInstances}/2)`;
    aktualizujPrzyciskGraj();
});

renderAccounts();