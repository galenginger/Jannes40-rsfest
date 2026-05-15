// projector.js — projektor-läge, tar emot meddelanden men kan inte skicka
// Visar meddelanden i ett stort rullande flöde för visning på storskärm/projektor

const projChatList = document.getElementById("projector-chat-list");
const projUserList = document.getElementById("proj-user-list");
const projWordsEl = document.getElementById("proj-words");
const projCombosEl = document.getElementById("proj-combos");
const projParticipantsEl = document.getElementById("proj-participants");
const projTotalMessagesEl = document.getElementById("proj-total-messages");
const triggerOverlay = document.getElementById("trigger-overlay");
const triggerPopup = document.getElementById("trigger-popup");

const MAX_MESSAGES = 120;

const projectorMessageBuffer = [];

const isBraveBrowser = !!navigator.brave;
const signalrTransportOptions = isBraveBrowser
    ? { transport: signalR.HttpTransportType.LongPolling }
    : undefined;

const connection = new signalR.HubConnectionBuilder()
    .withUrl(SIGNALR_URL, signalrTransportOptions)
    .withAutomaticReconnect()
    .build();

let lastMessageTime = null;
let manualReconnectTimer = null;

function stopManualReconnectLoop() {
    if (manualReconnectTimer !== null) {
        clearInterval(manualReconnectTimer);
        manualReconnectTimer = null;
    }
}

function startManualReconnectLoop() {
    if (manualReconnectTimer !== null) return;
    manualReconnectTimer = setInterval(() => {
        if (connection.state === signalR.HubConnectionState.Connected) {
            stopManualReconnectLoop();
            return;
        }

        if (connection.state === signalR.HubConnectionState.Disconnected) {
            connection.start().catch(err => console.error("Projector reconnect misslyckades:", err));
        }
    }, 3000);
}

async function loadHistory(sinceDate) {
    try {
        const history = await connection.invoke("GetHistory", sinceDate);
        if (history && history.length > 0) {
            history.forEach(msg => addProjMessage(msg.username, msg.text, msg.isHighlighted, msg.avatarId, msg.timestamp, msg.isAnnouncement === true));
        }
    } catch (err) {
        console.error("GetHistory (projector) misslyckades:", err);
    }
}

async function startConnection() {
    try {
        await connection.start();
        stopManualReconnectLoop();
        // Hämta historik vid första anslutning (alla tillgängliga, upp till 200)
        if (lastMessageTime === null) {
            const veryOldDate = new Date(0); // 1970-01-01, får alla meddelanden från buffern
            await loadHistory(veryOldDate);
        }
    } catch (err) {
        console.error("SignalR-anslutning misslyckades:", err);
        startManualReconnectLoop();
    }
}

connection.on("ReceiveMessage", (username, text, isHighlighted, avatarId, triggers, timestamp, isAnnouncement = false) => {
    lastMessageTime = timestamp;
    addProjMessage(username, text, isHighlighted, avatarId, timestamp, isAnnouncement);

    if (projTotalMessagesEl) {
        const current = parseInt(projTotalMessagesEl.textContent || "0", 10);
        projTotalMessagesEl.textContent = String((Number.isNaN(current) ? 0 : current) + 1);
    }

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

connection.on("UpdateParticipantList", (participants) => {
    renderParticipantList(participants || []);
});

// UserJoined-event är inaktiverad
// connection.on("UserJoined", (username) => {
//     addProjJoinMessage(username);
// });

startConnection();

connection.onreconnected(async () => {
    stopManualReconnectLoop();
    // Hämta missade meddelanden från reconnect
    if (lastMessageTime !== null) {
        await loadHistory(lastMessageTime);
    }
});

connection.onclose(() => {
    startManualReconnectLoop();
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden && connection.state !== signalR.HubConnectionState.Connected) {
        startConnection();
    }
});

window.addEventListener("focus", () => {
    if (connection.state !== signalR.HubConnectionState.Connected) {
        startConnection();
    }
});

window.addEventListener("pageshow", () => {
    if (connection.state !== signalR.HubConnectionState.Connected) {
        startConnection();
    }
});

// Lägger till ett nytt meddelande i projektor-vyn och tar bort gamla om det blir för många
function addProjMessage(username, text, isHighlighted, avatarId = null, timestamp = null, isAnnouncement = false) {
    projectorMessageBuffer.push({
        username,
        text,
        isHighlighted,
        avatarId,
        timestamp: timestamp || new Date().toISOString(),
        isAnnouncement
    });

    while (projectorMessageBuffer.length > MAX_MESSAGES) {
        projectorMessageBuffer.shift();
    }

    renderProjectorChat();
}

function renderProjectorChat() {
    if (!projChatList) return;
    projChatList.innerHTML = "";

    projectorMessageBuffer.forEach(message => {
        projChatList.appendChild(createProjMessageElement(message));
    });

    projChatList.scrollTop = projChatList.scrollHeight;
}

function renderParticipantList(participants) {
    if (!projUserList) return;

    projUserList.innerHTML = "";
    if (!participants.length) {
        const empty = document.createElement("div");
        empty.className = "projector-user-empty";
        empty.textContent = "Ingen inloggad just nu";
        projUserList.appendChild(empty);
        return;
    }

    participants.forEach(name => {
        const item = document.createElement("div");
        item.className = "projector-user-item";
        item.textContent = name;
        projUserList.appendChild(item);
    });
}

function createProjMessageElement(message) {
    const msg = document.createElement("div");
    msg.className = "proj-message"
        + (message.isHighlighted ? " highlighted" : "")
        + (message.isAnnouncement ? " proj-announcement" : "");

    const header = document.createElement("div");
    header.className = "proj-message-header";

    const avatarEl = document.createElement("div");
    avatarEl.className = "proj-message-avatar";
    if (message.isAnnouncement) {
        avatarEl.textContent = "📢";
    } else {
        const avatarImg = document.createElement("img");
        avatarImg.src = generateAvatar(message.username, 42, message.avatarId);
        avatarImg.alt = message.username.charAt(0).toUpperCase();
        avatarEl.appendChild(avatarImg);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "proj-message-name";
    nameEl.textContent = message.username;

    const timeEl = document.createElement("span");
    timeEl.className = "proj-message-time";
    timeEl.textContent = new Date(message.timestamp || Date.now()).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

    header.appendChild(avatarEl);
    header.appendChild(nameEl);
    header.appendChild(timeEl);

    const textEl = document.createElement("div");
    textEl.className = "proj-message-text";
    applyWordHighlights(textEl, message.text);

    msg.appendChild(header);
    msg.appendChild(textEl);
    return msg;
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

function randomJoinColor() {
    const h = Math.floor(Math.random() * 360);
    return {
        color:      `hsl(${h}, 70%, 72%)`,
        background: `hsla(${h}, 70%, 50%, 0.08)`,
        border:     `hsla(${h}, 70%, 60%, 0.35)`
    };
}

function addProjJoinMessage(username, avatarId = null) {
    addProjMessage(username, "Är med på festen!", false, avatarId, new Date().toISOString(), false);
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
