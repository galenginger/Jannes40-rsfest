// avatar.js — Deterministisk tecknad ansiktsavatar baserad på användarnamn.
// Genererar ett unikt SVG-ansikte (hår, ögon, mun, tillbehör) utan externa tjänster.

function _h(str, salt) {
    let v = 0;
    const s = str + (salt || '');
    for (let i = 0; i < s.length; i++) v = Math.imul(31, v) + s.charCodeAt(i) | 0;
    return Math.abs(v);
}

function generateAvatar(username, size, avatarId) {
    size = size || 36;
    const name = username || '?';
    const seed = avatarId ? `${name}|${avatarId}` : name;

    // Separata hash-värden per attribut för maximal variation
    const h0 = _h(seed);
    const h1 = _h(seed, 'eye');
    const h2 = _h(seed, 'hair');
    const h3 = _h(seed, 'mouth');
    const h4 = _h(seed, 'acc');
    const h5 = _h(seed, 'blush');

    const bgPalette = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff',
                       '#f77f00','#00b4d8','#e040fb','#ff4081','#69f0ae',
                       '#f7b731','#e84393','#00cec9','#a29bfe'];
    const skinTones  = ['#ffd5b4','#f4c491','#e8a87c','#c68642','#a0522d','#ffdbac'];
    const alienSkins = ['#8dfc73', '#64e8ff', '#9cffc6', '#b0ff7a', '#95f3ff'];
    const robotSkins = ['#b8c4cf', '#a5b3bf', '#c3ccd6', '#9aa9b8', '#d2d8df'];
    const hairColors = ['#2d1b00','#7b3f00','#ffd700','#ff6b6b','#c77dff',
                        '#1a1a2e','#e84393','#4d96ff','#ffffff','#00b894'];

    const speciesStyle = h5 % 12;
    const isAlien = speciesStyle === 0 || speciesStyle === 7;
    const isRobot = speciesStyle === 1 || speciesStyle === 8;

    const bg        = bgPalette[h0 % bgPalette.length];
    const skin      = isRobot
        ? robotSkins[h1 % robotSkins.length]
        : isAlien
            ? alienSkins[h1 % alienSkins.length]
            : skinTones[h1 % skinTones.length];
    const hair      = isRobot ? '#687785' : hairColors[h2 % hairColors.length];
    const irisColor = isRobot
        ? ['#76e4ff', '#9bff6e', '#ff7bd5', '#ffd166'][h3 % 4]
        : isAlien
            ? ['#1d1135', '#301934', '#0a2239', '#001f2f'][h3 % 4]
            : ['#2d3436','#1a3a5c','#0d6e6e','#4a0080','#6d4c41','#1e6b3a'][h3 % 6];

    const hairStyle  = h0 % 11;  // 0=kort, 1=lång, 2=afro, 3=knutar, 4=taggig, 5=mohawk, 6=undercut, 7=lockig lugg, 8=hästsvans, 9=bob, 10=långa vågor
    const eyeStyle   = h1 % 8;  // 0=anime, 1=prick, 2=lycklig (^_^), 3=blink, 4=sömnig, 5=arg, 6=spiral, 7=stjärnögon
    const mouthStyle = h2 % 9;  // 0=leende, 1=grin, 2=smirk, 3=förvånad, 4=rak smile, 5=tunga, 6=flin, 7=sur, 8=biten läpp
    const robotMouthStyle = h3 % 3;
    const hasBlush   = (h5 % 3) === 0;
    const hasFeminineTouch = !isRobot && (h5 % 4 === 0 || h4 % 7 === 0);
    const hasLashes = hasFeminineTouch && (h1 % 2 === 0);
    const hasLipGloss = hasFeminineTouch && (h3 % 2 === 1);
    const accessory  = h4 % 8;  // 0=inget, 1=glasögon, 2=festhatt, 3=rosett, 4=mustasch, 5=örhängen, 6=krona, 7=inget
    const browColor  = isRobot ? '#51606d' : isAlien ? '#274e13' : '#3d2b1f';
    const eyeY       = 52;

    const p = [];

    // Ingen fast bakgrund: avataren blir transparent runt ansiktet.

    // ── Öron (bakom ansikte) ─────────────────────────────────────────────
    if (isRobot) {
        p.push(`<rect x="8" y="52" width="10" height="12" rx="2" fill="#8d9aa6" stroke="#64717d" stroke-width="1"/>`);
        p.push(`<rect x="82" y="52" width="10" height="12" rx="2" fill="#8d9aa6" stroke="#64717d" stroke-width="1"/>`);
        p.push(`<circle cx="13" cy="58" r="2" fill="#6d7a86"/>`);
        p.push(`<circle cx="87" cy="58" r="2" fill="#6d7a86"/>`);
    } else if (isAlien) {
        p.push(`<ellipse cx="14" cy="58" rx="7" ry="11" fill="${skin}"/>`);
        p.push(`<ellipse cx="86" cy="58" rx="7" ry="11" fill="${skin}"/>`);
        p.push(`<circle cx="14" cy="58" r="2" fill="rgba(255,255,255,0.25)"/>`);
        p.push(`<circle cx="86" cy="58" r="2" fill="rgba(255,255,255,0.25)"/>`);
    } else {
        p.push(`<circle cx="15" cy="58" r="9" fill="${skin}"/>`);
        p.push(`<circle cx="85" cy="58" r="9" fill="${skin}"/>`);
        p.push(`<circle cx="15" cy="58" r="5" fill="rgba(0,0,0,0.12)"/>`);
        p.push(`<circle cx="85" cy="58" r="5" fill="rgba(0,0,0,0.12)"/>`);
    }

    // ── Hår (bakom ansikte) ──────────────────────────────────────────────
    if (!isRobot && hairStyle === 0) {
        // Kort rundat
        p.push(`<ellipse cx="50" cy="26" rx="31" ry="19" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 1) {
        // Långt — rektangel med avrundade kanter
        p.push(`<rect x="18" y="22" width="64" height="72" rx="10" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 2) {
        // Afro — stor cirkel
        p.push(`<circle cx="50" cy="40" r="35" fill="${hair}"/>`);
        p.push(`<circle cx="50" cy="40" r="35" fill="${hair}" opacity="0.3"/>`);
    } else if (!isRobot && hairStyle === 3) {
        // Knutar
        p.push(`<ellipse cx="50" cy="28" rx="23" ry="16" fill="${hair}"/>`);
        p.push(`<circle cx="28" cy="16" r="12" fill="${hair}"/>`);
        p.push(`<circle cx="72" cy="16" r="12" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 4) {
        // Taggig
        p.push(`<polygon points="20,32 30,8 40,28 50,4 60,28 70,8 80,32" fill="${hair}"/>`);
        p.push(`<rect x="18" y="28" width="64" height="16" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 5) {
        // Mohawk
        p.push(`<rect x="44" y="6" width="12" height="30" rx="5" fill="${hair}"/>`);
        p.push(`<polygon points="50,2 56,12 44,12" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 6) {
        // Undercut / sidokammat
        p.push(`<rect x="19" y="21" width="62" height="18" rx="8" fill="${hair}"/>`);
        p.push(`<path d="M24,35 Q45,18 79,25 L79,40 L24,40 Z" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 7) {
        // Lockig lugg
        p.push(`<ellipse cx="50" cy="25" rx="30" ry="16" fill="${hair}"/>`);
        p.push(`<circle cx="30" cy="33" r="7" fill="${hair}"/>`);
        p.push(`<circle cx="44" cy="35" r="7" fill="${hair}"/>`);
        p.push(`<circle cx="58" cy="35" r="7" fill="${hair}"/>`);
        p.push(`<circle cx="72" cy="33" r="7" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 8) {
        // Hög hästsvans
        p.push(`<ellipse cx="50" cy="26" rx="25" ry="14" fill="${hair}"/>`);
        p.push(`<ellipse cx="78" cy="32" rx="8" ry="16" fill="${hair}"/>`);
        p.push(`<rect x="63" y="24" width="8" height="7" rx="2" fill="${bgPalette[(h0 + 2) % bgPalette.length]}"/>`);
    } else if (!isRobot && hairStyle === 9) {
        // Bob med fylliga sidor
        p.push(`<rect x="20" y="20" width="60" height="46" rx="14" fill="${hair}"/>`);
        p.push(`<ellipse cx="23" cy="48" rx="7" ry="14" fill="${hair}"/>`);
        p.push(`<ellipse cx="77" cy="48" rx="7" ry="14" fill="${hair}"/>`);
    } else if (!isRobot) {
        // Långa vågor
        p.push(`<rect x="20" y="20" width="60" height="66" rx="12" fill="${hair}"/>`);
        p.push(`<path d="M24,30 Q32,38 24,46 Q32,54 24,62" stroke="rgba(255,255,255,0.22)" stroke-width="2" fill="none"/>`);
        p.push(`<path d="M76,30 Q68,38 76,46 Q68,54 76,62" stroke="rgba(255,255,255,0.22)" stroke-width="2" fill="none"/>`);
    }

    // ── Ansikte ──────────────────────────────────────────────────────────
    p.push(`<circle cx="50" cy="58" r="37" fill="${skin}"/>`);

    if (isRobot) {
        p.push(`<line x1="50" y1="38" x2="50" y2="80" stroke="#7f8c99" stroke-width="1.2" opacity="0.6"/>`);
        p.push(`<line x1="30" y1="67" x2="70" y2="67" stroke="#7f8c99" stroke-width="1" opacity="0.45"/>`);
        p.push(`<rect x="47" y="6" width="6" height="10" rx="2" fill="#7f8c99"/>`);
        p.push(`<circle cx="50" cy="4" r="4" fill="${irisColor}"/>`);
        p.push(`<circle cx="50" cy="4" r="1.6" fill="white" opacity="0.85"/>`);
    }

    if (isAlien) {
        p.push(`<circle cx="35" cy="63" r="3" fill="rgba(255,255,255,0.2)"/>`);
        p.push(`<circle cx="66" cy="59" r="2.5" fill="rgba(255,255,255,0.2)"/>`);
        p.push(`<circle cx="57" cy="70" r="2" fill="rgba(255,255,255,0.2)"/>`);
    }

    // ── Hår (framkant) ───────────────────────────────────────────────────
    if (!isRobot && hairStyle === 0) {
        p.push(`<rect x="19" y="27" width="62" height="13" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 1) {
        p.push(`<rect x="18" y="22" width="12" height="32" rx="6" fill="${hair}"/>`);
        p.push(`<rect x="70" y="22" width="12" height="32" rx="6" fill="${hair}"/>`);
        p.push(`<rect x="18" y="22" width="64" height="13" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 3) {
        p.push(`<rect x="24" y="28" width="52" height="14" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 4) {
        p.push(`<rect x="18" y="28" width="64" height="12" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 5) {
        p.push(`<rect x="45" y="16" width="10" height="22" rx="4" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 6) {
        p.push(`<path d="M22,33 Q43,20 78,27 L78,38 L22,38 Z" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 7) {
        p.push(`<path d="M24,33 Q32,27 40,33 Q48,27 56,33 Q64,27 72,33" stroke="${hair}" stroke-width="8" fill="none" stroke-linecap="round"/>`);
    } else if (!isRobot && hairStyle === 8) {
        p.push(`<path d="M24,31 Q37,22 50,27 Q63,22 76,31 L76,39 L24,39 Z" fill="${hair}"/>`);
        p.push(`<rect x="64" y="27" width="7" height="6" rx="2" fill="${bgPalette[(h0 + 2) % bgPalette.length]}"/>`);
    } else if (!isRobot && hairStyle === 9) {
        p.push(`<rect x="22" y="22" width="56" height="14" rx="7" fill="${hair}"/>`);
    } else if (!isRobot && hairStyle === 10) {
        p.push(`<path d="M24,30 Q32,24 40,30 Q48,24 56,30 Q64,24 72,30" stroke="${hair}" stroke-width="7" fill="none" stroke-linecap="round"/>`);
    }

    // ── Rodnad ───────────────────────────────────────────────────────────
    if (hasBlush) {
        p.push(`<circle cx="28" cy="66" r="8" fill="#ff9999" opacity="0.48"/>`);
        p.push(`<circle cx="72" cy="66" r="8" fill="#ff9999" opacity="0.48"/>`);
    }

    // ── Ögonbryn ─────────────────────────────────────────────────────────
    if (eyeStyle !== 2 && eyeStyle !== 6) {
        p.push(`<path d="M28,43 Q35,39 42,43" stroke="${browColor}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
        p.push(`<path d="M58,43 Q65,39 72,43" stroke="${browColor}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
    }

    // ── Ögon ─────────────────────────────────────────────────────────────
    if (isRobot) {
        // Robot-ögon (ljusare, mer "display" och mindre svart block-känsla)
        const robotEyeStyle = h1 % 3;
        if (robotEyeStyle === 0) {
            // Smala LED-fönster
            p.push(`<rect x="25" y="47" width="20" height="10" rx="4" fill="#c9d4de" stroke="#5c6975" stroke-width="1.4"/>`);
            p.push(`<rect x="55" y="47" width="20" height="10" rx="4" fill="#c9d4de" stroke="#5c6975" stroke-width="1.4"/>`);
            p.push(`<rect x="29" y="50" width="12" height="3" rx="1.5" fill="${irisColor}" opacity="0.95"/>`);
            p.push(`<rect x="59" y="50" width="12" height="3" rx="1.5" fill="${irisColor}" opacity="0.95"/>`);
        } else if (robotEyeStyle === 1) {
            // Runda lins-ögon
            p.push(`<circle cx="35" cy="52" r="7" fill="#c4d0da" stroke="#5c6975" stroke-width="1.5"/>`);
            p.push(`<circle cx="65" cy="52" r="7" fill="#c4d0da" stroke="#5c6975" stroke-width="1.5"/>`);
            p.push(`<circle cx="35" cy="52" r="3.8" fill="${irisColor}"/>`);
            p.push(`<circle cx="65" cy="52" r="3.8" fill="${irisColor}"/>`);
            p.push(`<circle cx="36.2" cy="50.8" r="1.1" fill="white" opacity="0.9"/>`);
            p.push(`<circle cx="66.2" cy="50.8" r="1.1" fill="white" opacity="0.9"/>`);
        } else {
            // En sammanhängande visor-display
            p.push(`<rect x="24" y="46" width="52" height="12" rx="6" fill="#b9c6d1" stroke="#5c6975" stroke-width="1.5"/>`);
            p.push(`<rect x="28" y="49" width="44" height="6" rx="3" fill="${irisColor}" opacity="0.9"/>`);
            p.push(`<circle cx="38" cy="52" r="1.2" fill="white" opacity="0.9"/>`);
            p.push(`<circle cx="62" cy="52" r="1.2" fill="white" opacity="0.9"/>`);
        }
    } else if (isAlien && (h1 % 3) === 0) {
        // Alien-ögon
        p.push(`<ellipse cx="35" cy="52" rx="7" ry="11" fill="#121212"/>`);
        p.push(`<ellipse cx="65" cy="52" rx="7" ry="11" fill="#121212"/>`);
        p.push(`<ellipse cx="37" cy="48" rx="1.7" ry="3" fill="rgba(255,255,255,0.75)"/>`);
        p.push(`<ellipse cx="67" cy="48" rx="1.7" ry="3" fill="rgba(255,255,255,0.75)"/>`);
    } else if (eyeStyle === 0) {
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
    } else if (eyeStyle === 2) {
        // Lyckliga slutna ögon ^_^
        p.push(`<path d="M27,${eyeY+1} Q35,${eyeY-7} 43,${eyeY+1}" stroke="${browColor}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`);
        p.push(`<path d="M57,${eyeY+1} Q65,${eyeY-7} 73,${eyeY+1}" stroke="${browColor}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`);
    } else if (eyeStyle === 3) {
        // Blink
        p.push(`<circle cx="35" cy="${eyeY}" r="6" fill="${irisColor}"/>`);
        p.push(`<circle cx="37" cy="${eyeY - 2}" r="2" fill="white" opacity="0.8"/>`);
        p.push(`<path d="M57,${eyeY+1} Q65,${eyeY-3} 73,${eyeY+1}" stroke="${browColor}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    } else if (eyeStyle === 4) {
        // Sömniga halvöppna ögon
        p.push(`<ellipse cx="35" cy="${eyeY}" rx="7" ry="5" fill="white"/>`);
        p.push(`<ellipse cx="65" cy="${eyeY}" rx="7" ry="5" fill="white"/>`);
        p.push(`<ellipse cx="35" cy="${eyeY + 1}" rx="4" ry="3" fill="${irisColor}"/>`);
        p.push(`<ellipse cx="65" cy="${eyeY + 1}" rx="4" ry="3" fill="${irisColor}"/>`);
        p.push(`<path d="M27,${eyeY-4} Q35,${eyeY-2} 43,${eyeY-4}" stroke="${browColor}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
        p.push(`<path d="M57,${eyeY-4} Q65,${eyeY-2} 73,${eyeY-4}" stroke="${browColor}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
    } else if (eyeStyle === 5) {
        // Arga ögon
        p.push(`<ellipse cx="35" cy="${eyeY}" rx="7" ry="6" fill="white"/>`);
        p.push(`<ellipse cx="65" cy="${eyeY}" rx="7" ry="6" fill="white"/>`);
        p.push(`<circle cx="35" cy="${eyeY+1}" r="3.5" fill="#111"/>`);
        p.push(`<circle cx="65" cy="${eyeY+1}" r="3.5" fill="#111"/>`);
        p.push(`<path d="M27,45 Q34,40 42,42" stroke="${browColor}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
        p.push(`<path d="M58,42 Q66,40 73,45" stroke="${browColor}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    } else if (eyeStyle === 6) {
        // Spiralögon
        p.push(`<path d="M29,52 q6,-6 12,0 q-6,6 -12,0 q4,-4 8,0" stroke="#111" stroke-width="1.8" fill="none"/>`);
        p.push(`<path d="M59,52 q6,-6 12,0 q-6,6 -12,0 q4,-4 8,0" stroke="#111" stroke-width="1.8" fill="none"/>`);
    } else {
        // Stjärnögon
        p.push(`<path d="M35,45 L36.8,50.2 L42,50.2 L37.7,53.3 L39.5,58.5 L35,55.3 L30.5,58.5 L32.3,53.3 L28,50.2 L33.2,50.2 Z" fill="${irisColor}"/>`);
        p.push(`<path d="M65,45 L66.8,50.2 L72,50.2 L67.7,53.3 L69.5,58.5 L65,55.3 L60.5,58.5 L62.3,53.3 L58,50.2 L63.2,50.2 Z" fill="${irisColor}"/>`);
        p.push(`<circle cx="35" cy="52" r="1.2" fill="white"/>`);
        p.push(`<circle cx="65" cy="52" r="1.2" fill="white"/>`);
    }

    if (!isRobot && hasLashes) {
        // Diskreta fransar/eyeliner
        p.push(`<path d="M27,45 L24,43 M35,43 L35,40 M43,45 L46,43" stroke="#2f1f1f" stroke-width="1.2" stroke-linecap="round"/>`);
        p.push(`<path d="M57,45 L54,43 M65,43 L65,40 M73,45 L76,43" stroke="#2f1f1f" stroke-width="1.2" stroke-linecap="round"/>`);
    }

    // ── Näsa ─────────────────────────────────────────────────────────────
    if (isRobot) {
        p.push(`<rect x="47" y="62" width="6" height="5" rx="1" fill="#6d7a86"/>`);
    } else {
        p.push(`<circle cx="50" cy="64" r="2.2" fill="rgba(0,0,0,0.13)"/>`);
    }

    // ── Mun ──────────────────────────────────────────────────────────────
    if (isRobot) {
        if (robotMouthStyle === 0) {
            p.push(`<rect x="38" y="71" width="24" height="8" rx="2" fill="#5c6975" stroke="#3f4a53" stroke-width="1"/>`);
            p.push(`<line x1="44" y1="71" x2="44" y2="79" stroke="#90a4b5" stroke-width="1"/>`);
            p.push(`<line x1="50" y1="71" x2="50" y2="79" stroke="#90a4b5" stroke-width="1"/>`);
            p.push(`<line x1="56" y1="71" x2="56" y2="79" stroke="#90a4b5" stroke-width="1"/>`);
        } else if (robotMouthStyle === 1) {
            p.push(`<rect x="39" y="73" width="22" height="5" rx="2.5" fill="${irisColor}" opacity="0.75"/>`);
            p.push(`<rect x="42" y="74" width="16" height="2" rx="1" fill="white" opacity="0.65"/>`);
        } else {
            p.push(`<path d="M39,76 L61,76" stroke="#56636f" stroke-width="3" stroke-linecap="round"/>`);
            p.push(`<circle cx="39" cy="76" r="1.8" fill="#7d8b98"/>`);
            p.push(`<circle cx="61" cy="76" r="1.8" fill="#7d8b98"/>`);
        }
    } else if (mouthStyle === 0) {
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
    } else if (mouthStyle === 3) {
        // Förvånad O
        p.push(`<ellipse cx="50" cy="75" rx="9" ry="8" fill="#cc2222"/>`);
        p.push(`<ellipse cx="50" cy="75" rx="6" ry="5" fill="#ff8888"/>`);
    } else if (mouthStyle === 4) {
        // Rak smile med tänder
        p.push(`<rect x="38" y="70" width="24" height="9" rx="4" fill="white" stroke="#a0522d" stroke-width="1.5"/>`);
        p.push(`<line x1="50" y1="70" x2="50" y2="79" stroke="#d8d8d8" stroke-width="1"/>`);
    } else if (mouthStyle === 5) {
        // Tunga
        p.push(`<path d="M39,72 Q50,84 61,72 Q60,80 50,82 Q40,80 39,72Z" fill="#d83b5b"/>`);
        p.push(`<path d="M50,75 Q50,82 50,82" stroke="#b42245" stroke-width="1.3"/>`);
    } else if (mouthStyle === 6) {
        // Brett flin med mungipor
        p.push(`<path d="M34,71 Q50,88 66,71" stroke="#8e4b2a" stroke-width="3" fill="none" stroke-linecap="round"/>`);
        p.push(`<path d="M34,71 Q35,76 38,77" stroke="#8e4b2a" stroke-width="2" fill="none"/>`);
        p.push(`<path d="M66,71 Q65,76 62,77" stroke="#8e4b2a" stroke-width="2" fill="none"/>`);
    } else if (mouthStyle === 7) {
        // Sur mun
        p.push(`<path d="M38,80 Q50,70 62,80" stroke="#8e4b2a" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
    } else {
        // Biten läpp
        p.push(`<path d="M38,74 Q50,82 62,74" fill="#c95f78"/>`);
        p.push(`<path d="M38,74 Q50,70 62,74" stroke="#8e4b2a" stroke-width="1.8" fill="none"/>`);
        p.push(`<rect x="44" y="72" width="12" height="3" rx="1.5" fill="white" opacity="0.8"/>`);
    }

    if (!isRobot && hasLipGloss) {
        p.push(`<ellipse cx="50" cy="75" rx="8" ry="2.1" fill="rgba(255,255,255,0.32)"/>`);
    }

    // ── Tillbehör ─────────────────────────────────────────────────────────
    if (isRobot) {
        // Robot-detaljer
        p.push(`<circle cx="26" cy="60" r="1.8" fill="#7a8895"/>`);
        p.push(`<circle cx="74" cy="60" r="1.8" fill="#7a8895"/>`);
        p.push(`<line x1="28" y1="39" x2="72" y2="39" stroke="#7f8c99" stroke-width="1.2" opacity="0.7"/>`);
    } else if (isAlien) {
        // Alien-detaljer
        p.push(`<path d="M40,23 Q50,8 60,23" stroke="rgba(255,255,255,0.45)" stroke-width="2" fill="none" stroke-linecap="round"/>`);
        p.push(`<circle cx="50" cy="10" r="2.5" fill="rgba(255,255,255,0.6)"/>`);
    } else if (accessory === 1) {
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
    } else if (accessory === 4) {
        // Mustasch
        p.push(`<path d="M34,71 Q40,66 47,71 Q40,73 34,71Z" fill="#5c3b25"/>`);
        p.push(`<path d="M53,71 Q60,66 66,71 Q60,73 53,71Z" fill="#5c3b25"/>`);
    } else if (accessory === 5) {
        // Örhängen
        p.push(`<circle cx="15" cy="66" r="3" fill="#ffd166"/>`);
        p.push(`<circle cx="85" cy="66" r="3" fill="#ffd166"/>`);
    } else if (accessory === 6) {
        // Krona
        const crown = bgPalette[(h4 + 9) % bgPalette.length];
        p.push(`<polygon points="24,23 34,10 44,23 50,8 56,23 66,10 76,23 76,31 24,31" fill="${crown}"/>`);
        p.push(`<circle cx="34" cy="12" r="2" fill="#fff4c2"/>`);
        p.push(`<circle cx="50" cy="9" r="2.2" fill="#fff4c2"/>`);
        p.push(`<circle cx="66" cy="12" r="2" fill="#fff4c2"/>`);
    } else if (hasFeminineTouch && accessory === 7) {
        // Liten hårspänne-blomma
        const clip = bgPalette[(h4 + 5) % bgPalette.length];
        p.push(`<circle cx="71" cy="34" r="3" fill="${clip}"/>`);
        p.push(`<circle cx="67" cy="34" r="2.2" fill="${clip}" opacity="0.9"/>`);
        p.push(`<circle cx="75" cy="34" r="2.2" fill="${clip}" opacity="0.9"/>`);
        p.push(`<circle cx="71" cy="30" r="2.2" fill="${clip}" opacity="0.9"/>`);
        p.push(`<circle cx="71" cy="38" r="2.2" fill="${clip}" opacity="0.9"/>`);
        p.push(`<circle cx="71" cy="34" r="1.1" fill="white"/>`);
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${p.join('')}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
