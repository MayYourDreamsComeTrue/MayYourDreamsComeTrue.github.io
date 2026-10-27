// =====================================================================
//  SLIME INVADERS - Space Invaders w okienku na pulpicie (index.html)
//  Citlali na swojej pluszowej poduszce strzela lodowymi gwiazdkami w maszerującą
//  formację szlamów (każdy rząd inny żywioł). Czasem przelatuje złoty szlam-UFO.
//  Korzysta z systemu okien z desktop.js (openWindow, reuseWin, el...),
//  więc musi być wczytany PO desktop.js.
//
//  Sterowanie: strzałki / A-D = ruch, Spacja (albo strzałka w górę / W) = strzał,
//  P = pauza, F2 = nowa gra, Enter / Spacja po końcu gry = od nowa.
//  Sprite'y: assets/invaders/sprites.png,
//  kolory tła, tarcz i napisów: desktop.css (sekcja 13).
// =====================================================================

const INV = {
    W: 224,               // plansza w logicznych pixelach (x2 w zwykłym oknie)
    H: 248,
    WIN_W: 476,           // okno mieści planszę x2 + pasek wyniku (jak Primo-Man)
    WIN_H: 584,
    MAX_SCALE: 3,
    COLS: 9,              // formacja szlamów
    ROWS: 5,
    GAP_X: 18,            // odstępy w formacji
    GAP_Y: 16,
    TOP: 36,              // górny rząd na 1. fali (kolejne fale startują niżej)
    WAVE_DROP: 8,         // ... o tyle pixeli na falę (max 4 razy)
    STEP: 2,              // krok marszu w bok
    DROP: 6,              // zejście w dół przy krawędzi
    MARCH_SLOW: 0.55,     // sekundy między krokami (pełna formacja) ...
    MARCH_FAST: 0.025,    // ... i gdy został ostatni szlam
    WAVE_FASTER: 0.9,     // każda fala maszeruje o 10% szybciej
    PLAYER_Y: 210,        // górny brzeg sprite'a Citlali
    PLAYER_SPEED: 84,     // pixele na sekundę
    SHOT_SPEED: 210,      // lodowa gwiazdka
    SPIT_SPEED: 66,       // plwocina szlamu (+5 na falę)
    SPIT_MAX: 3,          // ile plwocin naraz
    SPIT_EVERY: 0.9,      // średnio co tyle sekund nowa plwocina
    UFO_EVERY: [16, 26],  // szlam-UFO pojawia się co 16-26 s
    UFO_SPEED: 36,
    UFO_Y: 12,
    UFO_PTS: [50, 100, 150, 300],
    ROW_PTS: [40, 30, 20, 20, 10],
    ROW_KIND: [0, 1, 2, 3, 4],   // kolumna w arkuszu: electro, cryo, anemo, hydro, pyro
    SHIELD_Y: 180,
    SHIELD_W: 24,
    SHIELD_H: 16,
    GROUND: 244,          // linia ziemi
    LIVES: 3,
    BONUS_LIFE: 1500,     // dodatkowe życie (raz)
    HIT_TIME: 1.8,        // zawrót głowy po trafieniu
    SAFE_TIME: 1.5,       // mruganie (nietykalność) po powrocie
    HIGH_KEY: 'hb-invaders-high',
};
const INV_NAMES = ['Electro', 'Cryo', 'Anemo', 'Hydro', 'Pyro'];
// kształt tarczy (lodowa ścianka z łukiem), 24x16: # = lód
const INV_SHIELD = [
    '....################....',
    '...##################...',
    '..####################..',
    '.######################.',
    '########################',
    '########################',
    '########################',
    '########################',
    '########################',
    '########################',
    '########################',
    '#######..........#######',
    '######............######',
    '#####..............#####',
    '#####..............#####',
    '#####..............#####',
];

/** @type {any} */
var hbInvaders = null;

function openInvaders() {
    if (reuseWin('invaders')) return;
    const W = INV.W, H = INV.H;

    // ----- DOM: pasek wyniku + plansza + napisy -----
    const body = el('div', 'inv');
    const hud = el('div', 'inv-hud');
    const hScore = el('span', 'inv-score');
    const hHigh = el('span', 'inv-high');
    const hWave = el('span', 'inv-wave');
    const livesCv = /** @type {HTMLCanvasElement} */ (el('canvas', 'inv-lives'));
    livesCv.width = 16 * 4; livesCv.height = 14;
    hud.append(hScore, hHigh, hWave, livesCv);
    const stage = el('div', 'inv-stage');
    stage.tabIndex = 0;
    const cv = /** @type {HTMLCanvasElement} */ (el('canvas', 'inv-canvas'));
    cv.width = W; cv.height = H;
    const msg = el('div', 'inv-msg hidden');
    const box = el('div', 'inv-box');
    box.append(cv, msg);
    stage.appendChild(box);
    body.append(hud, stage);
    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    const lctx = /** @type {CanvasRenderingContext2D} */ (livesCv.getContext('2d'));
    const sheet = new Image();
    sheet.src = 'assets/invaders/sprites.png';

    // kolory z desktop.css (sekcja 13)
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue('--inv-' + n).trim();
    const C = {
        skyTop: v('sky-top'), skyBot: v('sky-bottom'), star: v('star'), ground: v('ground'), groundTop: v('ground-top'),
        ice: v('ice'), iceLight: v('ice-light'), iceDark: v('ice-dark'), text: v('text'), dim: v('text-dim'), pts: v('points'),
    };

    // ----- stan gry -----
    const st = {
        mode: 'title',     // title | ready | play | hit | clear | over
        timer: 0,
        score: 0,
        high: Number(localStorage.getItem(INV.HIGH_KEY)) || 0,
        lives: INV.LIVES,
        bonus: false,      // dodatkowe życie już przyznane
        wave: 1,
        paused: false,
        t: 0,
        march: 0,          // licznik do następnego kroku marszu
        frame: 0,          // klatka marszu (0/1 - szlamy się "przykucają")
        dir: 1,            // kierunek marszu
        fx: 0, fy: 0,      // przesunięcie formacji
        spitT: 0,
        ufoT: 20,
        safe: 0,           // nietykalność po powrocie (mruganie)
        shootAnim: 0,
        invaded: false,
    };
    const player = { x: W / 2 };
    /** @type {{r:number, c:number, alive:boolean, kind:number}[]} */
    let slimes = [];
    /** @type {{x:number, y:number}|null} */
    let shot = null;
    /** @type {{x:number, y:number, kind:number}[]} */
    let spits = [];
    /** @type {{x:number, y:number, dir:number, pts:number}|null} */
    let ufo = null;
    /** @type {{x:number, y:number, kind:number, t:number}[]} */
    let splats = [];
    /** @type {{x:number, y:number, vx:number, vy:number, life:number, big:boolean}[]} */
    let parts = [];
    /** @type {{x:number, y:number, text:string, life:number}[]} */
    let pops = [];
    /** @type {{x:number, y:number, mask:Uint8Array, cv:HTMLCanvasElement}[]} */
    let shields = [];
    const keys = new Set();

    // gwiazdy na niebie (stałe, migoczą)
    const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97 + 13) % W, y: (i * 53 + 7) % 170, p: i * 0.7 }));

    // ----- tarcze z lodu (maska pikseli + własne płótno) -----
    function makeShields() {
        shields = [];
        for (let i = 0; i < 4; i++) {
            const mask = new Uint8Array(INV.SHIELD_W * INV.SHIELD_H);
            INV_SHIELD.forEach((r, y) => { for (let x = 0; x < INV.SHIELD_W; x++) mask[y * INV.SHIELD_W + x] = r[x] === '#' ? 1 : 0; });
            const c = document.createElement('canvas');
            c.width = INV.SHIELD_W; c.height = INV.SHIELD_H;
            const s = { x: 24 + i * 48, y: INV.SHIELD_Y, mask, cv: c };
            shields.push(s);
            paintShield(s);
        }
    }
    function paintShield(s) {
        const g = /** @type {CanvasRenderingContext2D} */ (s.cv.getContext('2d'));
        const SW = INV.SHIELD_W, SH = INV.SHIELD_H;
        g.clearRect(0, 0, SW, SH);
        const on = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && s.mask[y * SW + x];
        for (let y = 0; y < SH; y++) {
            for (let x = 0; x < SW; x++) {
                if (!on(x, y)) continue;
                // brzeg ciemniejszy, góra jaśniejsza, w środku "cegiełki" lodu
                let col = C.ice;
                if (!on(x, y - 1)) col = C.iceLight;
                else if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y + 1)) col = C.iceDark;
                else if (y % 5 === 4 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0) col = C.iceDark;
                g.fillStyle = col;
                g.fillRect(x, y, 1, 1);
            }
        }
    }
    // dziura w tarczy: postrzępione kółko
    function chip(s, cx, cy, r) {
        const SW = INV.SHIELD_W;
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                const px = cx + x, py = cy + y;
                if (px < 0 || py < 0 || px >= SW || py >= INV.SHIELD_H) continue;
                const d = x * x + y * y;
                if (d <= r * r * 0.5 || (d <= r * r && Math.random() < 0.55)) s.mask[py * SW + px] = 0;
            }
        }
        paintShield(s);
    }
    // czy punkt (x, y) trafia w lód; jeśli tak - robi dziurę
    function hitShield(x, y, r) {
        for (const s of shields) {
            const lx = Math.floor(x - s.x), ly = Math.floor(y - s.y);
            if (lx < 0 || ly < 0 || lx >= INV.SHIELD_W || ly >= INV.SHIELD_H) continue;
            if (!s.mask[ly * INV.SHIELD_W + lx]) continue;
            chip(s, lx, ly, r);
            burst(x, y, 2, false);
            return true;
        }
        return false;
    }

    // ----- formacja -----
    const slimeX = (s) => st.fx + s.c * INV.GAP_X;
    const slimeY = (s) => st.fy + s.r * INV.GAP_Y;
    function newWave() {
        slimes = [];
        for (let r = 0; r < INV.ROWS; r++) for (let c = 0; c < INV.COLS; c++) slimes.push({ r, c, alive: true, kind: INV.ROW_KIND[r] });
        st.fx = Math.round((W - ((INV.COLS - 1) * INV.GAP_X + 16)) / 2);
        st.fy = INV.TOP + Math.min(4, st.wave - 1) * INV.WAVE_DROP;
        st.dir = 1; st.march = 0; st.frame = 0;
        shot = null; spits = []; ufo = null; splats = []; pops = [];
        st.ufoT = rnd(INV.UFO_EVERY[0], INV.UFO_EVERY[1]);
        makeShields();
        player.x = W / 2;
        st.mode = 'ready'; st.timer = 1.6;
        hudDraw();
    }
    function newGame() {
        st.score = 0; st.lives = INV.LIVES; st.wave = 1; st.bonus = false; st.paused = false; st.invaded = false;
        newWave();
    }
    const rnd = (a, b) => a + Math.random() * (b - a);
    const alive = () => slimes.filter((s) => s.alive);
    function marchInterval() {
        const n = alive().length, all = INV.ROWS * INV.COLS;
        const k = (n - 1) / (all - 1);
        return (INV.MARCH_FAST + (INV.MARCH_SLOW - INV.MARCH_FAST) * k * k) * INV.WAVE_FASTER ** Math.min(8, st.wave - 1);
    }
    function marchStep() {
        const live = alive();
        if (!live.length) return;
        st.frame ^= 1;
        const minX = Math.min(...live.map(slimeX)), maxX = Math.max(...live.map(slimeX)) + 16;
        if ((st.dir > 0 && maxX + INV.STEP > W - 2) || (st.dir < 0 && minX - INV.STEP < 2)) {
            st.fy += INV.DROP; st.dir = -st.dir;
        } else st.fx += st.dir * INV.STEP;
        // szlam wchodzący w tarczę zjada lód
        for (const s of live) {
            const x = slimeX(s), y = slimeY(s);
            for (const sh of shields) {
                if (x + 15 < sh.x || x + 1 > sh.x + INV.SHIELD_W || y + 15 < sh.y || y + 3 > sh.y + INV.SHIELD_H) continue;
                let changed = false;
                for (let yy = y + 3; yy < y + 16; yy++) {
                    for (let xx = x + 1; xx < x + 15; xx++) {
                        const lx = xx - sh.x, ly = yy - sh.y;
                        if (lx >= 0 && ly >= 0 && lx < INV.SHIELD_W && ly < INV.SHIELD_H && sh.mask[ly * INV.SHIELD_W + lx]) {
                            sh.mask[ly * INV.SHIELD_W + lx] = 0; changed = true;
                        }
                    }
                }
                if (changed) paintShield(sh);
            }
        }
        // inwazja: szlamy doszły do Citlali
        if (Math.max(...live.map(slimeY)) + 16 >= INV.PLAYER_Y + 6) { st.invaded = true; playerHit(); }
    }

    // ----- strzały -----
    function fire() {
        if (shot || st.mode !== 'play') return;
        shot = { x: player.x, y: INV.PLAYER_Y - 4 };
        st.shootAnim = 0.18;
    }
    function spit() {
        const live = alive();
        if (!live.length || spits.length >= INV.SPIT_MAX) return;
        // najniższy szlam w kolumnie; co drugi raz celuje w kolumnę nad Citlali
        const cols = [...new Set(live.map((s) => s.c))];
        let col = cols[Math.floor(Math.random() * cols.length)];
        if (Math.random() < 0.5) {
            let best = Infinity;
            cols.forEach((c) => { const d = Math.abs(st.fx + c * INV.GAP_X + 8 - player.x); if (d < best) { best = d; col = c; } });
        }
        const s = live.filter((q) => q.c === col).sort((a, b) => b.r - a.r)[0];
        spits.push({ x: slimeX(s) + 8, y: slimeY(s) + 14, kind: s.kind });
    }
    function addScore(n) {
        st.score += n;
        if (!st.bonus && st.score >= INV.BONUS_LIFE) { st.bonus = true; st.lives++; pops.push({ x: player.x, y: INV.PLAYER_Y - 6, text: '1UP', life: 1.2 }); }
        if (st.score > st.high) { st.high = st.score; localStorage.setItem(INV.HIGH_KEY, String(st.high)); }
        hudDraw();
    }
    function burst(x, y, n, big) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = (big ? 40 : 20) + Math.random() * 30;
            parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.3, big });
        }
    }
    function playerHit() {
        if (st.mode !== 'play') return;
        st.mode = 'hit'; st.timer = INV.HIT_TIME;
        shot = null;
    }

    // ----- jedna klatka logiki -----
    function update(dt) {
        st.t += dt;
        parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.life -= dt; });
        parts = parts.filter((p) => p.life > 0);
        pops.forEach((p) => { p.life -= dt; p.y -= dt * 8; });
        pops = pops.filter((p) => p.life > 0);
        splats.forEach((s) => { s.t += dt; });
        splats = splats.filter((s) => s.t < 0.6);
        if (st.shootAnim > 0) st.shootAnim -= dt;
        if (st.safe > 0) st.safe -= dt;

        if (st.mode === 'ready') { if ((st.timer -= dt) <= 0) st.mode = 'play'; return; }
        if (st.mode === 'clear') { if ((st.timer -= dt) <= 0) { st.wave++; newWave(); } return; }
        if (st.mode === 'hit') {
            if ((st.timer -= dt) <= 0) {
                st.lives--;
                if (st.lives <= 0 || st.invaded) { st.lives = Math.max(0, st.lives); st.mode = 'over'; hudDraw(); return; }
                spits = []; st.safe = INV.SAFE_TIME; st.mode = 'play'; hudDraw();
            }
            return;
        }
        if (st.mode !== 'play') return;

        // Citlali
        const dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        player.x = Math.max(16, Math.min(W - 16, player.x + dx * INV.PLAYER_SPEED * dt));
        if (keys.has('fire')) fire();

        // marsz
        st.march += dt;
        const iv = marchInterval();
        while (st.march >= iv && st.mode === 'play') { st.march -= iv; marchStep(); }
        if (st.mode !== 'play') return;

        // lodowa gwiazdka
        if (shot) {
            shot.y -= INV.SHOT_SPEED * dt;
            if (shot.y < 2) { burst(shot.x, 4, 2, false); shot = null; }
            else if (hitShield(shot.x, shot.y, 2)) shot = null;
            else hitSlimes();
        }
        // szlam-UFO
        if (ufo) {
            ufo.x += ufo.dir * INV.UFO_SPEED * dt;
            if (ufo.x < -40 || ufo.x > W + 40) ufo = null;
            if (ufo && Math.random() < dt * 8) parts.push({ x: ufo.x - ufo.dir * 14, y: INV.UFO_Y + 12 + Math.random() * 6, vx: -ufo.dir * 10, vy: 6, life: 0.4, big: false });
        } else if ((st.ufoT -= dt) <= 0 && alive().length > 6) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            ufo = { x: dir > 0 ? -20 : W + 20, y: INV.UFO_Y, dir, pts: INV.UFO_PTS[Math.floor(Math.random() * INV.UFO_PTS.length)] };
            st.ufoT = rnd(INV.UFO_EVERY[0], INV.UFO_EVERY[1]);
        }
        // plwociny
        if ((st.spitT -= dt) <= 0) { spit(); st.spitT = INV.SPIT_EVERY * rnd(0.4, 1.4) / Math.min(2, 1 + (st.wave - 1) * 0.15); }
        const sp = INV.SPIT_SPEED + (st.wave - 1) * 5;
        for (const s of spits) {
            s.y += sp * dt;
            if (shot && Math.abs(shot.x - s.x) < 4 && Math.abs(shot.y - s.y) < 6) { burst(s.x, s.y, 4, false); s.y = 999; shot = null; continue; }
            if (hitShield(s.x, s.y + 3, 2)) { s.y = 999; continue; }
            if (s.y + 3 >= INV.GROUND) { burst(s.x, INV.GROUND - 1, 3, false); s.y = 999; continue; }
            if (st.safe <= 0 && Math.abs(s.x - player.x) < 11 && s.y + 4 > INV.PLAYER_Y + 4 && s.y < INV.PLAYER_Y + 28) { s.y = 999; playerHit(); }
        }
        spits = spits.filter((s) => s.y < 900);

        if (!alive().length && st.mode === 'play') { st.mode = 'clear'; st.timer = 1.8; shot = null; spits = []; }
    }
    function hitSlimes() {
        if (!shot) return;
        if (ufo && Math.abs(shot.x - ufo.x) < 14 && shot.y < ufo.y + 22 && shot.y > ufo.y + 4) {
            addScore(ufo.pts);
            pops.push({ x: ufo.x, y: ufo.y + 14, text: String(ufo.pts), life: 1.2 });
            burst(ufo.x, ufo.y + 14, 12, true);
            ufo = null; shot = null;
            return;
        }
        for (const s of slimes) {
            if (!s.alive) continue;
            const x = slimeX(s), y = slimeY(s);
            if (shot.x >= x + 1 && shot.x <= x + 15 && shot.y >= y + 3 && shot.y <= y + 16) {
                s.alive = false;
                addScore(INV.ROW_PTS[s.r]);
                splats.push({ x, y, kind: s.kind, t: 0 });
                burst(x + 8, y + 10, 5, false);
                shot = null;
                return;
            }
        }
    }

    // ----- rysowanie -----
    const spr = (sx, sy, x, y, w = 16, h = 16) => ctx.drawImage(sheet, sx, sy, w, h, Math.round(x), Math.round(y), w, h);
    let skyGrad = null;
    function draw() {
        if (!skyGrad) { skyGrad = ctx.createLinearGradient(0, 0, 0, H); skyGrad.addColorStop(0, C.skyTop); skyGrad.addColorStop(1, C.skyBot); }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.star;
        stars.forEach((s) => { if (Math.sin(st.t * 2 + s.p) > -0.4) ctx.fillRect(s.x, s.y, 1, 1); });
        ctx.fillStyle = C.ground; ctx.fillRect(0, INV.GROUND, W, H - INV.GROUND);
        ctx.fillStyle = C.groundTop; ctx.fillRect(0, INV.GROUND, W, 1);
        if (st.mode === 'title') { drawTitle(); overlay(); return; }
        shields.forEach((s) => ctx.drawImage(s.cv, s.x, s.y));
        drawSlimes();
        if (ufo) {
            const bob = Math.round(Math.sin(st.t * 4) * 2);
            spr(Math.floor(st.t * 4) % 2 ? 32 : 0, 64, ufo.x - 16, ufo.y + bob, 32, 24);
        }
        splats.forEach((s) => {
            if (s.t < 0.12) spr(s.kind * 32 + 16, 16, s.x, s.y);
            else { ctx.globalAlpha = Math.max(0, 1 - (s.t - 0.3) / 0.3); spr(s.kind * 32, 16, s.x, s.y); ctx.globalAlpha = 1; }
        });
        if (shot) spr(96 + (Math.floor(st.t * 12) % 2) * 8, 32, shot.x - 4, shot.y - 4, 8, 8);
        spits.forEach((s, i) => spr(s.kind * 16 + (Math.floor(st.t * 8 + i) % 2) * 8, 56, s.x - 4, s.y - 4, 8, 8));
        drawPlayer();
        parts.forEach((p) => { ctx.globalAlpha = Math.min(1, p.life * 3); spr(p.big ? 64 : 72, 64, p.x - (p.big ? 3 : 2), p.y - (p.big ? 3 : 2), p.big ? 7 : 5, p.big ? 7 : 5); });
        ctx.globalAlpha = 1;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.pts;
        pops.forEach((p) => ctx.fillText(p.text, Math.round(p.x), Math.round(p.y)));
        overlay();
    }
    function drawSlimes() {
        slimes.forEach((s, i) => {
            if (!s.alive) return;
            const x = slimeX(s), y = slimeY(s);
            // marsz: wszystkie przykucają się na zmianę; do tego każdy co jakiś czas mruga oczkami (podskok)
            const hop = (Math.floor(st.t * 3 + i * 0.37) % 7 === 0) ? -1 : 0;
            spr(s.kind * 32 + st.frame * 16, 0, x, y + hop);
        });
    }
    function drawPlayer() {
        // Citlali siedzi na pluszowej poduszce (sprite 32x32 w y96), poduszka unosi się i kołysze
        const x = Math.round(player.x), y = INV.PLAYER_Y - 2;
        const bob = Math.round(Math.sin(st.t * 3) * 1.4);
        if (st.mode === 'over' && !st.invaded) return;
        if (st.mode === 'hit') {
            // trafiona: poduszka robi > <, Citlali kiwa się z zawrotem głowy, gwiazdki krążą nad głową
            const k = INV.HIT_TIME - st.timer;
            const wob = Math.round(Math.sin(k * 14) * 2);
            spr(96, 96, x - 16 + wob, y + bob, 32, 32);
            for (let s = 0; s < 3; s++) {
                const a = k * 7 + s * 2.1;
                spr(112, 32, x - 2 + Math.cos(a) * 9, y - 3 + Math.sin(a) * 3, 5, 5);
            }
            return;
        }
        if (st.safe > 0 && Math.floor(st.t * 12) % 2) return;
        const blink = (st.t % 3.3) < 0.14;
        const sx = st.shootAnim > 0 ? 64 : blink ? 32 : 0;
        spr(sx, 96, x - 16, y + bob, 32, 32);
    }
    function drawTitle() {
        ctx.textAlign = 'center';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.pts;
        const hop = Math.floor(st.t * 2) % 2;
        ctx.fillText('SLIME INVADERS', W / 2, 30);
        ctx.fillStyle = C.dim;
        ctx.fillText('SCORE TABLE', W / 2, 52);
        ctx.textAlign = 'left';
        INV_NAMES.forEach((n, i) => {
            const y = 60 + i * 20;
            spr(i * 32 + ((hop + i) % 2) * 16, 0, 52, y);
            ctx.fillStyle = C.text;
            ctx.fillText(`= ${INV.ROW_PTS[i]} PTS`, 76, y + 13);
        });
        spr(Math.floor(st.t * 4) % 2 ? 32 : 0, 64, 44, 156 + Math.round(Math.sin(st.t * 4) * 2), 32, 24);
        ctx.fillText('= ? MYSTERY', 82, 173);
        // Citlali na poduszce pod tabelką
        const blink = (st.t % 3.3) < 0.14;
        spr(blink ? 32 : 0, 96, W / 2 - 16, 206 + Math.round(Math.sin(st.t * 3) * 1.4), 32, 32);
    }
    function overlay() {
        let text = '';
        if (st.paused) text = 'PAUSED\n\nPress P';
        else if (st.mode === 'title') text = Math.floor(st.t * 2) % 2 ? '' : 'PRESS SPACE';
        else if (st.mode === 'ready') text = `WAVE ${st.wave}\n\nREADY!`;
        else if (st.mode === 'clear') text = 'WAVE CLEAR!';
        else if (st.mode === 'over') text = `${st.invaded ? 'THE SLIMES\nLANDED!' : 'GAME OVER'}\n\nScore ${st.score}\nWave ${st.wave}\n\nPress Enter`;
        else if ((st.mode === 'play' || st.mode === 'hit') && pausedNow()) text = 'PAUSED';
        if (msg.textContent !== text) msg.textContent = text;
        msg.classList.toggle('hidden', !text);
        msg.classList.toggle('inv-msg-title', st.mode === 'title' && !st.paused);
    }
    function hudDraw() {
        hScore.textContent = 'SCORE ' + st.score;
        hHigh.textContent = 'HIGH ' + st.high;
        hWave.textContent = 'WAVE ' + st.wave;
        lctx.clearRect(0, 0, livesCv.width, livesCv.height);
        const n = Math.min(4, Math.max(st.lives, INV.LIVES));
        for (let i = 0; i < n; i++) {
            lctx.globalAlpha = i < st.lives ? 1 : 0.25;
            if (sheet.complete) lctx.drawImage(sheet, 0, 32, 16, 14, i * 16, 0, 16, 14);   // główka Citlali
        }
        lctx.globalAlpha = 1;
    }
    sheet.addEventListener('load', hudDraw);

    // ----- pętla gry (stoi, gdy okno nieaktywne / zminimalizowane / karta ukryta) -----
    let raf = 0, last = 0;
    const pausedNow = () => st.paused || activeWin !== win95 || win95.min || document.hidden || deskBlocked;
    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
        last = now;
        if (pausedNow()) keys.clear();          // puszczone klawisze nie "zawisają" po powrocie
        else update(dt);
        draw();
    }
    function fit() {
        const s = Math.max(1, Math.min(INV.MAX_SCALE, Math.floor(Math.min(stage.clientWidth / W, stage.clientHeight / H))));
        cv.style.width = W * s + 'px';
        cv.style.height = H * s + 'px';
        box.style.setProperty('--s', String(s));
    }
    const ro = new ResizeObserver(() => fit());

    // ----- klawiatura (faza "capture" - jak w Primo-Man, żeby ikony pulpitu nie łapały strzałek) -----
    const KEY = /** @type {Record<string, string>} */ ({
        ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
        ' ': 'fire', ArrowUp: 'fire', w: 'fire', W: 'fire',
    });
    const onKey = (/** @type {KeyboardEvent} */ e) => {
        if (activeWin !== win95 || win95.min || deskBlocked || booting || !offScreen.classList.contains('hidden')) return;
        const t = /** @type {HTMLElement} */ (e.target);
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        const used = () => { e.preventDefault(); e.stopPropagation(); if (!win95.el.contains(document.activeElement)) stage.focus(); };
        if (st.mode === 'title' && (e.key === ' ' || e.key === 'Enter')) { used(); newGame(); return; }
        if (st.mode === 'over' && (e.key === 'Enter' || e.key === ' ')) { used(); newGame(); return; }
        if (e.key in KEY) { used(); keys.add(KEY[e.key]); if (KEY[e.key] === 'fire' && !e.repeat) fire(); }
        else if (e.key === 'p' || e.key === 'P') { used(); if (st.mode !== 'title' && st.mode !== 'over') st.paused = !st.paused; }
        else if (e.key === 'F2') { used(); newGame(); }
    };
    const onKeyUp = (/** @type {KeyboardEvent} */ e) => { if (e.key in KEY) keys.delete(KEY[e.key]); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    cv.addEventListener('pointerdown', () => { if (st.mode === 'over' || st.mode === 'title') newGame(); });

    const win95 = openWindow({
        id: 'invaders', title: 'Slime Invaders', icon: 'assets/icons/invaders.png', body,
        w: INV.WIN_W, h: INV.WIN_H,
        onClose: () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('keyup', onKeyUp, true);
            hbInvaders = null;
        },
    });
    ro.observe(stage);
    body.addEventListener('pointerdown', () => stage.focus());
    stage.focus();
    makeShields();
    newWaveIdle();
    fit();
    hudDraw();
    raf = requestAnimationFrame(frame);
    // ekran tytułowy: formacja i tarcze są gotowe, gra czeka na Spację
    function newWaveIdle() { st.mode = 'title'; }

    // do testów z konsoli
    hbInvaders = {
        st, player, keys, update, draw, newGame, newWave, fire, spit, marchStep, marchInterval,
        get slimes() { return slimes; }, get shot() { return shot; }, set shot(v) { shot = v; },
        get spits() { return spits; }, set spits(v) { spits = v; }, get ufo() { return ufo; }, set ufo(v) { ufo = v; },
        get shields() { return shields; }, get splats() { return splats; },
        slimeX, slimeY,
        killAllBut: (n) => { alive().slice(n).forEach((s) => { s.alive = false; }); },
    };
}
