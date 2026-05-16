// projector.js — projektor-läge, tar emot meddelanden men kan inte skicka
// Visar meddelanden i ett stort rullande flöde för visning på storskärm/projektor

const projChatList = document.getElementById("projector-chat-list");
const projUserList = document.getElementById("proj-user-list");
const projWordsEl = document.getElementById("proj-words");
const projCombosEl = document.getElementById("proj-combos");
const projParticipantsEl = document.getElementById("proj-participants");
const projTotalMessagesEl = document.getElementById("proj-total-messages");
const projHourlyBarsEl = document.getElementById("proj-hourly-bars");
const projLatestVmaEl = document.getElementById("proj-latest-vma");
const projectorColumnsEl = document.getElementById("projector-columns");
const projectorSlideshowToggleEl = document.getElementById("projector-slideshow-toggle");
const projectorSlideshowEl = document.getElementById("projector-slideshow");
const projectorSlideshowImageEl = document.getElementById("projector-slideshow-image");
const projectorSlideshowCaptionEl = document.getElementById("projector-slideshow-caption");
const triggerOverlay = document.getElementById("trigger-overlay");
const triggerPopup = document.getElementById("trigger-popup");

const MAX_MESSAGES = 120;
const IMAGE_MESSAGE_PREFIX = "[[IMG]]";
const SLIDESHOW_START_EVERY_MS = 10 * 60 * 1000;
const SLIDESHOW_IMAGE_EVERY_MS = 4500;
const MAX_SLIDESHOW_IMAGES = 20;

const projectorMessageBuffer = [];
const imageMessageBuffer = [];
const hourlyMessageCounts = Array.isArray(HOURLY_MESSAGE_COUNTS)
    ? [...HOURLY_MESSAGE_COUNTS]
    : new Array(12).fill(0);
const chartHours = new Array(12).fill(0);
let currentChartHour = null;
let slideshowActive = false;

while (hourlyMessageCounts.length < 12) {
    hourlyMessageCounts.push(0);
}

if (hourlyMessageCounts.length > 12) {
    hourlyMessageCounts.splice(0, hourlyMessageCounts.length - 12);
}

function getStockholmHour(dateValue = new Date()) {
    return parseInt(
        new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", hour12: false, timeZone: "Europe/Stockholm" }).format(dateValue),
        10
    );
}

function alignHourlyWindow() {
    const nowHour = getStockholmHour();

    if (currentChartHour === null) {
        currentChartHour = nowHour;
        for (let i = 11; i >= 0; i--) {
            chartHours[11 - i] = (nowHour - i + 24) % 24;
        }
        return;
    }

    let safety = 0;
    while (currentChartHour !== nowHour && safety < 24) {
        currentChartHour = (currentChartHour + 1) % 24;
        chartHours.shift();
        chartHours.push(currentChartHour);
        hourlyMessageCounts.shift();
        hourlyMessageCounts.push(0);
        safety++;
    }
}

alignHourlyWindow();

if (projectorSlideshowEl) {
    projectorSlideshowEl.hidden = true;
}

if (projectorColumnsEl) {
    projectorColumnsEl.hidden = false;
}

const isBraveBrowser = !!navigator.brave;
const signalrTransportOptions = isBraveBrowser
    ? { transport: signalR.HttpTransportType.LongPolling }
    : undefined;

const connection = new signalR.HubConnectionBuilder()
    .withUrl(SIGNALR_URL, signalrTransportOptions)
    .withAutomaticReconnect()
    .build();

const stockholmTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Stockholm"
});

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
    const imagePayload = parseImageMessage(text);
    const termsSourceText = imagePayload?.caption || text;

    if (isAnnouncement && projLatestVmaEl) {
        projLatestVmaEl.textContent = text;
    }

    if (projTotalMessagesEl) {
        const current = parseInt(projTotalMessagesEl.textContent || "0", 10);
        projTotalMessagesEl.textContent = String((Number.isNaN(current) ? 0 : current) + 1);
    }

    const parsedTimestamp = new Date(timestamp || Date.now());
    alignHourlyWindow();
    const hourIndex = getStockholmHour(parsedTimestamp);
    const visibleIndex = chartHours.indexOf(hourIndex);
    if (visibleIndex >= 0) {
        hourlyMessageCounts[visibleIndex] = (hourlyMessageCounts[visibleIndex] || 0) + 1;
        renderHourlyChart();
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
    const messageTerms = extractMessageTerms(termsSourceText);
    const justUnlocked = new Set((triggers.newWords || []).map(w => w.word.toLowerCase()));
    const alreadyFound = TRIGGER_WORDS.some(tw =>
        UNLOCKED_WORDS.has(tw.word.toLowerCase()) &&
        !justUnlocked.has(tw.word.toLowerCase()) &&
        messageTerms.has(tw.word.toLowerCase())
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
renderHourlyChart();
startSlideshowLoop();

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
    const imagePayload = parseImageMessage(text);

    projectorMessageBuffer.push({
        username,
        text,
        imagePayload,
        isHighlighted,
        avatarId,
        timestamp: timestamp || new Date().toISOString(),
        isAnnouncement
    });

    if (imagePayload) {
        imageMessageBuffer.push({
            username,
            timestamp: timestamp || new Date().toISOString(),
            imagePayload
        });

        while (imageMessageBuffer.length > 200) {
            imageMessageBuffer.shift();
        }
    }

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

    scrollProjectorChatToBottom();
}

function scrollProjectorChatToBottom() {
    if (!projChatList) return;

    requestAnimationFrame(() => {
        projChatList.scrollTop = projChatList.scrollHeight;
    });
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
    timeEl.textContent = stockholmTimeFormatter.format(new Date(message.timestamp || Date.now()));

    header.appendChild(avatarEl);
    header.appendChild(nameEl);
    header.appendChild(timeEl);

    const textEl = document.createElement("div");
    textEl.className = "proj-message-text";
    if (message.imagePayload) {
        const img = document.createElement("img");
        img.className = "proj-message-image";
        img.src = message.imagePayload.url;
        img.alt = message.imagePayload.caption || "Uppladdad bild";
        img.loading = "eager";
        img.decoding = "async";
        img.addEventListener("load", scrollProjectorChatToBottom, { once: true });
        img.addEventListener("error", scrollProjectorChatToBottom, { once: true });
        textEl.appendChild(img);

        if (message.imagePayload.caption) {
            const captionEl = document.createElement("div");
            captionEl.className = "proj-message-image-caption";
            applyWordHighlights(captionEl, message.imagePayload.caption);
            textEl.appendChild(captionEl);
        }
    } else {
        applyWordHighlights(textEl, message.text);
    }

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

function renderHourlyChart() {
    if (!projHourlyBarsEl) return;
    alignHourlyWindow();
    projHourlyBarsEl.innerHTML = "";
    const maxValue = Math.max(1, ...hourlyMessageCounts);
    const currentHour = getStockholmHour();

    for (let i = 0; i < chartHours.length; i++) {
        const hour = chartHours[i];
        const count = hourlyMessageCounts[i] || 0;
        const barItem = document.createElement("div");
        barItem.className = "projector-hourly-item" + (hour === currentHour ? " is-current" : "");

        const bar = document.createElement("div");
        bar.className = "projector-hourly-bar";
        const heightPercent = Math.max(4, Math.round((count / maxValue) * 100));
        bar.style.height = `${heightPercent}%`;
        bar.title = `${hour.toString().padStart(2, "0")}:00 - ${count} meddelanden`;

        const label = document.createElement("div");
        label.className = "projector-hourly-label";
        label.textContent = hour.toString().padStart(2, "0");

        barItem.appendChild(bar);
        barItem.appendChild(label);
        projHourlyBarsEl.appendChild(barItem);
    }
}

function applyWordHighlights(container, text) {
    const triggerTerms = new Set(TRIGGER_WORDS.map(w => w.word.toLowerCase()));
    const tokenPattern = /[\p{L}\p{N}_]+/gu;
    let lastIndex = 0;

    for (const match of text.matchAll(tokenPattern)) {
        const token = match[0];
        const start = match.index ?? 0;
        const end = start + token.length;

        if (start > lastIndex) {
            container.appendChild(document.createTextNode(text.slice(lastIndex, start)));
        }

        if (triggerTerms.has(token.toLowerCase())) {
            const span = document.createElement("span");
            span.className = "trigger-word-highlight";
            span.textContent = token;
            container.appendChild(span);
        } else {
            container.appendChild(document.createTextNode(token));
        }

        lastIndex = end;
    }

    if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
}

function extractMessageTerms(text) {
    const matches = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
    return new Set(matches);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function parseImageMessage(text) {
    if (typeof text !== "string" || !text.startsWith(IMAGE_MESSAGE_PREFIX)) {
        return null;
    }

    try {
        const payload = JSON.parse(text.slice(IMAGE_MESSAGE_PREFIX.length));
        if (!payload || typeof payload.url !== "string" || !payload.url) {
            return null;
        }

        return {
            url: payload.url,
            caption: typeof payload.caption === "string" ? payload.caption : ""
        };
    } catch {
        return null;
    }
}

function showSlideshow() {
    if (slideshowActive) {
        return;
    }

    if (!projectorSlideshowEl || !projectorColumnsEl || imageMessageBuffer.length === 0) {
        return;
    }

    slideshowActive = true;

    projectorColumnsEl.hidden = true;
    projectorSlideshowEl.hidden = false;

    let slides = imageMessageBuffer
        .map(item => ({
            username: item.username,
            url: item.imagePayload?.url || "",
            caption: item.imagePayload?.caption || ""
        }))
        .filter(item => !!item.url);

    if (slides.length > MAX_SLIDESHOW_IMAGES) {
        slides = shuffleArray(slides).slice(0, MAX_SLIDESHOW_IMAGES);
    }

    if (slides.length === 0) {
        projectorSlideshowEl.hidden = true;
        projectorColumnsEl.hidden = false;
        slideshowActive = false;
        return;
    }

    let index = 0;
    let rotationTimer = null;

    const stopSlideshow = () => {
        if (rotationTimer) {
            clearInterval(rotationTimer);
        }

        projectorSlideshowEl.hidden = true;
        projectorColumnsEl.hidden = false;
        if (projectorSlideshowImageEl) {
            projectorSlideshowImageEl.removeAttribute("src");
        }
        if (projectorSlideshowCaptionEl) {
            projectorSlideshowCaptionEl.textContent = "";
        }
        slideshowActive = false;
    };

    const setSlide = () => {
        if (index >= slides.length) {
            stopSlideshow();
            return;
        }

        const item = slides[index];
        if (!item) return;

        projectorSlideshowImageEl.src = item.url;
        const caption = item.caption
            ? `${item.username}: ${item.caption}`
            : `Bild uppladdad av ${item.username}`;
        projectorSlideshowCaptionEl.textContent = caption;
        index++;
    };

    setSlide();
    if (slides.length > 1) {
        rotationTimer = setInterval(setSlide, SLIDESHOW_IMAGE_EVERY_MS);
    } else {
        setTimeout(stopSlideshow, SLIDESHOW_IMAGE_EVERY_MS);
    }
}

function shuffleArray(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function startSlideshowLoop() {
    setInterval(() => {
        if (imageMessageBuffer.length === 0) {
            return;
        }

        showSlideshow();
    }, SLIDESHOW_START_EVERY_MS);
}

projectorSlideshowToggleEl?.addEventListener("click", () => {
    showSlideshow();
});
