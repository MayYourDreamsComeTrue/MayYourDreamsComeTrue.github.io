// =====================================================================
//  SIGIL SNAKE - wężyk w okienku na pulpicie (index.html)
//  Wężyk zjada skrzynki z Genshina, każda daje 1 pieczęć (Kitty Sigil).
//  Przy 30 pieczęciach gra staje i otwiera się lokacja "Kitty Flame"
//  (jak Tona's Flame): ołtarz + panel z guzikami Rewards / Offer.
//  Offer = oddajemy 30 pieczęci i dostajemy losowego kotka z cataas.com
//  (bez internetu - kotek z pixeli assets/snake/kitten.png).
//  Korzysta z systemu okien z desktop.js (openWindow, reuseWin, el...),
//  więc musi być wczytany PO desktop.js.
//
//  Sterowanie: strzałki / WASD, P = pauza, F2 = nowa gra, Esc = zamknij ołtarz.
//  Obrazki: assets/snake/, dziewczynka przy
//  ołtarzu pochodzi z assets/pacman/sprites.png. Kolory w desktop.css (sekcja 12).
// =====================================================================

const SNK = {
    CELL: 16,             // kratka planszy w logicznych pixelach
    COLS: 20,
    ROWS: 15,
    WIN_W: 664,           // okno mieści planszę x2 (640x480) + pasek u góry
    WIN_H: 566,
    MAX_SCALE: 3,
    TICK: 150,            // ms na jeden krok wężyka na start ...
    TICK_MIN: 70,         // ... najszybciej ...
    TICK_STEP: 4,         // ... i o tyle szybciej po każdej skrzynce
    START_LEN: 3,
    COST: 30,             // ile pieczęci kosztuje ofiara przy ołtarzu
    SCENE_W: 200,         // szerokość obrazka ołtarza (reszta to panel po prawej)
    DISC: [114, 101],     // środek złotej tarczy na assets/snake/altar.png
    FLAME: [117, 157],    // płomyk na ołtarzu (miejsce na ofiary)
    GIRL: [121, 214],     // gdzie stoi nasza postać (lewy górny róg sprite'a 16x16)
    GLYPHS: [[104, 75], [125, 81], [86, 97], [138, 106], [103, 121], [124, 126], [88, 113]],
    CAT_JSON: 'https://cataas.com/cat/cute?json=true&width=256',
    CAT_IMG: 'https://cataas.com/cat/cute?width=256&t=',
    CAT_TIMEOUT: 8000,    // ms czekania na kotka z internetu
    GALLERY_MAX: 12,      // ile kotków pamięta galeria
    TOKENS_KEY: 'hb-snake-tokens',
    HIGH_KEY: 'hb-snake-high',
    LEVEL_KEY: 'hb-snake-flame',
    GALLERY_KEY: 'hb-snake-kitties',
};
// kierunki jak w Primo-Manie: 0 dół, 1 prawo, 2 góra, 3 lewo
const SNK_DX = [0, 1, 0, -1];
const SNK_DY = [1, 0, -1, 0];
const SNK_KEYS = /** @type {Record<string, number>} */ ({
    ArrowDown: 0, s: 0, S: 0, ArrowRight: 1, d: 1, D: 1, ArrowUp: 2, w: 2, W: 2, ArrowLeft: 3, a: 3, A: 3,
});

/** @type {any} */
var hbSnake = null;

const snkNum = (key) => Number(localStorage.getItem(key)) || 0;

// obrazek z timeoutem (kotki z internetu)
/** @returns {Promise<HTMLImageElement>} */
function snkLoadImg(src, ms) {
    return new Promise((ok, fail) => {
        const im = new Image();
        const t = setTimeout(() => { im.src = ''; fail(new Error('timeout')); }, ms);
        im.onload = () => { clearTimeout(t); ok(im); };
        im.onerror = () => { clearTimeout(t); fail(new Error('img')); };
        im.src = src;
    });
}

// losowy kotek: cataas (JSON -> stały adres do galerii), potem sam obrazek, na końcu kotek z pixeli
/** @returns {Promise<{img: HTMLImageElement, url: string, online: boolean}>} */
async function snkFetchKitty() {
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), SNK.CAT_TIMEOUT);
        const r = await fetch(SNK.CAT_JSON + '&t=' + Date.now(), { signal: ctl.signal, cache: 'no-store' });
        clearTimeout(t);
        const j = await r.json();
        let url = String(j.url || (j._id ? '/cat/' + j._id : j.id ? '/cat/' + j.id : ''));
        if (!url) throw new Error('no url');
        if (!/^https?:/.test(url)) url = 'https://cataas.com' + (url[0] === '/' ? '' : '/') + url;
        return { img: await snkLoadImg(url, SNK.CAT_TIMEOUT), url, online: true };
    } catch (e) { /* spróbujemy inaczej */ }
    try {
        const url = SNK.CAT_IMG + Math.random().toString(36).slice(2);
        return { img: await snkLoadImg(url, SNK.CAT_TIMEOUT), url, online: true };
    } catch (e) { /* offline */ }
    return { img: await snkLoadImg('assets/snake/kitten.png', 3000), url: 'local', online: false };
}

function openSnake() {
    if (reuseWin('snake')) return;
    const CS = SNK.CELL, W = SNK.COLS * CS, H = SNK.ROWS * CS;

    // ----- DOM: pasek (pieczęci, wynik, rekord, ołtarz) + plansza -----
    const body = el('div', 'snk');
    const hud = el('div', 'snk-hud');
    const tokWrap = el('span', 'snk-tok');
    const tokImg = /** @type {HTMLImageElement} */ (el('img'));
    tokImg.src = 'assets/snake/token.png';
    tokImg.alt = '';
    const tokText = el('span', '', '');
    tokWrap.append(tokImg, tokText);
    const hScore = el('span', 'snk-score');
    const hHigh = el('span', 'snk-high');
    const altarBtn = /** @type {HTMLButtonElement} */ (el('button', 'win-btn snk-altar-btn', 'Altar'));
    altarBtn.title = 'Kitty Flame (Esc closes)';
    hud.append(tokWrap, hScore, hHigh, altarBtn);

    const stage = el('div', 'snk-stage');
    stage.tabIndex = 0;                     // klawiatura trafia do gry, nie do ikon pulpitu
    const box = el('div', 'snk-box');
    const cv = /** @type {HTMLCanvasElement} */ (el('canvas', 'snk-canvas'));
    cv.width = W; cv.height = H;
    const msg = el('div', 'snk-msg hidden');
    box.append(cv, msg);
    stage.appendChild(box);
    body.append(hud, stage);
    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));

    // ----- panel ołtarza (jak Tona's Flame) -----
    const altar = el('div', 'snk-altar hidden');
    const panel = el('div', 'snk-panel');
    const pTitle = el('div', 'snk-title', 'Kitty Flame');
    const closeX = /** @type {HTMLButtonElement} */ (el('button', 'snk-x', '×'));
    closeX.title = 'Back to the game';
    const main = el('div', 'snk-main');
    const emb = el('div', 'snk-emblem');
    const embImg = /** @type {HTMLImageElement} */ (el('img'));
    embImg.src = 'assets/snake/emblem.png';
    embImg.alt = '';
    const lvl = el('span', 'snk-lvl', '');
    emb.append(embImg, lvl);
    const sub = el('div', 'snk-sub', '');
    const rewRow = el('div', 'snk-rew-row');
    const slot = el('div', 'snk-slot');
    const slotImg = /** @type {HTMLImageElement} */ (el('img'));
    slotImg.src = 'assets/snake/kitten.png';
    slotImg.alt = 'Random Kitty';
    slot.title = 'Random Kitty';
    slot.append(slotImg, el('span', '', '1'));
    rewRow.appendChild(slot);
    const reqH = el('div', 'snk-req-h', 'Required Materials');
    const req = el('div', 'snk-req');
    const reqIc = el('span', 'snk-req-ic');
    const reqImg = /** @type {HTMLImageElement} */ (el('img'));
    reqImg.src = 'assets/snake/token.png';
    reqImg.alt = '';
    reqIc.appendChild(reqImg);
    const reqN = el('b', 'snk-req-n', '');
    req.append(reqIc, el('span', 'snk-req-name', 'Kitty Sigil'), reqN);
    main.append(emb, sub, rewRow, reqH, req);

    const rewView = el('div', 'snk-rewview hidden');
    const rewInfo = el('div', 'snk-rew-info', 'Offer 30 Kitty Sigils to the flame and a random kitty comes to visit (cataas.com).');
    const galH = el('div', 'snk-req-h', '');
    const gal = el('div', 'snk-gallery');
    rewView.append(rewInfo, galH, gal);

    const pills = el('div', 'snk-pills');
    const mkPill = (label, icon) => {
        const b = /** @type {HTMLButtonElement} */ (el('button', 'snk-pill'));
        b.append(el('i', icon), el('span', '', label));
        pills.appendChild(b);
        return b;
    };
    const rewardsBtn = mkPill('Rewards', 'snk-ic-ring');
    const offerBtn = mkPill('Offer', 'snk-ic-up');
    panel.append(pTitle, closeX, main, rewView, pills);
    altar.appendChild(panel);

    // karta z kotkiem
    const reveal = el('div', 'snk-reveal hidden');
    const card = el('div', 'snk-card raised');
    const cardT = el('div', 'snk-card-t', 'A kitty appeared!');
    const frameEl = el('div', 'snk-frame');
    const catCv = /** @type {HTMLCanvasElement} */ (el('canvas', 'snk-cat'));
    catCv.width = 96; catCv.height = 96;
    const loading = el('span', 'snk-loading', 'Summoning');
    frameEl.append(catCv, loading);
    const cardSrc = el('div', 'snk-card-src', '');
    const contBtn = /** @type {HTMLButtonElement} */ (el('button', 'win-btn snk-cont', 'Continue'));
    card.append(cardT, frameEl, cardSrc, contBtn);
    reveal.appendChild(card);
    box.append(altar, reveal);
    const catCtx = /** @type {CanvasRenderingContext2D} */ (catCv.getContext('2d'));

    // obrazki
    const sheet = new Image();
    sheet.src = 'assets/snake/sprites.png';
    const altarImg = new Image();
    altarImg.src = 'assets/snake/altar.png';
    const girl = new Image();
    girl.src = 'assets/pacman/sprites.png';

    // kolory z desktop.css (sekcja 12)
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue('--snk-' + n).trim();
    const C = {
        a: v('board-a'), b: v('board-b'), body: v('body'), light: v('body-light'), dark: v('body-dark'),
        eye: v('eye'), pupil: v('pupil'), cheek: v('cheek'), tongue: v('tongue'), text: v('plus'),
        panel: v('scene-side'), glow: v('glow'), glowOut: v('glow-out'), ember: v('ember'),
        f1: v('flame-core'), f2: v('flame-mid'), f3: v('flame-edge'), flash: v('flash'),
    };

    // ----- stan -----
    const st = {
        mode: 'title',     // title | ready | play | wow | dying | over | altar
        resume: 'title',   // do jakiego trybu wraca gra po zamknięciu ołtarza
        timer: 0,
        acc: 0,            // ms od ostatniego kroku
        score: 0,          // skrzynki w tej grze
        high: snkNum(SNK.HIGH_KEY),
        tokens: snkNum(SNK.TOKENS_KEY),
        flame: snkNum(SNK.LEVEL_KEY),   // poziom ołtarza = ile razy oddaliśmy pieczęci
        paused: false,
        t: 0,              // czas animacji (s)
        deadT: 0,
        offerT: -1,        // animacja ofiary (s od kliknięcia Offer), -1 = brak
        busy: false,       // trwa przywoływanie kotka
    };
    /** @type {{x:number,y:number}[]} */
    let segs = [];
    /** @type {{x:number,y:number}[]} */
    let from = [];
    let dir = 1;
    /** @type {number[]} */
    let queue = [];
    /** @type {{x:number,y:number,born:number}|null} */
    let chest = null;
    /** @type {{x:number,y:number,t:number}[]} */
    let opened = [];
    /** @type {{x:number,y:number,vx:number,vy:number,life:number,max:number,big:boolean}[]} */
    let parts = [];
    /** @type {{x:number,y:number,vx:number,vy:number,life:number}[]} */
    let embers = [];
    /** @type {string[]} */
    let gallery = [];
    try { gallery = JSON.parse(localStorage.getItem(SNK.GALLERY_KEY) || '[]').filter((s) => typeof s === 'string'); } catch (e) { gallery = []; }

    const tick = () => Math.max(SNK.TICK_MIN, SNK.TICK - st.score * SNK.TICK_STEP);
    const saveTokens = () => localStorage.setItem(SNK.TOKENS_KEY, String(st.tokens));

    function newGame() {
        const y = Math.floor(SNK.ROWS / 2), x = 6;
        segs = [];
        for (let i = 0; i < SNK.START_LEN; i++) segs.push({ x: x - i, y });
        from = segs.map((s) => ({ ...s }));
        dir = 1; queue = []; opened = []; parts = [];
        st.score = 0; st.acc = 0; st.deadT = 0; st.paused = false;
        placeChest();
        hudDraw();
    }
    function placeChest() {
        const free = [];
        for (let y = 0; y < SNK.ROWS; y++) {
            for (let x = 0; x < SNK.COLS; x++) {
                if (!segs.some((s) => s.x === x && s.y === y)) free.push({ x, y });
            }
        }
        const c = free[Math.floor(Math.random() * free.length)];
        chest = c ? { x: c.x, y: c.y, born: st.t } : null;
    }

    // ----- jeden krok wężyka -----
    function step() {
        if (queue.length) dir = /** @type {number} */ (queue.shift());
        const h = segs[0];
        const nx = h.x + SNK_DX[dir], ny = h.y + SNK_DY[dir];
        const eats = !!chest && chest.x === nx && chest.y === ny;
        const body = eats ? segs : segs.slice(0, -1);     // ogon ucieka, chyba że rośniemy
        if (nx < 0 || ny < 0 || nx >= SNK.COLS || ny >= SNK.ROWS || body.some((s) => s.x === nx && s.y === ny)) {
            die();
            return;
        }
        from = segs.map((s) => ({ ...s }));
        segs.unshift({ x: nx, y: ny });
        if (!eats) segs.pop();
        if (eats) eatChest(nx, ny);
    }
    function eatChest(x, y) {
        opened.push({ x, y, t: 0 });
        burst(x * CS + 8, y * CS + 6, 10, true);
        st.score++;
        if (st.score > st.high) { st.high = st.score; localStorage.setItem(SNK.HIGH_KEY, String(st.high)); }
        const before = st.tokens;
        st.tokens++;
        saveTokens();
        hudDraw(true);
        placeChest();
        // dokładnie 30 -> stop i do ołtarza (po chwili, żeby było widać otwartą skrzynkę)
        if (before < SNK.COST && st.tokens >= SNK.COST) { st.mode = 'wow'; st.timer = 1.1; }
    }
    function die() {
        st.mode = 'dying'; st.deadT = 0;
        from = segs.map((s) => ({ ...s }));
    }
    function burst(x, y, n, big) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 40;
            const life = 0.4 + Math.random() * 0.4;
            parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life, max: life, big: big && i % 2 === 0 });
        }
    }

    // ----- logika klatki -----
    function update(dt) {
        if (st.mode === 'ready') { if ((st.timer -= dt) <= 0) st.mode = 'play'; return; }
        if (st.mode === 'wow') { if ((st.timer -= dt) <= 0) openAltar(); return; }
        if (st.mode === 'dying') {
            st.deadT += dt;
            const popped = Math.floor(Math.max(0, st.deadT - 0.6) / 0.07);
            while (segs.length && popped > from.length - segs.length) {
                const s = /** @type {{x:number,y:number}} */ (segs.pop());
                burst(s.x * CS + 8, s.y * CS + 8, 5, segs.length === 0);
            }
            if (!segs.length && st.deadT > 0.6 + from.length * 0.07 + 0.6) { st.mode = 'over'; hudDraw(); }
            return;
        }
        if (st.mode !== 'play') return;
        st.acc += dt * 1000;
        const tk = tick();
        while (st.acc >= tk && st.mode === 'play') { st.acc -= tk; step(); }
    }
    function animate(dt) {
        st.t += dt;
        parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + 20 * dt; p.life -= dt; });
        parts = parts.filter((p) => p.life > 0);
        opened.forEach((o) => { o.t += dt; });
        opened = opened.filter((o) => o.t < 0.9);
        if (st.mode === 'altar') {
            // iskry z płomyka na ołtarzu
            if (Math.random() < dt * 14) {
                embers.push({ x: SNK.FLAME[0] + (Math.random() - 0.5) * 6, y: SNK.FLAME[1] - 4, vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 14, life: 1 + Math.random() * 1.2 });
            }
            embers.forEach((e) => { e.x += (e.vx + Math.sin(st.t * 3 + e.y * 0.2) * 4) * dt; e.y += e.vy * dt; e.life -= dt; });
            embers = embers.filter((e) => e.life > 0);
            if (st.offerT >= 0) st.offerT += dt;
        }
    }

    // ----- rysowanie planszy -----
    const spr = (sx, sy, x, y, w = 16, h = 16) => ctx.drawImage(sheet, sx, sy, w, h, Math.round(x), Math.round(y), w, h);
    function drawBoard() {
        for (let y = 0; y < SNK.ROWS; y++) {
            for (let x = 0; x < SNK.COLS; x++) {
                ctx.fillStyle = (x + y) % 2 ? C.b : C.a;
                ctx.fillRect(x * CS, y * CS, CS, CS);
            }
        }
        if (chest) {
            const age = st.t - chest.born;
            const sc = Math.min(1, age / 0.2);                        // wyskakuje z ziemi
            const bob = Math.floor(st.t * 2) % 2 ? -1 : 0;            // lekko podskakuje
            const sz = Math.max(2, Math.round(16 * sc));
            ctx.drawImage(sheet, 0, 0, 16, 16, chest.x * CS + (16 - sz) / 2, chest.y * CS + (16 - sz) + bob, sz, sz);
            if ((st.t % 2.4) < 0.25) spr(80, 0, chest.x * CS + 4, chest.y * CS - 5);   // błysk
        }
    }
    function drawSnake() {
        const n = segs.length;
        if (!n) return;
        const moving = st.mode === 'play';
        const k = moving ? Math.min(1, st.acc / tick()) : 1;
        const pos = segs.map((s, i) => {
            const f = from[Math.min(i, from.length - 1)] || s;
            return { x: Math.round((f.x + (s.x - f.x) * k) * CS + 8), y: Math.round((f.y + (s.y - f.y) * k) * CS + 8) };
        });
        const shake = st.mode === 'dying' && st.deadT < 0.6 ? Math.round(Math.sin(st.deadT * 60)) : 0;
        pos.forEach((p) => { p.x += shake; });
        // grubość: ogonek cienieje, a po ciele przebiega wesoła "fala" (+1 px)
        const rad = (i) => {
            const base = Math.min(6, 3 + (n - 1 - i));
            return base + (Math.sin(st.t * 7 - i * 0.9) > 0.55 ? 1 : 0);
        };
        // dwa przejścia: najpierw obrys (o 1px grubszy), potem ciało
        for (const pass of [0, 1]) {
            ctx.fillStyle = pass ? C.body : C.dark;
            const g = pass ? 0 : 1;
            for (let i = n - 1; i >= 1; i--) {
                const a = pos[i], b = pos[i - 1];
                const r = Math.min(rad(i), rad(i - 1)), ra = rad(i);
                ctx.fillRect(Math.min(a.x, b.x) - r - g, Math.min(a.y, b.y) - r - g, Math.abs(a.x - b.x) + 2 * (r + g), Math.abs(a.y - b.y) + 2 * (r + g));
                // zaokrąglony "koralik" w miejscu segmentu
                ctx.fillRect(a.x - ra - g + 1, a.y - ra - g, 2 * (ra + g) - 2, 2 * (ra + g));
                ctx.fillRect(a.x - ra - g, a.y - ra - g + 1, 2 * (ra + g), 2 * (ra + g) - 2);
            }
        }
        // łatki na grzbiecie (romby) i błysk
        for (let i = 1; i < n - 1; i++) {
            const q = pos[i];
            if (i % 2) {
                ctx.fillStyle = C.light;
                ctx.fillRect(q.x - 1, q.y - 2, 2, 4);
                ctx.fillRect(q.x - 2, q.y - 1, 4, 2);
            } else {
                ctx.fillStyle = C.dark;
                ctx.fillRect(q.x, q.y, 1, 1);
            }
        }
        drawHead(pos[0]);
    }
    function drawHead(p) {
        const fx = SNK_DX[dir], fy = SNK_DY[dir], sx = -fy, sy = fx;
        // główka: zaokrąglony kwadrat 16x16 z obrysem
        const blob = (r, col) => {
            ctx.fillStyle = col;
            ctx.fillRect(p.x - r + 2, p.y - r, 2 * r - 4, 2 * r);   // rogi ścięte o 2 px = okrąglejsza
            ctx.fillRect(p.x - r + 1, p.y - r + 1, 2 * r - 2, 2 * r - 2);
            ctx.fillRect(p.x - r, p.y - r + 2, 2 * r, 2 * r - 4);
        };
        blob(9, C.dark);
        blob(8, C.body);
        ctx.fillStyle = C.light;
        ctx.fillRect(p.x - 5, p.y - 6, 3, 1);                    // błysk na czubku
        ctx.fillRect(p.x - 6, p.y - 5, 1, 2);
        // policzki
        ctx.fillStyle = C.cheek;
        for (const sd of [-1, 1]) ctx.fillRect(p.x - fx + sx * sd * 6 - (sx ? 0 : 1), p.y - fy + sy * sd * 6 - (sy ? 0 : 1) + (sx ? 1 : 0), sx ? 1 : 2, sx ? 2 : 1);
        // oczka patrzą tam, dokąd jedziemy
        const dead = st.mode === 'dying' || st.mode === 'over';
        const blink = !dead && (st.t % 3.4) < 0.12;
        for (const sd of [-1, 1]) {
            const ex = p.x + fx * 2 + sx * sd * 4, ey = p.y + fy * 2 + sy * sd * 4;
            if (dead) {
                ctx.fillStyle = C.pupil;
                for (let d = -1; d <= 1; d++) { ctx.fillRect(ex + d - 1, ey + d - 1, 1, 1); ctx.fillRect(ex + d - 1, ey - d - 1, 1, 1); }
                continue;
            }
            if (blink) { ctx.fillStyle = C.pupil; ctx.fillRect(ex - 2, ey, 4, 1); continue; }
            ctx.fillStyle = C.eye;
            ctx.fillRect(ex - 2, ey - 2, 4, 4);
            ctx.fillStyle = C.pupil;
            ctx.fillRect(ex - 1 + fx, ey - 1 + fy, 2, 2);
            ctx.fillStyle = C.eye;
            ctx.fillRect(ex - 1 + fx, ey - 1 + fy, 1, 1);           // błysk w oku
        }
        // języczek: co chwilę "flik" do przodu, rozwidlony
        if (!dead && st.mode !== 'title' && (st.t % 1.5) < 0.22) {
            ctx.fillStyle = C.tongue;
            const len = (st.t % 1.5) < 0.11 ? 3 : 5;
            for (let i = 0; i < len; i++) ctx.fillRect(p.x + fx * (9 + i), p.y + fy * (9 + i), 1, 1);
            const tx = p.x + fx * (9 + len), ty = p.y + fy * (9 + len);
            ctx.fillRect(tx + sx, ty + sy, 1, 1);
            ctx.fillRect(tx - sx, ty - sy, 1, 1);
        }
    }
    // otwarta skrzynka leży pod wężem, pieczęć i "+1" lecą nad nim
    function drawOpened() {
        opened.forEach((o) => {
            ctx.globalAlpha = o.t > 0.6 ? Math.max(0, 1 - (o.t - 0.6) / 0.3) : 1;
            spr(o.t < 0.08 ? 16 : 32, 0, o.x * CS, o.y * CS);
        });
        ctx.globalAlpha = 1;
    }
    function drawFx() {
        opened.forEach((o) => {
            const x = o.x * CS, y = o.y * CS;
            ctx.globalAlpha = o.t > 0.6 ? Math.max(0, 1 - (o.t - 0.6) / 0.3) : 1;
            // pieczęć wylatuje ze skrzynki + napis +1
            const up = Math.min(1, o.t / 0.4);
            spr(48, 0, x, y - 4 - up * 12);
            ctx.fillStyle = C.text;
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'left';
            ctx.fillText('+1', x + 14, y - up * 12 + 2);
        });
        ctx.globalAlpha = 1;
        parts.forEach((p) => {
            ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
            spr(p.big ? 64 : 80, 0, p.x - 8, p.y - 8);
        });
        ctx.globalAlpha = 1;
    }

    // ----- scena ołtarza (lewa część; po prawej panel z DOM) -----
    function drawAltar() {
        ctx.fillStyle = C.panel;
        ctx.fillRect(0, 0, W, H);
        if (altarImg.complete) ctx.drawImage(altarImg, 0, 0);
        const [dx, dy] = SNK.DISC;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // tarcza "oddycha" światłem
        const pulse = 0.55 + 0.45 * Math.sin(st.t * 2.2);
        ctx.globalAlpha = 0.35 + 0.35 * pulse;
        const g = ctx.createRadialGradient(dx, dy, 4, dx, dy, 52);
        g.addColorStop(0, C.glow);
        g.addColorStop(1, C.glowOut);
        ctx.fillStyle = g;
        ctx.fillRect(dx - 52, dy - 52, 104, 104);
        // migoczące runy na tarczy
        SNK.GLYPHS.forEach(([gx, gy], i) => {
            const f = 0.5 + 0.25 * Math.sin(st.t * 7 + i * 1.7) + 0.25 * Math.sin(st.t * 13.3 + i * 4.1);
            ctx.globalAlpha = 0.25 + 0.6 * f;
            const r = ctx.createRadialGradient(gx, gy, 0, gx, gy, 8);
            r.addColorStop(0, C.glow);
            r.addColorStop(1, C.glowOut);
            ctx.fillStyle = r;
            ctx.fillRect(gx - 8, gy - 8, 16, 16);
        });
        ctx.restore();
        drawFlame();
        ctx.fillStyle = C.ember;
        embers.forEach((e) => {
            ctx.globalAlpha = Math.min(1, e.life);
            ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
        });
        ctx.globalAlpha = 1;
        // nasza postać przed ołtarzem (oddycha i mruga)
        if (girl.complete) {
            const blink = (st.t % 3.1) < 0.13;
            const bob = Math.floor(st.t * 2) % 2 ? -1 : 0;
            ctx.drawImage(girl, 32, blink ? 32 : 0, 16, 16, SNK.GIRL[0], SNK.GIRL[1] + bob, 16, 16);
        }
        drawOffer();
    }
    function drawFlame() {
        // płomyk z pixeli: kolumny o "żywej" wysokości
        const [fx, fy] = SNK.FLAME;
        const big = st.offerT >= 0 && st.offerT < 1.6 ? 4 : 0;
        const hs = [3, 6, 9, 6, 3].map((h, i) => h + big + Math.round(2 * Math.sin(st.t * 11 + i * 2.3) + Math.sin(st.t * 23 + i)));
        hs.forEach((h, i) => {
            const x = fx - 2 + i;
            ctx.fillStyle = C.f3; ctx.fillRect(x, fy - h, 1, h);
            if (h > 2) { ctx.fillStyle = C.f2; ctx.fillRect(x, fy - h + 2, 1, h - 2); }
            if (i > 0 && i < 4 && h > 4) { ctx.fillStyle = C.f1; ctx.fillRect(x, fy - h + 4, 1, h - 4); }
        });
    }
    function drawOffer() {
        if (st.offerT < 0) return;
        const t = st.offerT, [dx, dy] = SNK.DISC;
        // 6 pieczęci leci z panelu do tarczy
        for (let i = 0; i < 6; i++) {
            const k = Math.max(0, Math.min(1, (t - i * 0.08) / 0.7));
            if (k <= 0 || k >= 1) continue;
            const x0 = 206, y0 = 168;
            const x = x0 + (dx - x0) * k, y = y0 + (dy - y0) * k - Math.sin(k * Math.PI) * 30;
            spr(48, 0, x - 8, y - 8);
        }
        // błysk i fala światła, gdy ostatnia pieczęć doleci
        if (t > 1.1 && t < 2.2) {
            const k = (t - 1.1) / 1.1;
            ctx.globalAlpha = Math.max(0, 0.85 * (1 - k));
            ctx.fillStyle = C.flash;
            ctx.fillRect(0, 0, SNK.SCENE_W, H);
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = C.glow;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dx, dy, 10 + k * 90, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    function draw() {
        if (st.mode === 'altar') { drawAltar(); overlayText(); return; }
        drawBoard();
        drawOpened();
        drawSnake();
        drawFx();
        overlayText();
    }
    function overlayText() {
        let text = '';
        if (st.paused) text = 'PAUSED\n\nPress P';
        else if (st.mode === 'title') text = 'SIGIL SNAKE\n\nEat chests, collect\nKitty Sigils!\n\nPress an arrow key';
        else if (st.mode === 'ready') text = 'READY!';
        else if (st.mode === 'wow') text = `${SNK.COST} KITTY SIGILS!\n\nThe Kitty Flame\nis calling...`;
        else if (st.mode === 'over') text = `GAME OVER\n\nChests: ${st.score}\n\nPress Enter`;
        else if (st.mode === 'play' && pausedNow()) text = 'PAUSED';
        if (msg.textContent !== text) msg.textContent = text;
        msg.classList.toggle('hidden', !text);
    }
    function hudDraw(bump = false) {
        tokText.textContent = `Tokens: ${st.tokens}/${SNK.COST}`;
        hScore.textContent = 'Chests ' + st.score;
        hHigh.textContent = 'Best ' + st.high;
        tokWrap.classList.toggle('full', st.tokens >= SNK.COST);
        if (bump) { tokWrap.classList.remove('bump'); void tokWrap.offsetWidth; tokWrap.classList.add('bump'); }
        // panel ołtarza
        lvl.textContent = String(st.flame + 1);                 // poziom ołtarza zaczyna się od 1
        sub.textContent = `Reach Kitty Flame Level ${st.flame + 2} to obtain`;
        reqN.textContent = `${st.tokens}/${SNK.COST}`;
        req.classList.toggle('short', st.tokens < SNK.COST);
        offerBtn.disabled = st.busy;
        offerBtn.classList.toggle('dim', st.tokens < SNK.COST);
    }

    // ----- ołtarz: otwieranie, Rewards, Offer, kotek -----
    function openAltar() {
        if (st.mode === 'altar') return;
        st.resume = st.mode === 'wow' || st.mode === 'play' || st.mode === 'ready' ? 'play' : st.mode;
        st.mode = 'altar';
        st.offerT = -1;
        embers = [];
        showRewards(false);
        altar.classList.remove('hidden');
        hudDraw();
    }
    function closeAltar() {
        if (st.mode !== 'altar' || st.busy) return;
        reveal.classList.add('hidden');
        altar.classList.add('hidden');
        st.offerT = -1;
        if (st.resume === 'play') { st.mode = 'ready'; st.timer = 1.2; st.acc = 0; from = segs.map((s) => ({ ...s })); }
        else st.mode = st.resume;
    }
    function showRewards(on) {
        main.classList.toggle('hidden', on);
        rewView.classList.toggle('hidden', !on);
        rewardsBtn.classList.toggle('on', on);
        if (!on) return;
        galH.textContent = `Your kitties (${gallery.length})`;
        gal.textContent = '';
        if (!gallery.length) gal.appendChild(el('span', 'snk-empty', 'No kitties yet - collect 30 sigils!'));
        gallery.forEach((u) => {
            const b = /** @type {HTMLButtonElement} */ (el('button', 'snk-thumb'));
            const im = /** @type {HTMLImageElement} */ (el('img'));
            im.src = u === 'local' ? 'assets/snake/kitten.png' : u;
            im.alt = 'kitty';
            im.onerror = () => { im.src = 'assets/snake/kitten.png'; };
            b.appendChild(im);
            b.addEventListener('click', () => showCat(im, u, false));
            gal.appendChild(b);
        });
    }
    async function offer() {
        if (st.busy || st.mode !== 'altar') return;
        if (st.tokens < SNK.COST) {
            req.classList.remove('shake'); void req.offsetWidth; req.classList.add('shake');
            return;
        }
        st.busy = true;
        st.tokens -= SNK.COST; saveTokens();
        st.flame++; localStorage.setItem(SNK.LEVEL_KEY, String(st.flame));
        showRewards(false);
        hudDraw();
        st.offerT = 0;
        const kitty = snkFetchKitty();                       // kotek ładuje się w trakcie animacji
        await new Promise((r) => setTimeout(r, 1300));
        if (!hbSnake) return;                                // okno zamknięte w międzyczasie
        cardT.textContent = 'Summoning...';
        cardSrc.textContent = '';
        catCtx.clearRect(0, 0, 96, 96);
        frameEl.classList.add('wait');
        frameEl.classList.remove('show');
        contBtn.disabled = true;
        reveal.classList.remove('hidden');
        let res;
        try { res = await kitty; } catch (e) { res = null; }
        if (!hbSnake) return;
        st.busy = false;
        if (res) {
            gallery = [res.url, ...gallery.filter((u) => u !== res.url || u === 'local')].slice(0, SNK.GALLERY_MAX);
            localStorage.setItem(SNK.GALLERY_KEY, JSON.stringify(gallery));
            showCat(res.img, res.url, true);
        } else {
            cardT.textContent = 'The kitty got shy...';
            frameEl.classList.remove('wait');
            contBtn.disabled = false;
        }
        hudDraw();
    }
    // kotek w ramce: zmniejszony do 96x96 (wycinek ze środka) i powiększony z ostrymi pixelami
    function showCat(img, url, fresh) {
        const draw1 = () => {
            const w = img.naturalWidth || 96, h = img.naturalHeight || 96, m = Math.min(w, h);
            catCtx.imageSmoothingEnabled = w > 96;
            catCtx.clearRect(0, 0, 96, 96);
            catCtx.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, 96, 96);
        };
        if (img.complete) draw1(); else img.onload = draw1;
        cardT.textContent = fresh ? 'A kitty appeared!' : 'Your kitty';
        cardSrc.textContent = url === 'local' ? 'offline kitty (no internet)' : 'from cataas.com';
        frameEl.classList.remove('wait', 'show');
        void frameEl.offsetWidth;
        frameEl.classList.add('show');
        contBtn.disabled = false;
        reveal.classList.remove('hidden');
        contBtn.focus();
    }

    // ----- pętla -----
    let raf = 0, last = 0;
    const pausedNow = () => st.paused || activeWin !== win95 || win95.min || document.hidden || deskBlocked;
    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
        last = now;
        if (!pausedNow()) { animate(dt); update(dt); }
        draw();
    }
    function fit() {
        const s = Math.max(1, Math.min(SNK.MAX_SCALE, Math.floor(Math.min(stage.clientWidth / W, stage.clientHeight / H))));
        box.style.width = W * s + 'px';
        box.style.height = H * s + 'px';
        box.style.setProperty('--s', String(s));
    }
    const ro = new ResizeObserver(() => fit());

    // ----- sterowanie -----
    function turn(d) {
        const lastDir = queue.length ? queue[queue.length - 1] : dir;
        if (d === lastDir || d === (lastDir + 2) % 4 || queue.length >= 2) return;   // bez zawracania w miejscu
        queue.push(d);
    }

    // ----- klawiatura (tylko gdy nasze okno jest aktywne) -----
    // Nasłuch w fazie "capture": gdy nasze okno jest aktywne, klawisze gry nie trafiają już do
    // zaznaczonej ikony na pulpicie (tam strzałki przesuwają zaznaczenie, a Enter otwiera program)
    const onKey = (/** @type {KeyboardEvent} */ e) => {
        if (activeWin !== win95 || win95.min || deskBlocked || booting || !offScreen.classList.contains('hidden')) return;
        const used = () => { e.preventDefault(); e.stopPropagation(); if (!win95.el.contains(document.activeElement)) stage.focus(); };
        const t = /** @type {HTMLElement} */ (e.target);
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        if (st.mode === 'altar') {
            if (e.key === 'Escape') { used(); closeAltar(); }
            return;
        }
        if (e.key in SNK_KEYS) {
            used();
            const d = SNK_KEYS[e.key];
            if (st.mode === 'title' || st.mode === 'over') {
                newGame();
                st.mode = 'play';
                turn(d);
            } else if (st.mode === 'play' || st.mode === 'ready') turn(d);
        } else if (e.key === 'p' || e.key === 'P') { used(); if (st.mode === 'play' || st.mode === 'ready') st.paused = !st.paused; }
        else if (e.key === 'F2') { used(); newGame(); st.mode = 'ready'; st.timer = 1; }
        else if ((e.key === 'Enter' || e.key === ' ') && (st.mode === 'over' || st.mode === 'title')) {
            used(); newGame(); st.mode = 'ready'; st.timer = 1;
        }
    };
    document.addEventListener('keydown', onKey, true);
    altarBtn.addEventListener('click', () => { if (st.mode !== 'dying' && st.mode !== 'wow') openAltar(); });
    closeX.addEventListener('click', closeAltar);
    rewardsBtn.addEventListener('click', () => showRewards(rewView.classList.contains('hidden')));
    offerBtn.addEventListener('click', () => { offer(); });
    contBtn.addEventListener('click', () => { reveal.classList.add('hidden'); closeAltar(); });

    const win95 = openWindow({
        id: 'snake', title: 'Sigil Snake', icon: 'assets/icons/snake.png', body,
        w: SNK.WIN_W, h: SNK.WIN_H,
        onClose: () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.removeEventListener('keydown', onKey, true);
            hbSnake = null;
        },
    });
    ro.observe(stage);
    body.addEventListener('pointerdown', (e) => { if (!(/** @type {HTMLElement} */ (e.target)).closest('button')) stage.focus(); });
    stage.focus();
    newGame();
    fit();
    raf = requestAnimationFrame(frame);

    // do testów z konsoli
    hbSnake = {
        st, step, update, animate, draw, newGame, openAltar, closeAltar, offer, showRewards,
        get segs() { return segs; },
        get chest() { return chest; },
        set chest(c) { chest = c; },
        turn,
        setTokens: (n) => { st.tokens = n; saveTokens(); hudDraw(); },
        start: () => { newGame(); st.mode = 'play'; },
    };
}
