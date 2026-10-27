// =====================================================================
//  PULPIT - stary Windows (95/98) w kolorach gry. To jest index.html.
//  Sama gra jest w game.html i otwiera się w okienku (<iframe>).
//
//  Najważniejsze miejsca do edycji (wszystkie są tu na górze):
//    GAME_NAME   - nazwa gry (ikona, menu Start, okno, ekran startowy)
//    README_TEXT - treść README.txt jest teraz w pliku readme.js
//    TRASH_TEXT  - treść OpenMe.txt w Koszu
//    APPS        - lista ikon na pulpicie i w menu Start
//    DESK        - liczby: progi PC ONLY, czasy animacji, rozmiary okien
// =====================================================================

// ===== NAZWA GRY - zmieniasz tutaj, zmienia się wszędzie =====
const GAME_NAME = 'Less Pull Together';
// nazwa "systemu" (ekran startowy i pasek w menu Start)
const OS_NAME = 'May Your Birthday Wishes Come True!';

// ===== README =====
// Treść README.txt jest w osobnym pliku readme.js (łatwa edycja).
// Ten tekst pokaże się tylko wtedy, gdy readme.js się nie wczyta.
const README_FALLBACK = `Hi there!

(readme.js is missing - the README text lives there.)
`;

// ===== TUTAJ wpisz treść OpenMe.txt (plik w Koszu) =====
// Zwykły tekst, każdy Enter to nowa linia. Znak ` zapisz jako \`.
// Działa też [img: ścieżka] i [palette: #kolory] (jak w readme.js).
const TRASH_TEXT = `Everything on this site is PERFECT.

So... what exactly are you looking for in the trash?!

Nothing was thrown away here. Nothing ever will be.
Now go back and make your Wish!
`;

// ===== LICZBY DO STROJENIA =====
// TUTAJ zmienisz podpis pod obrazkiem w "My Computer"
const PC_CAPTION = 'Who cares about your computer? This site runs even on a toaster!';

const DESK = {
    MIN_W: 1024,          // minimalna szerokość okna (px CSS) - tak samo jak w grze (app.js)
    MIN_H: 640,           // minimalna wysokość okna; mniejsze = monit "PC ONLY"
    BOOT_TIME: 1500,      // ms: ekran startowy (klik albo klawisz go pomija)
    BOOT_BLOCKS: 16,      // ile klocków ma pasek postępu na ekranie startowym
    LOAD_TIME: 1000,      // ms: okienko "Loading..." przed otwarciem gry
    GAME_W: 840,          // rozmiar okna gry po "przywróceniu" (□); zmaksymalizowane = cały ekran
    GAME_H: 664,
    RE_W: 900,            // okno gry 3D "Resident Cake" po "przywróceniu" (□)
    RE_H: 620,
    README_W: 600,        // rozmiar okna README.txt (i domyślny dla innych plików .txt)
    README_H: 560,
    NOTE_IMG_SCALE: 2,    // obrazki w Notatniku x2 (całkowita skala = ostre pixele)
    NOTE_W: 520,          // rozmiar okna OpenMe.txt (krótki tekst = mniejsze okno)
    NOTE_H: 300,
    FOLDER_W: 460,        // rozmiar okna folderu (np. Kosz)
    FOLDER_H: 320,
    IMAGE_SCALE: 3,       // obrazki w podglądzie x3 (całkowita skala = ostre pixele)
    CASCADE: 24,          // o ile px przesuwa się każde kolejne okno (kaskada)
    NOT_READY: 'This app is not available yet.', // tekst okienka atrap aplikacji
};

// ===== IKONY NA PULPICIE (i w menu Start) =====
// id     - unikalna nazwa (bez spacji)
// name   - podpis pod ikoną
// icon   - obrazek 32x32 (na pulpicie powiększony x2)
// open   - co robi podwójny klik; bez "open" pokazuje się okienko z tekstem
//          "message" (albo DESK.NOT_READY) - tak działają atrapy
const APPS = [
    { id: 'game',     name: GAME_NAME,     icon: 'assets/primogem.png',       open: launchGame },
    { id: 'readme',   name: 'README.txt',  icon: 'assets/icons/readme.png',   open: openReadme },
    { id: 'computer', name: 'My Computer', icon: 'assets/icons/computer.png', open: openComputer },
    { id: 'recycle',  name: 'Recycle Bin', icon: 'assets/icons/recycle.png',  open: openTrash },
    { id: 'paint',    name: 'Paint',       icon: 'assets/icons/paint.png',    open: () => openPaint() }, // paint.js
    { id: 'music',    name: 'Music',       icon: 'assets/icons/music.png',    open: () => openMusic() }, // music.js
    { id: 'solitaire', name: 'Solitaire',  icon: 'assets/icons/solitaire.png', open: () => openSolitaire() }, // solitaire.js
    { id: 'pacman',   name: 'Primo-Man',   icon: 'assets/icons/pacman.png',   open: () => openPacman() }, // pacman.js
    { id: 'snake',    name: 'Sigil Snake', icon: 'assets/icons/snake.png',    open: () => openSnake() },  // snake.js
    { id: 'invaders', name: 'Slime Invaders', icon: 'assets/icons/invaders.png', open: () => openInvaders() }, // invaders.js
    { id: 'run',      name: 'Citlali Run', icon: 'assets/icons/run.png',      open: () => openRunner() }, // runner.js
    { id: 're',       name: 'Resident Cake', icon: 'assets/icons/re.png',     open: () => openResidentCake() }, // re.html + re/*.js
    // center: true = ikona stoi na środku pulpitu, a nie w kolumnie z resztą
    { id: 'scores',   name: 'High Scores', icon: 'assets/icons/trophy.png', open: () => openLeaderboard(), center: true }, // scores.js + leaderboard.js
];
const INFO_ICON = 'assets/icons/info.png';         // ikonka "i" w okienkach z komunikatem
const SHUTDOWN_ICON = 'assets/icons/computer.png'; // ikonka przy "Shut Down..."

// =====================================================================
//  POMOCNIKI
// =====================================================================

/**
 * tworzy element z klasą i tekstem
 * @param {string} tag
 * @param {string} [cls]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// pixelowe ikonki przycisków _ □ X ('#' = zapalony pixel, rysowane x2)
const GLYPHS = {
    min:     ['......', '......', '......', '......', '#####.', '#####.'],
    max:     ['#######', '#######', '#.....#', '#.....#', '#.....#', '#######'],
    restore: ['..#####', '..#####', '#####.#', '#####.#', '#...###', '#...#..', '#####..'],
    close:   ['##...##', '.##.##.', '..###..', '.##.##.', '##...##'],
};
function glyphSvg(rows) {
    const w = rows[0].length, h = rows.length;
    let rects = '';
    rows.forEach((row, y) => {
        for (let x = 0; x < w; x++) {
            if (row[x] === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
        }
    });
    return `<svg width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${rects}</svg>`;
}

// =====================================================================
//  OKNA - przeciąganie za pasek tytułu, _ □ X, fokus, pasek zadań
// =====================================================================

/**
 * @typedef {Object} DeskWin
 * @property {string} id
 * @property {HTMLElement} el          ramka okna
 * @property {HTMLButtonElement} taskBtn przycisk na pasku zadań
 * @property {HTMLButtonElement|null} maxBtn
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {number} z
 * @property {boolean} auto            rozmiar z zawartości (okienka z komunikatem)
 * @property {boolean} max
 * @property {boolean} min
 * @property {boolean} cover           zmaksymalizowane zakrywa też pasek zadań (gra)
 * @property {HTMLIFrameElement|null} frame
 * @property {(() => void)|null} onClose
 */

const winLayer = document.getElementById('windows');
const taskButtons = document.getElementById('taskButtons');
const taskbar = document.getElementById('taskbar');
/** @type {Map<string, DeskWin>} */
const wins = new Map();
/** @type {DeskWin|null} */
let activeWin = null;
let zTop = 10;            // okna mają z-index od 10 w górę (pasek zadań ma 5000)
const COVER_Z = 6000;     // zmaksymalizowana gra wskakuje nad pasek zadań

/**
 * otwiera nowe okno
 * @param {Object} o
 * @param {string} o.id
 * @param {string} o.title
 * @param {string} o.icon
 * @param {HTMLElement} o.body
 * @param {number} [o.w]          bez w/h = rozmiar z zawartości
 * @param {number} [o.h]
 * @param {boolean} [o.maximizable]
 * @param {boolean} [o.minimizable]
 * @param {boolean} [o.maximized]
 * @param {boolean} [o.cover]
 * @param {HTMLIFrameElement} [o.frame]
 * @param {() => void} [o.onClose]
 * @returns {DeskWin}
 */
function openWindow(o) {
    const root = el('div', 'window raised');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', o.title);

    // pasek tytułu: ikonka, tytuł, przyciski _ □ X
    const bar = el('div', 'titlebar');
    const icon = /** @type {HTMLImageElement} */ (el('img'));
    icon.src = o.icon;
    icon.alt = '';
    const btns = el('div', 'title-btns');
    const mkBtn = (glyph, label, cls) => {
        const b = /** @type {HTMLButtonElement} */ (el('button', 'win-btn ' + cls));
        b.innerHTML = glyphSvg(GLYPHS[glyph]);
        b.title = label;
        b.setAttribute('aria-label', label);
        btns.appendChild(b);
        return b;
    };
    const minBtn = o.minimizable === false ? null : mkBtn('min', 'Minimize', 'min-btn');
    const maxBtn = o.maximizable === false ? null : mkBtn(o.maximized ? 'restore' : 'max', o.maximized ? 'Restore' : 'Maximize', 'max-btn');
    const closeBtn = mkBtn('close', 'Close', 'close-btn');
    bar.append(icon, el('span', 'title-text', o.title), btns);

    const body = el('div', 'win-body');
    body.appendChild(o.body);
    root.append(bar, body);

    // przycisk na pasku zadań
    const taskBtn = /** @type {HTMLButtonElement} */ (el('button', 'win-btn task-btn'));
    const tIcon = /** @type {HTMLImageElement} */ (el('img'));
    tIcon.src = o.icon;
    tIcon.alt = '';
    taskBtn.append(tIcon, el('span', '', o.title));
    taskBtn.title = o.title;

    // kaskada: każde kolejne okno trochę niżej i w prawo
    const step = (wins.size % 5) * DESK.CASCADE;
    /** @type {DeskWin} */
    const win = {
        id: o.id, el: root, taskBtn, maxBtn,
        x: 0, y: 0, w: o.w || 0, h: o.h || 0, z: 0,
        auto: !o.w, max: !!o.maximized, min: false, cover: !!o.cover,
        frame: o.frame || null, onClose: o.onClose || null,
    };
    wins.set(o.id, win);
    winLayer.appendChild(root);
    taskButtons.appendChild(taskBtn);

    // pozycja "przywróconego" okna liczona od razu (też dla otwieranych zmaksymalizowanych)
    win.max = false;
    centerWin(win, step);
    win.max = !!o.maximized;

    // zdarzenia
    root.addEventListener('pointerdown', () => focusWin(win, false), true);
    root.addEventListener('pointerup', (e) => {
        // klik w ramkę/pasek okna gry oddaje klawiaturę grze (strzałki)
        if (win.frame && !(/** @type {HTMLElement} */ (e.target)).closest('.title-btns')) focusFrame(win);
    });
    root.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && win.auto) closeWin(win); // Esc zamyka okienka z komunikatem
    });
    if (minBtn) minBtn.addEventListener('click', () => minimizeWin(win));
    if (maxBtn) maxBtn.addEventListener('click', () => toggleMax(win));
    closeBtn.addEventListener('click', () => closeWin(win));
    bar.addEventListener('dblclick', (e) => {
        if (maxBtn && !(/** @type {HTMLElement} */ (e.target)).closest('.title-btns')) toggleMax(win);
    });
    taskBtn.addEventListener('click', () => {
        if (win.min) restoreWin(win);
        else if (activeWin === win) minimizeWin(win);
        else focusWin(win, true);
    });
    enableDrag(win, bar);

    focusWin(win, true);
    return win;
}

// ustawia okno na środku pulpitu (+ przesunięcie kaskady)
/**
 * @param {DeskWin} win
 * @param {number} [step]
 */
function centerWin(win, step = 0) {
    const size = winSize(win);
    win.x = Math.round((window.innerWidth - size.w) / 2) + step;
    win.y = Math.round((desktopH() - size.h) / 2) + step;
    layoutWin(win);
}

// wysokość pulpitu nad paskiem zadań
const desktopH = () => window.innerHeight - taskbar.offsetHeight;

/** @param {DeskWin} win */
function winSize(win) {
    if (win.max) return { w: window.innerWidth, h: win.cover ? window.innerHeight : desktopH() };
    if (win.auto) return { w: win.el.offsetWidth, h: win.el.offsetHeight };
    return { w: Math.min(win.w, window.innerWidth), h: Math.min(win.h, desktopH()) };
}

// ustawia rozmiar i pozycję okna; okno zawsze zostaje w całości na ekranie
/** @param {DeskWin} win */
function layoutWin(win) {
    const s = winSize(win);
    if (!win.auto || win.max) {
        win.el.style.width = s.w + 'px';
        win.el.style.height = s.h + 'px';
    }
    let x = 0, y = 0;
    if (!win.max) {
        x = win.x = clamp(win.x, 0, Math.max(0, window.innerWidth - s.w));
        y = win.y = clamp(win.y, 0, Math.max(0, desktopH() - s.h));
    }
    win.el.style.transform = `translate(${x}px, ${y}px)`;
    win.el.style.zIndex = String(win.z + (win.max && win.cover ? COVER_Z : 0));
    win.el.classList.toggle('max', win.max);
}

/**
 * przeciąganie za pasek tytułu (pointer events + transform, bez przeliczania układu)
 * @param {DeskWin} win
 * @param {HTMLElement} bar
 */
function enableDrag(win, bar) {
    let dx = 0, dy = 0, nx = 0, ny = 0, queued = false, dragging = false;
    const apply = () => {
        queued = false;
        if (!dragging) return;
        win.x = nx;
        win.y = ny;
        layoutWin(win);
    };
    bar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || win.max || (/** @type {HTMLElement} */ (e.target)).closest('.title-btns')) return;
        dragging = true;
        dx = e.clientX - win.x;
        dy = e.clientY - win.y;
        bar.setPointerCapture(e.pointerId);
        win.el.classList.add('dragging');
    });
    bar.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        nx = e.clientX - dx;
        ny = e.clientY - dy;
        if (!queued) { queued = true; requestAnimationFrame(apply); } // max 1 przesunięcie na klatkę
    });
    const stop = () => {
        if (!dragging) return;
        dragging = false;
        win.el.classList.remove('dragging');
    };
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);
}

// fokus: okno na wierzch, aktywny kolor paska tytułu, wciśnięty przycisk na pasku zadań
/**
 * @param {DeskWin} win
 * @param {boolean} giveFrameFocus  czy od razu dać klawiaturę grze w iframe
 */
function focusWin(win, giveFrameFocus) {
    closeStart();
    if (activeWin !== win || win.z !== zTop) win.z = ++zTop;
    setActive(win);
    layoutWin(win);
    if (giveFrameFocus && win.frame) focusFrame(win);
}

/** @param {DeskWin|null} win */
function setActive(win) {
    activeWin = win;
    wins.forEach((w) => {
        w.el.classList.toggle('active', w === win);
        w.taskBtn.classList.toggle('pressed', w === win);
    });
}

// najwyższe widoczne okno (po zamknięciu/zminimalizowaniu aktywnego)
function activateTop() {
    /** @type {DeskWin|null} */
    let top = null;
    wins.forEach((w) => { if (!w.min && (!top || w.z > top.z)) top = w; });
    if (top) focusWin(top, true);
    else setActive(null);
}

/** @param {DeskWin} win */
function minimizeWin(win) {
    win.min = true;
    win.el.classList.add('min');
    if (activeWin === win) activateTop();
    syncGamePause();
}

/** @param {DeskWin} win */
function restoreWin(win) {
    win.min = false;
    win.el.classList.remove('min');
    focusWin(win, true);
    syncGamePause();
}

/** @param {DeskWin} win */
function toggleMax(win) {
    win.max = !win.max;
    if (win.maxBtn) {
        win.maxBtn.innerHTML = glyphSvg(GLYPHS[win.max ? 'restore' : 'max']);
        win.maxBtn.title = win.max ? 'Restore' : 'Maximize';
        win.maxBtn.setAttribute('aria-label', win.maxBtn.title);
    }
    layoutWin(win);
    if (win.frame) focusFrame(win);
}

/** @param {DeskWin} win */
function closeWin(win) {
    win.el.remove();
    win.taskBtn.remove();
    wins.delete(win.id);
    if (win.onClose) win.onClose();
    if (activeWin === win) activateTop();
}

// klawiatura dla gry w iframe (strzałki)
/** @param {DeskWin} win */
function focusFrame(win) {
    if (!win.frame || win.min) return;
    win.frame.focus();
    if (win.frame.contentWindow) win.frame.contentWindow.focus();
}

// klik wewnątrz iframe nie dociera do pulpitu - za to pulpit traci fokus,
// więc wtedy wyciągamy okno z tym iframe na wierzch
window.addEventListener('blur', () => {
    setTimeout(() => {
        const a = document.activeElement;
        if (!(a instanceof HTMLIFrameElement)) return;
        wins.forEach((w) => { if (w.frame === a && activeWin !== w) focusWin(w, false); });
    }, 0);
});

// po zmianie rozmiaru okna przeglądarki okna wracają na ekran (max raz na klatkę)
let layoutQueued = false;
window.addEventListener('resize', () => {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
        layoutQueued = false;
        wins.forEach(layoutWin);
        deskCheckPc();
    });
});

// =====================================================================
//  OKIENKA Z KOMUNIKATEM (atrapy aplikacji, Shut Down, ładowanie)
// =====================================================================

/**
 * @param {Object} o
 * @param {string} o.id
 * @param {string} o.title
 * @param {string} o.text
 * @param {string} [o.icon]
 * @param {{label: string, action?: () => void}[]} [o.buttons]
 * @param {HTMLElement} [o.extra]   dodatkowa zawartość pod tekstem (np. pasek postępu)
 * @returns {DeskWin}
 */
function showMessage(o) {
    const old = wins.get(o.id);
    if (old) { if (old.min) restoreWin(old); else focusWin(old, true); return old; }

    const body = el('div', 'msg-body');
    const row = el('div', 'msg-row');
    const img = /** @type {HTMLImageElement} */ (el('img'));
    img.src = o.icon || INFO_ICON;
    img.alt = '';
    row.append(img, el('p', '', o.text));
    body.appendChild(row);
    if (o.extra) body.appendChild(o.extra);

    const buttons = o.buttons || [{ label: 'OK' }];
    const btnRow = el('div', 'msg-btns');
    if (buttons.length) body.appendChild(btnRow);

    const win = openWindow({
        id: o.id, title: o.title, icon: o.icon || INFO_ICON, body,
        maximizable: false, minimizable: false,
    });
    buttons.forEach((b) => {
        const btn = el('button', 'win-btn', b.label);
        btn.addEventListener('click', () => { closeWin(win); if (b.action) b.action(); });
        btnRow.appendChild(btn);
    });
    centerWin(win);                       // rozmiar znany dopiero po dodaniu przycisków
    const first = btnRow.querySelector('button');
    if (first) first.focus();             // Enter = OK
    return win;
}

// =====================================================================
//  APLIKACJE
// =====================================================================

/** @param {typeof APPS[number]} app */
function openApp(app) {
    closeStart();
    if (app.open) app.open();
    else showMessage({ id: 'msg-' + app.id, title: app.name, text: app.message || DESK.NOT_READY, icon: INFO_ICON });
}

// ===== PLIKI W KOSZU =====
// name - nazwa pliku, icon - obrazek 32x32, open - co robi podwójny klik / Enter
const TRASH_FILES = [
    { name: 'OpenMe.txt', icon: 'assets/icons/readme.png', open: () => openNotepad('OpenMe.txt', TRASH_TEXT, DESK.NOTE_W, DESK.NOTE_H) },
];
function openTrash() {
    openFolder('Recycle Bin', TRASH_FILES, 'assets/icons/recycle.png');
}

// My Computer: folder z jednym obrazkiem (pixelowy worek na śmieci)
const PC_FILES = [
    { name: 'your_pc.png', icon: 'assets/icons/pc-trash-thumb.png', open: () => openImage('your_pc.png', 'assets/pc-trash.png', PC_CAPTION) },
];
function openComputer() {
    openFolder('My Computer', PC_FILES, 'assets/icons/computer.png');
}

/**
 * podgląd obrazka (pixel art powiększony o całkowitą skalę, z podpisem)
 * @param {string} title   nazwa pliku w pasku tytułu
 * @param {string} src
 * @param {string} [caption]
 * @param {number} [scale] powiększenie (całkowite = ostre pixele)
 */
function openImage(title, src, caption, scale = DESK.IMAGE_SCALE) {
    const id = 'img-' + title;
    if (reuseWin(id)) return;
    const pic = new Image();
    pic.onload = () => {
        if (wins.has(id)) return;                     // podwójny klik w trakcie ładowania
        const body = el('div', 'viewer');
        const frame = el('div', 'viewer-frame sunken');
        pic.className = 'viewer-img';
        pic.alt = caption || title;
        pic.style.width = pic.naturalWidth * scale + 'px';
        pic.style.height = pic.naturalHeight * scale + 'px';
        frame.appendChild(pic);
        body.appendChild(frame);
        if (caption) body.appendChild(el('p', 'viewer-caption', caption));
        const win = openWindow({ id, title: title + ' - Image Viewer', icon: 'assets/icons/pc-trash-thumb.png', body, maximizable: false });
        centerWin(win);
        layoutWin(win);
    };
    pic.src = src;
}

// README.txt - Notatnik tylko do czytania
function openReadme() {
    openNotepad('README.txt', typeof README_TEXT === 'string' ? README_TEXT : README_FALLBACK);
}

// jeśli okno o tym id już jest otwarte - przywróć je i daj na wierzch (zamiast drugiej kopii)
/** @param {string} id */
function reuseWin(id) {
    const old = wins.get(id);
    if (!old) return false;
    if (old.min) restoreWin(old);
    else focusWin(old, true);
    return true;
}

/**
 * okno Notatnika (tylko do czytania) z dowolnym plikiem tekstowym
 * @param {string} filename   np. 'README.txt' - tytuł okna to "<filename> - Notepad"
 * @param {string} text
 * @param {number} [w]
 * @param {number} [h]
 */
function openNotepad(filename, text, w = DESK.README_W, h = DESK.README_H) {
    const id = 'note-' + filename;
    if (reuseWin(id)) return;

    const body = el('div', 'notepad');
    body.style.display = 'contents';
    const menu = el('div', 'menubar');
    ['File', 'Edit', 'Format', 'Help'].forEach((m) => menu.appendChild(el('span', '', m))); // atrapy
    const area = el('div', 'notepad-text sunken');
    area.tabIndex = 0;                     // strzałki / PageDown przewijają tekst
    area.setAttribute('role', 'document');
    area.setAttribute('aria-label', filename);
    renderNote(area, text);
    body.append(menu, area);

    openWindow({ id, title: `${filename} - Notepad`, icon: 'assets/icons/readme.png', body, w, h });
    area.focus();
    area.scrollTop = 0;
}

/**
 * zamienia tekst notatki na elementy: zwykłe linie jako tekst (bez HTML),
 * [img: ścieżka] -> obrazek x2 z ostrymi pixelami, [palette: #hex ...] -> kwadraciki kolorów
 * @param {HTMLElement} box
 * @param {string} text
 */
function renderNote(box, text) {
    let buf = [];
    const flush = () => {
        if (buf.length) box.appendChild(el('div', 'note-line', buf.join('\n')));
        buf = [];
    };
    text.replace(/\s+$/, '').split('\n').forEach((line) => {
        const img = line.match(/^\s*\[img:\s*([^\]]+?)\s*\]\s*$/i);
        const pal = line.match(/^\s*\[palette:\s*([^\]]*)\]\s*$/i);
        if (img) {
            flush();
            const wrap = el('div', 'note-img');
            const pic = /** @type {HTMLImageElement} */ (el('img'));
            pic.alt = '';
            pic.onload = () => {                  // całkowita skala x2 = ostre pixele
                pic.style.width = pic.naturalWidth * DESK.NOTE_IMG_SCALE + 'px';
                pic.style.height = pic.naturalHeight * DESK.NOTE_IMG_SCALE + 'px';
            };
            pic.onerror = () => wrap.replaceChildren(el('span', 'note-missing', `[image not found: ${img[1]}]`));
            pic.src = img[1];
            wrap.appendChild(pic);
            box.appendChild(wrap);
        } else if (pal) {
            flush();
            const row = el('div', 'note-palette');
            pal[1].split(/[\s,]+/).filter((c) => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c)).forEach((c) => {
                const sw = el('span', 'note-swatch');
                const chip = el('i');
                chip.style.background = c;        // kolor z treści README (dane, nie wygląd strony)
                sw.append(chip, el('b', '', c.toUpperCase()));
                sw.title = c.toUpperCase();
                row.appendChild(sw);
            });
            box.appendChild(row);
        } else {
            buf.push(line);
        }
    });
    flush();
}

/**
 * okno folderu w stylu Eksploratora Win95: menu (atrapy), pliki, pasek stanu.
 * Klik zaznacza plik, podwójny klik / Enter go otwiera.
 * @param {string} title
 * @param {{name: string, icon: string, open: () => void}[]} files
 * @param {string} [icon]   ikonka w pasku tytułu i na pasku zadań
 */
function openFolder(title, files, icon = 'assets/icons/computer.png') {
    const id = 'folder-' + title;
    if (reuseWin(id)) return;

    const body = el('div', 'folder');
    body.style.display = 'contents';
    const menu = el('div', 'menubar');
    ['File', 'Edit', 'View', 'Help'].forEach((m) => menu.appendChild(el('span', '', m))); // atrapy
    const view = el('div', 'folder-view sunken');
    const status = el('div', 'statusbar');
    const count = el('span', 'sunken', `${files.length} object(s)`);
    const selInfo = el('span', 'sunken', '');
    status.append(count, selInfo);

    /** @type {HTMLButtonElement[]} */
    const items = [];
    /** @param {HTMLButtonElement|null} b */
    const select = (b) => {
        items.forEach((i) => i.classList.toggle('selected', i === b));
        selInfo.textContent = b ? b.dataset.name : '';
        if (b) b.focus();
    };
    files.forEach((f) => {
        const b = /** @type {HTMLButtonElement} */ (el('button', 'icon file'));
        b.dataset.name = f.name;
        const img = /** @type {HTMLImageElement} */ (el('img'));
        img.src = f.icon;
        img.alt = '';
        b.append(img, el('span', '', f.name));
        b.addEventListener('click', () => select(b));
        b.addEventListener('dblclick', () => f.open());
        b.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); f.open(); }
            const move = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
            if (move && items[items.indexOf(b) + move]) select(items[items.indexOf(b) + move]);
        });
        view.appendChild(b);
        items.push(b);
    });
    // klik w puste miejsce folderu odznacza plik
    view.addEventListener('pointerdown', (e) => {
        if (!(/** @type {HTMLElement} */ (e.target)).closest('.file')) select(null);
    });
    body.append(menu, view, status);

    openWindow({ id, title, icon, body, w: DESK.FOLDER_W, h: DESK.FOLDER_H });
}

// gra: krótkie "Loading..." z klepsydrą, potem okno z game.html na cały ekran
let gameLoading = false;
function launchGame() {
    const old = wins.get('game');
    if (old) { if (old.min) restoreWin(old); else focusWin(old, true); return; }
    if (gameLoading) return;
    gameLoading = true;
    document.body.classList.add('busy');

    const bar = el('div', 'progress sunken');
    const fill = el('div', 'progress-fill');
    bar.appendChild(fill);
    const loading = showMessage({
        id: 'loading', title: GAME_NAME, icon: 'assets/primogem.png',
        text: `Loading ${GAME_NAME}...`, extra: bar, buttons: [],
    });
    loading.el.style.width = '380px';
    centerWin(loading);
    // pasek zapełnia się skokami (jak w Windowsie), bez liczenia co klatkę
    fill.style.transition = `width ${DESK.LOAD_TIME}ms steps(10, end)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = '100%'; }));

    setTimeout(() => {
        gameLoading = false;
        document.body.classList.remove('busy');
        if (wins.get('loading') !== loading) return; // ktoś zamknął "Loading..." krzyżykiem = anuluj
        closeWin(loading);
        openGameWindow();
    }, DESK.LOAD_TIME + 120);
}

function openGameWindow() {
    const frame = /** @type {HTMLIFrameElement} */ (el('iframe', 'game-frame'));
    frame.src = 'game.html';
    frame.title = GAME_NAME;
    const win = openWindow({
        id: 'game', title: GAME_NAME, icon: 'assets/primogem.png', body: frame, frame,
        w: DESK.GAME_W, h: DESK.GAME_H, maximized: true, cover: true,
    });
    frame.addEventListener('load', () => {
        syncGamePause();
        if (activeWin === win) focusFrame(win);
    });
}

// gra 3D (re.html) w okienku z <iframe>: zmaksymalizowana, ale pasek zadań zostaje
function openResidentCake() {
    if (reuseWin('re')) return;
    const frame = /** @type {HTMLIFrameElement} */ (el('iframe', 'game-frame'));
    frame.src = 're.html';
    frame.title = 'Resident Cake';
    frame.allow = 'fullscreen';
    const win = openWindow({
        id: 're', title: 'Resident Cake', icon: 'assets/icons/re.png', body: frame, frame,
        w: DESK.RE_W, h: DESK.RE_H, maximized: true,
    });
    frame.addEventListener('load', () => {
        syncGamePause();
        if (activeWin === win) focusFrame(win);
    });
}

// gry w <iframe> stoją, gdy ich okno jest zminimalizowane albo pulpit pokazuje monit PC ONLY
function syncGamePause() {
    wins.forEach((g) => {
        if (!g.frame || !g.frame.contentWindow) return;
        // '*' bo z dysku (file://) origin to "null"; gra sprawdza, że wiadomość jest od rodzica
        g.frame.contentWindow.postMessage({ type: 'hb-host', paused: g.min || deskBlocked }, '*');
    });
}

// =====================================================================
//  IKONY NA PULPICIE - klik zaznacza, podwójny klik / Enter otwiera
// =====================================================================

const iconBox = document.getElementById('icons');
/** @type {HTMLButtonElement[]} */
const iconEls = [];
APPS.forEach((app) => {
    const b = /** @type {HTMLButtonElement} */ (el('button', 'icon'));
    b.setAttribute('role', 'option');
    b.dataset.id = app.id;
    const img = /** @type {HTMLImageElement} */ (el('img'));
    img.src = app.icon;
    img.alt = '';
    b.append(img, el('span', '', app.name));
    b.addEventListener('click', () => selectIcon(b));
    b.addEventListener('dblclick', () => openApp(app));
    b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); openApp(app); }
    });
    if (app.center) {
        b.classList.add('center');                        // na środku ekranu (desktop.css)
        document.getElementById('desktop').appendChild(b);
    } else iconBox.appendChild(b);
    iconEls.push(b);
});

/** @param {HTMLButtonElement|null} b */
function selectIcon(b) {
    iconEls.forEach((i) => {
        i.classList.toggle('selected', i === b);
        i.setAttribute('aria-selected', String(i === b));
    });
    if (b) b.focus();
}

// klik w puste miejsce pulpitu odznacza ikonę
document.getElementById('desktop').addEventListener('pointerdown', (e) => {
    if (!(/** @type {HTMLElement} */ (e.target)).closest('.icon')) selectIcon(null);
    closeStart();
});

// strzałki przesuwają zaznaczenie (góra/dół w kolumnie, lewo/prawo między kolumnami)
iconBox.addEventListener('keydown', (e) => {
    const i = iconEls.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (i < 0) return;
    const perCol = iconEls.filter((b) => b.offsetLeft === iconEls[0].offsetLeft).length;
    const move = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -perCol, ArrowRight: perCol }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    const next = iconEls[i + move];
    if (next) selectIcon(next);
});

// =====================================================================
//  MENU START I PASEK ZADAŃ
// =====================================================================

const startBtn = document.getElementById('startBtn');
const startMenu = document.getElementById('startMenu');
const startList = document.getElementById('startList');

/**
 * @param {string} label
 * @param {string} icon
 * @param {() => void} action
 */
function addStartItem(label, icon, action) {
    const li = el('li');
    li.tabIndex = 0;
    li.setAttribute('role', 'menuitem');
    const img = /** @type {HTMLImageElement} */ (el('img'));
    img.src = icon;
    img.alt = '';
    li.append(img, el('span', '', label));
    li.addEventListener('click', () => { closeStart(); action(); });
    li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); closeStart(); action(); }
    });
    startList.appendChild(li);
}
APPS.forEach((app) => addStartItem(app.name, app.icon, () => openApp(app)));
startList.appendChild(el('li', 'sep'));
addStartItem('Shut Down...', SHUTDOWN_ICON, askShutdown);
document.getElementById('startSideText').textContent = OS_NAME;

function openStart() {
    startMenu.classList.remove('hidden');
    startBtn.classList.add('pressed');
    startBtn.setAttribute('aria-expanded', 'true');
}
function closeStart() {
    if (startMenu.classList.contains('hidden')) return;
    startMenu.classList.add('hidden');
    startBtn.classList.remove('pressed');
    startBtn.setAttribute('aria-expanded', 'false');
}
startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (startMenu.classList.contains('hidden')) {
        openStart();
        const first = startList.querySelector('li');
        if (first) first.focus();
    } else closeStart();
});
// klik gdziekolwiek poza menu je zamyka
document.addEventListener('pointerdown', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.closest('#startMenu') && !t.closest('#startBtn')) closeStart();
});

// Shut Down... -> pytanie -> ekran "It's now safe to turn off your computer."
const offScreen = document.getElementById('offScreen');
function askShutdown() {
    showMessage({
        id: 'shutdown', title: 'Shut Down', icon: SHUTDOWN_ICON,
        text: "Are you sure you want to shut down? There's still a wish waiting for you!",
        buttons: [{ label: 'Cancel' }, { label: 'Shut Down', action: shutDown }],
    });
}
function shutDown() {
    [...wins.values()].forEach(closeWin);
    selectIcon(null);
    offScreen.classList.remove('hidden');
}
function wakeUp() {
    offScreen.classList.add('hidden');
    runBoot();
}
offScreen.addEventListener('click', wakeUp);

// zegar w zasobniku (HH:MM, czas lokalny) - odświeżany raz na minutę
const clockEl = document.getElementById('clock');
function updateClock() {
    const now = new Date();
    clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    clockEl.title = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    setTimeout(updateClock, 60000 - (now.getTime() % 60000) + 50); // równo na pełną minutę
}
updateClock();

// =====================================================================
//  KLAWIATURA (cały pulpit)
// =====================================================================

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
document.addEventListener('keydown', (e) => {
    // ekran startowy / wyłączony: dowolny klawisz go zamyka
    if (booting) { e.preventDefault(); endBoot(); return; }
    if (!offScreen.classList.contains('hidden')) { e.preventDefault(); wakeUp(); return; }

    if (e.key === 'Escape') closeStart();
    const t = /** @type {HTMLElement} */ (e.target);
    const inText = t instanceof HTMLTextAreaElement || !!t.closest('.notepad-text');
    // strzałki itp. nie przewijają strony pulpitu (w Notatniku przewijają tekst)
    if (!inText && (SCROLL_KEYS.has(e.key) || (e.key === ' ' && t === document.body))) e.preventDefault();
    // strzałka trafiła do pulpitu, a na wierzchu jest gra -> oddajemy jej klawiaturę
    if (activeWin && activeWin.frame && ARROWS.has(e.key) && !t.closest('.icon')) focusFrame(activeWin);
});

// =====================================================================
//  EKRAN STARTOWY (BOOT) - raz na sesję karty, pomijany klikiem/klawiszem
// =====================================================================

const bootEl = document.getElementById('boot');
const bootBar = document.getElementById('bootBar');
let booting = false;
let bootTimer = 0;
document.getElementById('bootTitle').textContent = OS_NAME;
for (let i = 0; i < DESK.BOOT_BLOCKS; i++) bootBar.appendChild(el('i'));

function runBoot() {
    booting = true;
    bootEl.classList.remove('hidden');
    const blocks = bootBar.children;
    for (const b of blocks) b.classList.remove('on');
    let lit = 0;
    // klocek co BOOT_TIME / BOOT_BLOCKS ms (bez pętli co klatkę)
    bootTimer = setInterval(() => {
        if (lit < blocks.length) blocks[lit++].classList.add('on');
        else endBoot();
    }, DESK.BOOT_TIME / DESK.BOOT_BLOCKS);
}
function endBoot() {
    if (!booting) return;
    booting = false;
    clearInterval(bootTimer);
    bootEl.classList.add('hidden');
    try { sessionStorage.setItem('hb-booted', '1'); } catch (err) { /* bez sessionStorage boot będzie przy każdym wejściu */ }
    document.dispatchEvent(new Event('hb-boot-done')); // music.js pokazuje wtedy okienko "Sound"
}
bootEl.addEventListener('pointerdown', endBoot);

let bootedBefore = false;
try { bootedBefore = sessionStorage.getItem('hb-booted') === '1'; } catch (err) { /* jw. */ }
if (!bootedBefore) runBoot();

// =====================================================================
//  MONIT "PC ONLY" - za małe okno albo sam ekran dotykowy (jak w grze)
// =====================================================================

const deskPcOnly = document.getElementById('pcOnly');
const deskPcSize = document.getElementById('pcSize');
const deskPcTouch = document.getElementById('pcTouch');
let deskBlocked = false;
const deskTouchMq = window.matchMedia('(hover: none) and (pointer: coarse)');
const deskFineMq = window.matchMedia('(any-pointer: fine)');

function deskCheckPc() {
    const w = window.innerWidth, h = window.innerHeight;
    const touch = deskTouchMq.matches && !deskFineMq.matches;
    const blocked = touch || w < DESK.MIN_W || h < DESK.MIN_H;
    deskPcSize.textContent = `${w}×${h}`;
    deskPcTouch.classList.toggle('hidden', !touch);
    if (blocked === deskBlocked) return;
    deskBlocked = blocked;
    deskPcOnly.classList.toggle('hidden', !blocked);
    document.body.classList.toggle('pc-blocked', blocked);
    if (blocked) closeStart();
    syncGamePause(); // gra w okienku staje razem z pulpitem
}
document.getElementById('pcMin').textContent = `${DESK.MIN_W}×${DESK.MIN_H}`;
deskTouchMq.addEventListener('change', deskCheckPc);
deskFineMq.addEventListener('change', deskCheckPc);
deskCheckPc();
