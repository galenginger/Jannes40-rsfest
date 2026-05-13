// chat.js — hanterar real-time chatt och sidopanel via SignalR
// MY_NAME, TRIGGER_WORDS, TRIGGER_COMBOS, UNLOCKED_WORDS, UNLOCKED_COMBOS
// injiceras server-side från Chat.cshtml

const messagesInner     = document.getElementById("messages-inner");
const messagesContainer = document.getElementById("messages");
const messageInput      = document.getElementById("message-input");
const sendBtn           = document.getElementById("send-btn");
const charCounter       = document.getElementById("char-counter");
const MAX_LENGTH       = 256;
const MAX_MESSAGES     = 50;  // Max synliga meddelanden i chatt-vyn

function updateCharCounter() {
    const remaining = MAX_LENGTH - messageInput.value.length;
    if (remaining > 56) {
        charCounter.textContent = "";
        charCounter.className = "char-counter";
        return;
    }
    charCounter.textContent = remaining;
    charCounter.className = remaining <= 20 ? "char-counter danger"
                          : remaining <= 50 ? "char-counter warning"
                          : "char-counter";
}

messageInput.addEventListener("input", updateCharCounter);

// ===== Auto-scroll =====

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function onNewMessage() {
    scrollToBottom();
}

const emojiBtn         = document.getElementById("emoji-btn");
const emojiPicker      = document.getElementById("emoji-picker");
const unlockedWordsEl  = document.getElementById("unlocked-words");
const unlockedCombosEl = document.getElementById("unlocked-combos");
const triggerOverlay   = document.getElementById("trigger-overlay");
const triggerPopup     = document.getElementById("trigger-popup");

const sidebar          = document.getElementById("sidebar");
const sidebarToggle    = document.getElementById("sidebar-toggle");
const sidebarOpenBtn   = document.getElementById("sidebar-open-btn");
const participantToggle = document.getElementById("participant-toggle");
const participantPanel  = document.getElementById("participant-panel");
const participantList   = document.getElementById("participant-list");
const participantClose  = document.getElementById("participant-close");
const participantCountEl = document.getElementById("participant-count");
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
    addHeaderWordChip(word, emoji, true);
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

// ===== Header-ord =====

const headerUnlockedWords = document.getElementById("header-unlocked-words");

function buildHeaderWords() {
    TRIGGER_WORDS.forEach(w => {
        if (UNLOCKED_WORDS.has(w.word.toLowerCase()))
            addHeaderWordChip(w.word, w.emoji, false);
    });
}

function addHeaderWordChip(word, emoji, animate) {
    if (!headerUnlockedWords) return;
    const id = "hw-" + word.toLowerCase().replace(/\s+/g, "-");
    if (document.getElementById(id)) return;
    const span = document.createElement("span");
    span.id = id;
    span.className = "header-word-chip" + (animate ? " hw-new" : "");
    span.textContent = emoji + " " + word;
    if (animate) setTimeout(() => span.classList.remove("hw-new"), 1000);
    headerUnlockedWords.appendChild(span);
}

// Sidopanel öppna/stäng
// Dölj sidopanelen från start på alla skärmstorlekar
sidebar?.classList.add("sidebar-hidden");

sidebarToggle?.addEventListener("click", () => sidebar.classList.add("sidebar-hidden"));
sidebarOpenBtn?.addEventListener("click", () => sidebar.classList.remove("sidebar-hidden"));

function setParticipantPanelOpen(isOpen) {
    if (!participantPanel || !participantToggle) return;
    participantPanel.hidden = !isOpen;
    participantToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

participantToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    setParticipantPanelOpen(participantPanel?.hidden ?? true);
});

participantClose?.addEventListener("click", () => setParticipantPanelOpen(false));

document.addEventListener("click", (e) => {
    if (!participantPanel || participantPanel.hidden) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (participantPanel.contains(target) || participantToggle?.contains(target)) return;
    setParticipantPanelOpen(false);
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        setParticipantPanelOpen(false);
    }
});

buildSidebar();
buildHeaderWords();

// ===== SignalR =====

const isBraveBrowser = !!navigator.brave;
const signalrTransportOptions = isBraveBrowser
    ? { transport: signalR.HttpTransportType.LongPolling }
    : undefined;
const hubUrl = `${SIGNALR_URL}${SIGNALR_URL.includes("?") ? "&" : "?"}username=${encodeURIComponent(MY_NAME)}&avatarId=${encodeURIComponent(MY_AVATAR_ID || "")}`;

const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, signalrTransportOptions)
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 2000 })
    .build();

const reconnectBanner = document.createElement("div");
reconnectBanner.id = "reconnect-banner";
reconnectBanner.className = "reconnect-banner";
reconnectBanner.textContent = "Återansluter...";
reconnectBanner.hidden = true;
document.querySelector(".chat-main").prepend(reconnectBanner);

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
            connection.start().catch(err => console.error("Manuell reconnect misslyckades:", err));
        }
    }, 3000);
}

async function startConnection() {
    try {
        await connection.start();
        stopManualReconnectLoop();
        reconnectBanner.hidden = true;
        sendBtn.disabled = false;
        messageInput.focus();
        // Hämta historik vid första anslutning (alla tillgängliga, upp till 200)
        if (lastMessageTime === null) {
            const veryOldDate = new Date(0); // 1970-01-01, får alla meddelanden från buffern
            await loadHistory(veryOldDate);
        }
    } catch (err) {
        console.error("SignalR-anslutning misslyckades:", err);
        reconnectBanner.hidden = false;
        sendBtn.disabled = true;
        startManualReconnectLoop();
    }
}

async function loadHistory(sinceDate) {
    try {
        const history = await connection.invoke("GetHistory", sinceDate);
        if (history && history.length > 0) {
            const sep = document.createElement("div");
            sep.className = "history-separator";
            sep.textContent = `— ${history.length} meddelande${history.length > 1 ? "n" : ""} från tidigare —`;
            messagesInner.insertBefore(sep, messagesInner.firstChild);

            // Historiken kommer i kronologisk ordning från servern.
            // Rendera i samma ordning så nyaste hamnar längst ner, precis som live-meddelanden.
            history.forEach(msg => {
                addMessage(msg.username, msg.text, msg.isHighlighted, msg.avatarId, msg.timestamp);
            });
        }
    } catch (err) {
        console.error("GetHistory misslyckades:", err);
    }
}

connection.onreconnecting(() => {
    reconnectBanner.hidden = false;
    sendBtn.disabled = true;
});
connection.onreconnected(async () => {
    stopManualReconnectLoop();
    reconnectBanner.hidden = true;
    sendBtn.disabled = false;
    // Hämta missade meddelanden från reconnect
    if (lastMessageTime !== null) {
        await loadHistory(lastMessageTime);
    }
});

connection.onclose(() => {
    reconnectBanner.hidden = false;
    sendBtn.disabled = true;
    startManualReconnectLoop();
});

// Kicka igång reconnect direkt när skärmen låses upp
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

connection.on("ReceiveMessage", (username, text, isHighlighted, avatarId, triggers, timestamp) => {
    lastMessageTime = timestamp;
    addMessage(username, text, isHighlighted, avatarId, timestamp);

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

connection.on("UpdateParticipants", (count) => {
    if (participantCountEl) participantCountEl.textContent = count;
});

connection.on("UpdateParticipantList", (participants) => {
    if (!participantList) return;
    participantList.innerHTML = "";

    if (!participants || participants.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "participant-list-empty";
        emptyItem.textContent = "Ingen är ansluten just nu";
        participantList.appendChild(emptyItem);
        return;
    }

    participants.forEach((name) => {
        const item = document.createElement("li");
        item.className = "participant-list-item";
        item.textContent = name;
        participantList.appendChild(item);
    });
});

// UserJoined-event är inaktiverad
// connection.on("UserJoined", (username) => {
//     addJoinMessage(username);
// });

sendBtn.disabled = true;
startConnection();

// ===== Skicka meddelande =====

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Emotikon/shortcode → emoji-konvertering (körs före sändning)
const EMOTICON_MAP = [
    // Ordning spelar roll — längre/specifika mönster först
    [/:'-\)/g,  "🥹"], [/:'-\(/g,  "😢"],
    [/:-?\)/g,  "😊"], [/:-?\(/g,  "😢"],
    [/:-?D/g,   "😄"], [/:-?P/g,   "😛"],
    [/;-?\)/g,  "😉"], [/:-?\*/g,  "😘"],
    [/:-?O/gi,  "😮"], [/>:-?\(/g, "😠"],
    [/\bXD\b/gi,"😂"], [/\bx3\b/gi,"🥰"],
    [/<3/g,     "❤️"], [/\b:\|/g,  "😐"],
    [/\^_\^/g,  "😊"], [/\^-\^/g,  "😊"],
    [/o\/o/gi,  "🙌"], [/\\o\//g,  "🙌"],
];

function applyEmoticons(text) {
    let result = text;
    for (const [pattern, emoji] of EMOTICON_MAP) {
        result = result.replace(pattern, emoji);
    }
    return result;
}

function sendMessage() {
    const raw = messageInput.value.trim();
    if (!raw) return;
    const text = applyEmoticons(raw);
    connection.invoke("SendMessage", text).catch(err => console.error(err));
    messageInput.value = "";
    updateCharCounter();
    messageInput.focus();
}

// ===== Hjälpfunktioner =====

function addMessage(username, text, isHighlighted, avatarId = null, timestamp = null) {
    const isOwn = username === MY_NAME;
    const previousMessage = findLastMessageElement();
    const isCompact = previousMessage
        && previousMessage.dataset.kind === "chat"
        && previousMessage.dataset.username === username;

    const wrapper = document.createElement("div");
    wrapper.className = "message"
        + (isOwn ? " own" : "")
        + (isHighlighted ? " highlighted" : "")
        + (isCompact ? " message-compact" : "");
    wrapper.dataset.kind = "chat";
    wrapper.dataset.username = username;

    const content = document.createElement("div");
    content.className = "message-content";

    const side = document.createElement("div");
    side.className = "message-side";

    const metaRow = document.createElement("div");
    metaRow.className = "message-meta-row";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = isOwn ? "Du" : username;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    const avatarImg = document.createElement("img");
    const effectiveAvatarId = avatarId || (isOwn ? MY_AVATAR_ID : "");
    avatarImg.src = generateAvatar(username, 36, effectiveAvatarId);
    avatarImg.alt = username.charAt(0).toUpperCase();
    avatar.appendChild(avatarImg);

    const body = document.createElement("div");
    body.className = "message-body";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    applyWordHighlights(bubble, text);

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = formatTime(timestamp ? new Date(timestamp) : new Date());

    metaRow.appendChild(meta);
    metaRow.appendChild(time);
    side.appendChild(avatar);
    body.appendChild(bubble);
    content.appendChild(side);
    content.appendChild(body);
    wrapper.appendChild(metaRow);
    wrapper.appendChild(content);
    messagesInner.appendChild(wrapper);

    // Ta bort äldsta meddelandet om vi passerar maxgränsen
    while (messagesInner.children.length > MAX_MESSAGES) {
        messagesInner.removeChild(messagesInner.firstChild);
    }

    onNewMessage();
}

function updateCounters(words, combos) {
    if (unlockedWordsEl) unlockedWordsEl.textContent = words;
    if (unlockedCombosEl) unlockedCombosEl.textContent = combos;
    if (sbWordsEl)  sbWordsEl.textContent = words;
    if (sbCombosEl) sbCombosEl.textContent = combos;
    bumpCounter("word-counter");
    bumpCounter("combo-counter");
}

function bumpCounter(id) {
    const el = document.getElementById(id);
    if (!el) return;
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

function randomJoinColor() {
    const h = Math.floor(Math.random() * 360);
    return {
        color:      `hsl(${h}, 70%, 72%)`,
        background: `hsla(${h}, 70%, 50%, 0.08)`,
        border:     `hsla(${h}, 70%, 60%, 0.35)`
    };
}

function addJoinMessage(username, avatarId = null) {
    const wrapper = document.createElement("div");
    wrapper.className = "message join-message";
    wrapper.dataset.kind = "join";

    const content = document.createElement("div");
    content.className = "message-content";

    const side = document.createElement("div");
    side.className = "message-side";

    const metaRow = document.createElement("div");
    metaRow.className = "message-meta-row";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = username;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    const avatarImg = document.createElement("img");
    avatarImg.src = generateAvatar(username, 36, avatarId);
    avatarImg.alt = username.charAt(0).toUpperCase();
    avatar.appendChild(avatarImg);

    const body = document.createElement("div");
    body.className = "message-body";

    const c = randomJoinColor();
    const bubble = document.createElement("div");
    bubble.className = "message-bubble join-bubble";
    bubble.style.color           = c.color;
    bubble.style.background      = c.background;
    bubble.style.borderColor     = c.border;
    bubble.textContent = "Är med på festen!";

    metaRow.appendChild(meta);
    side.appendChild(avatar);
    body.appendChild(bubble);
    content.appendChild(side);
    content.appendChild(body);
    wrapper.appendChild(metaRow);
    wrapper.appendChild(content);
    messagesInner.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

function formatTime(date) {
    return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function findLastMessageElement() {
    let el = messagesInner.lastElementChild;
    while (el) {
        if (el.classList && el.classList.contains("message")) {
            return el;
        }
        el = el.previousElementSibling;
    }
    return null;
}

// ===== Emoji-picker =====

const EMOJIS = [
    "🎉","🎂","🥳","🎊","🎈","🎁","🎀","🪩","🎸","🏆",
    "❤️","💖","💗","❤️‍🔥","💕","🥂","🍾","🍻","🥰","😍",
    "😂","🤣","😊","😄","😃","😎","🤩","🥹","😘","🤗",
    "👏","🙌","✨","💫","🔥","💯","⭐","🌟","📢","👑",
    "😋","😏","😜","🤪","😝","🫶","🤝","👋","🕺","💃",
    "🍕","🎵","🎶","🎯","🌈","🦄","🐣","🍀","☀️","🌙",
];

// Segmenter för korrekt hantering av multi-codepoint emojis (t.ex. ❤️‍🔥)
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter()
    : null;

function graphemeLength(str) {
    if (segmenter) return [...segmenter.segment(str)].length;
    return [...str].length; // spread hanterar surrogatpar
}

(function buildEmojiPicker() {
    if (!emojiPicker || !emojiBtn) return;
    EMOJIS.forEach(emoji => {
        const btn = document.createElement("button");
        btn.className = "emoji-item";
        btn.textContent = emoji;
        btn.type = "button";
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const pos = messageInput.selectionStart ?? messageInput.value.length;
            const val = messageInput.value;
            messageInput.value = val.slice(0, pos) + emoji + val.slice(pos);
            // Sätt cursor efter infogad emoji (UTF-16 code unit-längd)
            const newPos = pos + emoji.length;
            messageInput.setSelectionRange(newPos, newPos);
            messageInput.dispatchEvent(new Event("input"));
            messageInput.focus();
        });
        emojiPicker.appendChild(btn);
    });
})();

if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle("open");
    });

    document.addEventListener("click", () => {
        emojiPicker.classList.remove("open");
    });

    emojiPicker.addEventListener("click", (e) => e.stopPropagation());
}
