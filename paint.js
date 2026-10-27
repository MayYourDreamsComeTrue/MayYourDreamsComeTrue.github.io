// =====================================================================
//  MINI PAINT - okienko "untitled - Paint" na pulpicie (index.html)
//  Korzysta z systemu okien z desktop.js (openWindow, reuseWin, el...),
//  więc musi być wczytany PO desktop.js.
//
//  Płótno ma 320x200 "prawdziwych" pixeli i jest powiększane x2..x4
//  (image-rendering: pixelated), więc wszystko wygląda jak pixel art.
//  Domyślny obrazek (tort) rysuje funkcja drawBirthdayCake() niżej.
// =====================================================================

const PAINT = {
    W: 320,               // szerokość płótna w pixelach
    H: 200,               // wysokość płótna
    MAX_SCALE: 4,         // największe powiększenie (zmaksymalizowane okno)
    UNDO_STEPS: 20,       // ile kroków pamięta Ctrl+Z
    SAVE_SCALE: 4,        // File > Save zapisuje PNG powiększony x4 (ostre pixele)
    WIN_W: 780,           // rozmiar okna Painta (płótno x2 + przybornik + paleta)
    WIN_H: 600,
    WHITE: '#ffffff',     // kolor "pustej kartki" (File > New, Clear)
};

// ===== PALETA (próbki kolorów na dole okna) =====
// To są DANE obrazka, nie wygląd strony: '--nazwa' = kolor wzięty z :root w desktop.css
// (kolory gry), a '#rrggbb' = podstawowe kolory, których w grze nie ma.
// Lewy klik = kolor główny, prawy klik = kolor tła (gumka, prawy przycisk myszy).
const PAINT_SWATCHES = [
    '#000000', '#5f574f', '#c2c3c7', '#ffffff', '#e83b3b',   // czarny, ciemnoszary, szary, biały, czerwony
    '#f7962f', '--boot-title', '#4fc35a', '#3b6fe8', '#5fe1ff', // pomarańcz, złoto gry, zielony, niebieski, cyjan
    '--bg', '--boot-bg', '--select-bg', '#b98cff', '--pink-dark', // granat nieba, noc, fiolet, lawenda, śliwka
    '--panel', '--win-light', '--gold', '#ffe7a8', '#8a5a3c',   // róż okienek, jasny róż, perłowy, krem, brąz
];

// ===== KOLORY TORTU (dane obrazka, tak jak paleta) =====
const CAKE_COLORS = {
    bg:          '#ffffff', // tło
    outline:     '#8f1f69', // obrys tortu i talerza (śliwkowy, jak cienie w grze)
    sponge:      '#ffe7a8', // biszkopt (krem)
    spongeShade: '#f2c97d', // jego cień (prawa strona i dół)
    jam:         '#f881ad', // warstwa dżemu w środku
    cream:       '#fff7fb', // warstwa kremu pod dżemem
    frost:       '#f26dab', // różowy lukier (jak okienka gry)
    frostLight:  '#fbb3d3', // błysk na lukrze
    frostShade:  '#d4518f', // cień lukru
    pearl:       '#ffffff', // perełki na dole pięter
    plate:       '#f6e9f2', // talerz
    plateShade:  '#cfb2c6', // cień talerza
    candle:      '#ffd36e', // świeczka (złota)
    candleStripe:'#ffffff', // paski na świeczce
    wick:        '#5f574f', // knot
    flameOut:    '#f7962f', // płomień - brzeg
    flameIn:     '#ffd36e', // płomień - środek
    flameCore:   '#ffffff', // płomień - najjaśniejszy
    glow:        '#fff6d0', // iskierki wokół płomieni
    text:        '#8f1f69', // napis HAPPY BIRTHDAY
    textShadow:  '#fbb3d3', // jego cień
    sprinkles:   ['#5fe1ff', '#ffd36e', '#a16ad9', '#ffffff', '#4fc35a'], // posypka
    star:        '#ffd36e', // gwiazdki dookoła
    heart:       '#f26dab', // serduszka dookoła
};

// malutki font 3x5 (tylko litery potrzebne do HAPPY BIRTHDAY; '#' = pixel)
const PAINT_FONT = {
    H: ['#.#', '#.#', '###', '#.#', '#.#'], A: ['.#.', '#.#', '###', '#.#', '#.#'],
    P: ['##.', '#.#', '##.', '#..', '#..'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
    B: ['##.', '#.#', '##.', '#.#', '##.'], I: ['###', '.#.', '.#.', '.#.', '###'],
    R: ['##.', '#.#', '##.', '#.#', '#.#'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
    D: ['##.', '#.#', '#.#', '#.#', '##.'], ' ': ['...', '...', '...', '...', '...'],
};

// =====================================================================
//  TUTAJ RYSUJE SIĘ TORT - domyślny obrazek po otwarciu Painta
//  (też Image > Birthday cake). Współrzędne są w pixelach płótna 320x200.
//  Zmieniasz liczby/kolory -> zmienia się tort.
// =====================================================================
/** @param {CanvasRenderingContext2D} g */
function drawBirthdayCake(g) {
    const C = CAKE_COLORS;
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    // rysuje kształt z napisów ('#' = kolor c)
    const shape = (x, y, rows, c, s = 1) => rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') R(x + i * s, y + j * s, s, s, c);
    });
    // stały "los" - posypka jest zawsze w tych samych miejscach
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    R(0, 0, PAINT.W, PAINT.H, C.bg);

    // --- napis HAPPY BIRTHDAY (font 3x5 x2, z cieniem) ---
    const text = 'HAPPY BIRTHDAY';
    const tw = text.length * 8 - 2;
    let tx = Math.round((PAINT.W - tw) / 2);
    for (const ch of text) {
        shape(tx + 1, 11, PAINT_FONT[ch], C.textShadow, 2);
        shape(tx, 10, PAINT_FONT[ch], C.text, 2);
        tx += 8;
    }

    // --- gwiazdki i serduszka dookoła ---
    const STAR = ['...#...', '...#...', '..###..', '###.###', '..###..', '...#...', '...#...'];
    const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    [[40, 34], [272, 28], [26, 108], [286, 100], [60, 158], [250, 160], [96, 42], [218, 48]]
        .forEach(([x, y]) => { shape(x, y, STAR, C.star); R(x + 3, y + 3, 1, 1, C.glow); });
    // serduszka x2 (14x12 pixeli)
    [[46, 72], [258, 68], [30, 134], [274, 130]].forEach(([x, y]) => {
        shape(x, y, HEART, C.heart, 2);
        R(x + 2, y + 2, 2, 2, C.frostLight);          // błysk
    });

    // --- talerz ---
    R(70, 177, 180, 1, C.outline);
    R(68, 178, 184, 4, C.plate);
    R(66, 179, 1, 3, C.outline); R(253, 179, 1, 3, C.outline);
    R(72, 182, 176, 2, C.plateShade);
    R(68, 182, 4, 1, C.outline); R(248, 182, 4, 1, C.outline);
    R(72, 184, 176, 1, C.outline);
    R(84, 179, 24, 1, C.pearl); // błysk na talerzu

    // --- jedno piętro tortu: biszkopt, dżem z kremem, lukier z kapaniem, posypka, perełki ---
    const tier = (x, y, w, h) => {
        R(x - 1, y - 1, w + 2, h + 2, C.outline);       // obrys
        R(x, y, w, h, C.sponge);                         // biszkopt
        R(x + w - 6, y, 6, h, C.spongeShade);            // cień z prawej
        R(x, y + h - 2, w, 2, C.spongeShade);            // cień na dole
        const fy = y + Math.round(h * 0.6);              // warstwa dżemu i kremu
        R(x, fy, w, 1, C.cream); R(x, fy + 1, w, 2, C.jam); R(x, fy + 3, w, 1, C.cream);
        // lukier na górze
        const band = 6;
        R(x, y, w, band, C.frost);
        R(x + w - 6, y, 6, band, C.frostShade);
        R(x + 2, y + 1, w - 12, 1, C.frostLight);
        // kapiący lukier (paski po 4 px o różnej długości, z zaokrąglonym końcem)
        const DRIPS = [5, 9, 3, 12, 6, 0, 10, 4, 8, 2, 11, 7];
        for (let i = 0, k = 0; i + 4 <= w; i += 6, k++) {
            const d = DRIPS[(k + x) % DRIPS.length];
            if (!d) continue;
            const c = i + 4 > w - 6 ? C.frostShade : C.frost;
            R(x + i, y + band, 4, d - 1, c);
            R(x + i + 1, y + band + d - 1, 2, 1, c);
            R(x + i + 1, y + band + d, 2, 1, C.frostShade);
            if (i + 4 <= w - 6) R(x + i, y + band, 1, Math.max(0, d - 3), C.frostLight);
        }
        // posypka na lukrze
        for (let n = 0; n < w / 5; n++) {
            const sx = x + 2 + Math.floor(rnd() * (w - 5));
            const sy = y + 1 + Math.floor(rnd() * (band - 2));
            R(sx, sy, rnd() < 0.5 ? 2 : 1, rnd() < 0.5 ? 1 : 2, C.sprinkles[n % C.sprinkles.length]);
        }
        // perełki na dole piętra
        for (let px = x + 3; px < x + w - 3; px += 6) {
            R(px, y + h - 4, 2, 2, C.pearl);
            R(px + 1, y + h - 3, 1, 1, C.frostLight);
        }
    };
    tier(88, 132, 144, 44);   // dolne piętro: 144 x 44
    tier(112, 98, 96, 34);    // górne piętro: 96 x 34

    // --- świeczki z płomieniami ---
    const FLAME_OUT = ['..#..', '.###.', '.###.', '#####', '#####', '.###.'];
    const FLAME_IN  = ['.....', '..#..', '..#..', '.###.', '.###.', '..#..'];
    const FLAME_CORE = ['.....', '.....', '.....', '..#..', '..#..', '.....'];
    [121, 137, 153, 169, 185].forEach((cx, i) => {
        const top = 76 + (i % 2) * 3;                    // świeczki trochę różnej wysokości
        R(cx - 1, top - 1, 7, 98 - top + 1, C.outline);  // obrys
        R(cx, top, 5, 98 - top, C.candle);
        for (let y = top + 1; y < 97; y += 4) R(cx, y, 5, 2, C.candleStripe); // paski
        R(cx + 4, top, 1, 98 - top, C.spongeShade);      // cień
        R(cx + 2, top - 3, 1, 2, C.wick);                // knot
        const fy = top - 10;
        shape(cx, fy, FLAME_OUT, C.flameOut);
        shape(cx, fy, FLAME_IN, C.flameIn);
        shape(cx, fy, FLAME_CORE, C.flameCore);
        // iskierki - wygląda, jakby płomień migotał
        R(cx + (i % 2 ? -2 : 6), fy + 1, 1, 1, C.glow);
        R(cx + (i % 2 ? 6 : -2), fy + 4, 1, 1, C.glow);
    });
}

// =====================================================================
//  OKNO PAINTA
// =====================================================================

// pixelowe ikonki narzędzi ('#' = pixel, rysowane x2 przez glyphSvg z desktop.js)
const PAINT_TOOLS = [
    { id: 'pencil', name: 'Pencil', key: 'p', glyph: ['......##', '.....###', '....###.', '...###..', '..###...', '.###....', '##......', '#.......'] },
    { id: 'brush',  name: 'Brush',  key: 'b', glyph: ['...##...', '...##...', '...##...', '...##...', '..####..', '.######.', '.######.', '.#.##.#.'] },
    { id: 'eraser', name: 'Eraser', key: 'e', glyph: ['...#####', '..#...##', '.#...#.#', '#####..#', '#...#.#.', '#...##..', '#####...', '........'] },
    { id: 'fill',   name: 'Fill With Color', key: 'f', glyph: ['..##....', '.#..#...', '#.##.#..', '#.#..##.', '.#....##', '..#..#.#', '...##..#', '.......#'] },
    { id: 'picker', name: 'Pick Color', key: 'i', glyph: ['......##', '.....###', '....###.', '...#.#..', '..#.#...', '.#.#....', '#.#.....', '##......'] },
    { id: 'line',   name: 'Line',   key: 'l', glyph: ['#.......', '.#......', '..#.....', '...#....', '....#...', '.....#..', '......#.', '.......#'] },
];
const PAINT_CLEAR_GLYPH = ['#####...', '#...##..', '#...###.', '#.....#.', '#.....#.', '#.....#.', '#######.', '........'];

function openPaint() {
    if (reuseWin('paint')) return;

    // kolory z :root (desktop.css) albo zwykły #hex
    const rootCss = getComputedStyle(document.documentElement);
    const resolve = (c) => (c.startsWith('--') ? rootCss.getPropertyValue(c).trim() : c);
    const swatches = PAINT_SWATCHES.map(resolve);

    let tool = 'pencil';
    let primary = swatches[0];       // lewy przycisk
    let secondary = PAINT.WHITE;     // prawy przycisk i gumka
    /** @type {ImageData[]} */
    const undoStack = [];

    // ----- układ okna -----
    const body = el('div', 'paint');
    const menu = el('div', 'menubar');
    const main = el('div', 'paint-main');
    const tools = el('div', 'paint-tools');
    const area = el('div', 'paint-area sunken');
    const cv = /** @type {HTMLCanvasElement} */ (el('canvas', 'paint-canvas'));
    cv.width = PAINT.W;
    cv.height = PAINT.H;
    cv.tabIndex = 0;
    cv.setAttribute('aria-label', 'Drawing canvas');
    area.appendChild(cv);
    main.append(tools, area);
    const bottom = el('div', 'paint-bottom');
    const colorBox = el('div', 'paint-colors sunken');
    const secBox = el('div', 'paint-sec');
    const priBox = el('div', 'paint-pri');
    colorBox.append(secBox, priBox);
    const swatchBox = el('div', 'paint-swatches');
    bottom.append(colorBox, swatchBox);
    const status = el('div', 'statusbar');
    const stHelp = el('span', '', '');            // nazwa narzędzia
    const stPos = el('span', 'paint-pos', '');
    status.append(stHelp, stPos);
    body.append(menu, main, bottom, status);

    const g = cv.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    drawBirthdayCake(g);

    // ----- skala płótna: największa całkowita, która się mieści (2x, w dużym oknie 3x-4x) -----
    let scale = 2;
    const fit = () => {
        const s = clamp(Math.floor(Math.min((area.clientWidth - 12) / PAINT.W, (area.clientHeight - 12) / PAINT.H)), 1, PAINT.MAX_SCALE);
        if (s === scale && cv.style.width) return;
        scale = s;
        cv.style.width = PAINT.W * s + 'px';
        cv.style.height = PAINT.H * s + 'px';
    };
    new ResizeObserver(fit).observe(area); // tylko przy zmianie rozmiaru, bez pętli

    // ----- kolory -----
    const showColors = () => {
        priBox.style.background = primary;
        secBox.style.background = secondary;
        priBox.title = 'Primary color: ' + primary;
        secBox.title = 'Secondary color: ' + secondary;
    };
    swatches.forEach((c) => {
        const s = /** @type {HTMLButtonElement} */ (el('button', 'paint-swatch'));
        s.style.background = c;
        s.title = c;
        s.setAttribute('aria-label', 'Color ' + c);
        s.addEventListener('pointerdown', (e) => {
            if (e.button === 2) secondary = c; else if (e.button === 0) primary = c;
            showColors();
        });
        swatchBox.appendChild(s);
    });
    showColors();

    // ----- narzędzia -----
    /** @type {Map<string, HTMLButtonElement>} */
    const toolBtns = new Map();
    let toolBeforePicker = 'pencil';
    const setTool = (id) => {
        if (id === 'picker' && tool !== 'picker') toolBeforePicker = tool;
        tool = id;
        toolBtns.forEach((b, k) => b.classList.toggle('pressed', k === id));
        cv.dataset.tool = id;
        stHelp.textContent = 'Tool: ' + PAINT_TOOLS.find((t) => t.id === id).name;
    };
    PAINT_TOOLS.forEach((t) => {
        const b = /** @type {HTMLButtonElement} */ (el('button', 'win-btn paint-tool'));
        b.innerHTML = glyphSvg(t.glyph);
        b.title = `${t.name} (${t.key.toUpperCase()})`;
        b.setAttribute('aria-label', t.name);
        b.addEventListener('click', () => setTool(t.id));
        tools.appendChild(b);
        toolBtns.set(t.id, b);
    });
    const clearBtn = /** @type {HTMLButtonElement} */ (el('button', 'win-btn paint-tool'));
    clearBtn.innerHTML = glyphSvg(PAINT_CLEAR_GLYPH);
    clearBtn.title = 'Clear Image';
    clearBtn.setAttribute('aria-label', 'Clear Image');
    clearBtn.addEventListener('click', () => clearImage());
    tools.appendChild(clearBtn);
    setTool('pencil');

    // ----- cofanie -----
    const pushUndo = () => {
        undoStack.push(g.getImageData(0, 0, PAINT.W, PAINT.H));
        if (undoStack.length > PAINT.UNDO_STEPS) undoStack.shift();
    };
    const undo = () => {
        const img = undoStack.pop();
        if (img) g.putImageData(img, 0, 0);
    };
    const clearImage = () => { pushUndo(); g.fillStyle = PAINT.WHITE; g.fillRect(0, 0, PAINT.W, PAINT.H); };
    const redrawCake = () => { pushUndo(); drawBirthdayCake(g); };

    // zapis PNG powiększonego x4 (bez rozmywania)
    const save = () => {
        const out = document.createElement('canvas');
        out.width = PAINT.W * PAINT.SAVE_SCALE;
        out.height = PAINT.H * PAINT.SAVE_SCALE;
        const og = out.getContext('2d');
        og.imageSmoothingEnabled = false;
        og.drawImage(cv, 0, 0, out.width, out.height);
        out.toBlob((blob) => {
            if (!blob) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'untitled.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }, 'image/png');
    };

    // ----- rysowanie -----
    const stamp = (x, y, c) => {
        g.fillStyle = c;
        if (tool === 'brush') g.fillRect(x - 1, y - 1, 3, 3);       // pędzel 3x3
        else if (tool === 'eraser') g.fillRect(x - 1, y - 1, 4, 4); // gumka 4x4
        else g.fillRect(x, y, 1, 1);                                 // ołówek i linia: 1 pixel
    };
    // linia Bresenhama - bez dziur przy szybkim ruchu myszką
    const line = (x0, y0, x1, y1, c) => {
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            stamp(x0, y0, c);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    };
    const hexRgb = (c) => {
        const n = parseInt(c.replace('#', ''), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    // wypełnianie (scanline na stosie, bez rekurencji)
    const flood = (x, y, c) => {
        const img = g.getImageData(0, 0, PAINT.W, PAINT.H);
        const d = new Uint32Array(img.data.buffer);
        const [r, gg, b] = hexRgb(c);
        const fillV = new Uint32Array(new Uint8ClampedArray([r, gg, b, 255]).buffer)[0];
        const target = d[y * PAINT.W + x];
        if (target === fillV) return;
        const stack = [[x, y]];
        while (stack.length) {
            const [px, py] = stack.pop();
            let lx = px;
            while (lx > 0 && d[py * PAINT.W + lx - 1] === target) lx--;
            let up = false, down = false;
            for (let i = lx; i < PAINT.W && d[py * PAINT.W + i] === target; i++) {
                d[py * PAINT.W + i] = fillV;
                if (py > 0) {
                    const t = d[(py - 1) * PAINT.W + i] === target;
                    if (t && !up) stack.push([i, py - 1]);
                    up = t;
                }
                if (py < PAINT.H - 1) {
                    const t = d[(py + 1) * PAINT.W + i] === target;
                    if (t && !down) stack.push([i, py + 1]);
                    down = t;
                }
            }
        }
        g.putImageData(img, 0, 0);
    };
    const pickAt = (x, y) => {
        const p = g.getImageData(x, y, 1, 1).data;
        return '#' + [p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    };

    // pozycja myszki -> pixel płótna (działa przy każdej skali)
    const toPx = (e) => {
        const r = cv.getBoundingClientRect();
        return [
            Math.floor((e.clientX - r.left) * PAINT.W / r.width),
            Math.floor((e.clientY - r.top) * PAINT.H / r.height),
        ];
    };
    const inside = (x, y) => x >= 0 && y >= 0 && x < PAINT.W && y < PAINT.H;

    let drawing = false, lastX = 0, lastY = 0, startX = 0, startY = 0, color = primary;
    /** @type {ImageData|null} */
    let lineSnap = null;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        cv.focus();
        const [x, y] = toPx(e);
        if (!inside(x, y)) return;
        const right = e.button === 2;
        if (tool === 'picker') {
            const c = pickAt(x, y);
            if (right) secondary = c; else primary = c;
            showColors();
            setTool(toolBeforePicker);
            return;
        }
        color = tool === 'eraser' ? secondary : (right ? secondary : primary);
        pushUndo();
        if (tool === 'fill') { flood(x, y, color); return; }
        drawing = true;
        cv.setPointerCapture(e.pointerId);   // rysowanie działa też po wyjechaniu za płótno
        lastX = startX = x;
        lastY = startY = y;
        if (tool === 'line') lineSnap = g.getImageData(0, 0, PAINT.W, PAINT.H);
        stamp(x, y, color);
    });
    cv.addEventListener('pointermove', (e) => {
        const [x, y] = toPx(e);
        const pos = inside(x, y) ? `${x}, ${y}px` : '';
        if (stPos.textContent !== pos) stPos.textContent = pos;
        if (!drawing) return;
        const cx = clamp(x, -4, PAINT.W + 4), cy = clamp(y, -4, PAINT.H + 4);
        if (tool === 'line') {
            g.putImageData(lineSnap, 0, 0);               // podgląd linii od punktu startu
            line(startX, startY, cx, cy, color);
        } else {
            line(lastX, lastY, cx, cy, color);
        }
        lastX = cx;
        lastY = cy;
    });
    const stopDraw = () => { drawing = false; lineSnap = null; };
    cv.addEventListener('pointerup', stopDraw);
    cv.addEventListener('pointercancel', stopDraw);
    cv.addEventListener('pointerleave', () => { if (!drawing) stPos.textContent = ''; });

    // ----- menu (File, Edit, Image działają; View i Help to atrapy) -----
    /** @type {HTMLElement|null} */
    let openPop = null;
    /** @type {HTMLElement|null} */
    let openTitle = null;                  // podświetlony tytuł otwartego menu
    const closePop = () => {
        if (openPop) { openPop.remove(); openPop = null; }
        if (openTitle) { openTitle.classList.remove('open'); openTitle = null; }
    };
    const MENUS = {
        File: [['New', 'Ctrl+N', () => clearImage()], ['Save', 'Ctrl+S', save], null, ['Exit', '', () => closeWin(win)]],
        Edit: [['Undo', 'Ctrl+Z', undo], null, ['Clear Image', '', () => clearImage()]],
        View: null,
        Image: [['Birthday cake', '', redrawCake], ['Clear Image', '', () => clearImage()]],
        Help: null,
    };
    Object.entries(MENUS).forEach(([name, items]) => {
        const m = el('span', '', name);
        if (items) {
            const show = () => {
                closePop();
                const pop = el('div', 'menu-pop raised');
                pop.dataset.menu = name;
                items.forEach((it) => {
                    if (!it) { pop.appendChild(el('div', 'menu-sep')); return; }
                    const row = el('div', 'menu-item');
                    row.append(el('span', '', it[0]), el('span', 'menu-key', it[1]));
                    row.addEventListener('click', () => { closePop(); it[2](); });
                    pop.appendChild(row);
                });
                pop.style.left = m.offsetLeft + 'px';
                pop.style.top = (m.offsetTop + m.offsetHeight) + 'px';
                win.el.appendChild(pop);
                openPop = pop;
                openTitle = m;
                m.classList.add('open');
            };
            m.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                if (openPop && openPop.dataset.menu === name) closePop(); else show();
            });
            // jak w Windowsie: przy otwartym menu najechanie na inny tytuł przełącza menu
            m.addEventListener('pointerenter', () => { if (openPop && openPop.dataset.menu !== name) show(); });
        }
        menu.appendChild(m);
    });
    // klik gdziekolwiek indziej zamyka rozwinięte menu
    const outside = (e) => { if (openPop && !openPop.contains(/** @type {Node} */ (e.target))) closePop(); };
    document.addEventListener('pointerdown', outside);
    // Esc zamyka menu także wtedy, gdy fokus nie jest w oknie (klik w tytuł menu)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openPop) closePop(); });

    const win = openWindow({
        id: 'paint', title: 'untitled - Paint', icon: 'assets/icons/paint.png', body,
        w: PAINT.WIN_W, h: PAINT.WIN_H,
        onClose: () => document.removeEventListener('pointerdown', outside),
    });

    // ----- skróty klawiszowe (gdy fokus jest w oknie Painta) -----
    win.el.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) {
            if (k === 'z') { e.preventDefault(); undo(); }
            else if (k === 's') { e.preventDefault(); save(); }
            else if (k === 'n') { e.preventDefault(); clearImage(); }
            return;
        }
        if (e.key === 'Escape') { closePop(); return; }
        const t = PAINT_TOOLS.find((tt) => tt.key === k);
        if (t) setTool(t.id);
    });
    fit();
    cv.focus();
}
