// login-avatar.js - avatarförhandsvisning och val på inloggningssidan

(function initLoginAvatarChooser() {
    const usernameInput = document.getElementById("username");
    const previewImg = document.getElementById("login-avatar-preview");
    const avatarBtn = document.getElementById("login-avatar-btn");
    const avatarIdInput = document.getElementById("avatar-id");

    if (!usernameInput || !previewImg || !avatarBtn || !avatarIdInput || typeof generateAvatar !== "function") {
        return;
    }

    const STORAGE_KEY = "danne_avatar_map_v1";

    function normalizeName(name) {
        return String(name || "").trim().toLowerCase();
    }

    function getAvatarMap() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }

    function saveAvatarMap(map) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        } catch {
            // Ignorera om storage är blockerat.
        }
    }

    function createAvatarId() {
        const randomPart = Math.random().toString(36).slice(2, 10);
        return `av-${Date.now().toString(36)}-${randomPart}`;
    }

    function resolveAvatarIdForCurrentName() {
        const key = normalizeName(usernameInput.value);
        if (!key) {
            return "guest-preview";
        }

        const map = getAvatarMap();
        if (!map[key]) {
            map[key] = createAvatarId();
            saveAvatarMap(map);
        }

        return map[key];
    }

    function renderPreview() {
        const currentName = String(usernameInput.value || "").trim() || "?";
        const avatarId = resolveAvatarIdForCurrentName();
        avatarIdInput.value = avatarId;
        previewImg.src = generateAvatar(currentName, 96, avatarId);
    }

    avatarBtn.addEventListener("click", () => {
        const key = normalizeName(usernameInput.value);
        if (!key) {
            renderPreview();
            return;
        }

        const map = getAvatarMap();
        map[key] = createAvatarId();
        saveAvatarMap(map);
        renderPreview();
    });

    usernameInput.addEventListener("input", renderPreview);

    usernameInput.form?.addEventListener("submit", () => {
        avatarIdInput.value = resolveAvatarIdForCurrentName();
    });

    renderPreview();
})();
