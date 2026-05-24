const btnMinimize = document.getElementById('btnMinimize');
if (btnMinimize) btnMinimize.onclick = () => { window.api.send('window-minimize'); };

const btnClose = document.getElementById('btnClose');
if (btnClose) btnClose.onclick = () => { window.api.send('window-close'); };

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
let isClientUpdating = false;

const totalRAMBytes = window.api.getTotalMemory();
const totalRAMGB = totalRAMBytes / (1024 * 1024 * 1024);
const maxRAMAllowed = Math.max(2, Math.floor(totalRAMGB / 2));
if (ramSlider) ramSlider.max = maxRAMAllowed;
if (ramInput) ramInput.max = maxRAMAllowed;

function syncRamDisplay(value) {
    let num = parseInt(value);
    if (isNaN(num) || num < 2) num = 2;
    if (num > maxRAMAllowed) num = maxRAMAllowed;
    if (ramSlider) ramSlider.value = num;
    if (ramInput) ramInput.value = num;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('btnWww')) document.getElementById('btnWww').onclick = () => { window.api.openLink('https://reapercraft.pl'); };
    if (document.getElementById('btnYt')) document.getElementById('btnYt').onclick = () => { window.api.openLink('https://www.youtube.com/@ReaperCraftpl'); };
    if (document.getElementById('btnTt')) document.getElementById('btnTt').onclick = () => { window.api.openLink('https://www.tiktok.com/@reapercraft.pl'); };
    if (document.getElementById('btnDc')) document.getElementById('btnDc').onclick = () => { window.api.openLink('https://discord.com/invite/qhdHUbE7sp'); };
});

if (document.getElementById('btnSettings')) {
    document.getElementById('btnSettings').onclick = () => {
        if (!selectedAccountNick) {
            if (poleStatusu) {
                poleStatusu.innerText = "Najpierw dodaj lub wybierz konto!";
                poleStatusu.style.color = "#e74c3c";
            }
            return;
        }
        let ramForSelected = ramProfiles[selectedAccountNick] || 2;
        if (settingsAccountLabel) settingsAccountLabel.innerText = selectedAccountNick;
        syncRamDisplay(ramForSelected);
        if (settingsModal) settingsModal.style.display = 'flex';
    };
}

if (document.getElementById('modalSettingsCancelBtn')) document.getElementById('modalSettingsCancelBtn').onclick = () => { settingsModal.style.display = 'none'; };

if (document.getElementById('modalSettingsSaveBtn')) {
    document.getElementById('modalSettingsSaveBtn').onclick = () => {
        syncRamDisplay(ramInput.value);
        ramProfiles[selectedAccountNick] = parseInt(ramInput.value);
        localStorage.setItem('reaper_ram_profiles', JSON.stringify(ramProfiles));
        settingsModal.style.display = 'none';
        if (poleStatusu) {
            poleStatusu.innerText = `Zapisano ustawienia dla profilu: ${selectedAccountNick}`;
            poleStatusu.style.color = "#2ecc71";
        }
    };
}

if (ramSlider) ramSlider.oninput = (e) => syncRamDisplay(e.target.value);
if (ramInput) ramInput.onchange = (e) => syncRamDisplay(e.target.value);

function renderAccounts() {
    const mainPanelTitle = document.getElementById('mainPanelTitle');

    if (accounts.length === 0) {
        if (mainPanelTitle) mainPanelTitle.innerText = "Dodaj pierwsze konto";
        if (btnEmptyAddAccount) btnEmptyAddAccount.style.display = 'block';
        if (accountSelectorContainer) accountSelectorContainer.style.display = 'none';
        selectedAccountNick = null;
        aktualizujPrzyciskGraj();
        return;
    }

    if (mainPanelTitle) mainPanelTitle.innerText = "Wybierz konto";
    if (btnEmptyAddAccount) btnEmptyAddAccount.style.display = 'none';
    if (accountSelectorContainer) accountSelectorContainer.style.display = 'flex';

    if (!accounts.some(a => a.nick === selectedAccountNick)) {
        selectedAccountNick = accounts[0].nick;
    }

    const currentAccObj = accounts.find(a => a.nick === selectedAccountNick);
    if (selectedAccountName) {
        if (currentAccObj && currentAccObj.type === 'premium') {
            selectedAccountName.innerHTML = `<span style="color: #2ecc71;">${selectedAccountNick}</span>`;
        } else {
            selectedAccountName.innerText = selectedAccountNick;
        }
    }

    localStorage.setItem('reaper_last_nick', selectedAccountNick);
    if (customDropdown) customDropdown.innerHTML = '';

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
            if (deleteAccountModal) deleteAccountModal.style.display = 'flex';
            zamknijListeRozwijana();
        };

        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(deleteBtn);
        if (customDropdown) customDropdown.appendChild(itemDiv);
    });

    aktualizujPrzyciskGraj();
}

function zamknijListeRozwijana() {
    if (customDropdown) customDropdown.style.display = 'none';
    if (customSelectToggle) customSelectToggle.classList.remove('active');
}

if (customSelectToggle) customSelectToggle.onclick = (e) => {
    e.stopPropagation();
    const czyZamkniete = customDropdown.style.display === 'none' || customDropdown.style.display === '';
    if (czyZamkniete) {
        customDropdown.style.display = 'block';
        customSelectToggle.classList.add('active');
    } else { zamknijListeRozwijana(); }
};

document.addEventListener('click', () => { zamknijListeRozwijana(); });
if (customDropdown) customDropdown.onclick = (e) => { e.stopPropagation(); }

function otworzModal() {
    if (addAccountModal) addAccountModal.style.display = 'flex';
    if (modalError) modalError.style.display = 'none';
    if (msLoginStatus) msLoginStatus.style.display = 'none';
    if (modalNickInput) {
        modalNickInput.value = '';
        modalNickInput.focus();
    }
    if (btnMicrosoftLogin) btnMicrosoftLogin.disabled = false;
}

function zamknijModal() { if (addAccountModal) addAccountModal.style.display = 'none'; }

if (btnEmptyAddAccount) btnEmptyAddAccount.onclick = otworzModal;
if (btnPlus) btnPlus.onclick = otworzModal;
if (modalCancelBtn) modalCancelBtn.onclick = zamknijModal;

if (modalAddBtn) modalAddBtn.onclick = () => {
    const nick = modalNickInput.value.trim();
    if (nick.length < 3) {
        if (modalError) {
            modalError.innerText = "Nick musi mieć min. 3 litery!";
            modalError.style.display = 'block';
        }
        return;
    }
    if (accounts.some(a => a.nick === nick)) {
        if (modalError) {
            modalError.innerText = "To konto już istnieje na liście!";
            modalError.style.display = 'block';
        }
        return;
    }

    accounts.push({ nick: nick, type: 'offline' });
    localStorage.setItem('reaper_accounts', JSON.stringify(accounts));
    selectedAccountNick = nick;
    zamknijModal();
    renderAccounts();
};

if (btnMicrosoftLogin) btnMicrosoftLogin.onclick = () => {
    btnMicrosoftLogin.disabled = true;
    if (msLoginStatus) {
        msLoginStatus.innerText = "Otwieranie bezpiecznego okna Microsoft...";
        msLoginStatus.style.color = "#ccc";
        msLoginStatus.style.display = "block";
    }
    window.api.send('login-microsoft');
};

window.api.receive('microsoft-login-success', (data) => {
    if (btnMicrosoftLogin) btnMicrosoftLogin.disabled = false;
    if (msLoginStatus) msLoginStatus.style.display = "none";

    accounts = accounts.filter(a => a.nick !== data.nick);
    accounts.push({ nick: data.nick, type: 'premium', auth: data.auth });
    localStorage.setItem('reaper_accounts', JSON.stringify(accounts));

    selectedAccountNick = data.nick;
    zamknijModal();
    renderAccounts();
});

window.api.receive('microsoft-login-error', (errorMsg) => {
    if (btnMicrosoftLogin) btnMicrosoftLogin.disabled = false;
    if (msLoginStatus) {
        msLoginStatus.innerText = "Błąd: " + errorMsg;
        msLoginStatus.style.color = "#e74c3c";
    }
});

if (modalDeleteCancelBtn) modalDeleteCancelBtn.onclick = () => {
    if (deleteAccountModal) deleteAccountModal.style.display = 'none';
    accountToDelete = null;
};
if (modalDeleteConfirmBtn) modalDeleteConfirmBtn.onclick = () => {
    if (accountToDelete) {
        accounts = accounts.filter(a => a.nick !== accountToDelete);
        localStorage.setItem('reaper_accounts', JSON.stringify(accounts));
        delete ramProfiles[accountToDelete];
        localStorage.setItem('reaper_ram_profiles', JSON.stringify(ramProfiles));
        renderAccounts();
    }
    if (deleteAccountModal) deleteAccountModal.style.display = 'none';
    accountToDelete = null;
};

function aktualizujPrzyciskGraj() {
    if (!btnGraj) return;
    if (accounts.length === 0) {
        btnGraj.disabled = true;
        btnGraj.innerText = "Brak konta";
        btnGraj.style.backgroundColor = "#555";
    } else if (isClientUpdating) {
        btnGraj.disabled = true;
        btnGraj.innerText = "Aktualizacja...";
        btnGraj.style.backgroundColor = "#d35400";
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

if (btnGraj) btnGraj.addEventListener('click', () => {
    if (isLaunching || runningInstances >= 2 || accounts.length === 0 || isClientUpdating) return;

    isLaunching = true;
    aktualizujPrzyciskGraj();

    if (poleStatusu) {
        poleStatusu.style.color = "#ccc";
        poleStatusu.innerText = "Sprawdzanie autoryzacji i plików gry...";
    }
    if (progressContainer) progressContainer.style.display = "block";
    if (progressBar) progressBar.value = 0;
    if (progressText) progressText.innerText = "0%";

    const selectedAccountObj = accounts.find(a => a.nick === selectedAccountNick);
    const finalRam = ramProfiles[selectedAccountNick] || 2;
    window.api.send('start-game', { account: selectedAccountObj, ram: finalRam });
});

window.api.receive('launcher-error', (msg) => {
    isLaunching = false;
    if (progressContainer) progressContainer.style.display = "none";
    if (poleStatusu) {
        poleStatusu.style.color = "#e74c3c";
        poleStatusu.innerText = msg;
    }
    aktualizujPrzyciskGraj();
});

window.api.receive('update-state', (state) => {
    isClientUpdating = state;
    aktualizujPrzyciskGraj();
});

window.api.receive('file-progress', (data) => {
    const pobrane = data.task;
    const wszystkie = data.total;
    const typ = data.type;
    if (wszystkie === 0) return;
    const procent = Math.round((pobrane / wszystkie) * 100);
    if (progressBar) progressBar.value = procent;

    let nazwaEtapu = "Pobieranie plików";
    if (typ === 'assets') nazwaEtapu = "Pobieranie tekstur i dźwięków";
    else if (typ === 'classes' || typ === 'libraries') nazwaEtapu = "Pobieranie bibliotek gry";
    else if (typ === 'natives') nazwaEtapu = "Pobieranie rdzenia";

    if (progressText) progressText.innerText = `${nazwaEtapu}: ${pobrane} / ${wszystkie} (${procent}%)`;

    if (procent >= 100) {
        if (poleStatusu) {
            poleStatusu.style.color = "#f39c12";
            poleStatusu.innerText = "Wypakowywanie plików i start Javy... (Może to potrwać dłuższą chwilę)";
        }
    } else {
        if (poleStatusu) {
            poleStatusu.style.color = "#ccc";
            poleStatusu.innerText = "Trwa pobieranie i weryfikacja plików z serwerów...";
        }
    }
});

window.api.receive('game-started', () => {
    runningInstances++;
    if (progressContainer) progressContainer.style.display = "none";
    if (poleStatusu) {
        poleStatusu.style.color = "#e67e22";
        poleStatusu.innerText = "Uruchamianie... (Poczekaj chwilę na wczytanie okna Minecrafta)";
    }

    launchCooldown = setTimeout(() => {
        isLaunching = false;
        if (poleStatusu) {
            poleStatusu.style.color = "#2ecc71";
            poleStatusu.innerText = "Gra załadowana! Możesz odpalić kolejne konto.";
        }
        aktualizujPrzyciskGraj();
    }, 15000);
});

window.api.receive('game-closed', () => {
    runningInstances--;
    if (runningInstances < 0) runningInstances = 0;
    if (isLaunching && runningInstances === 0) {
        clearTimeout(launchCooldown);
        isLaunching = false;
    }
    if (poleStatusu) {
        poleStatusu.style.color = "#ccc";
        poleStatusu.innerText = `Gra zamknięta. (Uruchomione: ${runningInstances}/2)`;
    }
    aktualizujPrzyciskGraj();
});

window.api.receive('update-message', (msg) => {
    const updateElement = document.getElementById('updateStatusText');
    if (updateElement) {
        updateElement.innerText = msg;
        if (msg.includes('Pobieranie') || msg.includes('Znaleziono') || msg.includes('Cicha')) {
            updateElement.style.color = '#f1c40f';
        } else {
            updateElement.style.color = '#666';
        }
    }
});

window.api.receive('set-version', (version) => {
    const versionElement = document.getElementById('appVersionText');
    if (versionElement) {
        versionElement.innerText = `v${version}`;
    }
});

const btnOpenMods = document.getElementById('btnOpenMods');
const modChoiceModal = document.getElementById('modChoiceModal');
const modrinthModal = document.getElementById('modrinthModal');
const modrinthResults = document.getElementById('modrinthResults');
const modrinthStatus = document.getElementById('modrinthStatus');
const modrinthSearchInput = document.getElementById('modrinthSearchInput');

const btnModrinthPrev = document.getElementById('btnModrinthPrev');
const btnModrinthNext = document.getElementById('btnModrinthNext');
const modrinthPageLabel = document.getElementById('modrinthPageLabel');

let currentModPage = 1;
let currentModQuery = "";
let installedModsCache = [];
let currentInstallBtn = null;

window.api.receive('installed-mods-list', (list) => {
    installedModsCache = list;

    if (modrinthModal && modrinthModal.style.display === 'flex') {
        szukajWModrinth(currentModQuery, currentModPage);
    }
});

if (btnOpenMods) {
    btnOpenMods.onclick = () => { if (modChoiceModal) modChoiceModal.style.display = 'flex'; };
}

if (document.getElementById('btnActionCancelChoice')) document.getElementById('btnActionCancelChoice').onclick = () => { modChoiceModal.style.display = 'none'; };
if (document.getElementById('btnCloseModrinth')) document.getElementById('btnCloseModrinth').onclick = () => { modrinthModal.style.display = 'none'; };

if (document.getElementById('btnActionOpenFolder')) document.getElementById('btnActionOpenFolder').onclick = () => {
    window.api.send('open-user-mods-folder');
    if (modChoiceModal) modChoiceModal.style.display = 'none';
};

if (document.getElementById('btnActionModrinth')) document.getElementById('btnActionModrinth').onclick = () => {
    if (modChoiceModal) modChoiceModal.style.display = 'none';
    if (modrinthModal) modrinthModal.style.display = 'flex';
    if (modrinthSearchInput) {
        modrinthSearchInput.value = "";
        modrinthSearchInput.focus();
    }

    currentModPage = 1;
    currentModQuery = "";

    if (modrinthResults) modrinthResults.innerHTML = '<p style="color: #ccc; text-align: center; margin-top: 20px;">Ładowanie listy zainstalowanych modów...</p>';

    window.api.send('get-installed-mods');
};

async function szukajWModrinth(query, page) {
    if (!modrinthResults) return;
    modrinthResults.innerHTML = '<p style="color: #ccc; text-align: center; margin-top: 20px;">Wyszukiwanie...</p>';

    try {
        const limit = 10;
        const offset = (page - 1) * limit;
        const facets = encodeURIComponent('[["categories:fabric"],["versions:1.21.5"]]');
        const index = query === "" ? "downloads" : "relevance";

        const url = `https://api.modrinth.com/v2/search?query=${query}&facets=${facets}&limit=${limit}&offset=${offset}&index=${index}`;

        const res = await fetch(url);
        const data = await res.json();

        modrinthResults.innerHTML = '';
        if (data.hits.length === 0) {
            modrinthResults.innerHTML = '<p style="color: #e74c3c; text-align: center; margin-top: 20px;">Brak wyników.</p>';
            aktualizujGuzikiStron(0);
            return;
        }

        data.hits.forEach(mod => {
            const modDiv = document.createElement('div');
            modDiv.style.cssText = "background: #222; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #333; gap: 15px;";

            const leftArea = document.createElement('div');
            leftArea.style.cssText = "display: flex; align-items: center; gap: 15px; overflow: hidden;";
            const iconUrl = mod.icon_url || 'reaper_logo.png';

            leftArea.innerHTML = `
                <img src="${iconUrl}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background: #111;">
                <div style="display: flex; flex-direction: column;">
                    <strong style="color: #f1c40f; font-size: 15px;">${mod.title}</strong>
                    <span style="font-size: 11px; color: #aaa;">${mod.author} • Pobrania: ${mod.downloads.toLocaleString()}</span>
                </div>
            `;

            const installBtn = document.createElement('button');

            const znormalizuj = (tekst) => tekst.toLowerCase().replace(/[^a-z0-9]/g, '');

            const isInstalled = installedModsCache.some(file => {
                const czystyPlik = file.toLowerCase().replace(/[^a-z0-9]/g, '');
                const czystySlug = mod.slug.toLowerCase().replace(/[^a-z0-9]/g, '');

                const czystyTytul = mod.title.toLowerCase()
                    .replace(/'s/g, '')
                    .replace(/\[.*?\]|\(.*?\)/g, '')
                    .replace(/[^a-z0-9]/g, '');

                return czystyPlik.includes(czystySlug) || (czystyTytul.length > 4 && czystyPlik.includes(czystyTytul));
            });

            if (isInstalled) {
                installBtn.innerText = "Zainstalowany";
                installBtn.disabled = true;
                installBtn.style.cssText = "background: #555; color: #aaa; border: none; padding: 6px 15px; border-radius: 3px; font-weight: bold; min-width: 80px; cursor: not-allowed;";
            } else {
                installBtn.innerText = "Instaluj";
                installBtn.style.cssText = "background: #f1c40f; color: #111; border: none; padding: 6px 15px; border-radius: 3px; cursor: pointer; font-weight: bold; min-width: 80px;";
                installBtn.onclick = () => installModrinthMod(mod.project_id, mod.slug, installBtn);
            }

            modDiv.appendChild(leftArea);
            modDiv.appendChild(installBtn);
            modrinthResults.appendChild(modDiv);
        });

        aktualizujGuzikiStron(data.total_hits);

    } catch (err) {
        modrinthResults.innerHTML = '<p style="color: #e74c3c; text-align: center; margin-top: 20px;">Błąd połączenia z bazą danych Modrinth.</p>';
    }
}

function aktualizujGuzikiStron(totalHits) {
    if (modrinthPageLabel) modrinthPageLabel.innerText = `Strona ${currentModPage}`;
    if (btnModrinthPrev) {
        btnModrinthPrev.disabled = (currentModPage === 1);
        btnModrinthPrev.style.opacity = (currentModPage === 1) ? "0.3" : "1";
    }
    if (btnModrinthNext) {
        const hasMore = totalHits > (currentModPage * 10);
        btnModrinthNext.disabled = !hasMore;
        btnModrinthNext.style.opacity = !hasMore ? "0.3" : "1";
    }
}

if (document.getElementById('btnSearchModrinth')) document.getElementById('btnSearchModrinth').onclick = () => {
    if (!modrinthSearchInput) return;
    currentModQuery = modrinthSearchInput.value.trim();
    currentModPage = 1;
    szukajWModrinth(currentModQuery, currentModPage);
};

if (btnModrinthPrev) btnModrinthPrev.onclick = () => {
    if (currentModPage > 1) {
        currentModPage--;
        szukajWModrinth(currentModQuery, currentModPage);
    }
};

if (btnModrinthNext) btnModrinthNext.onclick = () => {
    currentModPage++;
    szukajWModrinth(currentModQuery, currentModPage);
};

async function installModrinthMod(projectId, slug, btnElement) {
    currentInstallBtn = btnElement;
    btnElement.innerText = "Trwa...";
    btnElement.disabled = true;
    btnElement.style.background = "#d39e00";
    if (modrinthStatus) modrinthStatus.innerText = "Pobieranie pliku...";

    try {
        const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`);
        const versions = await res.json();
        const validVersion = versions.find(v => v.game_versions.includes('1.21.5') && v.loaders.includes('fabric'));

        if (validVersion) {
            const file = validVersion.files.find(f => f.primary) || validVersion.files[0];
            window.api.send('download-modrinth', { url: file.url, filename: file.filename });
            installedModsCache.push(slug.toLowerCase());
        } else {
            if (modrinthStatus) modrinthStatus.innerText = "Błąd: Brak pliku JAR dla Fabric 1.21.5.";
            btnElement.innerText = "Błąd";
            btnElement.style.background = "#e74c3c";
            btnElement.style.color = "white";
        }
    } catch (err) {
        if (modrinthStatus) modrinthStatus.innerText = "Błąd podczas pobierania informacji.";
    }
}

window.api.receive('mod-download-done', (filename) => {
    if (modrinthStatus) {
        modrinthStatus.style.color = "#f1c40f";
        modrinthStatus.innerText = `✔ Pomyślnie zainstalowano: ${filename}`;
    }
    if (currentInstallBtn) {
        currentInstallBtn.innerText = "Zainstalowany";
        currentInstallBtn.style.cssText = "background: #555; color: #aaa; border: none; padding: 6px 15px; border-radius: 3px; font-weight: bold; min-width: 80px; cursor: not-allowed;";
        currentInstallBtn = null;
    }
});

window.api.receive('mod-download-error', (err) => {
    if (modrinthStatus) {
        modrinthStatus.style.color = "#e74c3c";
        modrinthStatus.innerText = `✖ Błąd pobierania: ${err}`;
    }
    if (currentInstallBtn) {
        currentInstallBtn.innerText = "Błąd";
        currentInstallBtn.style.background = "#e74c3c";
        currentInstallBtn.style.color = "white";
        currentInstallBtn = null;
    }
});

window.api.send('get-version');
renderAccounts();