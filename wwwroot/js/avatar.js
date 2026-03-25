// avatar.js — Deterministisk tecknad ansiktsavatar baserad på användarnamn.
// Genererar ett unikt SVG-ansikte (hår, ögon, mun, tillbehör) utan externa tjänster.

function _h(str, salt) {
    let v = 0;
    const s = str + (salt || '');
    for (let i = 0; i < s.length; i++) v = Math.imul(31, v) + s.charCodeAt(i) | 0;
    return Math.abs(v);
}

function generateAvatar(username, size) {
    size = size || 36;
    const name = username || '?';

    // Separata hash-värden per attribut för maximal variation
    const h0 = _h(name);
    const h1 = _h(name, 'eye');
    const h2 = _h(name, 'hair');
    const h3 = _h(name, 'mouth');
    const h4 = _h(name, 'acc');
    const h5 = _h(name, 'blush');

    const bgPalette = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff',
                       '#f77f00','#00b4d8','#e040fb','#ff4081','#69f0ae',
                       '#f7b731','#e84393','#00cec9','#a29bfe'];
    const skinTones  = ['#ffd5b4','#f4c491','#e8a87c','#c68642','#a0522d','#ffdbac'];
    const hairColors = ['#2d1b00','#7b3f00','#ffd700','#ff6b6b','#c77dff',
                        '#1a1a2e','#e84393','#4d96ff','#ffffff','#00b894'];

    const bg        = bgPalette[h0 % bgPalette.length];
    const skin      = skinTones[h1 % skinTones.length];
    const hair      = hairColors[h2 % hairColors.length];
    const irisColor = ['#2d3436','#1a3a5c','#0d6e6e','#4a0080','#6d4c41','#1e6b3a'][h3 % 6];

    const hairStyle  = h0 % 5;  // 0=kort, 1=lång, 2=afro, 3=knutar, 4=taggig
    const eyeStyle   = h1 % 3;  // 0=anime, 1=prick, 2=lycklig (^_^)
    const mouthStyle = h2 % 4;  // 0=leende, 1=bred grin, 2=smirk, 3=förvånad
    const hasBlush   = (h5 % 3) === 0;
    const accessory  = h4 % 5;  // 0=inget, 1=glasögon, 2=festhatt, 3=rosett, 4=inget
    const browColor  = '#3d2b1f';
    const eyeY       = 52;

    const p = [];

    // ── Bakgrund ─────────────────────────────────────────────────────────
    p.push(`<circle cx="50" cy="50" r="50" fill="${bg}"/>`);

    // ── Öron (bakom ansikte) ─────────────────────────────────────────────
    p.push(`<circle cx="15" cy="58" r="9" fill="${skin}"/>`);
    p.push(`<circle cx="85" cy="58" r="9" fill="${skin}"/>`);
    p.push(`<circle cx="15" cy="58" r="5" fill="${bg}" opacity="0.25"/>`);
    p.push(`<circle cx="85" cy="58" r="5" fill="${bg}" opacity="0.25"/>`);

    // ── Hår (bakom ansikte) ──────────────────────────────────────────────
    if (hairStyle === 0) {
        // Kort rundat
        p.push(`<ellipse cx="50" cy="26" rx="31" ry="19" fill="${hair}"/>`);
    } else if (hairStyle === 1) {
        // Långt — rektangel med avrundade kanter
        p.push(`<rect x="18" y="22" width="64" height="72" rx="10" fill="${hair}"/>`);
    } else if (hairStyle === 2) {
        // Afro — stor cirkel
        p.push(`<circle cx="50" cy="40" r="35" fill="${hair}"/>`);
        p.push(`<circle cx="50" cy="40" r="35" fill="${hair}" opacity="0.3"/>`);
    } else if (hairStyle === 3) {
        // Knutar
        p.push(`<ellipse cx="50" cy="28" rx="23" ry="16" fill="${hair}"/>`);
        p.push(`<circle cx="28" cy="16" r="12" fill="${hair}"/>`);
        p.push(`<circle cx="72" cy="16" r="12" fill="${hair}"/>`);
    } else {
        // Taggig
        p.push(`<polygon points="20,32 30,8 40,28 50,4 60,28 70,8 80,32" fill="${hair}"/>`);
        p.push(`<rect x="18" y="28" width="64" height="16" fill="${hair}"/>`);
    }

    // ── Ansikte ──────────────────────────────────────────────────────────
    p.push(`<circle cx="50" cy="58" r="37" fill="${skin}"/>`);

    // ── Hår (framkant) ───────────────────────────────────────────────────
    if (hairStyle === 0) {
        p.push(`<rect x="19" y="27" width="62" height="13" fill="${hair}"/>`);
    } else if (hairStyle === 1) {
        p.push(`<rect x="18" y="22" width="12" height="32" rx="6" fill="${hair}"/>`);
        p.push(`<rect x="70" y="22" width="12" height="32" rx="6" fill="${hair}"/>`);
        p.push(`<rect x="18" y="22" width="64" height="13" fill="${hair}"/>`);
    } else if (hairStyle === 3) {
        p.push(`<rect x="24" y="28" width="52" height="14" fill="${hair}"/>`);
    } else if (hairStyle === 4) {
        p.push(`<rect x="18" y="28" width="64" height="12" fill="${hair}"/>`);
    }

    // ── Rodnad ───────────────────────────────────────────────────────────
    if (hasBlush) {
        p.push(`<circle cx="28" cy="66" r="8" fill="#ff9999" opacity="0.48"/>`);
        p.push(`<circle cx="72" cy="66" r="8" fill="#ff9999" opacity="0.48"/>`);
    }

    // ── Ögonbryn ─────────────────────────────────────────────────────────
    if (eyeStyle !== 2) {
        p.push(`<path d="M28,43 Q35,39 42,43" stroke="${browColor}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
        p.push(`<path d="M58,43 Q65,39 72,43" stroke="${browColor}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
    }

    // ── Ögon ─────────────────────────────────────────────────────────────
    if (eyeStyle === 0) {
        // Anime-ögon
        p.push(`<ellipse cx="35" cy="${eyeY}" rx="9" ry="9" fill="white"/>`);
        p.push(`<ellipse cx="65" cy="${eyeY}" rx="9" ry="9" fill="white"/>`);
        p.push(`<circle cx="36" cy="${eyeY}" r="6" fill="${irisColor}"/>`);
        p.push(`<circle cx="66" cy="${eyeY}" r="6" fill="${irisColor}"/>`);
        p.push(`<circle cx="35" cy="${eyeY}" r="3.2" fill="#111"/>`);
        p.push(`<circle cx="65" cy="${eyeY}" r="3.2" fill="#111"/>`);
        p.push(`<circle cx="38" cy="${eyeY - 2.5}" r="2" fill="white"/>`);
        p.push(`<circle cx="68" cy="${eyeY - 2.5}" r="2" fill="white"/>`);
    } else if (eyeStyle === 1) {
        // Prickögon med glans
        p.push(`<circle cx="35" cy="${eyeY}" r="6" fill="${irisColor}"/>`);
        p.push(`<circle cx="65" cy="${eyeY}" r="6" fill="${irisColor}"/>`);
        p.push(`<circle cx="37.5" cy="${eyeY - 2}" r="2" fill="white" opacity="0.8"/>`);
        p.push(`<circle cx="67.5" cy="${eyeY - 2}" r="2" fill="white" opacity="0.8"/>`);
    } else {
        // Lyckliga slutna ögon ^_^
        p.push(`<path d="M27,${eyeY+1} Q35,${eyeY-7} 43,${eyeY+1}" stroke="${browColor}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`);
        p.push(`<path d="M57,${eyeY+1} Q65,${eyeY-7} 73,${eyeY+1}" stroke="${browColor}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`);
    }

    // ── Näsa ─────────────────────────────────────────────────────────────
    p.push(`<circle cx="50" cy="64" r="2.2" fill="rgba(0,0,0,0.13)"/>`);

    // ── Mun ──────────────────────────────────────────────────────────────
    if (mouthStyle === 0) {
        // Enkelt leende
        p.push(`<path d="M37,72 Q50,84 63,72" stroke="#a0522d" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
    } else if (mouthStyle === 1) {
        // Bred grin med tänder
        p.push(`<path d="M36,70 Q50,86 64,70 Q50,74 36,70Z" fill="#cc2222"/>`);
        p.push(`<rect x="36" y="69" width="28" height="6" rx="2" fill="white"/>`);
        p.push(`<path d="M36,70 Q50,86 64,70" stroke="#a0522d" stroke-width="1.5" fill="none"/>`);
    } else if (mouthStyle === 2) {
        // Smirk
        p.push(`<path d="M38,74 Q49,80 60,70" stroke="#a0522d" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
    } else {
        // Förvånad O
        p.push(`<ellipse cx="50" cy="75" rx="9" ry="8" fill="#cc2222"/>`);
        p.push(`<ellipse cx="50" cy="75" rx="6" ry="5" fill="#ff8888"/>`);
    }

    // ── Tillbehör ─────────────────────────────────────────────────────────
    if (accessory === 1) {
        // Glasögon
        p.push(`<circle cx="35" cy="${eyeY}" r="11" fill="rgba(200,230,255,0.15)" stroke="#333" stroke-width="2.5"/>`);
        p.push(`<circle cx="65" cy="${eyeY}" r="11" fill="rgba(200,230,255,0.15)" stroke="#333" stroke-width="2.5"/>`);
        p.push(`<line x1="46" y1="${eyeY}" x2="54" y2="${eyeY}" stroke="#333" stroke-width="2"/>`);
        p.push(`<line x1="11" y1="${eyeY-1}" x2="24" y2="${eyeY}" stroke="#333" stroke-width="1.5"/>`);
        p.push(`<line x1="76" y1="${eyeY}" x2="89" y2="${eyeY-1}" stroke="#333" stroke-width="1.5"/>`);
    } else if (accessory === 2) {
        // Festhatt 🎉
        const hatFill  = bgPalette[(h4 + 4) % bgPalette.length];
        const hatStripe = bgPalette[(h4 + 7) % bgPalette.length];
        p.push(`<polygon points="50,0 26,36 74,36" fill="${hatFill}"/>`);
        // Ränder på hatten
        p.push(`<polygon points="50,0 42,20 58,20" fill="${hatStripe}" opacity="0.55"/>`);
        p.push(`<polygon points="50,0 34,32 44,32 38,18 50,0" fill="white" opacity="0.12"/>`);
        // Brätte
        p.push(`<rect x="24" y="34" width="52" height="7" rx="3.5" fill="${hatStripe}"/>`);
        // Pompom i toppen
        p.push(`<circle cx="50" cy="2" r="5" fill="white" opacity="0.9"/>`);
        // Prickar
        p.push(`<circle cx="42" cy="17" r="3" fill="white" opacity="0.65"/>`);
        p.push(`<circle cx="59" cy="23" r="2.5" fill="white" opacity="0.65"/>`);
        p.push(`<circle cx="52" cy="8" r="2" fill="white" opacity="0.65"/>`);
    } else if (accessory === 3) {
        // Rosett/strikse
        const bowFill = bgPalette[(h4 + 3) % bgPalette.length];
        p.push(`<path d="M36,25 Q43,17 50,25 Q57,17 64,25 Q57,33 50,25 Q43,33 36,25Z" fill="${bowFill}"/>`);
        p.push(`<circle cx="50" cy="25" r="4.5" fill="${bowFill}"/>`);
        p.push(`<circle cx="50" cy="25" r="2.5" fill="white" opacity="0.4"/>`);
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${p.join('')}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
