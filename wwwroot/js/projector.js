// projector.js — projektor-läge, tar emot meddelanden men kan inte skicka
// Visar meddelanden i ett stort rullande flöde för visning på storskärm/projektor

const projMessages = document.getElementById("projector-messages");
const projWordsEl = document.getElementById("proj-words");
const projCombosEl = document.getElementById("proj-combos");
const projParticipantsEl = document.getElementById("proj-participants");
const triggerOverlay = document.getElementById("trigger-overlay");
const triggerPopup = document.getElementById("trigger-popup");

// Max antal synliga meddelanden i projektor-vyn (äldre tas bort)
const MAX_MESSAGES = 30;

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chathub")
    .withAutomaticReconnect()
    .build();

connection.on("ReceiveMessage", (username, text, isHighlighted, triggers) => {
    addProjMessage(username, text, isHighlighted);

    if (triggers.totalUnlockedWords !== undefined) {
        projWordsEl.textContent  = triggers.totalUnlockedWords;
        projCombosEl.textContent = triggers.totalUnlockedCombos;
    }

    if (triggers.newWords && triggers.newWords.length > 0) {
        triggers.newWords.forEach(w => {
            UNLOCKED_WORDS.add(w.word.toLowerCase());
            showTriggerUnlock(w.emoji, `"${w.word}" upplåst!`, false);
        });
    }

    if (triggers.newCombos && triggers.newCombos.length > 0) {
        triggers.newCombos.forEach(c => showTriggerUnlock(c.emoji, `Kombo: ${c.description}`, true));
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
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.65 }, scalar: 0.8, ticks: 100 });
    }
});

// Synka räknare direkt vid anslutning
connection.on("UpdateCounters", (state) => {
    projWordsEl.textContent  = state.unlockedWords;
    projCombosEl.textContent = state.unlockedCombos;
});

connection.on("UpdateParticipants", (count) => {
    projParticipantsEl.textContent = count;
});

connection.start().catch(err => console.error("SignalR-anslutning misslyckades:", err));

// Lägger till ett nytt meddelande i projektor-vyn och tar bort gamla om det blir för många
function addProjMessage(username, text, isHighlighted) {
    const msg = document.createElement("div");
    msg.className = "proj-message" + (isHighlighted ? " highlighted" : "");

    const header = document.createElement("div");
    header.className = "proj-message-header";

    const avatarEl = document.createElement("div");
    avatarEl.className = "proj-message-avatar";
    const avatarImg = document.createElement("img");
    avatarImg.src = generateAvatar(username, 42);
    avatarImg.alt = username.charAt(0).toUpperCase();
    avatarEl.appendChild(avatarImg);

    const nameEl = document.createElement("div");
    nameEl.className = "proj-message-name";
    nameEl.textContent = username;

    const timeEl = document.createElement("span");
    timeEl.className = "proj-message-time";
    timeEl.textContent = new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

    header.appendChild(avatarEl);
    header.appendChild(nameEl);
    header.appendChild(timeEl);

    const textEl = document.createElement("div");
    textEl.className = "proj-message-text";
    applyWordHighlights(textEl, text);

    msg.appendChild(header);
    msg.appendChild(textEl);

    // Nyaste meddelandet längst upp till vänster i griden
    projMessages.insertBefore(msg, projMessages.firstChild);

    // Ta bort äldsta meddelandet (längst ner) om vi passerar maxgränsen
    while (projMessages.children.length > MAX_MESSAGES) {
        projMessages.removeChild(projMessages.lastChild);
    }
}

function showTriggerUnlock(emoji, title, isCombo) {
    triggerPopup.innerHTML = `
        <span class="popup-emoji">${emoji}</span>
        <div class="popup-title">${escapeHtml(title)}</div>
        <div class="popup-sub">${isCombo ? "KOMBINATIONSUNLÅST!" : "Nytt magiskt ord!"}</div>
    `;

    triggerOverlay.style.display = "flex";

    if (isCombo) {
        launchSideConfetti();
    } else {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
    }

    setTimeout(() => {
        triggerOverlay.style.display = "none";
    }, 3000);
}

function launchSideConfetti() {
    const end = Date.now() + 3000;

    const interval = setInterval(() => {
        if (Date.now() > end) {
            clearInterval(interval);
            return;
        }
        confetti({ particleCount: 60, angle: 60,  spread: 60, origin: { x: 0 } });
        confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 } });
    }, 200);
}

function applyWordHighlights(container, text) {
    const wordSet = new Set(TRIGGER_WORDS.map(w => w.word.toLowerCase()));
    const escaped = TRIGGER_WORDS.map(w => w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = text.split(pattern);
    parts.forEach(part => {
        if (wordSet.has(part.toLowerCase())) {
            const span = document.createElement("span");
            span.className = "trigger-word-highlight";
            span.textContent = part;
            container.appendChild(span);
        } else {
            container.appendChild(document.createTextNode(part));
        }
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
