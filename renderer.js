const { ipcRenderer, shell } = require('electron');
const os = require('os');

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

const btnMicrosoftLogin = document.getElementById('btnMicrosoftLogin');
const msLoginStatus = document.getElementById('msLoginStatus');

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

// --- ZARZĄDZANIE KONTAMI (MIGRACJA DANYCH) ---
let accounts = JSON.parse(localStorage.getItem('reaper_accounts')) || [];

if (accounts.length > 0 && typeof accounts[0] === 'string') {
    accounts = accounts.map(nick => ({ nick: nick, type: 'offline' }));
    localStorage.setItem('reaper_accounts', JSON.stringify(accounts));
}

let selectedAccountNick = localStorage.getItem('reaper_last_nick') || null;
let ramProfiles = JSON.parse(localStorage.getItem('reaper_ram_profiles')) || {};
let runningInstances = 0;
let isLaunching = false;
let accountToDelete = null;
let launchCooldown;

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

// --- LINKI ---
document.getElementById('btnOpenMods').onclick = () => { ipcRenderer.send('open-mods-folder'); };

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnWww').onclick = () => { shell.openExternal('https://reapercraft.pl'); };
    document.getElementById('btnYt').onclick = () => { shell.openExternal('https://www.youtube.com/@ReaperCraftpl'); };
    document.getElementById('btnTt').onclick = () => { shell.openExternal('https://www.tiktok.com/@reapercraft.pl'); };
    document.getElementById('btnDc').onclick = () => { shell.openExternal('https://discord.com/invite/qhdHUbE7sp'); };
});

document.getElementById('btnSettings').onclick = () => {
    if (!selectedAccountNick) {
        poleStatusu.innerText = "Najpierw dodaj lub wybierz konto!";
        poleStatusu.style.color = "#ff4c4c";
        return;
    }
    let ramForSelected = ramProfiles[selectedAccountNick] || 2;
    settingsAccountLabel.innerText = selectedAccountNick;
    syncRamDisplay(ramForSelected);
    settingsModal.style.display = 'flex';
};

document.getElementById('modalSettingsCancelBtn').onclick = () => { settingsModal.style.display = 'none'; };

document.getElementById('modalSettingsSaveBtn').onclick = () => {
    syncRamDisplay(ramInput.value);
    ramProfiles[selectedAccountNick] = parseInt(ramInput.value);
    localStorage.setItem('reaper_ram_profiles', JSON.stringify(ramProfiles));
    settingsModal.style.display = 'none';
    poleStatusu.innerText = `Zapisano ustawienia dla profilu: ${selectedAccountNick}`;
    poleStatusu.style.color = "#2ecc71";
};

ramSlider.oninput = (e) => syncRamDisplay(e.target.value);
ramInput.onchange = (e) => syncRamDisplay(e.target.value);

// --- RYSOWANIE KONT ---
function renderAccounts() {
    if (accounts.length === 0) {
        btnEmptyAddAccount.style.display = 'block';
        accountSelectorContainer.style.display = 'none';
        selectedAccountNick = null;
        aktualizujPrzyciskGraj();
        return;
    }

    btnEmptyAddAccount.style.display = 'none';
    accountSelectorContainer.style.display = 'flex';

    if (!accounts.some(a => a.nick === selectedAccountNick)) {
        selectedAccountNick = accounts[0].nick;
    }

    const currentAccObj = accounts.find(a => a.nick === selectedAccountNick);
    if (currentAccObj && currentAccObj.type === 'premium') {
        selectedAccountName.innerHTML = `<span style="color: #2ecc71;">${selectedAccountNick}</span>`;
    } else {
        selectedAccountName.innerText = selectedAccountNick;
    }

    localStorage.setItem('reaper_last_nick', selectedAccountNick);
    customDropdown.innerHTML = '';

    accounts.forEach(acc => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'dropdown-item';

        itemDiv.onclick = (e) => {
            e.stopPropagation();
            selectedAccountNick = acc.nick;
            zamknijListeRozwijana();
            renderAccounts();
        };

        const nameSpan = document.createElement('span');
        nameSpan.innerHTML = acc.type === 'premium' ? `<span style="color: #2ecc71; font-weight: bold;">${acc.nick}</span>` : acc.nick;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-acc';
        deleteBtn.innerText = '✖';
        deleteBtn.title = "Usuń to konto";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            accountToDelete = acc.nick;
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
    } else { zamknijListeRozwijana(); }
};

document.addEventListener('click', () => { zamknijListeRozwijana(); });
customDropdown.onclick = (e) => { e.stopPropagation(); }

function otworzModal() {
    addAccountModal.style.display = 'flex';
    modalError.style.display = 'none';
    msLoginStatus.style.display = 'none';
    modalNickInput.value = '';
    btnMicrosoftLogin.disabled = false;
    modalNickInput.focus();
}

function zamknijModal() { addAccountModal.style.display = 'none'; }

btnEmptyAddAccount.onclick = otworzModal;
btnPlus.onclick = otworzModal;
modalCancelBtn.onclick = zamknijModal;

// --- LOGOWANIE OFFLINE ---
modalAddBtn.onclick = () => {
    const nick = modalNickInput.value.trim();
    if (nick.length < 3) {
        modalError.innerText = "Nick musi mieć min. 3 litery!";
        modalError.style.display = 'block';
        return;
    }
    if (accounts.some(a => a.nick === nick)) {
        modalError.innerText = "To konto już istnieje na liście!";
        modalError.style.display = 'block';
        return;
    }

    accounts.push({ nick: nick, type: 'offline' });
    localStorage.setItem('reaper_accounts', JSON.stringify(accounts));
    selectedAccountNick = nick;
    zamknijModal();
    renderAccounts();
};

// --- LOGOWANIE MICROSOFT (PREMIUM) ---
btnMicrosoftLogin.onclick = () => {
    btnMicrosoftLogin.disabled = true;
    msLoginStatus.innerText = "Otwieranie bezpiecznego okna Microsoft...";
    msLoginStatus.style.color = "#ccc";
    msLoginStatus.style.display = "block";
    ipcRenderer.send('login-microsoft');
};

ipcRenderer.on('microsoft-login-success', (event, data) => {
    btnMicrosoftLogin.disabled = false;
    msLoginStatus.style.display = "none";

    accounts = accounts.filter(a => a.nick !== data.nick);
    accounts.push({ nick: data.nick, type: 'premium', auth: data.auth });
    localStorage.setItem('reaper_accounts', JSON.stringify(accounts));

    selectedAccountNick = data.nick;
    zamknijModal();
    renderAccounts();
});

ipcRenderer.on('microsoft-login-error', (event, errorMsg) => {
    btnMicrosoftLogin.disabled = false;
    msLoginStatus.innerText = "Błąd: " + errorMsg;
    msLoginStatus.style.color = "#e74c3c";
});


// --- USUWANIE KONT ---
modalDeleteCancelBtn.onclick = () => {
    deleteAccountModal.style.display = 'none';
    accountToDelete = null;
};
modalDeleteConfirmBtn.onclick = () => {
    if (accountToDelete) {
        accounts = accounts.filter(a => a.nick !== accountToDelete);
        localStorage.setItem('reaper_accounts', JSON.stringify(accounts));
        delete ramProfiles[accountToDelete];
        localStorage.setItem('reaper_ram_profiles', JSON.stringify(ramProfiles));
        renderAccounts();
    }
    deleteAccountModal.style.display = 'none';
    accountToDelete = null;
};

// --- ODPALANIE GRY ---
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
    poleStatusu.innerText = "Sprawdzanie autoryzacji i plików gry...";
    progressContainer.style.display = "block";
    progressBar.value = 0;
    progressText.innerText = "0%";

    const selectedAccountObj = accounts.find(a => a.nick === selectedAccountNick);
    const finalRam = ramProfiles[selectedAccountNick] || 2;
    ipcRenderer.send('start-game', { account: selectedAccountObj, ram: finalRam });
});

// --- ODBIERANIE DANYCH Z PLIKÓW ---
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
    runningInstances++;
    progressContainer.style.display = "none";
    poleStatusu.style.color = "#e67e22";
    poleStatusu.innerText = "Uruchamianie... (Poczekaj chwilę na wczytanie plików gry)";

    launchCooldown = setTimeout(() => {
        isLaunching = false;
        poleStatusu.style.color = "#2ecc71";
        poleStatusu.innerText = "Gra załadowana! Możesz odpalić kolejne konto.";
        aktualizujPrzyciskGraj();
    }, 15000);
});

ipcRenderer.on('game-closed', () => {
    runningInstances--;
    if (runningInstances < 0) runningInstances = 0;
    if (isLaunching && runningInstances === 0) {
        clearTimeout(launchCooldown);
        isLaunching = false;
    }
    poleStatusu.style.color = "#ccc";
    poleStatusu.innerText = `Gra zamknięta. (Uruchomione: ${runningInstances}/2)`;
    aktualizujPrzyciskGraj();
});

renderAccounts();