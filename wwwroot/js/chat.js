// chat.js — hanterar real-time chatt och sidopanel via SignalR
// MY_NAME, TRIGGER_WORDS, TRIGGER_COMBOS, UNLOCKED_WORDS, UNLOCKED_COMBOS
// injiceras server-side från Chat.cshtml

const messagesInner    = document.getElementById("messages-inner");
const messagesContainer = document.getElementById("messages");
const messageInput     = document.getElementById("message-input");
const sendBtn          = document.getElementById("send-btn");
const unlockedWordsEl  = document.getElementById("unlocked-words");
const unlockedCombosEl = document.getElementById("unlocked-combos");
const triggerOverlay   = document.getElementById("trigger-overlay");
const triggerPopup     = document.getElementById("trigger-popup");

const sidebar          = document.getElementById("sidebar");
const sidebarToggle    = document.getElementById("sidebar-toggle");
const sidebarOpenBtn   = document.getElementById("sidebar-open-btn");
const sbWordsEl        = document.getElementById("sb-words");
const sbCombosEl       = document.getElementById("sb-combos");
const sidebarWordsList  = document.getElementById("sidebar-words");
const sidebarCombosList = document.getElementById("sidebar-combos");

// ===== Sidopanel =====

// Bygg upp sidopanelen baserat på TRIGGER_WORDS/COMBOS och aktuellt UNLOCKED_*-state.
// Upplåsta ord visas med emoji och namn, olåsta visas som "???".
function buildSidebar() {
    sidebarWordsList.innerHTML = "";

    TRIGGER_WORDS.forEach(w => {
        const li = document.createElement("li");
        li.className = "sidebar-item" + (UNLOCKED_WORDS.has(w.word.toLowerCase()) ? " unlocked" : " locked");
        li.id = "sw-" + w.word.toLowerCase().replace(/\s+/g, "-");

        if (UNLOCKED_WORDS.has(w.word.toLowerCase())) {
            li.innerHTML = `<span class="sw-emoji">${w.emoji}</span><span class="sw-word">${escapeHtml(w.word)}</span>`;
        } else {
            li.innerHTML = `<span class="sw-emoji">❓</span><span class="sw-word sw-hidden">???</span>`;
        }

        sidebarWordsList.appendChild(li);
    });

    if (!sidebarCombosList) return;
    sidebarCombosList.innerHTML = "";

    TRIGGER_COMBOS.forEach(c => {
        const li = document.createElement("li");
        li.className = "sidebar-item" + (UNLOCKED_COMBOS.has(c.key) ? " unlocked" : " locked");
        li.id = "sc-" + c.key;

        if (UNLOCKED_COMBOS.has(c.key)) {
            li.innerHTML = `<span class="sw-emoji">${c.emoji}</span><span class="sw-word">${escapeHtml(c.description)}</span>`;
        } else {
            li.innerHTML = `<span class="sw-emoji">🔒</span><span class="sw-word sw-hidden">???</span>`;
        }

        sidebarCombosList.appendChild(li);
    });
}

// Uppdatera ett enskilt ord i sidopanelen när det låses upp live
function unlockWordInSidebar(word, emoji) {
    UNLOCKED_WORDS.add(word.toLowerCase());
    const id = "sw-" + word.toLowerCase().replace(/\s+/g, "-");
    const li = document.getElementById(id);
    if (!li) return;
    li.className = "sidebar-item unlocked";
    li.innerHTML = `<span class="sw-emoji">${emoji}</span><span class="sw-word">${escapeHtml(word)}</span>`;
    li.classList.add("just-unlocked");
    setTimeout(() => li.classList.remove("just-unlocked"), 1500);
}

// Uppdatera en kombination i sidopanelen när den låses upp live
function unlockComboInSidebar(key, description, emoji) {
    UNLOCKED_COMBOS.add(key);
    const li = document.getElementById("sc-" + key);
    if (!li) return;
    li.className = "sidebar-item unlocked";
    li.innerHTML = `<span class="sw-emoji">${emoji}</span><span class="sw-word">${escapeHtml(description)}</span>`;
    li.classList.add("just-unlocked");
    setTimeout(() => li.classList.remove("just-unlocked"), 1500);
}

// Sidopanel öppna/stäng
sidebarToggle?.addEventListener("click", () => sidebar.classList.add("sidebar-hidden"));
sidebarOpenBtn?.addEventListener("click", () => sidebar.classList.remove("sidebar-hidden"));

buildSidebar();

// ===== SignalR =====

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chathub")
    .withAutomaticReconnect()
    .build();

connection.on("ReceiveMessage", (username, text, triggers) => {
    addMessage(username, text);

    if (triggers.totalUnlockedWords !== undefined) {
        updateCounters(triggers.totalUnlockedWords, triggers.totalUnlockedCombos);
    }

    // Visa konfetti + popup och uppdatera sidopanelen för nyligen upplåsta ord
    if (triggers.newWords && triggers.newWords.length > 0) {
        triggers.newWords.forEach(w => {
            unlockWordInSidebar(w.word, w.emoji);
            showTriggerUnlock(w.emoji, `"${w.word}" upplåst!`, "Nytt magiskt ord!", false);
        });
    }

    // Samma för kombinationer
    if (triggers.newCombos && triggers.newCombos.length > 0) {
        triggers.newCombos.forEach(c => {
            const comboObj = TRIGGER_COMBOS.find(tc => tc.description === c.description);
            if (comboObj) unlockComboInSidebar(comboObj.key, c.description, c.emoji);
            showTriggerUnlock(c.emoji, `Kombo: ${c.description}`, "KOMBINATIONSUNLÅST!", true);
        });
    }

    // Mini-konfetti om meddelandet innehåller ett redan upplåst triggerord
    const lowerText = text.toLowerCase();
    const justUnlocked = new Set((triggers.newWords || []).map(w => w.word.toLowerCase()));
    const alreadyFound = TRIGGER_WORDS.some(tw =>
        UNLOCKED_WORDS.has(tw.word.toLowerCase()) &&
        !justUnlocked.has(tw.word.toLowerCase()) &&
        lowerText.includes(tw.word.toLowerCase())
    );
    if (alreadyFound) {
        confetti({ particleCount: 30, spread: 55, origin: { y: 0.65 }, scalar: 0.75, ticks: 90 });
    }
});

// Synka räknare direkt vid anslutning
connection.on("UpdateCounters", (state) => {
    updateCounters(state.unlockedWords, state.unlockedCombos);
});

connection.start()
    .then(() => {
        sendBtn.disabled = false;
        messageInput.focus();
    })
    .catch(err => console.error("SignalR-anslutning misslyckades:", err));

// ===== Skicka meddelande =====

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    connection.invoke("SendMessage", text).catch(err => console.error(err));
    messageInput.value = "";
    messageInput.focus();
}

// ===== Hjälpfunktioner =====

function addMessage(username, text) {
    const isOwn = username === MY_NAME;

    const wrapper = document.createElement("div");
    wrapper.className = "message" + (isOwn ? " own" : "");

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    const avatarImg = document.createElement("img");
    avatarImg.src = generateAvatar(username);
    avatarImg.alt = username.charAt(0).toUpperCase();
    avatar.appendChild(avatarImg);

    const body = document.createElement("div");
    body.className = "message-body";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = isOwn ? "Du" : username;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text; // textContent skyddar mot XSS

    body.appendChild(meta);
    body.appendChild(bubble);
    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    messagesInner.appendChild(wrapper);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateCounters(words, combos) {
    unlockedWordsEl.textContent = words;
    unlockedCombosEl.textContent = combos;
    if (sbWordsEl)  sbWordsEl.textContent = words;
    if (sbCombosEl) sbCombosEl.textContent = combos;
    bumpCounter("word-counter");
    bumpCounter("combo-counter");
}

function bumpCounter(id) {
    const el = document.getElementById(id);
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
}

function showTriggerUnlock(emoji, title, subtitle, isCombo) {
    triggerPopup.innerHTML = `
        <span class="popup-emoji">${emoji}</span>
        <div class="popup-title">${escapeHtml(title)}</div>
        <div class="popup-sub">${escapeHtml(subtitle)}</div>
    `;

    triggerOverlay.style.display = "flex";

    if (isCombo) {
        launchSideConfetti();
    } else {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }

    setTimeout(() => { triggerOverlay.style.display = "none"; }, 2500);
}

function launchSideConfetti() {
    const end = Date.now() + 2000;
    const interval = setInterval(() => {
        if (Date.now() > end) { clearInterval(interval); return; }
        confetti({ particleCount: 40, angle: 60,  spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1 } });
    }, 200);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
