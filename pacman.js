// =====================================================================
//  PRIMO-MAN - Pac-Man w okienku na pulpicie (index.html)
//  Nasza postać (liliowa dziewczynka) zbiera primogemy w labiryncie,
//  a goni ją czwórka szlamów: Pyro, Hydro, Electro i Dendro.
//  Korzysta z systemu okien z desktop.js (openWindow, reuseWin, el...),
//  więc musi być wczytany PO desktop.js.
//
//  Sterowanie: strzałki / WASD, P = pauza, F2 / Enter (po końcu gry) = nowa gra.
//  Sprite'y (16x16) są w assets/pacman/sprites.png,
//  kolory labiryntu w desktop.css (sekcja 11).
// =====================================================================

const PAC = {
    TILE: 8,              // kafelek labiryntu w logicznych pixelach
    COLS: 28,
    ROWS: 31,
    WIN_W: 476,           // okno mieści planszę x2 (448x496) + pasek wyniku
    WIN_H: 584,
    MAX_SCALE: 3,         // największe powiększenie (zmaksymalizowane okno)
    LIVES: 3,
    LEVELS: 5,            // po przejściu tylu poziomów - ekran wygranej
    PAC_SPEED: 62,        // pixele na sekundę (poziom 1) ...
    GHOST_SPEED: 57,
    SPEED_UP: 0.08,       // ... i +8% za każdy kolejny poziom
    SCARED_SPEED: 0.6,    // przestraszony szlam (mnożnik prędkości)
    TUNNEL_SPEED: 0.5,    // szlam w tunelu
    EYES_SPEED: 130,      // oczka wracające do domku
    SCARED_TIME: 7,       // sekundy strachu na poziomie 1 (potem mniej)
    SCARED_MIN: 2.5,
    FLASH_TIME: 2,        // ostatnie sekundy strachu - szlamy mrugają
    READY_TIME: 2,
    DOT: 10,              // punkty: primogem
    POWER: 50,            // duży primogem
    GHOST_PTS: 200,       // pierwszy zjedzony szlam (potem x2, x4, x8)
    RELEASE: [0, 4, 1, 8],// po ilu sekundach szlam wychodzi z domku (Blinky jest od razu na zewnątrz)
    // tryby: rozproszenie / pościg (sekundy), ostatni pościg trwa do końca
    MODES: [7, 20, 7, 20, 5, 20, 5],
    HIGH_KEY: 'hb-pacman-high',
};

// labirynt: # ściana, . primogem, o duży primogem, - drzwi domku, _ pustka poza planszą, spacja = pusta ścieżka
const PAC_MAZE = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '_____#.##### ## #####.#_____',
    '_____#.##          ##.#_____',
    '_____#.## ###--### ##.#_____',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '_____#.## ######## ##.#_____',
    '_____#.##          ##.#_____',
    '_____#.## ######## ##.#_____',
    '######.## ######## ##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################',
];

// kierunki: 0 dół, 1 prawo, 2 góra, 3 lewo (tak jak kolumny w arkuszu sprite'ów)
const PAC_DX = [0, 1, 0, -1];
const PAC_DY = [1, 0, -1, 0];
const PAC_KEYS = /** @type {Record<string, number>} */ ({
    ArrowDown: 0, s: 0, S: 0, ArrowRight: 1, d: 1, D: 1, ArrowUp: 2, w: 2, W: 2, ArrowLeft: 3, a: 3, A: 3,
});
// szlamy: kolumna w arkuszu, narożnik rozproszenia (kafelki), start (pixele środka)
const PAC_GHOSTS = [
    { name: 'Pyro',    sx: 0,  corner: [25, -3], x: 112, y: 92,  home: false },
    { name: 'Hydro',   sx: 32, corner: [27, 31], x: 96,  y: 116, home: true },
    { name: 'Electro', sx: 64, corner: [2, -3],  x: 112, y: 116, home: true },
    { name: 'Dendro',  sx: 96, corner: [0, 31],  x: 128, y: 116, home: true },
];

/** @type {any} */
var hbPacman = null;

function openPacman() {
    if (reuseWin('pacman')) return;
    const T = PAC.TILE, W = PAC.COLS * T, H = PAC.ROWS * T;

    // ----- DOM: pasek wyniku + plansza + napisy na planszy -----
    const body = el('div', 'pac');
    const hud = el('div', 'pac-hud');
    const hScore = el('span', 'pac-score');
    const hHigh = el('span', 'pac-high');
    const hLevel = el('span', 'pac-level');
    const livesCv = /** @type {HTMLCanvasElement} */ (el('canvas', 'pac-lives'));
    livesCv.width = 16 * PAC.LIVES; livesCv.height = 16;
    hud.append(hScore, hHigh, hLevel, livesCv);
    const stage = el('div', 'pac-stage');
    stage.tabIndex = 0;                     // klawiatura trafia do gry, nie do ikon pulpitu
    const cv = /** @type {HTMLCanvasElement} */ (el('canvas', 'pac-canvas'));
    cv.width = W; cv.height = H;
    const msg = el('div', 'pac-msg hidden');
    const box = el('div', 'pac-box');
    box.append(cv, msg);
    stage.appendChild(box);
    body.append(hud, stage);
    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    const lctx = /** @type {CanvasRenderingContext2D} */ (livesCv.getContext('2d'));

    const sheet = new Image();
    sheet.src = 'assets/pacman/sprites.png';

    // kolory z desktop.css (sekcja 11)
    const css = getComputedStyle(document.documentElement);
    const C = {
        bg: css.getPropertyValue('--pac-bg').trim(),
        wall: css.getPropertyValue('--pac-wall').trim(),
        line: css.getPropertyValue('--pac-wall-line').trim(),
        flash: css.getPropertyValue('--pac-wall-flash').trim(),
        door: css.getPropertyValue('--pac-door').trim(),
        pts: css.getPropertyValue('--pac-points').trim(),
    };

    // ----- stan gry -----
    const st = {
        mode: 'ready',     // ready | play | dying | clear | over | won
        timer: 0,          // odliczanie bieżącej fazy (ready, dying, clear, zamrożenie)
        freeze: 0,         // krótka stopklatka po zjedzeniu szlamu
        score: 0,
        high: Number(localStorage.getItem(PAC.HIGH_KEY)) || 0,
        lives: PAC.LIVES,
        level: 1,
        dots: 0,           // ile primogemów zostało
        modeIdx: 0,        // indeks w PAC.MODES
        modeT: 0,
        scared: 0,         // ile sekund strachu zostało
        combo: 0,          // ile szlamów zjedzonych w tym strachu
        paused: false,     // P
        t: 0,              // czas animacji (sekundy)
        since: 0,          // czas od startu życia (wypuszczanie szlamów)
    };
    /** @type {string[][]} */
    let grid = [];
    const player = { x: 112, y: 188, dir: 3, want: 3, acc: 0, moving: false, munch: 0 };
    /** @type {{name:string, sx:number, corner:number[], x:number, y:number, dir:number, acc:number,
     *  state:string, scared:boolean, idx:number, home:boolean}[]} */
    const ghosts = PAC_GHOSTS.map((g, i) => ({ ...g, dir: 3, acc: 0, state: 'out', scared: false, idx: i }));
    /** @type {{x:number, y:number, vx:number, vy:number, life:number, big:boolean}[]} */
    let parts = [];
    /** @type {{x:number, y:number, text:string, life:number}[]} */
    let pops = [];

    // ----- labirynt -----
    const cell = (cx, cy) => {
        if (cy < 0 || cy >= PAC.ROWS) return '_';
        cx = ((cx % PAC.COLS) + PAC.COLS) % PAC.COLS;     // tunel zawija się
        return grid[cy][cx];
    };
    const open = (cx, cy) => { const c = cell(cx, cy); return c !== '#' && c !== '-' && c !== '_'; };
    const tileOf = (p) => Math.floor(p / T);
    const atCenter = (a) => ((a.x % T) + T) % T === 4 && ((a.y % T) + T) % T === 4;
    const inTunnel = (a) => tileOf(a.y) === 14 && (a.x < 6 * T || a.x >= 22 * T);

    // ściany rysowane raz do osobnego płótna (i drugi raz w kolorze mrugania)
    const wallCv = [document.createElement('canvas'), document.createElement('canvas')];
    function paintWalls() {
        wallCv.forEach((c, k) => {
            c.width = W; c.height = H;
            const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
            const wallish = (x, y) => { const ch = cell(x, y); return ch === '#' || ch === '_'; };
            for (let y = 0; y < PAC.ROWS; y++) {
                for (let x = 0; x < PAC.COLS; x++) {
                    const ch = PAC_MAZE[y][x];
                    if (ch === '-') { g.fillStyle = C.door; g.fillRect(x * T, y * T + 3, T, 2); continue; }
                    if (ch !== '#') continue;
                    const px = x * T, py = y * T;
                    g.fillStyle = C.wall;
                    g.fillRect(px, py, T, T);
                    g.fillStyle = k ? C.flash : C.line;
                    const up = !wallish(x, y - 1), dn = !wallish(x, y + 1);
                    const lf = x > 0 && !wallish(x - 1, y), rt = x < PAC.COLS - 1 && !wallish(x + 1, y);
                    if (up) g.fillRect(px, py, T, 1);
                    if (dn) g.fillRect(px, py + T - 1, T, 1);
                    if (lf) g.fillRect(px, py, 1, T);
                    if (rt) g.fillRect(px + T - 1, py, 1, T);
                    // zaokrąglone (pixelowo) narożniki
                    const corner = (a, b, cx, cy, ix, iy) => {
                        if (!a || !b) return;
                        g.clearRect(cx, cy, 1, 1);
                        g.fillRect(ix, iy, 1, 1);
                    };
                    corner(up, lf, px, py, px + 1, py + 1);
                    corner(up, rt, px + T - 1, py, px + T - 2, py + 1);
                    corner(dn, lf, px, py + T - 1, px + 1, py + T - 2);
                    corner(dn, rt, px + T - 1, py + T - 1, px + T - 2, py + T - 2);
                }
            }
        });
    }

    // ----- prędkości zależne od poziomu -----
    const lvlK = () => 1 + PAC.SPEED_UP * (Math.min(st.level, 6) - 1);
    const scaredLen = () => Math.max(PAC.SCARED_MIN, PAC.SCARED_TIME - (st.level - 1) * 1.2);
    const chasing = () => st.modeIdx % 2 === 1 || st.modeIdx >= PAC.MODES.length;

    function newLevel() {
        grid = PAC_MAZE.map((r) => r.split(''));
        st.dots = grid.reduce((n, r) => n + r.filter((c) => c === '.' || c === 'o').length, 0);
        paintWalls();
        resetActors();
    }
    function resetActors() {
        Object.assign(player, { x: 112, y: 188, dir: 3, want: 3, acc: 0, moving: false, munch: 0 });
        ghosts.forEach((g, i) => {
            const d = PAC_GHOSTS[i];
            Object.assign(g, { x: d.x, y: d.y, dir: i === 0 ? 3 : (i % 2 ? 2 : 0), acc: 0, scared: false,
                state: d.home ? 'home' : 'out' });
        });
        st.modeIdx = 0; st.modeT = 0; st.scared = 0; st.combo = 0; st.since = 0;
        parts = []; pops = [];
        st.mode = 'ready'; st.timer = PAC.READY_TIME;
    }
    function newGame() {
        st.score = 0; st.lives = PAC.LIVES; st.level = 1; st.paused = false;
        newLevel();
        hudDraw();
    }

    // ----- gracz -----
    function stepPlayer() {
        if (atCenter(player)) {
            const tx = tileOf(player.x), ty = tileOf(player.y);
            eat(tx, ty);
            if (open(tx + PAC_DX[player.want], ty + PAC_DY[player.want])) player.dir = player.want;
            player.moving = open(tx + PAC_DX[player.dir], ty + PAC_DY[player.dir]);
            if (!player.moving) return false;
        } else if (player.want === (player.dir + 2) % 4) {
            player.dir = player.want;                  // zawrócić można zawsze
        }
        player.moving = true;
        player.x += PAC_DX[player.dir];
        player.y += PAC_DY[player.dir];
        if (player.x < -8) player.x += W + 16;     // tunel
        if (player.x > W + 8) player.x -= W + 16;
        return true;
    }
    function eat(tx, ty) {
        const c = cell(tx, ty);
        if (c !== '.' && c !== 'o') return;
        grid[ty][((tx % PAC.COLS) + PAC.COLS) % PAC.COLS] = ' ';
        st.dots--;
        player.munch = 0.18;
        const big = c === 'o';
        addScore(big ? PAC.POWER : PAC.DOT);
        burst(tx * T + 4, ty * T + 4, big ? 10 : 2, big);
        if (big) frighten();
        if (st.dots <= 0) { st.mode = 'clear'; st.timer = 2.2; }
    }
    function frighten() {
        st.scared = scaredLen(); st.combo = 0;
        ghosts.forEach((g) => {
            if (g.state === 'eyes') return;
            g.scared = true;
            if (g.state === 'out') g.dir = (g.dir + 2) % 4;
        });
    }
    function addScore(n) {
        st.score += n;
        if (st.score > st.high) { st.high = st.score; localStorage.setItem(PAC.HIGH_KEY, String(st.high)); }
        hudDraw();
    }
    function burst(x, y, n, big) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = (big ? 30 : 18) + Math.random() * 25;
            parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, big });
        }
    }

    // ----- szlamy -----
    function target(g) {
        const px = tileOf(player.x), py = tileOf(player.y), d = player.dir;
        if (g.state === 'eyes') return [13, 11];
        if (!chasing()) return g.corner;
        if (g.idx === 0) return [px, py];                                   // Pyro: prosto na nas
        if (g.idx === 2) return [px + 4 * PAC_DX[d], py + 4 * PAC_DY[d]];   // Electro: zasadzka z przodu
        if (g.idx === 1) {                                                  // Hydro: odbicie od Pyro
            const b = ghosts[0];
            return [2 * (px + 2 * PAC_DX[d]) - tileOf(b.x), 2 * (py + 2 * PAC_DY[d]) - tileOf(b.y)];
        }
        const gx = tileOf(g.x), gy = tileOf(g.y);                           // Dendro: nieśmiały
        return (gx - px) ** 2 + (gy - py) ** 2 > 64 ? [px, py] : g.corner;
    }
    function stepGhost(g) {
        if (g.state === 'home') {                  // podskakuje w domku
            if (g.y <= 112) g.dir = 0; else if (g.y >= 120) g.dir = 2;
            g.y += PAC_DY[g.dir];
            return;
        }
        if (g.state === 'leave') {                 // na środek, potem w górę przez drzwi
            if (g.x !== 112) g.x += g.x < 112 ? 1 : -1;
            else if (g.y > 92) { g.y -= 1; g.dir = 2; }
            else { g.state = 'out'; g.dir = 3; }
            return;
        }
        if (g.state === 'enter') {                 // oczka wchodzą do domku i odżywają
            if (g.y < 116) { g.y += 1; g.dir = 0; } else { g.state = 'leave'; g.scared = false; }
            return;
        }
        if (g.state === 'eyes' && g.y === 92 && Math.abs(g.x - 112) <= 4) {
            g.x = 112; g.state = 'enter';
            return;
        }
        if (atCenter(g)) {
            const tx = tileOf(g.x), ty = tileOf(g.y);
            const opts = [2, 3, 0, 1].filter((d) => d !== (g.dir + 2) % 4 && open(tx + PAC_DX[d], ty + PAC_DY[d]));
            if (opts.length === 0) g.dir = (g.dir + 2) % 4;
            else if (g.scared && g.state === 'out') g.dir = opts[Math.floor(Math.random() * opts.length)];
            else {
                const [ax, ay] = target(g);
                let best = opts[0], bd = Infinity;
                opts.forEach((d) => {
                    const dd = (tx + PAC_DX[d] - ax) ** 2 + (ty + PAC_DY[d] - ay) ** 2;
                    if (dd < bd) { bd = dd; best = d; }
                });
                g.dir = best;
            }
        }
        g.x += PAC_DX[g.dir];
        g.y += PAC_DY[g.dir];
        if (g.x < -8) g.x += W + 16;
        if (g.x > W + 8) g.x -= W + 16;
    }
    function ghostSpeed(g) {
        const base = PAC.GHOST_SPEED * lvlK();
        if (g.state === 'eyes' || g.state === 'enter') return PAC.EYES_SPEED;
        if (g.state === 'home' || g.state === 'leave') return base * 0.5;
        if (inTunnel(g)) return base * PAC.TUNNEL_SPEED;
        if (g.scared) return base * PAC.SCARED_SPEED;
        return base;
    }

    // ----- jedna klatka logiki -----
    function update(dt) {
        st.t += dt;
        parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.life -= dt; });
        parts = parts.filter((p) => p.life > 0);
        pops.forEach((p) => { p.life -= dt; p.y -= dt * 6; });
        pops = pops.filter((p) => p.life > 0);
        if (player.munch > 0) player.munch -= dt;

        if (st.mode === 'ready') { if ((st.timer -= dt) <= 0) { st.mode = 'play'; } return; }
        if (st.mode === 'dying') {
            if ((st.timer -= dt) <= 0) {
                if (--st.lives <= 0) { st.mode = 'over'; hudDraw(); }
                else { resetActors(); hudDraw(); }
            }
            return;
        }
        if (st.mode === 'clear') {
            if ((st.timer -= dt) <= 0) {
                if (st.level >= PAC.LEVELS) { st.mode = 'won'; return; }
                st.level++; newLevel(); hudDraw();
            }
            return;
        }
        if (st.mode !== 'play') return;
        if (st.freeze > 0) { st.freeze -= dt; return; }

        st.since += dt;
        // rozproszenie <-> pościg (szlamy zawracają przy każdej zmianie)
        if (st.scared > 0) {
            if ((st.scared -= dt) <= 0) { st.scared = 0; ghosts.forEach((g) => { g.scared = false; }); }
        } else if (st.modeIdx < PAC.MODES.length && (st.modeT += dt) >= PAC.MODES[st.modeIdx]) {
            st.modeT = 0; st.modeIdx++;
            ghosts.forEach((g) => { if (g.state === 'out') g.dir = (g.dir + 2) % 4; });
        }
        ghosts.forEach((g, i) => {
            if (g.state === 'home' && st.since >= PAC.RELEASE[i] / Math.min(2, lvlK())) g.state = 'leave';
        });

        player.acc += PAC.PAC_SPEED * lvlK() * dt;
        while (player.acc >= 1) { player.acc -= 1; if (!stepPlayer()) { player.acc = 0; break; } }
        if (st.mode !== 'play') return;
        for (const g of ghosts) {
            g.acc += ghostSpeed(g) * dt;
            while (g.acc >= 1) { g.acc -= 1; stepGhost(g); }
        }
        collide();
    }
    function collide() {
        for (const g of ghosts) {
            if (g.state === 'eyes' || g.state === 'enter') continue;
            if (Math.abs(g.x - player.x) >= 6 || Math.abs(g.y - player.y) >= 6) continue;
            if (g.scared) {
                const pts = PAC.GHOST_PTS * 2 ** st.combo++;
                addScore(pts);
                pops.push({ x: g.x, y: g.y, text: String(pts), life: 0.9 });
                burst(g.x, g.y, 8, false);
                g.state = 'eyes'; g.scared = false;
                st.freeze = 0.45;
            } else {
                st.mode = 'dying'; st.timer = 1.8; player.munch = 0;
                return;
            }
        }
    }

    // ----- rysowanie -----
    const spr = (sx, sy, x, y, w = 16, h = 16) => ctx.drawImage(sheet, sx, sy, w, h, Math.round(x), Math.round(y), w, h);
    function draw() {
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, W, H);
        const flash = st.mode === 'clear' && st.timer < 1.8 && Math.floor(st.timer * 5) % 2 === 0;
        ctx.drawImage(wallCv[flash ? 1 : 0], 0, 0);
        // primogemy (duże pulsują)
        const pulse = Math.floor(st.t * 4) % 2 === 0;
        for (let y = 0; y < PAC.ROWS; y++) {
            for (let x = 0; x < PAC.COLS; x++) {
                const c = grid[y][x];
                if (c === '.') spr(21, 117, x * T + 2, y * T + 2, 5, 5);
                else if (c === 'o') {
                    if (pulse || st.mode !== 'play') spr(3, 115, x * T - 1, y * T - 1, 10, 10);
                    else spr(21, 117, x * T + 2, y * T + 1, 5, 5);
                }
            }
        }
        if (st.mode !== 'clear' || st.timer > 1.8) drawGhosts();
        drawPlayer();
        parts.forEach((p) => {
            ctx.globalAlpha = Math.min(1, p.life * 3);
            if (p.big) spr(32, 112, p.x - 8, p.y - 8); else spr(48, 112, p.x - 8, p.y - 8);
        });
        ctx.globalAlpha = 1;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.pts;
        pops.forEach((p) => ctx.fillText(p.text, Math.round(p.x), Math.round(p.y)));
        overlay();
    }
    function drawGhosts() {
        ghosts.forEach((g, i) => {
            if (st.mode === 'dying' && st.timer < 1.3) return;   // szlamy znikają, gdy kręci się nam w głowie
            const x = g.x - 8, y = g.y - 9;
            if (g.state === 'eyes' || g.state === 'enter') { spr(g.dir * 16, 96, x, y); return; }
            const squat = Math.floor(st.t * 5 + i * 0.7) % 2;
            const hop = squat ? 0 : -1;
            if (g.scared) {
                const blink = st.scared < PAC.FLASH_TIME && Math.floor(st.t * 6) % 2 === 0;
                const wob = Math.round(Math.sin(st.t * 18 + i) * 0.8);   // trzęsie się ze strachu
                spr((blink ? 32 : 0) + squat * 16, 64, x + wob, y + hop);
            } else spr(g.sx + squat * 16, 48, x, y + hop);
        });
    }
    function drawPlayer() {
        const x = player.x - 8, y = player.y - 9;
        if (st.mode === 'dying') {
            // zawrót głowy: kręcimy się w kółko, nad głową krążą gwiazdki, na koniec "puff"
            const k = 1.8 - st.timer;
            if (k < 0.5) { spr(player.dir * 16, 0, x, y); return; }
            if (k < 1.5) {
                const d = Math.floor(k * 14) % 4;
                spr(d * 16, 32, x, y);
                for (let s = 0; s < 3; s++) {
                    const a = k * 8 + s * 2.1;
                    spr(48, 112, player.x - 8 + Math.cos(a) * 8, player.y - 15 + Math.sin(a) * 3);
                }
                return;
            }
            ctx.globalAlpha = Math.max(0, 1 - (k - 1.5) * 3.3);
            spr(0, 32, x, y + (k - 1.5) * 10);
            ctx.globalAlpha = 1;
            for (let s = 0; s < 6; s++) {
                const a = s * Math.PI / 3, r = (k - 1.5) * 40;
                spr(32, 112, player.x - 8 + Math.cos(a) * r, player.y - 8 + Math.sin(a) * r);
            }
            return;
        }
        if (st.mode === 'won' || st.mode === 'over') return;
        // mruganie co ~3 s, buzia otwarta przy jedzeniu, lekki podskok w biegu
        const blink = (st.t % 3.2) < 0.14;
        const row = player.munch > 0 && Math.floor(st.t * 12) % 2 === 0 ? 16 : blink ? 32 : 0;
        const bob = player.moving && st.mode === 'play' && Math.floor(st.t * 8) % 2 ? -1 : 0;
        spr(player.dir * 16, row, x, y + bob);
    }
    function overlay() {
        let text = '';
        if (st.paused) text = 'PAUSED\n\nPress P';
        else if (st.mode === 'ready') text = st.level > 1 ? `LEVEL ${st.level}\nREADY!` : 'READY!';
        else if (st.mode === 'over') text = 'GAME OVER\n\nPress Enter';
        else if (st.mode === 'won') text = 'YOU WIN!\n\nAll primogems\ncollected\n\nPress Enter';
        else if (st.mode === 'clear' && st.timer < 1.8) text = 'LEVEL CLEAR!';
        else if (st.mode === 'play' && pausedNow()) text = 'PAUSED';
        msg.textContent = text;
        msg.classList.toggle('hidden', !text);
        msg.classList.toggle('pac-msg-big', st.mode === 'over' || st.mode === 'won');
    }
    function hudDraw() {
        hScore.textContent = 'SCORE ' + st.score;
        hHigh.textContent = 'HIGH ' + st.high;
        hLevel.textContent = 'LV ' + st.level;
        lctx.clearRect(0, 0, livesCv.width, livesCv.height);
        for (let i = 0; i < PAC.LIVES; i++) {
            lctx.globalAlpha = i < st.lives ? 1 : 0.25;
            if (sheet.complete) lctx.drawImage(sheet, 16, 0, 16, 16, i * 16, 0, 16, 16);
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
        if (!pausedNow()) update(dt);
        draw();
    }

    // ----- skala całkowita (x1, x2, x3) jak w pasjansie -----
    function fit() {
        const s = Math.max(1, Math.min(PAC.MAX_SCALE, Math.floor(Math.min(stage.clientWidth / W, stage.clientHeight / H))));
        cv.style.width = W * s + 'px';
        cv.style.height = H * s + 'px';
        box.style.setProperty('--s', String(s));
    }
    const ro = new ResizeObserver(() => fit());

    // ----- klawiatura (tylko gdy nasze okno jest aktywne) -----
    // Nasłuch w fazie "capture": gdy nasze okno jest aktywne, klawisze gry nie trafiają już do
    // zaznaczonej ikony na pulpicie (tam strzałki przesuwają zaznaczenie, a Enter otwiera program)
    const onKey = (/** @type {KeyboardEvent} */ e) => {
        if (activeWin !== win95 || win95.min || deskBlocked || booting || !offScreen.classList.contains('hidden')) return;
        const used = () => { e.preventDefault(); e.stopPropagation(); if (!win95.el.contains(document.activeElement)) stage.focus(); };
        const t = /** @type {HTMLElement} */ (e.target);
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        if (e.key in PAC_KEYS) { used(); player.want = PAC_KEYS[e.key]; }
        else if (e.key === 'p' || e.key === 'P') { used(); if (st.mode === 'play' || st.mode === 'ready') st.paused = !st.paused; }
        else if (e.key === 'F2') { used(); newGame(); }
        else if ((e.key === 'Enter' || e.key === ' ') && (st.mode === 'over' || st.mode === 'won')) { used(); newGame(); }
    };
    document.addEventListener('keydown', onKey, true);
    cv.addEventListener('pointerdown', () => { if (st.mode === 'over' || st.mode === 'won') newGame(); });

    const win95 = openWindow({
        id: 'pacman', title: 'Primo-Man', icon: 'assets/icons/pacman.png', body,
        w: PAC.WIN_W, h: PAC.WIN_H,
        onClose: () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.removeEventListener('keydown', onKey, true);
            hbPacman = null;
        },
    });
    ro.observe(stage);
    body.addEventListener('pointerdown', () => stage.focus());
    stage.focus();
    newGame();
    fit();
    raf = requestAnimationFrame(frame);

    // do testów z konsoli
    hbPacman = {
        st, player, ghosts, update, draw, newGame, frighten,
        get grid() { return grid; },
        // zjada wszystkie primogemy poza jednym (szybki test końca poziomu)
        eatAllButOne: () => {
            let left = 0;
            grid.forEach((r, y) => r.forEach((c, x) => { if ((c === '.' || c === 'o') && left++ > 0) { r[x] = ' '; } }));
            st.dots = 1;
        },
    };
}
