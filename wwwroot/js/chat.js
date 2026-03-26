// chat.js — hanterar real-time chatt och sidopanel via SignalR
// MY_NAME, TRIGGER_WORDS, TRIGGER_COMBOS, UNLOCKED_WORDS, UNLOCKED_COMBOS
// injiceras server-side från Chat.cshtml

const messagesInner     = document.getElementById("messages-inner");
const messagesContainer = document.getElementById("messages");
const scrollToBottomBtn = document.getElementById("scroll-to-bottom");
const messageInput      = document.getElementById("message-input");
const sendBtn           = document.getElementById("send-btn");
const charCounter       = document.getElementById("char-counter");
const MAX_LENGTH       = 256;

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

function isNearBottom() {
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 120;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    scrollToBottomBtn.hidden = true;
}

function onNewMessage() {
    if (isNearBottom()) {
        scrollToBottom();
    } else {
        scrollToBottomBtn.hidden = false;
    }
}

messagesContainer.addEventListener("scroll", () => {
    if (isNearBottom()) scrollToBottomBtn.hidden = true;
});

scrollToBottomBtn.addEventListener("click", scrollToBottom);
const emojiBtn         = document.getElementById("emoji-btn");
const emojiPicker      = document.getElementById("emoji-picker");
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
sidebarToggle?.addEventListener("click", () => sidebar.classList.add("sidebar-hidden"));
sidebarOpenBtn?.addEventListener("click", () => sidebar.classList.remove("sidebar-hidden"));

buildSidebar();
buildHeaderWords();

// ===== SignalR =====

const connection = new signalR.HubConnectionBuilder()
    .withUrl(SIGNALR_URL)
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 2000 })
    .build();

const reconnectBanner = document.createElement("div");
reconnectBanner.id = "reconnect-banner";
reconnectBanner.className = "reconnect-banner";
reconnectBanner.textContent = "Återansluter...";
reconnectBanner.hidden = true;
document.querySelector(".chat-main").prepend(reconnectBanner);

connection.onreconnecting(() => { reconnectBanner.hidden = false; });
connection.onreconnected(() => { reconnectBanner.hidden = true; });

// Kicka igång reconnect direkt när skärmen låses upp
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && connection.state === signalR.HubConnectionState.Disconnected) {
        connection.start().catch(err => console.error("Reconnect misslyckades:", err));
    }
});

connection.on("ReceiveMessage", (username, text, isHighlighted, triggers) => {
    addMessage(username, text, isHighlighted);

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
    document.getElementById("participant-count").textContent = count;
});

connection.on("UserJoined", (username) => {
    addJoinMessage(username);
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

function addMessage(username, text, isHighlighted) {
    const isOwn = username === MY_NAME;

    const wrapper = document.createElement("div");
    wrapper.className = "message" + (isOwn ? " own" : "") + (isHighlighted ? " highlighted" : "");

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
    applyWordHighlights(bubble, text);

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = formatTime(new Date());

    body.appendChild(meta);
    body.appendChild(bubble);
    body.appendChild(time);
    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    messagesInner.appendChild(wrapper);

    onNewMessage();
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

function randomJoinColor() {
    const h = Math.floor(Math.random() * 360);
    return {
        color:      `hsl(${h}, 70%, 72%)`,
        background: `hsla(${h}, 70%, 50%, 0.08)`,
        border:     `hsla(${h}, 70%, 60%, 0.35)`
    };
}

function addJoinMessage(username) {
    const wrapper = document.createElement("div");
    wrapper.className = "message join-message";

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
    meta.textContent = username;

    const c = randomJoinColor();
    const bubble = document.createElement("div");
    bubble.className = "message-bubble join-bubble";
    bubble.style.color           = c.color;
    bubble.style.background      = c.background;
    bubble.style.borderColor     = c.border;
    bubble.textContent = "Är med på festen! 🎉";

    body.appendChild(meta);
    body.appendChild(bubble);
    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
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

emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle("open");
});

document.addEventListener("click", () => {
    emojiPicker.classList.remove("open");
});

emojiPicker.addEventListener("click", (e) => e.stopPropagation());
