// avatar.js — Deterministisk SVG-avatar baserad på användarnamn
// Genererar en unik färg + mönsterkombination utan externa tjänster.
// Inkluderas i _Layout.cshtml och används av chat.js och projector.js.

const AVATAR_PALETTE = [
    '#f7b731', '#e84393', '#a29bfe', '#fd79a8',
    '#fdcb6e', '#6c5ce7', '#00cec9', '#e17055',
    '#74b9ff', '#55efc4', '#fab1a0', '#81ecec',
    '#ff7675', '#00b894', '#0984e3', '#d63031'
];

function _avatarHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h);
}

// Returnerar en SVG data-URL med en unik avatar för given användare.
// size: sidlängd i px (cirkulär).
function generateAvatar(username, size = 36) {
    const h = _avatarHash(username || '?');
    const bg      = AVATAR_PALETTE[h % AVATAR_PALETTE.length];
    const ring    = AVATAR_PALETTE[(h >>> 4) % AVATAR_PALETTE.length];
    const initial = (username || '?').charAt(0).toUpperCase();

    // Välj textfärg baserat på bakgrundens ljusstyrka
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 140 ? '#111111' : '#ffffff';

    const cx = size / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cx}" r="${cx}" fill="${bg}"/>
      <circle cx="${cx}" cy="${cx}" r="${cx * 0.62}" fill="${ring}" opacity="0.38"/>
      <text x="${cx}" y="${cx * 1.38}" text-anchor="middle" font-size="${cx * 0.9}" font-weight="700" font-family="'Segoe UI',sans-serif" fill="${textColor}">${initial}</text>
    </svg>`;

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
