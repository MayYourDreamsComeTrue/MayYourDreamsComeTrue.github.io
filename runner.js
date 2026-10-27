// =====================================================================
//  CITLALI RUN - bieg po świątyni w stylu Temple Run (okienko na pulpicie)
//  Widok zza pleców Citlali: ścieżka z kamieni (3 pasy) rysowana w pseudo-3D
//  (prawdziwy rzut perspektywiczny wielokątów, kamera obraca się na zakrętach).
//  Przeszkody: niskie murki i przepaście (skok), łuki (ślizg), totemy (zmiana pasa),
//  korzenie (potknięcie). Po potknięciu goni nas wielki szlam Pyro.
//  Korzysta z systemu okien z desktop.js, więc musi być wczytany PO desktop.js.
//
//  Sterowanie: strzałki / WASD - lewo/prawo = zmiana pasa albo skręt na rozwidleniu,
//  góra = skok, dół = ślizg, Spacja = start, P = pauza, F2 = nowa gra.
//  Sprite'y: assets/run/sprites.png,
//  kolory świątyni, nieba i napisów: desktop.css (sekcja 14).
// =====================================================================

const RUN = {
    W: 320,               // płótno w logicznych pixelach (x2 w zwykłym oknie)
    H: 240,
    WIN_W: 664,           // okno mieści płótno x2 + pasek wyniku (jak Sigil Snake)
    WIN_H: 566,
    MAX_SCALE: 3,
    FOCAL: 200,           // ogniskowa rzutu (pixele na jednostkę świata na odległości 1)
    HORIZON: 78,          // linia horyzontu na płótnie
    CAM_H: 1.7,           // wysokość kamery
    CAM_BACK: 3.4,        // kamera tyle jednostek za Citlali
    NEAR: 0.2,            // przycinanie bliskiej płaszczyzny
    VIEW: 70,             // jak daleko rysujemy drogę
    HALF: 1.6,            // pół szerokości drogi (3 pasy po 1 jednostce + brzegi)
    LANE: 1.0,
    WALL_H: 0.35,         // niski murek wzdłuż drogi
    SLAB: 2,              // długość kamiennej płyty (co druga ciemniejsza)
    SPEED: 9,             // prędkość startowa (jednostki = metry na sekundę) ...
    SPEED_MAX: 21,        // ... maksymalna
    ACCEL: 0.13,          // ... przyrost na sekundę
    LANE_SPEED: 9,        // szybkość przeskoku między pasami
    JUMP_T: 0.62,         // skok: czas i wysokość
    JUMP_H: 1.15,
    SLIDE_T: 0.7,         // ślizg
    SEG_LEN: [70, 120],   // długość prostego odcinka do rozwidlenia
    FIRST_LEN: 60,
    TURN_EARLY: 2.2,      // skręt działa od tylu jednostek przed środkiem rozwidlenia ...
    TURN_BUFFER: 9,       // ... a wciśnięty jeszcze wcześniej - czeka na swój moment
    TURN_TIME: 0.3,       // obrót kamery
    STUMBLE_TIME: 0.5,
    CHASE_TIME: 7,        // tyle sekund szlam depcze nam po piętach po potknięciu
    GEM_PTS: 10,          // punkty za primogem (wynik = metry + primogemy x 10)
    HIGH_KEY: 'hb-run-high',
};
// kierunki świata: 0 = +z, 1 = +x, 2 = -z, 3 = -x (prawo = kierunek + 1)
const RUN_DX = [0, 1, 0, -1];
const RUN_DZ = [1, 0, -1, 0];
const RUN_DEATH = /** @type {Record<string, string>} */ ({
    wall: 'Bonked into a stone wall!',
    arch: 'Forgot to slide under the arch!',
    totem: 'Ran into a totem!',
    gap: 'Fell into the abyss!',
    edge: 'Missed the turn!',
    caught: 'The Pyro slime caught you!',
});

/** @type {any} */
var hbRunner = null;

function openRunner() {
    if (reuseWin('run')) return;
    const W = RUN.W, H = RUN.H, F = RUN.FOCAL, HOR = RUN.HORIZON, HALF = RUN.HALF;

    // ----- DOM -----
    const body = el('div', 'run');
    const hud = el('div', 'run-hud');
    const hDist = el('span', 'run-dist');
    const hGems = el('span', 'run-gems');
    const gemIc = /** @type {HTMLImageElement} */ (el('img'));
    gemIc.src = 'assets/primogem.png'; gemIc.alt = '';
    const hGemN = el('span');
    hGems.append(gemIc, hGemN);
    const hScore = el('span', 'run-score');
    const hHigh = el('span', 'run-high');
    hud.append(hDist, hGems, hScore, hHigh);
    const stage = el('div', 'run-stage');
    stage.tabIndex = 0;
    const box = el('div', 'run-box');
    const cv = /** @type {HTMLCanvasElement} */ (el('canvas', 'run-canvas'));
    cv.width = W; cv.height = H;
    const msg = el('div', 'run-msg hidden');
    box.append(cv, msg);
    stage.appendChild(box);
    body.append(hud, stage);
    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    ctx.imageSmoothingEnabled = false;
    const sheet = new Image();
    sheet.src = 'assets/run/sprites.png';

    // ----- kolory z desktop.css (sekcja 14) + mgła (gotowe odcienie na 8 poziomów odległości) -----
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue('--run-' + n).trim();
    const C = {
        skyTop: v('sky-top'), skyMid: v('sky-mid'), skyLow: v('sky-low'), sun: v('sun'), far: v('far'), farDark: v('far-dark'),
        jungle: v('jungle'), jungleDark: v('jungle-dark'), abyss: v('abyss'), fog: v('fog'),
        slabA: v('slab-a'), slabB: v('slab-b'), lane: v('lane'), trim: v('trim'), wall: v('wall'), wallTop: v('wall-top'),
        block: v('block'), blockDark: v('block-dark'), blockTop: v('block-top'), gold: v('gold'), jade: v('jade'),
        cliff: v('cliff'), fire: v('fire'), fireCore: v('fire-core'), shadow: v('shadow'), text: v('text'), pts: v('points'),
    };
    const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const fogRGB = rgb(C.fog);
    /** @type {Record<string, string[]>} */
    const fogCache = {};
    const FOG_LV = 8;
    function fogged(col, f) {
        let list = fogCache[col];
        if (!list) {
            const c = rgb(col);
            list = fogCache[col] = [];
            for (let i = 0; i < FOG_LV; i++) {
                const k = Math.min(1, (i / (FOG_LV - 1)) ** 1.6 * 0.85);
                list.push(`rgb(${c.map((x, j) => Math.round(x + (fogRGB[j] - x) * k)).join(',')})`);
            }
        }
        return list[Math.max(0, Math.min(FOG_LV - 1, Math.floor(f / RUN.VIEW * FOG_LV)))];
    }

    // ----- tło: niebo z piramidami (przewija się przy obrocie kamery) i dżungla pod drogą -----
    const BG_W = 640;
    const bg = document.createElement('canvas');
    bg.width = BG_W; bg.height = H;
    (function paintBg() {
        const g = /** @type {CanvasRenderingContext2D} */ (bg.getContext('2d'));
        const sky = g.createLinearGradient(0, 0, 0, HOR);
        sky.addColorStop(0, C.skyTop); sky.addColorStop(0.6, C.skyMid); sky.addColorStop(1, C.skyLow);
        g.fillStyle = sky; g.fillRect(0, 0, BG_W, HOR);
        g.fillStyle = C.sun;                          // słońce z pixeli
        for (let y = -10; y <= 10; y++) { const w = Math.round(Math.sqrt(100 - y * y)); g.fillRect(470 - w, 40 + y, w * 2, 1); }
        // piramidy schodkowe (Natlan) w dwóch planach
        const pyramid = (cx, base, steps, stepW, stepH, col) => {
            g.fillStyle = col;
            for (let i = 0; i < steps; i++) g.fillRect(cx - (steps - i) * stepW, base - (i + 1) * stepH, (steps - i) * stepW * 2, stepH);
            g.fillRect(cx - stepW, base - (steps + 1) * stepH - 3, stepW * 2, stepH + 3);   // świątynka na szczycie
        };
        [[60, 6, 7, 4], [250, 5, 6, 4], [400, 7, 8, 4], [560, 4, 6, 4]].forEach(([x, s, w, h]) => pyramid(x, HOR, s, w, h, C.far));
        [[150, 4, 6, 3], [330, 3, 6, 3], [500, 4, 5, 3], [20, 3, 5, 3]].forEach(([x, s, w, h]) => pyramid(x, HOR, s, w, h, C.farDark));
        // dżungla: korony drzew przy horyzoncie, niżej przepaść
        const low = g.createLinearGradient(0, HOR, 0, H);
        low.addColorStop(0, C.jungle); low.addColorStop(0.25, C.jungleDark); low.addColorStop(1, C.abyss);
        g.fillStyle = low; g.fillRect(0, HOR, BG_W, H - HOR);
        g.fillStyle = C.jungle;
        for (let x = 0; x < BG_W; x += 2) {
            const h = 3 + Math.round(2.5 * Math.sin(x * 0.09) + 1.5 * Math.sin(x * 0.23 + 1));
            g.fillRect(x, HOR - h, 2, h);
        }
    })();

    // ----- stan -----
    const st = {
        mode: 'title',     // title | play | dead | over
        t: 0,
        paused: false,
        speed: RUN.SPEED,
        dist: 0,
        gems: 0,
        score: 0,
        high: Number(localStorage.getItem(RUN.HIGH_KEY)) || 0,
        chase: 0,          // ile sekund jeszcze goni szlam (>0 = widać go za plecami)
        chaseGap: 4,       // odległość szlamu za Citlali (animowana)
        dead: '',          // powód końca biegu
        deadT: 0,
        yaw: 0, yawFrom: 0, yawTo: 0, turnT: 1,
        pending: 0,        // zapamiętany skręt (-1 lewo / 1 prawo)
        pendingT: 0,
        hintT: 0,
    };
    const pl = { s: 0, x: 0, lane: 0, h: 0, jumpT: -1, slideT: -1, stumbleT: -1, phase: 0, lean: 0, fallH: 0 };
    /** @typedef {{type:string, s0:number, s1:number, lanes?:number[], hit?:boolean}} Obst */
    /** @typedef {{s:number, x:number, h:number, got:boolean}} Gem */
    /** @typedef {{ox:number, oz:number, d:number, L:number, turn:string, obs:Obst[], gems:Gem[], kids:any[]|null, plain:boolean}} Seg */
    /** @type {Seg} */
    let seg;
    /** @type {Seg|null} */
    let prev = null;
    /** @type {Seg|null} */
    let ghost = null;
    /** @type {{x:number, y:number, vx:number, vy:number, life:number, big:boolean}[]} */
    let parts = [];

    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];

    // ----- trasa: proste odcinki zakończone rozwidleniem -----
    function makeSeg(ox, oz, d, L, first, plain) {
        /** @type {Seg} */
        const sg = { ox, oz, d, L, turn: pick(['L', 'R', 'T']), obs: [], gems: [], kids: null, plain };
        if (plain) return sg;
        let s = first ? 32 : 14;
        while (s < L - 16) {
            const type = pick(['wall', 'arch', 'gap', 'roots', 'totem', 'wall', 'arch', 'totem']);
            const len = type === 'gap' ? 2.2 : type === 'arch' ? 0.5 : type === 'totem' ? 0.8 : 0.5;
            /** @type {Obst} */
            const o = { type, s0: s, s1: s + len };
            if (type === 'totem') {
                const free = Math.floor(Math.random() * 3) - 1;
                o.lanes = [-1, 0, 1].filter((l) => l !== free && (Math.random() < 0.6 || l === free + 1 || l === free - 1));
                if (o.lanes.length === 0) o.lanes = [free === 0 ? 1 : 0];
                // primogemy prowadzą przez wolny pas
                for (let i = 0; i < 5; i++) sg.gems.push({ s: s - 6 + i * 1.6, x: free, h: 0.45, got: false });
            } else if ((type === 'wall' || type === 'gap') && Math.random() < 0.6) {
                const lane = Math.floor(Math.random() * 3) - 1;      // łuk primogemów nad przeszkodą
                for (let i = 0; i < 5; i++) {
                    const k = (i - 2) / 2;
                    sg.gems.push({ s: (o.s0 + o.s1) / 2 + k * 2.2, x: lane, h: 0.45 + 0.9 * (1 - k * k), got: false });
                }
            }
            sg.obs.push(o);
            // rządek primogemów między przeszkodami
            const gap = rnd(12, 19) + st.speed * 0.45;
            if (Math.random() < 0.7) {
                const lane = Math.floor(Math.random() * 3) - 1;
                const n = Math.floor(rnd(4, 8));
                for (let i = 0; i < n && s + 4 + i * 1.5 < s + gap - 4; i++) sg.gems.push({ s: s + 5 + i * 1.5, x: lane, h: 0.45, got: false });
            }
            s += gap;
        }
        return sg;
    }
    function kidsOf(sg) {
        if (sg.kids) return sg.kids;
        const jx = sg.ox + RUN_DX[sg.d] * sg.L, jz = sg.oz + RUN_DZ[sg.d] * sg.L;
        const dirs = sg.turn === 'L' ? [-1] : sg.turn === 'R' ? [1] : [-1, 1];
        sg.kids = dirs.map((t) => ({ t, seg: makeSeg(jx, jz, (sg.d + t + 4) % 4, Math.round(rnd(RUN.SEG_LEN[0], RUN.SEG_LEN[1])), false, false) }));
        return sg.kids;
    }

    // ----- nowa gra / start -----
    function newGame() {
        Object.assign(st, { mode: 'title', paused: false, speed: RUN.SPEED, dist: 0, gems: 0, score: 0, chase: 0, chaseGap: 1.75,
            dead: '', deadT: 0, yaw: 0, yawFrom: 0, yawTo: 0, turnT: 1, pending: 0, pendingT: 0 });
        Object.assign(pl, { s: 0, x: 0, lane: 0, h: 0, jumpT: -1, slideT: -1, stumbleT: -1, phase: 0, lean: 0, fallH: 0 });
        seg = makeSeg(0, 0, 0, RUN.FIRST_LEN, true, false);
        prev = null; ghost = null; parts = [];
        hudDraw();
    }
    function start() {
        if (st.mode !== 'title') return;
        st.mode = 'play';
        st.chase = 2.5;                       // na starcie szlam chwilę biegnie za nami
    }

    // ----- sterowanie -----
    function side(dir) {
        if (st.mode !== 'play') return;
        const kids = kidsOf(seg);
        const branch = kids.some((k) => k.t === dir);
        const toJ = seg.L - pl.s;
        if (branch && toJ <= RUN.TURN_EARLY) { turn(dir); return; }
        if (branch && toJ <= RUN.TURN_BUFFER) { st.pending = dir; st.pendingT = 0.9; return; }
        const want = Math.max(-1, Math.min(1, pl.lane + dir));
        if (want === pl.lane) return;
        // pas zajęty przez totem tuż obok = potknięcie i odbicie
        const blocked = seg.obs.some((o) => o.type === 'totem' && o.lanes.includes(want) && pl.s > o.s0 - 0.6 && pl.s < o.s1 + 0.3);
        if (blocked) { stumble(); pl.x += dir * 0.25; return; }
        pl.lane = want;
        pl.lean = dir;
    }
    function turn(dir) {
        const kid = kidsOf(seg).find((k) => k.t === dir);
        if (!kid) return;
        const n = kid.seg;
        // pozycja w świecie -> współrzędne nowego odcinka (środek rozwidlenia = początek nowego)
        const [wx, wz] = toWorld(seg, pl.s, pl.x);
        const rx = RUN_DX[(n.d + 1) % 4], rz = RUN_DZ[(n.d + 1) % 4];
        const s2 = (wx - n.ox) * RUN_DX[n.d] + (wz - n.oz) * RUN_DZ[n.d];
        const x2 = (wx - n.ox) * rx + (wz - n.oz) * rz;
        const other = kidsOf(seg).find((k) => k.t !== dir);
        ghost = other ? { ...other.seg, plain: true, obs: [], gems: [] } : null;
        prev = seg;
        seg = n;
        pl.s = s2; pl.x = x2;
        pl.lane = Math.max(-1, Math.min(1, Math.round(x2)));
        st.yawFrom = st.yaw; st.yawTo = st.yawTo + dir * Math.PI / 2; st.turnT = 0;
        st.pending = 0;
        pl.lean = dir;
        burst(W / 2, H - 50, 6, false);
    }
    function jump() {
        if (st.mode !== 'play' || pl.jumpT >= 0) return;
        pl.slideT = -1; pl.jumpT = 0;
    }
    function slide() {
        if (st.mode !== 'play') return;
        if (pl.jumpT >= 0) pl.jumpT = RUN.JUMP_T * 0.85;     // w powietrzu: szybko w dół
        pl.slideT = 0;
    }
    function stumble() {
        if (st.chase > 0 && st.mode === 'play' && st.chase < RUN.CHASE_TIME - 0.6) { die('caught'); return; }
        pl.stumbleT = 0;
        st.chase = RUN.CHASE_TIME;
        st.speed = Math.max(RUN.SPEED, st.speed * 0.85);
    }
    function die(why) {
        if (st.mode !== 'play') return;
        st.mode = 'dead'; st.dead = why; st.deadT = 0;
        pl.jumpT = -1; pl.slideT = -1;
        if (why !== 'gap' && why !== 'edge') st.chase = 9;
        st.score = Math.floor(st.dist) + st.gems * RUN.GEM_PTS;
        if (st.score > st.high) { st.high = st.score; localStorage.setItem(RUN.HIGH_KEY, String(st.high)); }
        hudDraw();
    }

    // ----- logika -----
    function update(dt) {
        st.t += dt;
        parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; });
        parts = parts.filter((p) => p.life > 0);
        if (st.turnT < 1) {
            st.turnT = Math.min(1, st.turnT + dt / RUN.TURN_TIME);
            const k = 1 - (1 - st.turnT) ** 3;
            st.yaw = st.yawFrom + (st.yawTo - st.yawFrom) * k;
        }
        // szlam podbiega / odpada
        const want = st.mode === 'dead' && st.dead !== 'gap' && st.dead !== 'edge' ? 1.2 : st.chase > 0 || st.mode === 'title' ? 1.75 : 4.5;
        st.chaseGap += (want - st.chaseGap) * Math.min(1, dt * (st.mode === 'dead' ? 3 : 2));
        if (st.mode === 'title') { pl.phase += dt * 2; return; }
        if (st.mode === 'dead') {
            st.deadT += dt;
            if (st.dead === 'gap' || st.dead === 'edge') { pl.fallH -= dt * (2 + st.deadT * 9); pl.s += dt * st.speed * Math.max(0, 0.4 - st.deadT); }
            if (st.deadT > 1.6) { st.mode = 'over'; }
            return;
        }
        if (st.mode !== 'play') return;

        st.speed = Math.min(RUN.SPEED_MAX, st.speed + RUN.ACCEL * dt);
        const ds = st.speed * dt;
        pl.s += ds; st.dist += ds;
        pl.phase += dt * st.speed * 0.9;
        if (st.chase > 0) st.chase -= dt;
        if (pl.stumbleT >= 0 && (pl.stumbleT += dt) > RUN.STUMBLE_TIME) pl.stumbleT = -1;
        // przeskok pasa
        const tx = pl.lane * RUN.LANE;
        const step = RUN.LANE_SPEED * dt * (Math.abs(tx - pl.x) > 1.2 ? 1.6 : 1);
        pl.x = Math.abs(tx - pl.x) <= step ? tx : pl.x + Math.sign(tx - pl.x) * step;
        if (pl.x === tx) pl.lean *= Math.max(0, 1 - dt * 10);
        // skok / ślizg
        if (pl.jumpT >= 0) {
            pl.jumpT += dt;
            if (pl.jumpT >= RUN.JUMP_T) { pl.jumpT = -1; pl.h = 0; }
            else pl.h = RUN.JUMP_H * Math.sin(Math.PI * pl.jumpT / RUN.JUMP_T);
        } else pl.h = 0;
        if (pl.slideT >= 0 && pl.jumpT < 0 && (pl.slideT += dt) > RUN.SLIDE_T) pl.slideT = -1;
        // zapamiętany skręt
        if (st.pending) {
            if ((st.pendingT -= dt) <= 0) st.pending = 0;
            else if (seg.L - pl.s <= RUN.TURN_EARLY) turn(st.pending);
        }
        collide();
        // za daleko za rozwidlenie = spadamy z krawędzi
        if (st.mode === 'play' && pl.s > seg.L + HALF - 0.15) die('edge');
        // stare odcinki znikają, gdy już ich nie widać
        if (prev && pl.s > 25) { prev = null; ghost = null; }
        if (st.mode === 'play') {
            st.score = Math.floor(st.dist) + st.gems * RUN.GEM_PTS;
            hudDraw();
        }
    }
    function collide() {
        const sliding = pl.slideT >= 0;
        for (const o of seg.obs) {
            if (pl.s < o.s0 - 0.25 || pl.s > o.s1 + 0.25) continue;
            if (o.type === 'wall' && pl.h < 0.6) return die('wall');
            if (o.type === 'arch' && !sliding) return die('arch');
            if (o.type === 'totem' && o.lanes.some((l) => Math.abs(l * RUN.LANE - pl.x) < 0.6)) return die('totem');
            if (o.type === 'gap' && pl.h <= 0.05 && pl.s > o.s0 + 0.35 && pl.s < o.s1 - 0.35) { pl.fallH = 0; return die('gap'); }
            if (o.type === 'roots' && pl.h < 0.3 && !o.hit) { o.hit = true; stumble(); }
        }
        for (const g of seg.gems) {
            if (g.got || Math.abs(g.s - pl.s) > 0.6 || Math.abs(g.x * RUN.LANE - pl.x) > 0.55) continue;
            const top = sliding ? 0.6 : 1.1;
            if (g.h + 0.2 < pl.h || g.h - 0.2 > pl.h + top) continue;
            g.got = true;
            st.gems++;
            const p = project(...camPt(seg, g.s, g.x * RUN.LANE, g.h));
            if (p) burst(p[0], p[1], 5, true);
            hudBump();
        }
    }
    function burst(x, y, n, big) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 40;
            parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.35 + Math.random() * 0.3, big });
        }
    }

    // ----- rzut 3D -> płótno -----
    const toWorld = (sg, s, x) => [sg.ox + RUN_DX[sg.d] * s + RUN_DX[(sg.d + 1) % 4] * x, sg.oz + RUN_DZ[sg.d] * s + RUN_DZ[(sg.d + 1) % 4] * x];
    let cam = { x: 0, z: 0, sin: 0, cos: 1 };
    function setCamera() {
        const sin = Math.sin(st.yaw), cos = Math.cos(st.yaw);
        const [px, pz] = toWorld(seg, pl.s, pl.x * 0.55);
        cam = { x: px - sin * RUN.CAM_BACK, z: pz - cos * RUN.CAM_BACK, sin, cos };
    }
    /** punkt w kamerze: [w prawo, do przodu, wysokość] */
    function camPt(sg, s, x, h) {
        const [wx, wz] = toWorld(sg, s, x);
        const dx = wx - cam.x, dz = wz - cam.z;
        return [dx * cam.cos - dz * cam.sin, dx * cam.sin + dz * cam.cos, h];
    }
    function project(r, f, h) {
        if (f < RUN.NEAR) return null;
        return [W / 2 + r * F / f, HOR + (RUN.CAM_H - h) * F / f, F / f];
    }
    // wielokąt w kamerze -> przycięty do bliskiej płaszczyzny -> wypełniony
    function poly(pts, col) {
        const out = [];
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            const ain = a[1] >= RUN.NEAR, bin = b[1] >= RUN.NEAR;
            if (ain) out.push(a);
            if (ain !== bin) {
                const k = (RUN.NEAR - a[1]) / (b[1] - a[1]);
                out.push([a[0] + (b[0] - a[0]) * k, RUN.NEAR, a[2] + (b[2] - a[2]) * k]);
            }
        }
        if (out.length < 3) return;
        let fsum = 0;
        ctx.beginPath();
        out.forEach((p, i) => {
            const sx = W / 2 + p[0] * F / p[1], sy = HOR + (RUN.CAM_H - p[2]) * F / p[1];
            fsum += p[1];
            if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
        });
        ctx.closePath();
        ctx.fillStyle = fogged(col, fsum / out.length);
        ctx.fill();
    }
    // prostokąt na drodze / ściana / pudełko w układzie odcinka
    const quadFlat = (sg, s0, s1, x0, x1, h, col) => poly([camPt(sg, s0, x0, h), camPt(sg, s0, x1, h), camPt(sg, s1, x1, h), camPt(sg, s1, x0, h)], col);
    const quadFront = (sg, s, x0, x1, h0, h1, col) => poly([camPt(sg, s, x0, h0), camPt(sg, s, x1, h0), camPt(sg, s, x1, h1), camPt(sg, s, x0, h1)], col);
    const quadSide = (sg, x, s0, s1, h0, h1, col) => poly([camPt(sg, s0, x, h0), camPt(sg, s1, x, h0), camPt(sg, s1, x, h1), camPt(sg, s0, x, h1)], col);
    function boxDraw(sg, s0, s1, x0, x1, h0, h1, front, top, sideCol) {
        // widoczne ściany: ta bliżej kamery + ściany boczne zwrócone do kamery + wierzch
        const lc = localCam(sg);            // kamera w układzie odcinka
        if (lc.x < x0) quadSide(sg, x0, s0, s1, h0, h1, sideCol);
        if (lc.x > x1) quadSide(sg, x1, s0, s1, h0, h1, sideCol);
        if (lc.s < s0) quadFront(sg, s0, x0, x1, h0, h1, front);
        else if (lc.s > s1) quadFront(sg, s1, x0, x1, h0, h1, front);
        if (RUN.CAM_H > h1) quadFlat(sg, s0, s1, x0, x1, h1, top);
    }
    function localCam(sg) {
        const dx = cam.x - sg.ox, dz = cam.z - sg.oz;
        return { s: dx * RUN_DX[sg.d] + dz * RUN_DZ[sg.d], x: dx * RUN_DX[(sg.d + 1) % 4] + dz * RUN_DZ[(sg.d + 1) % 4] };
    }

    // ----- zbieranie rzeczy do narysowania (malarz: od najdalszych) -----
    /** @type {{f:number, fn:() => void}[]} */
    let ground = [], things = [];
    const depth = (sg, s, x) => camPt(sg, s, x, 0)[1];
    function collect(sg, from, to, isCur) {
        const L = sg.L;
        const lo = Math.max(-HALF, from), hi = Math.min(L + HALF, to);
        if (hi <= lo) return;
        const gaps = sg.obs.filter((o) => o.type === 'gap');
        const inGap = (s) => gaps.some((o) => s >= o.s0 && s < o.s1);
        const kids = sg.plain ? [] : (isCur ? kidsOf(sg) : sg.kids || []);
        const left = kids.some((k) => k.t === -1), right = kids.some((k) => k.t === 1);
        // płyty drogi
        for (let s = Math.floor(lo / RUN.SLAB) * RUN.SLAB; s < hi; s += RUN.SLAB) {
            const a = Math.max(lo, s), b = Math.min(hi, s + RUN.SLAB);
            const pieces = [];
            let cur = a;
            gaps.forEach((o) => { if (o.s1 > cur && o.s0 < b) { if (o.s0 > cur) pieces.push([cur, o.s0]); cur = Math.max(cur, o.s1); } });
            if (cur < b) pieces.push([cur, b]);
            const odd = Math.floor(s / RUN.SLAB) % 2 !== 0;
            const junction = s + RUN.SLAB > L - HALF;
            pieces.forEach(([p0, p1]) => {
                const f = depth(sg, p0, 0);
                ground.push({ f, fn: () => {
                    quadFlat(sg, p0, p1, -HALF, HALF, 0, odd ? C.slabB : C.slabA);
                    if (!junction && p0 > -HALF + 0.1) {
                        quadFlat(sg, p0, p1, -0.53, -0.47, 0.001, C.lane);
                        quadFlat(sg, p0, p1, 0.47, 0.53, 0.001, C.lane);
                    }
                    quadFlat(sg, p0, p1, -HALF, -HALF + 0.12, 0.002, C.trim);
                    quadFlat(sg, p0, p1, HALF - 0.12, HALF, 0.002, C.trim);
                } });
            });
            // murki po bokach (otwarte przy rozwidleniu, tam gdzie odchodzi droga)
            for (const sd of [-1, 1]) {
                const open = (sd < 0 ? left : right) && b > L - HALF;
                if (open || s < HALF - RUN.SLAB) continue;
                pieces.forEach(([p0, p1]) => {
                    const x = sd * HALF;
                    things.push({ f: depth(sg, p0, x), fn: () => {
                        quadSide(sg, x, p0, p1, 0, RUN.WALL_H, C.wall);
                        quadFlat(sg, p0, p1, Math.min(x, x + sd * 0.25), Math.max(x, x + sd * 0.25), RUN.WALL_H, C.wallTop);
                    } });
                });
                // słupki z ogniem co 10 jednostek
                if (Math.floor(s) % 10 === 0 && !inGap(s) && s < L - HALF - 1) {
                    const x0 = sd < 0 ? -HALF - 0.35 : HALF, x1 = x0 + 0.35;
                    things.push({ f: depth(sg, s, x0), fn: () => drawPillar(sg, s, x0, x1) });
                }
            }
        }
        // parapet na końcu (tam nie ma drogi prosto)
        if (L + HALF <= to) things.push({ f: depth(sg, L + HALF, 0), fn: () => boxDraw(sg, L + HALF, L + HALF + 0.3, -HALF - 0.3, HALF + 0.3, 0, RUN.WALL_H + 0.25, C.wall, C.wallTop, C.wall) });
        // ścianki przepaści (widać grubość drogi)
        gaps.forEach((o) => {
            if (o.s1 < lo || o.s0 > hi) return;
            things.push({ f: depth(sg, o.s1, 0) + 0.5, fn: () => quadFront(sg, o.s1, -HALF, HALF, -1.4, 0, C.cliff) });
        });
        // przeszkody i primogemy
        sg.obs.forEach((o) => {
            if (o.s1 < lo || o.s0 > hi || o.type === 'gap') return;
            things.push({ f: depth(sg, o.s0, 0), fn: () => drawObstacle(sg, o) });
        });
        sg.gems.forEach((g) => {
            if (g.got || g.s < lo || g.s > hi) return;
            things.push({ f: depth(sg, g.s, g.x), fn: () => drawGem(sg, g) });
        });
    }
    function drawPillar(sg, s, x0, x1) {
        boxDraw(sg, s, s + 0.35, x0, x1, 0, 1.0, C.block, C.gold, C.blockDark);
        // płomyk na szczycie (migocze)
        const p = project(...camPt(sg, s + 0.17, (x0 + x1) / 2, 1.0));
        if (!p) return;
        const k = p[2], fl = 0.75 + 0.25 * Math.sin(st.t * 17 + s);
        const w = Math.max(1, Math.round(0.22 * k)), h = Math.max(1, Math.round(0.4 * k * fl));
        ctx.fillStyle = C.fire;
        ctx.fillRect(Math.round(p[0] - w / 2), Math.round(p[1] - h), w, h);
        ctx.fillStyle = C.fireCore;
        ctx.fillRect(Math.round(p[0] - w / 4), Math.round(p[1] - h * 0.6), Math.max(1, Math.round(w / 2)), Math.round(h * 0.6));
    }
    function drawObstacle(sg, o) {
        if (o.type === 'wall') {
            boxDraw(sg, o.s0, o.s1, -HALF, HALF, 0, 0.6, C.block, C.blockTop, C.blockDark);
            quadFront(sg, o.s0 - 0.001, -HALF, HALF, 0.42, 0.5, C.gold);           // złoty pas
            for (let x = -1; x <= 1; x++) quadFront(sg, o.s0 - 0.002, x - 0.08, x + 0.08, 0.16, 0.32, C.jade);
        } else if (o.type === 'arch') {
            boxDraw(sg, o.s0, o.s1, -HALF - 0.4, -HALF + 0.05, 0, 2.0, C.block, C.blockTop, C.blockDark);
            boxDraw(sg, o.s0, o.s1, HALF - 0.05, HALF + 0.4, 0, 2.0, C.block, C.blockTop, C.blockDark);
            boxDraw(sg, o.s0, o.s1, -HALF - 0.4, HALF + 0.4, 0.75, 1.55, C.block, C.blockTop, C.blockDark);
            quadFront(sg, o.s0 - 0.001, -HALF - 0.4, HALF + 0.4, 0.75, 0.85, C.gold);
            quadFront(sg, o.s0 - 0.001, -HALF - 0.4, HALF + 0.4, 1.45, 1.55, C.gold);
            for (let x = -1.2; x <= 1.21; x += 0.6) quadFront(sg, o.s0 - 0.002, x - 0.08, x + 0.08, 1.08, 1.22, C.jade);
        } else if (o.type === 'roots') {
            const a = project(...camPt(sg, o.s0, -HALF, 0.32)), b = project(...camPt(sg, o.s0, HALF, 0));
            if (!a || !b) return;
            ctx.drawImage(sheet, 16, 48 + (Math.floor(st.t * 4) % 2) * 8, 32, 8, Math.round(a[0]), Math.round(a[1]), Math.round(b[0] - a[0]), Math.max(2, Math.round(b[1] - a[1])));
        } else if (o.type === 'totem') {
            o.lanes.forEach((l) => {
                const p = project(...camPt(sg, o.s0, l * RUN.LANE, 0));
                if (!p) return;
                const w = 0.9 * p[2], h = 1.8 * p[2];
                ctx.drawImage(sheet, 0, 48, 16, 32, Math.round(p[0] - w / 2), Math.round(p[1] - h), Math.round(w), Math.round(h));
            });
        }
    }
    function drawGem(sg, g) {
        const bob = Math.sin(st.t * 4 + g.s) * 0.06;
        const p = project(...camPt(sg, g.s, g.x * RUN.LANE, g.h + bob));
        if (!p) return;
        const sz = Math.max(2, Math.round(0.42 * p[2]));
        const spin = Math.floor(st.t * 5 + g.s) % 4 === 0;      // co chwilę obrót (bokiem)
        if (spin) ctx.drawImage(sheet, 80, 24, 8, 16, Math.round(p[0] - sz / 4), Math.round(p[1] - sz / 2), Math.max(1, Math.round(sz / 2)), sz);
        else ctx.drawImage(sheet, 64, 24, 16, 16, Math.round(p[0] - sz / 2), Math.round(p[1] - sz / 2), sz, sz);
    }
    function drawPlayer() {
        const p = project(...camPt(seg, pl.s, pl.x, 0));
        if (!p) return;
        const SC = 2;     // sprite 24x40 rysowany x2 (Citlali jest zawsze w tej samej odległości od kamery)
        // klatka: [x, y] w arkuszu - bieg 6 klatek (y96), reszta w wierszu y136
        const anim = Math.floor(st.t * 10) % 2;
        let fr = [Math.floor(pl.phase * 1.5) % 6, 0];
        if (st.mode === 'title') fr = [0, 1];
        else if (pl.jumpT >= 0) {
            const k = pl.jumpT / RUN.JUMP_T;
            fr = [k < 0.15 ? 1 : k < 0.55 ? 2 : 3, 1];
        } else if (pl.slideT >= 0) fr = [4 + anim, 1];
        if (pl.stumbleT >= 0) fr = [6 + (pl.stumbleT < RUN.STUMBLE_TIME / 2 ? 0 : 1), 1];
        const lift = st.mode === 'dead' && (st.dead === 'gap' || st.dead === 'edge') ? pl.fallH : pl.h;
        const y = p[1] - lift * p[2];
        // cień pod stopami (mniejszy w skoku)
        if (lift > -0.2) {
            const sw = Math.round((22 - pl.h * 8));
            ctx.fillStyle = C.shadow;
            ctx.fillRect(Math.round(p[0] - sw / 2), Math.round(p[1] - 2), sw, 3);
        }
        ctx.save();
        ctx.translate(Math.round(p[0]), Math.round(y));
        if (st.mode === 'dead') {
            fr = [8 + anim, 1];
            if (st.dead === 'gap' || st.dead === 'edge') {
                const k = Math.max(0.2, 1 - st.deadT * 0.6);
                ctx.scale(k, k); ctx.rotate(st.deadT * 5);
                ctx.translate(0, 40);
            } else {
                ctx.rotate(-0.25 * Math.min(1, st.deadT * 4));
            }
        } else if (pl.lean) ctx.rotate(pl.lean * 0.12);
        ctx.drawImage(sheet, fr[0] * 24, 96 + fr[1] * 40, 24, 40, -12 * SC, -40 * SC, 24 * SC, 40 * SC);
        ctx.restore();
        // gwiazdki zawrotu głowy po zderzeniu
        if (st.mode === 'dead' && st.dead !== 'gap' && st.dead !== 'edge') {
            for (let s = 0; s < 3; s++) {
                const a = st.t * 7 + s * 2.1;
                ctx.drawImage(sheet, 112, 24, 5, 5, Math.round(p[0] + Math.cos(a) * 14 - 5), Math.round(y - 84 + Math.sin(a) * 4), 10, 10);
            }
        }
    }
    function drawChaser() {
        if (st.chaseGap > 3.2) return;
        const p = project(...camPt(seg, pl.s - st.chaseGap, pl.x * 0.7, 0));
        if (!p) return;
        const hop = Math.abs(Math.sin(st.t * 9)) * 0.25;
        const squat = hop < 0.06 ? 1 : 0;
        const w = 1.1 * p[2], h = w * 24 / 32;
        let y = p[1] - hop * p[2];
        // złapany: szlam skacze na Citlali
        if (st.mode === 'dead' && st.dead === 'caught') y -= Math.sin(Math.min(1, st.deadT * 1.5) * Math.PI) * 30;
        ctx.drawImage(sheet, squat * 32, 24, 32, 24, Math.round(p[0] - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    }
    function draw() {
        setCamera();
        // tło przesuwa się z obrotem kamery
        const off = Math.round((((-st.yaw / (Math.PI / 2)) * 160) % BG_W + BG_W) % BG_W);
        ctx.drawImage(bg, off - BG_W, 0);
        ctx.drawImage(bg, off, 0);
        ground = []; things = [];
        if (prev) collect(prev, prev.L - 24, prev.L + HALF, false);
        if (ghost) collect(ghost, -HALF, 30, false);
        collect(seg, pl.s - RUN.CAM_BACK - 3, pl.s + RUN.VIEW, true);
        const rest = RUN.VIEW - (seg.L - pl.s);
        if (rest > 0) kidsOf(seg).forEach((k) => collect(k.seg, -HALF, rest, false));
        ground.sort((a, b) => b.f - a.f).forEach((d) => d.fn());
        things.push({ f: RUN.CAM_BACK, fn: drawPlayer });
        things.push({ f: RUN.CAM_BACK - st.chaseGap, fn: drawChaser });
        things.sort((a, b) => b.f - a.f).forEach((d) => d.fn());
        // iskierki
        parts.forEach((q) => {
            ctx.globalAlpha = Math.min(1, q.life * 3);
            if (q.big) ctx.drawImage(sheet, 120, 24, 7, 7, Math.round(q.x - 3), Math.round(q.y - 3), 7, 7);
            else ctx.drawImage(sheet, 112, 24, 5, 5, Math.round(q.x - 2), Math.round(q.y - 2), 5, 5);
        });
        ctx.globalAlpha = 1;
        drawHint();
        overlay();
    }
    // migająca strzałka przed rozwidleniem
    function drawHint() {
        if (st.mode !== 'play') return;
        const toJ = seg.L - pl.s;
        if (toJ > 26 || toJ < -1 || Math.floor(st.t * 6) % 2) return;
        kidsOf(seg).forEach((k) => {
            const x = W / 2 + k.t * 22;
            ctx.save();
            ctx.translate(x, 30);
            if (k.t > 0) ctx.scale(-1, 1);
            ctx.drawImage(sheet, 96, 24, 16, 16, -16, -16, 32, 32);
            ctx.restore();
        });
    }
    function overlay() {
        let text = '';
        if (st.paused) text = 'PAUSED\n\nPress P';
        else if (st.mode === 'title') text = 'CITLALI RUN\n\nArrows: lanes & turns\nUp: jump  Down: slide\n\nPress Space';
        else if (st.mode === 'over') {
            text = `GAME OVER\n\n${RUN_DEATH[st.dead] || ''}\n\nDistance  ${Math.floor(st.dist)} m\nPrimogems ${st.gems}\nScore     ${st.score}\nBest      ${st.high}\n\nPress Space`;
        } else if (st.mode === 'play' && pausedNow()) text = 'PAUSED';
        if (msg.textContent !== text) msg.textContent = text;
        msg.classList.toggle('hidden', !text);
    }
    let lastHud = '';
    function hudDraw() {
        const s = `${Math.floor(st.dist)}|${st.gems}|${st.score}|${st.high}`;
        if (s === lastHud) return;
        lastHud = s;
        hDist.textContent = Math.floor(st.dist) + ' m';
        hGemN.textContent = String(st.gems);
        hScore.textContent = 'SCORE ' + st.score;
        hHigh.textContent = 'BEST ' + st.high;
    }
    function hudBump() {
        hGems.classList.remove('bump');
        void hGems.offsetWidth;
        hGems.classList.add('bump');
    }

    // ----- pętla -----
    let raf = 0, last = 0;
    const pausedNow = () => st.paused || activeWin !== win95 || win95.min || document.hidden || deskBlocked;
    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
        last = now;
        if (!pausedNow()) update(dt);
        draw();
    }
    function fit() {
        const s = Math.max(1, Math.min(RUN.MAX_SCALE, Math.floor(Math.min(stage.clientWidth / W, stage.clientHeight / H))));
        box.style.width = W * s + 'px';
        box.style.height = H * s + 'px';
        box.style.setProperty('--s', String(s));
    }
    const ro = new ResizeObserver(() => fit());

    // ----- klawiatura (faza "capture", jak w pozostałych grach) -----
    const onKey = (/** @type {KeyboardEvent} */ e) => {
        if (activeWin !== win95 || win95.min || deskBlocked || booting || !offScreen.classList.contains('hidden')) return;
        const t = /** @type {HTMLElement} */ (e.target);
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        const used = () => { e.preventDefault(); e.stopPropagation(); if (!win95.el.contains(document.activeElement)) stage.focus(); };
        const k = e.key;
        if (k === ' ' || k === 'Enter') {
            used();
            if (st.mode === 'title') start();
            else if (st.mode === 'over') { newGame(); start(); }
            else if (k === ' ' && !e.repeat) jump();
            return;
        }
        if (k === 'p' || k === 'P') { used(); if (st.mode === 'play') st.paused = !st.paused; return; }
        if (k === 'F2') { used(); newGame(); return; }
        if (st.paused || e.repeat) {
            if (/^(Arrow|[wasdWASD]$)/.test(k)) used();
            return;
        }
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { used(); side(-1); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { used(); side(1); }
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') { used(); if (st.mode === 'title') start(); else jump(); }
        else if (k === 'ArrowDown' || k === 's' || k === 'S') { used(); slide(); }
    };
    document.addEventListener('keydown', onKey, true);
    cv.addEventListener('pointerdown', () => { if (st.mode === 'title') start(); else if (st.mode === 'over') { newGame(); start(); } });

    const win95 = openWindow({
        id: 'run', title: 'Citlali Run', icon: 'assets/icons/run.png', body,
        w: RUN.WIN_W, h: RUN.WIN_H,
        onClose: () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.removeEventListener('keydown', onKey, true);
            hbRunner = null;
        },
    });
    ro.observe(stage);
    body.addEventListener('pointerdown', () => stage.focus());
    stage.focus();
    newGame();
    fit();
    raf = requestAnimationFrame(frame);

    // do testów z konsoli
    hbRunner = {
        st, pl, update, draw, newGame, start, side, turn, jump, slide, kidsOf, collide,
        get seg() { return seg; }, get prev() { return prev; },
        // ustawia przeszkodę "ahead" jednostek przed Citlali (czyści inne)
        place: (type, ahead, lanes) => {
            const s0 = pl.s + ahead, len = type === 'gap' ? 2.2 : type === 'totem' ? 0.8 : 0.5;
            seg.obs = [{ type, s0, s1: s0 + len, lanes }];
        },
        clear: () => { seg.obs = []; seg.gems = []; },
        gemsAhead: (ahead, lane, n) => { for (let i = 0; i < n; i++) seg.gems.push({ s: pl.s + ahead + i * 1.5, x: lane, h: 0.45, got: false }); },
        // rozwidlenie "ahead" jednostek przed nami, typ L / R / T
        junction: (ahead, type) => { seg.L = pl.s + ahead; seg.turn = type; seg.kids = null; seg.obs = seg.obs.filter((o) => o.s1 < seg.L - 10); seg.gems = []; },
    };
}
