const { ipcRenderer } = require('electron');

// --- POBIERANIE ELEMENTÓW Z HTML ---
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

// Elementy modala usuwania konta
const deleteAccountModal = document.getElementById('deleteAccountModal');
const modalDeleteConfirmBtn = document.getElementById('modalDeleteConfirmBtn');
const modalDeleteCancelBtn = document.getElementById('modalDeleteCancelBtn');

const btnGraj = document.getElementById('playBtn');
const poleStatusu = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// --- ZMIENNE STANOWE ---
let accounts = JSON.parse(localStorage.getItem('reaper_accounts')) || [];
let selectedAccount = localStorage.getItem('reaper_last_nick') || null;
let runningInstances = 0;
let isLaunching = false;
let accountToDelete = null; // Przechowuje nick konta, które gracz chce właśnie usunąć

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

        const nameSpan = document.createElement('span');
        nameSpan.innerText = acc;

        nameSpan.onclick = (e) => {
            e.stopPropagation();
            selectedAccount = acc;
            zamknijListeRozwijana();
            renderAccounts();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-acc';
        deleteBtn.innerText = '✖';
        deleteBtn.title = "Usuń to konto";

        // Zamiast usuwać od razu, otwieramy okno potwierdzenia
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            accountToDelete = acc; // Zapisujemy w pamięci kogo usuwamy
            deleteAccountModal.style.display = 'flex'; // Pokazujemy okienko
            zamknijListeRozwijana(); // Zamykamy listę pod spodem, żeby nie przeszkadzała
        };

        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(deleteBtn);
        customDropdown.appendChild(itemDiv);
    });

    aktualizujPrzyciskGraj();
}

// --- LOGIKA LISTY ROZWIJANEJ ---
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

document.addEventListener('click', () => {
    zamknijListeRozwijana();
});

customDropdown.onclick = (e) => {
    e.stopPropagation();
}

// --- LOGIKA OKIENKA DODAWANIA KONTA ---
function otworzModal() {
    addAccountModal.style.display = 'flex';
    modalError.style.display = 'none';
    modalNickInput.value = '';
    modalNickInput.focus();
}

function zamknijModal() {
    addAccountModal.style.display = 'none';
}

btnEmptyAddAccount.onclick = otworzModal;
btnPlus.onclick = otworzModal;
modalCancelBtn.onclick = zamknijModal;

modalAddBtn.onclick = () => {
    const nick = modalNickInput.value.trim();

    if (nick.length < 3) {
        modalError.innerText = "Nick musi mieć co najmniej 3 litery!";
        modalError.style.display = 'block';
        return;
    }
    if (accounts.includes(nick)) {
        modalError.innerText = "To konto znajduje się już na liście!";
        modalError.style.display = 'block';
        return;
    }

    accounts.push(nick);
    localStorage.setItem('reaper_accounts', JSON.stringify(accounts));
    selectedAccount = nick;

    zamknijModal();
    renderAccounts();
};

// --- LOGIKA OKIENKA USUWANIA KONTA ---
// Klawisz "Nie"
modalDeleteCancelBtn.onclick = () => {
    deleteAccountModal.style.display = 'none';
    accountToDelete = null; // Resetujemy zapamiętane konto
};

// Klawisz "Tak"
modalDeleteConfirmBtn.onclick = () => {
    if (accountToDelete) {
        // Usuwamy z bazy
        accounts = accounts.filter(a => a !== accountToDelete);
        localStorage.setItem('reaper_accounts', JSON.stringify(accounts));

        // Odświeżamy widok
        renderAccounts();
    }
    deleteAccountModal.style.display = 'none';
    accountToDelete = null; // Reset
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

    ipcRenderer.send('start-game', selectedAccount);
});

// --- ODBIERANIE DANYCH Z MAIN.JS ---
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
    poleStatusu.style.color = "#2ecc71";
    poleStatusu.innerText = "Minecraft pomyślnie uruchomiony!";
    progressContainer.style.display = "none";

    isLaunching = false;
    runningInstances++;
    aktualizujPrzyciskGraj();
});

ipcRenderer.on('game-closed', () => {
    runningInstances--;
    if (runningInstances < 0) runningInstances = 0;

    poleStatusu.style.color = "#ccc";
    poleStatusu.innerText = `Gra zamknięta. (Uruchomione: ${runningInstances}/2)`;
    aktualizujPrzyciskGraj();
});

document.getElementById('btnOpenMods').onclick = () => {
    ipcRenderer.send('open-mods-folder');
};

// Inicjalizacja
renderAccounts();