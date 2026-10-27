// =====================================================================
//  PROTOTYP: menu -> mini gra (160 primogemów) -> baner -> wymiana na
//  Intertwined Fate -> wish (animacja) -> reveal Leona z życzeniami
//  Liczby do strojenia są w CONFIG na górze.
// =====================================================================

// czyta kolor ze zmiennej w style.css (:root), np. cssVar('--game-gem').
// Wynik zapamiętujemy, żeby nie pytać przeglądarki co klatkę (to spowalnia).
const cssCache = {};
function cssVar(name) {
    if (!(name in cssCache)) {
        cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }
    return cssCache[name];
}

const CONFIG = {
    GEM_VALUE: 10,       // ile primogemów daje jeden złapany kryształ
    WIN_GEMS: 160,       // ile trzeba zebrać (koszt 1 wisha)
    MAX_MISSED: 5,       // ile można przepuścić, zanim przegramy
    SPAWN_START: 45,     // co ile klatek nowy kryształ na start
    SPAWN_MIN: 22,       // najczęstsze spawnowanie (limit trudności)
    GEM_SPEED: 4,        // prędkość spadania na start
    GEM_SPEED_UP: 0.3,   // o ile przyspiesza każdy złapany kryształ
    CAT_SPEED: 10,        // prędkość postaci (nazwa została po kotku)
    CAT_SCALE: 1.6,      // powiększenie sprite'a postaci: 87x98 px -> ok. 139x157 px na ekranie (kotek miał 96x143)
    HEART_SIZE: 30,      // wielkość serduszek (żyć) w pasku u góry, w pikselach
    TURN_TIME: 160,      // ile ms trwa obrót postaci przy zmianie kierunku (lustrzane odbicie)
    TURN_HOP: 4,         // o ile px postać podskakuje w połowie obrotu (0 = bez podskoku)
    WIN_FREEZE_TIME: 300, // ms: po wygranej gra staje, kryształy pękają, postać podskakuje
    WIN_PARTY_TIME: 1200, // ms: napis WISH UNLOCKED! i primogemy lecące do licznika
    WIN_WIPE_TIME: 450,   // ms: pixelowa kurtyna zakrywa (i potem tyle samo odkrywa baner)
    WIN_FLYERS: 8,        // ile primogemów wylatuje z postaci przy wygranej
    MIN_W: 1024,          // minimalna szerokość okna (px CSS); węższe = monit "PC ONLY"
    MIN_H: 640,           // minimalna wysokość okna; ramki 808x608 + obrys i cień ~ 624 px
    EMBED_MIN_W: 816,     // to samo, gdy gra jest w okienku na pulpicie (index.html): pulpit sam
    EMBED_MIN_H: 608,     // pilnuje 1024x640, a tu musi wejść tylko ramka gry 808x608 (+ obrys)
};

// ===== EKRANY =====
const screens = {
    menu: document.getElementById('menu'),
    game: document.getElementById('game'),
    lose: document.getElementById('lose'),
    banner: document.getElementById('banner'),
    wish: document.getElementById('wish'),
};

// pokazuje jeden ekran, resztę chowa
function showScreen(name) {
    for (const key in screens) screens[key].classList.remove('active');
    screens[name].classList.add('active');
}

// =====================================================================
//  MINI GRA
// =====================================================================
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // pixel art ma być ostry

// postać gracza: dziewczyna na poduszce (pixel art 87x98 px, z ciemnym konturem).
const PLAYER_W = 87, PLAYER_H = 98; // rozmiar pliku assets/player.png w pikselach
const catImg = new Image();
catImg.src = 'assets/player.png';

const backdropImg = new Image();
backdropImg.src = 'assets/game-bg.png'; // 1280x800 px, tło bez logo Genshina

// tekstura primogemu (pixel art 32x32 px, przezroczyste tło)
const gemImg = new Image();
gemImg.src = 'assets/primogem.png';
const GEM_TEX = 32; // rysujemy 1:1 (całkowita skala = ostre piksele)

// czy obrazek już się wczytał (jeśli nie - rysujemy stary romb jako zapas)
function imgReady(img) {
    return img.complete && img.naturalWidth > 0;
}

const cat = {
    width: PLAYER_W * CONFIG.CAT_SCALE,
    height: PLAYER_H * CONFIG.CAT_SCALE,
    x: 0,
    y: 0,
    speed: CONFIG.CAT_SPEED,
    // obrót: oryginalny obrazek patrzy w prawo (spódnica "powiewa" w lewo, głowa pochylona w prawo)
    facing: 1,    // kierunek docelowy: 1 = prawo, -1 = lewo
    flip: 1,      // aktualna skala X przy rysowaniu (1 -> 0 -> -1 podczas obrotu)
    turnFrom: 1,  // od jakiej wartości flip zaczął się obecny obrót
    turnT: 1,     // postęp obrotu 0..1 (1 = obrót skończony)
    winHop: 0,    // dodatkowy podskok w px podczas animacji wygranej
};

// płynny start i koniec ruchu (ease-in-out)
function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

let gems = [];        // spadające primogemy
let score = 0;        // zebrane primogemy
let missed = 0;       // przepuszczone kryształy
let gameOver = false; // czy gra się skończyła
let frame = 0;        // licznik klatek
let nextSpawn = 0;    // w której klatce pojawi się następny kryształ
let gemSpeed = CONFIG.GEM_SPEED;
let running = false;  // czy pętla gry ma się kręcić
let hudPulse = 0;     // 0..1 - jak mocno licznik w pasku świeci na złoto (animacja wygranej)

// które klawisze są teraz wciśnięte
const keys = { left: false, right: false };
window.addEventListener('keydown', (e) => {
    if (pcBlocked || hostPaused) return; // przy monicie "PC ONLY" / pauzie z pulpitu gra nie reaguje na klawisze
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
});

function resetGame() {
    cat.x = (canvas.width - cat.width) / 2;
    cat.y = canvas.height - cat.height - 10;
    gems = [];
    score = 0;
    missed = 0;
    frame = 0;
    nextSpawn = 30;
    gemSpeed = CONFIG.GEM_SPEED;
    gameOver = false;
    cat.facing = 1; // na start patrzy w prawo, bez obrotu
    cat.flip = 1;
    cat.turnFrom = 1;
    cat.turnT = 1;
    cat.winHop = 0;
    hudPulse = 0;
}

function spawnGem() {
    const size = 28;
    gems.push({ x: Math.random() * (canvas.width - size), y: -size, size: size });
    // im więcej złapane, tym częściej spadają (ale nie częściej niż SPAWN_MIN)
    const gap = Math.max(CONFIG.SPAWN_MIN, CONFIG.SPAWN_START - score / CONFIG.GEM_VALUE * 1.5);
    nextSpawn = frame + gap * (0.7 + Math.random() * 0.6); // trochę losowości
}

// kolizja dwóch prostokątów (AABB)
function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
}

// obrót postaci: gdy kierunek się zmienia, zaczynamy animację od obecnego flip
// (dir = 0, czyli bez wciśniętej strzałki: zostaje ostatni kierunek, a trwający obrót się kończy)
function updateTurn(k, dir) {
    if (dir !== 0 && dir !== cat.facing) {
        cat.facing = dir;
        cat.turnFrom = cat.flip; // działa też, gdy zawrócimy w połowie obrotu
        cat.turnT = 0;
    }
    if (cat.turnT < 1) {
        // k to klatki 60 FPS, więc k * 1000/60 = milisekundy (płynnie też przy 165 Hz)
        cat.turnT = Math.min(1, cat.turnT + (k * 1000 / 60) / CONFIG.TURN_TIME);
        cat.flip = cat.turnFrom + (cat.facing - cat.turnFrom) * easeInOut(cat.turnT);
    }
}

// k = ile "klatek 60 FPS" minęło od ostatniej klatki (delta time).
// Dzięki temu gra działa tak samo szybko przy 60, 144 czy 30 FPS.
function update(k) {
    if (keys.left) cat.x -= cat.speed * k;
    if (keys.right) cat.x += cat.speed * k;
    cat.x = Math.max(0, Math.min(canvas.width - cat.width, cat.x));

    updateTurn(k, (keys.right ? 1 : 0) - (keys.left ? 1 : 0));

    frame += k;
    if (frame >= nextSpawn) spawnGem();

    // hitbox postaci - od głowy do wierzchu poduszki, bez szerokiej spódnicy po bokach
    // i bez dolnej części poduszki (łapiemy "rękami" i na poduszkę, nie podłogą)
    const catBox = {
        x: cat.x + cat.width * 0.15,
        y: cat.y + cat.height * 0.08,
        width: cat.width * 0.7,
        height: cat.height * 0.62,
    };

    for (let i = gems.length - 1; i >= 0; i--) {
        const g = gems[i];
        g.y += gemSpeed * k;
        const gemBox = { x: g.x, y: g.y, width: g.size, height: g.size };

        if (overlaps(gemBox, catBox)) {
            gems.splice(i, 1);
            score += CONFIG.GEM_VALUE;
            gemSpeed += CONFIG.GEM_SPEED_UP;
        } else if (g.y > canvas.height) {
            gems.splice(i, 1);
            missed++;
        }
    }

    if (score >= CONFIG.WIN_GEMS) endGame(true);
    else if (missed >= CONFIG.MAX_MISSED) endGame(false);
}

// primogem: tekstura 32x32 wyśrodkowana na hitboxie 28x28
// (sam kryształ w pliku ma ok. 28x30 px, więc hitbox 28x28 prawie dokładnie pokrywa to, co widać)
function drawGem(g) {
    if (imgReady(gemImg)) {
        const off = (GEM_TEX - g.size) / 2;
        ctx.drawImage(gemImg, Math.round(g.x - off), Math.round(g.y - off), GEM_TEX, GEM_TEX);
        return;
    }
    // zapas: stary romb, dopóki tekstura się nie wczyta
    const cx = g.x + g.size / 2, cy = g.y + g.size / 2, r = g.size / 2;
    ctx.fillStyle = cssVar('--game-gem');
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cssVar('--game-gem-shine');
    ctx.fillRect(cx - 3, cy - r / 2, 4, 4); // błysk
}

function drawHUD() {
    ctx.fillStyle = cssVar('--game-hud-bg');
    const barH = Math.max(44, CONFIG.HEART_SIZE + 14); // pasek rośnie razem z serduszkami
    ctx.fillRect(0, 0, canvas.width, barH);
    ctx.font = '14px "Press Start 2P", monospace'; // ten sam retro font co strona
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cssVar('--game-score');
    if (hudPulse > 0) {
        // po wygranej licznik pulsuje na złoto i lekko rośnie
        ctx.fillStyle = cssVar('--win-score-pulse');
        ctx.font = `${14 + Math.round(hudPulse * 4)}px "Press Start 2P", monospace`;
    }
    if (imgReady(gemImg)) {
        // ikonka primogemu 1:1 obok licznika
        ctx.drawImage(gemImg, 12, Math.round((barH - GEM_TEX) / 2), GEM_TEX, GEM_TEX);
        ctx.fillText(`${score} / ${CONFIG.WIN_GEMS}`, 12 + GEM_TEX + 6, barH / 2);
    } else {
        ctx.fillText(`✦ ${score} / ${CONFIG.WIN_GEMS}`, 16, barH / 2); // zapas bez tekstury
    }
    ctx.font = CONFIG.HEART_SIZE + 'px sans-serif'; // serduszka większe, osobnym fontem
    ctx.fillStyle = cssVar('--game-lives');
    const lives = '♥'.repeat(CONFIG.MAX_MISSED - missed) + '♡'.repeat(missed);
    ctx.fillText(lives, canvas.width - 16 - ctx.measureText(lives).width, barH / 2);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // tło 16:10 przycinamy po bokach do 4:3 planszy, żeby się nie rozciągało
    const bgW = backdropImg.height * (canvas.width / canvas.height);
    const bgX = (backdropImg.width - bgW) / 2;
    ctx.imageSmoothingEnabled = true;  // tło to "zdjęcie", więc wygładzamy przy pomniejszaniu
    ctx.drawImage(backdropImg, bgX, 0, bgW, backdropImg.height, 0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; // postać i reszta zostają ostrym pixel artem
    for (const g of gems) drawGem(g);
    drawPlayer();
    drawHUD();
}

// postać z lustrzanym odbiciem: skalujemy w poziomie wokół środka sprite'a
function drawPlayer() {
    const cx = Math.round(cat.x + cat.width / 2);                           // środek, równo w pikselach
    const hop = Math.round(Math.sin(Math.PI * cat.turnT) * CONFIG.TURN_HOP); // mały podskok w połowie obrotu
    ctx.save();
    ctx.translate(cx, Math.round(cat.y) - hop - cat.winHop);
    ctx.scale(cat.flip, 1);
    ctx.imageSmoothingEnabled = false; // ostre piksele także w trakcie obrotu
    ctx.drawImage(catImg, -cat.width / 2, 0, cat.width, cat.height);
    ctx.restore();
}

let lastTime = 0;

function gameLoop(now) {
    if (!running) return;
    // max 3, żeby po przełączeniu karty kryształy nie "teleportowały się"
    const k = lastTime ? Math.min((now - lastTime) / (1000 / 60), 3) : 1;
    lastTime = now;
    update(k);
    if (!running) return; // gra mogła się właśnie skończyć
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    if (winActive) return; // w trakcie przejścia do banera nie startujemy nowej gry
    if (pcBlocked) return; // przy monicie "PC ONLY" też nie
    resetGame();
    lastTime = 0;
    showScreen('game');
    running = true;
    requestAnimationFrame(gameLoop);
}

function endGame(won) {
    running = false;
    gameOver = true;
    if (won) {
        startWinTransition(); // animowane przejście, baner otworzy się na jego końcu
    } else {
        document.getElementById('loseScore').textContent = String(score);
        showScreen('lose');
    }
}

// =====================================================================
//  PRZEJŚCIE PO WYGRANEJ: zatrzymanie -> świętowanie -> pixelowa kurtyna -> baner
//  Czasy w CONFIG (WIN_FREEZE_TIME, WIN_PARTY_TIME, WIN_WIPE_TIME).
// =====================================================================
const wipeCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wipeCanvas'));
const wipeCtx = wipeCanvas.getContext('2d');
const bannerBox = /** @type {HTMLElement} */ (document.querySelector('#banner .banner-box'));
const WIPE_BLOCK = 16; // kostka kurtyny w px (wielokrotność siatki 8 px)

let winActive = false;  // blokada: przejście może ruszyć tylko raz
let winStart = 0;       // performance.now() startu przejścia
let winLast = 0;        // poprzednia klatka (do delta time)
let winSwitched = false; // czy już przełączyliśmy na baner
let winParts = [];      // iskierki (pixelowe kwadraciki)
let winFlyers = [];     // primogemy lecące łukiem do licznika
let wipeOrder = null;   // próg zakrycia każdej kostki (0..1)
let wipeCols = 0, wipeRows = 0;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// odbijające "pop" przy pojawianiu się napisu (ease-out-back)
function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// garść iskierek z punktu (x, y)
function burstSparkles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
        winParts.push({
            x, y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
            life: 0, max: 350 + Math.random() * 350,
            size: Math.random() < 0.5 ? 4 : 2, color,
        });
    }
}

function startWinTransition() {
    // nie odpalamy drugi raz ani spoza ekranu mini gry
    if (winActive || !screens.game.classList.contains('active')) return;
    winActive = true;
    winSwitched = false;
    winStart = winLast = performance.now();
    winParts = [];
    winFlyers = [];
    hudPulse = 0;

    // kurtyna na cały ekran, w rozmiarze okna (piksele CSS, bez rozmycia)
    wipeCanvas.width = window.innerWidth;
    wipeCanvas.height = window.innerHeight;
    wipeCols = Math.ceil(wipeCanvas.width / WIPE_BLOCK);
    wipeRows = Math.ceil(wipeCanvas.height / WIPE_BLOCK);
    wipeOrder = new Float32Array(wipeCols * wipeRows);
    for (let r = 0; r < wipeRows; r++) {
        for (let c = 0; c < wipeCols; c++) {
            // ukośnie z lewej-góry + trochę losowości = pixelowe "rozsypywanie"
            const diag = (c / wipeCols) * 0.55 + (r / wipeRows) * 0.45;
            wipeOrder[r * wipeCols + c] = diag * 0.7 + Math.random() * 0.3;
        }
    }
    wipeCanvas.classList.remove('hidden');

    if (!reduceMotion()) {
        // pozostałe kryształy rozpryskują się na iskierki
        for (const g of gems) burstSparkles(g.x + g.size / 2, g.y + g.size / 2, 10, cssVar('--win-sparkle'));
        gems = [];
        // primogemy wylatują z postaci po kolei w stronę licznika w pasku
        const sx = cat.x + cat.width / 2, sy = cat.y + cat.height * 0.35;
        for (let i = 0; i < CONFIG.WIN_FLYERS; i++) {
            const ex = 12 + GEM_TEX / 2, ey = 22;
            winFlyers.push({
                t0: CONFIG.WIN_FREEZE_TIME + i * 70, dur: 650,
                sx, sy, ex, ey,
                cx: sx + (Math.random() - 0.5) * 360, cy: Math.min(sy, ey) - 80 - Math.random() * 120, // punkt łuku
                trail: 0, arrived: false,
            });
        }
    }
    requestAnimationFrame(winFrame);
}

function winFrame(now) {
    const dt = Math.min(now - winLast, 50); // ms od ostatniej klatki (max 50 po zmianie karty)
    winLast = now;
    const t = now - winStart;
    if (reduceMotion()) return winFrameReduced(t);

    const F = CONFIG.WIN_FREEZE_TIME, P = CONFIG.WIN_PARTY_TIME, W = CONFIG.WIN_WIPE_TIME;
    const wipeInStart = F + P, switchAt = F + P + W, endAt = F + P + W * 2;

    if (!winSwitched) {
        // postać kończy ewentualny obrót i robi dwa radosne podskoki
        updateTurn(dt * 60 / 1000, 0);
        const hopT = t / F;
        cat.winHop = hopT < 2 ? Math.round(Math.abs(Math.sin(Math.PI * hopT)) * 14) : 0;
        updateWinParticles(dt);
        hudPulse = Math.max(0, hudPulse - dt / 300);
        draw();
        drawWinOverlay(t);
    }

    // pixelowa kurtyna: zakrywanie, przełączenie na baner, odkrywanie
    wipeCtx.clearRect(0, 0, wipeCanvas.width, wipeCanvas.height);
    if (t >= wipeInStart && t < switchAt) drawWipe(clamp01((t - wipeInStart) / W), true);
    if (t >= switchAt && !winSwitched) {
        winSwitched = true;
        cat.winHop = 0;
        openBanner(true);
    }
    if (t >= switchAt && t < endAt) drawWipe(clamp01((t - switchAt) / W), false);
    if (t >= endAt) return finishWinTransition();
    requestAnimationFrame(winFrame);
}

// wersja dla prefers-reduced-motion: tylko szybkie przyciemnienie i rozjaśnienie
function winFrameReduced(t) {
    const half = 200;
    wipeCtx.clearRect(0, 0, wipeCanvas.width, wipeCanvas.height);
    wipeCtx.globalAlpha = t < half ? t / half : Math.max(0, 1 - (t - half) / half);
    wipeCtx.fillStyle = cssVar('--win-wipe');
    wipeCtx.fillRect(0, 0, wipeCanvas.width, wipeCanvas.height);
    wipeCtx.globalAlpha = 1;
    if (t >= half && !winSwitched) {
        winSwitched = true;
        openBanner(false);
    }
    if (t >= half * 2) return finishWinTransition();
    requestAnimationFrame(winFrame);
}

function finishWinTransition() {
    wipeCtx.clearRect(0, 0, wipeCanvas.width, wipeCanvas.height);
    wipeCanvas.classList.add('hidden');
    winActive = false;
}

// cover = true: kostki się pojawiają; false: znikają w tej samej kolejności
function drawWipe(p, cover) {
    wipeCtx.fillStyle = cssVar('--win-wipe');
    for (let r = 0; r < wipeRows; r++) {
        for (let c = 0; c < wipeCols; c++) {
            const th = wipeOrder[r * wipeCols + c];
            if (cover ? p >= th : p < th) wipeCtx.fillRect(c * WIPE_BLOCK, r * WIPE_BLOCK, WIPE_BLOCK, WIPE_BLOCK);
        }
    }
}

function updateWinParticles(dt) {
    const k = dt * 60 / 1000;
    for (let i = winParts.length - 1; i >= 0; i--) {
        const p = winParts[i];
        p.life += dt;
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.vy += 0.08 * k; // lekka grawitacja
        if (p.life >= p.max) winParts.splice(i, 1);
    }
}

// rysuje świętowanie na planszy gry (iskierki, lecące primogemy, napis)
function drawWinOverlay(t) {
    const F = CONFIG.WIN_FREEZE_TIME;

    // lecące primogemy (krzywa Béziera) + ślad z iskierek
    for (const f of winFlyers) {
        const u = (t - f.t0) / f.dur;
        if (u < 0) continue;
        if (u >= 1) {
            if (!f.arrived) { f.arrived = true; hudPulse = 1; burstSparkles(f.ex, f.ey, 6, cssVar('--win-text')); }
            continue;
        }
        const e = easeInOut(u), m = 1 - e;
        const x = m * m * f.sx + 2 * m * e * f.cx + e * e * f.ex;
        const y = m * m * f.sy + 2 * m * e * f.cy + e * e * f.ey;
        if (t - f.trail > 25) { // co ~25 ms jedna iskierka śladu
            f.trail = t;
            winParts.push({ x, y, vx: 0, vy: 0.3, life: 0, max: 300, size: 4, color: cssVar('--win-sparkle') });
        }
        ctx.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1; // znika przy liczniku
        if (imgReady(gemImg)) ctx.drawImage(gemImg, Math.round(x - GEM_TEX / 2), Math.round(y - GEM_TEX / 2), GEM_TEX, GEM_TEX);
        else drawGem({ x: x - 14, y: y - 14, size: 28 });
        ctx.globalAlpha = 1;
    }

    // iskierki - kwadraciki wyrównane do pikseli
    for (const p of winParts) {
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // duży napis z odbiciem: WISH UNLOCKED! + 160 [primogem] COLLECTED
    const u1 = clamp01((t - F) / 350), u2 = clamp01((t - F - 180) / 350);
    if (u1 > 0) drawPopText('WISH UNLOCKED!', 34, canvas.height / 2 - 30, easeOutBack(u1), true);
    if (u2 > 0) drawPopText(`${CONFIG.WIN_GEMS}   COLLECTED`, 16, canvas.height / 2 + 30, easeOutBack(u2), false);
}

// napis w stylu .title (twarde pixelowe cienie), skalowany wokół środka
function drawPopText(text, size, cy, scale, big) {
    ctx.save();
    ctx.translate(Math.round(canvas.width / 2), Math.round(cy));
    ctx.scale(scale, scale);
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const d = big ? 4 : 2;
    ctx.fillStyle = cssVar('--shadow');
    ctx.fillText(text, d * 2, d * 2);
    ctx.fillStyle = cssVar('--win-text-shadow');
    ctx.fillText(text, d, d);
    ctx.fillStyle = cssVar('--win-text');
    ctx.fillText(text, 0, 0);
    if (!big && imgReady(gemImg)) {
        // ikonka primogemu w przerwie (3 spacje) między "160" a "COLLECTED"
        const num = ctx.measureText(`${CONFIG.WIN_GEMS}`).width;
        const gap = ctx.measureText('   ').width;
        const full = ctx.measureText(text).width;
        const gx = Math.round(-full / 2 + num + gap / 2 - GEM_TEX / 2);
        ctx.drawImage(gemImg, gx, -GEM_TEX / 2, GEM_TEX, GEM_TEX);
    }
    ctx.restore();
    ctx.textAlign = 'left'; // przywracamy domyślne dla HUD
}

// =====================================================================
//  LEON - grafika w assets/leon.png
// =====================================================================

// Leon jest teraz obrazkiem assets/leon.png w HTML - nic nie trzeba rysować
function drawLeon(canvasId) {}

// =====================================================================
//  BANER + WYMIANA WALUTY
// =====================================================================
let primogems = 0;
let fates = 0;

const primoEl = document.getElementById('primoCount');
const fateEl = document.getElementById('fateCount');
const dialog = document.getElementById('exchangeDialog');

// odświeża liczniki walut z małą animacją
function updateCurrency() {
    primoEl.textContent = String(primogems);
    fateEl.textContent = String(fates);
    for (const el of [primoEl.parentElement, fateEl.parentElement]) {
        el.classList.remove('bump');
        void el.offsetWidth; // sztuczka, żeby animacja odpaliła się ponownie
        el.classList.add('bump');
    }
}

// animate = true: ramka banera wjeżdża krótką animacją (po przejściu z mini gry)
function openBanner(animate = false) {
    primogems = score; // to, co złapaliśmy w mini grze
    fates = 0;
    updateCurrency();
    dialog.classList.add('hidden');
    drawLeon('bannerLeon');
    bannerBox.classList.remove('banner-enter');
    showScreen('banner');
    if (animate) {
        void bannerBox.offsetWidth; // restart animacji CSS
        bannerBox.classList.add('banner-enter');
    }
}

// klik "Wish x1": jak nie ma Fate, pytamy o wymianę - dokładnie jak w grze
function onWishClick() {
    if (fates >= 1) {
        fates--;
        updateCurrency();
        setTimeout(startWish, 400);
    } else {
        dialog.classList.remove('hidden');
    }
}

function onConfirmExchange() {
    if (primogems < 160) return;
    primogems -= 160;
    fates += 1;
    updateCurrency();
    dialog.classList.add('hidden');
    setTimeout(onWishClick, 500); // po wymianie od razu robimy wisha
}

// =====================================================================
//  ANIMACJA WISHA - meteor leci po gwiaździstym tle strony (bg.js),
//  canvas jest przezroczysty i na cały ekran, jak scena wisha w Genshinie.
//  Oś czasu (sekundy):
//   0.0  meteor wlatuje z prawego górnego rogu, sypie iskrami
//   1.3  "awans" na 4★: wybuch fioletowych iskier + wstrząs
//   2.0  "awans" na 5★: większy złoty wybuch + mocniejszy wstrząs
//   2.3  ekran się przyciemnia (napięcie)
//   2.8  uderzenie w środek: 3 pierścienie, złote promienie, deszcz iskier
//   3.2  błysk na cały ekran -> karta postaci
// =====================================================================
const wishCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wishCanvas'));
const wctx = wishCanvas.getContext('2d');
const reveal = document.getElementById('reveal');
const skipBtn = document.getElementById('skipBtn');

const PX = 8;          // rozmiar "piksela" w animacji
const UP_4STAR = 1.3;  // kiedy meteor robi się fioletowy
const UP_5STAR = 2.0;  // kiedy meteor robi się złoty
const DIM_START = 2.3; // kiedy zaczyna się przyciemnienie
const FLY_END = 2.8;   // kiedy meteor uderza
const FLASH_START = 3.2;
const FLASH_END = 3.9; // kiedy błysk zakrywa cały ekran

let wishRunning = false;
let particles = [];    // iskry: {x, y, vx, vy, life, max, color, size}
let shakeTime = 0;     // ile sekund jeszcze trzęsie ekranem
let shakePower = 0;    // siła wstrząsu w pikselach

function colorAt(t) {
    if (t >= UP_5STAR) return cssVar('--wish-5star');
    if (t >= UP_4STAR) return cssVar('--wish-4star');
    return cssVar('--wish-3star');
}

// zaokrąglenie do siatki pikseli, żeby wszystko wyglądało pixel-artowo
const snap = v => Math.round(v / PX) * PX;

// wyrzuca "count" iskier z punktu (x, y) we wszystkie strony
function burst(x, y, count, color, speed) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        const max = 0.5 + Math.random() * 0.7;
        particles.push({
            x, y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life: max, max, color,
            size: Math.random() < 0.3 ? PX * 2 : PX,
        });
    }
}

function shake(power, time) {
    shakePower = power;
    shakeTime = time;
}

// ruch i rysowanie iskier (dt = sekundy od poprzedniej klatki)
function updateParticles(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;          // lekka grawitacja
        p.vx *= 1 - 1.5 * dt;      // opór powietrza
        p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
        wctx.globalAlpha = p.life / p.max;
        wctx.fillStyle = p.color;
        wctx.fillRect(snap(p.x), snap(p.y), p.size, p.size);
    }
    wctx.globalAlpha = 1;
}

// pozycja meteoru: łuk z prawego górnego rogu do środka, przyspieszając
function meteorPos(t, W, H) {
    const p = Math.min(t / FLY_END, 1);
    const e = p * p * p * 0.6 + p * 0.4;     // powoli -> szybko
    const sx = W + 80, sy = -80;              // start poza ekranem
    const ex = W / 2, ey = H / 2;             // cel: środek
    const bend = Math.sin(p * Math.PI) * H * 0.18; // wygięcie toru
    return {
        x: sx + (ex - sx) * e - bend * 0.5,
        y: sy + (ey - sy) * e + bend,
    };
}

function startWish() {
    showScreen('wish');
    reveal.classList.add('hidden');
    wishCanvas.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    wishCanvas.width = window.innerWidth;
    wishCanvas.height = window.innerHeight;
    const W = wishCanvas.width;
    const H = wishCanvas.height;
    const flash = cssVar('--wish-flash');
    const dark = cssVar('--shadow');

    particles = [];
    shakeTime = 0;
    let did4 = false, did5 = false, didImpact = false;
    let last = performance.now();
    const start = last;
    const trail = [];  // ostatnie pozycje meteoru (ogon)
    wishRunning = true;

    function wishFrame(now) {
        if (!wishRunning) return;
        const t = (now - start) / 1000;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const color = colorAt(t);
        const m = meteorPos(t, W, H);

        // przezroczyste czyszczenie - pod spodem gwiazdki z tła strony
        wctx.setTransform(1, 0, 0, 1, 0, 0);
        wctx.clearRect(0, 0, W, H);

        // wstrząs ekranu
        if (shakeTime > 0) {
            shakeTime -= dt;
            const dx = snap((Math.random() - 0.5) * shakePower * 2);
            const dy = snap((Math.random() - 0.5) * shakePower * 2);
            wctx.setTransform(1, 0, 0, 1, dx, dy);
        }

        // przyciemnienie przed uderzeniem
        if (t >= DIM_START) {
            wctx.globalAlpha = Math.min((t - DIM_START) / (FLY_END - DIM_START), 1) * 0.6;
            wctx.fillStyle = dark;
            wctx.fillRect(-PX * 4, -PX * 4, W + PX * 8, H + PX * 8);
            wctx.globalAlpha = 1;
        }

        // "awanse" koloru z wybuchem iskier
        if (!did4 && t >= UP_4STAR) {
            did4 = true;
            burst(m.x, m.y, 50, cssVar('--wish-4star'), 500);
            shake(10, 0.25);
        }
        if (!did5 && t >= UP_5STAR) {
            did5 = true;
            burst(m.x, m.y, 90, cssVar('--wish-5star'), 700);
            burst(m.x, m.y, 30, '#ffffff', 400);
            shake(18, 0.35);
        }

        if (t < FLY_END) {
            // ogon z zapamiętanych pozycji
            trail.unshift({ x: m.x, y: m.y });
            if (trail.length > 40) trail.pop();
            for (let i = trail.length - 1; i >= 0; i--) {
                const f = 1 - i / trail.length;
                const s = snap(PX + f * PX * 3);
                wctx.globalAlpha = f;
                wctx.fillStyle = i < 3 ? '#ffffff' : color;
                wctx.fillRect(snap(trail[i].x) - s / 2, snap(trail[i].y) - s / 2, s, s);
            }
            // pulsująca poświata wokół głowy (rośnie z rzadkością)
            const glow = (t >= UP_5STAR ? 9 : t >= UP_4STAR ? 7 : 5) + Math.sin(t * 25);
            wctx.globalAlpha = 0.3;
            wctx.fillStyle = color;
            wctx.fillRect(snap(m.x) - snap(glow * PX / 2), snap(m.y) - snap(glow * PX / 2), snap(glow * PX), snap(glow * PX));
            wctx.globalAlpha = 1;
            // głowa meteoru
            wctx.fillStyle = '#ffffff';
            wctx.fillRect(snap(m.x) - PX * 2, snap(m.y) - PX * 2, PX * 4, PX * 4);
            // sypanie iskrami w locie
            if (Math.random() < 0.9) {
                particles.push({
                    x: m.x, y: m.y,
                    vx: (Math.random() - 0.3) * 200, vy: (Math.random() - 0.7) * 200,
                    life: 0.6, max: 0.6, color, size: PX,
                });
            }
        }

        // uderzenie
        if (!didImpact && t >= FLY_END) {
            didImpact = true;
            burst(W / 2, H / 2, 160, color, 1100);
            burst(W / 2, H / 2, 50, '#ffffff', 600);
            shake(28, 0.6);
        }
        if (t >= FLY_END) {
            const ti = t - FLY_END;
            const big = Math.max(W, H);
            // 3 pierścienie jeden po drugim
            for (let r = 0; r < 3; r++) {
                const f = (ti - r * 0.12) / 0.9;
                if (f <= 0 || f >= 1) continue;
                wctx.globalAlpha = 1 - f;
                wctx.strokeStyle = r === 1 ? '#ffffff' : color;
                wctx.lineWidth = PX * (3 - r);
                wctx.beginPath();
                wctx.arc(W / 2, H / 2, f * big * 0.8, 0, Math.PI * 2);
                wctx.stroke();
            }
            // obracające się złote promienie z centrum
            wctx.globalAlpha = Math.min(ti / 0.2, 1) * 0.8;
            wctx.strokeStyle = color;
            wctx.lineWidth = PX * 3;
            const len = Math.min(ti / 0.5, 1) * big;
            for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6 + ti * 1.5;
                wctx.beginPath();
                wctx.moveTo(W / 2, H / 2);
                wctx.lineTo(W / 2 + Math.cos(a) * len, H / 2 + Math.sin(a) * len);
                wctx.stroke();
            }
            // jasny rdzeń w środku
            const core = snap(PX * 4 + ti * PX * 30);
            wctx.globalAlpha = 1;
            wctx.fillStyle = '#ffffff';
            wctx.fillRect(W / 2 - core / 2, H / 2 - core / 2, core, core);
        }

        updateParticles(dt);

        // końcowy błysk na cały ekran
        if (t >= FLASH_START) {
            wctx.globalAlpha = Math.min((t - FLASH_START) / (FLASH_END - FLASH_START), 1);
            wctx.fillStyle = flash;
            wctx.fillRect(-PX * 4, -PX * 4, W + PX * 8, H + PX * 8);
            wctx.globalAlpha = 1;
        }

        if (t >= FLASH_END) {
            showReveal();
            return;
        }
        requestAnimationFrame(wishFrame);
    }
    requestAnimationFrame(wishFrame);
}

// karta postaci - animacje odpalają się same z CSS (gwiazdki po kolei itd.)
function showReveal() {
    wishRunning = false;
    wishCanvas.classList.add('hidden');
    skipBtn.classList.add('hidden');
    drawLeon('revealLeon');
    reveal.classList.remove('hidden');
}

// ===== PRZYCISKI =====
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);
document.getElementById('wishBtn').addEventListener('click', onWishClick);
document.getElementById('confirmBtn').addEventListener('click', onConfirmExchange);
document.getElementById('cancelBtn').addEventListener('click', () => dialog.classList.add('hidden'));
skipBtn.addEventListener('click', showReveal);
document.getElementById('againBtn').addEventListener('click', () => showScreen('menu'));

// =====================================================================
//  MONIT "PC ONLY" - za małe okno albo sam ekran dotykowy (telefon/tablet)
//  Progi w CONFIG.MIN_W / CONFIG.MIN_H (to jedyne miejsce z tymi liczbami).
// =====================================================================
const pcOnly = document.getElementById('pcOnly');
const pcSizeEl = document.getElementById('pcSize');
const pcTouchEl = document.getElementById('pcTouch');
let pcBlocked = false;      // czy monit jest teraz widoczny
let pcPausedGame = false;   // czy to monit/pulpit zatrzymał mini grę (żeby ją potem wznowić)
let pcCheckQueued = false;  // żeby przy resize sprawdzać max raz na klatkę
let hostPaused = false;     // pulpit kazał zatrzymać grę (okno zminimalizowane albo monit na pulpicie)

// czy gra jest w okienku <iframe> na pulpicie (index.html), czy otwarta sama (game.html)
const EMBEDDED = window.self !== window.top;
const MIN_W = EMBEDDED ? CONFIG.EMBED_MIN_W : CONFIG.MIN_W;
const MIN_H = EMBEDDED ? CONFIG.EMBED_MIN_H : CONFIG.MIN_H;
// w okienku pulpit ma już swoje paski CRT - gra nie dokłada drugich (style.css: html.embedded)
if (EMBEDDED) document.documentElement.classList.add('embedded');

// tylko dotyk: brak hovera, gruby wskaźnik i żadnej myszki/touchpada
const touchOnlyMq = window.matchMedia('(hover: none) and (pointer: coarse)');
const finePointerMq = window.matchMedia('(any-pointer: fine)');
const isTouchOnly = () => touchOnlyMq.matches && !finePointerMq.matches;

function checkPcOnly() {
    pcCheckQueued = false;
    const w = window.innerWidth, h = window.innerHeight;
    const touch = isTouchOnly();
    const blocked = touch || w < MIN_W || h < MIN_H;
    pcSizeEl.textContent = `${w}×${h}`;
    pcTouchEl.classList.toggle('hidden', !touch);
    if (blocked !== pcBlocked) {
        pcBlocked = blocked;
        pcOnly.classList.toggle('hidden', !blocked);
        document.body.classList.toggle('pc-blocked', blocked);
    }
    applyPause();
}

// pauza / wznowienie mini gry: monit "PC ONLY" albo prośba pulpitu
function applyPause() {
    const stop = pcBlocked || hostPaused;
    if (stop && running) {
        // pauza tylko pętli mini gry; przejście do banera i wish lecą dalej pod monitem
        running = false;
        pcPausedGame = true;
        keys.left = keys.right = false;
    } else if (!stop && pcPausedGame) {
        // okno znowu duże / pulpit wznowił - gra rusza dokładnie tam, gdzie stanęła
        pcPausedGame = false;
        running = true;
        lastTime = 0; // bez skoku delta time po pauzie
        requestAnimationFrame(gameLoop);
    }
}

function queuePcCheck() {
    if (pcCheckQueued) return;
    pcCheckQueued = true;
    requestAnimationFrame(checkPcOnly);
}
document.getElementById('pcMin').textContent = `${MIN_W}×${MIN_H}`;
window.addEventListener('resize', queuePcCheck);
touchOnlyMq.addEventListener('change', queuePcCheck);
finePointerMq.addEventListener('change', queuePcCheck);
checkPcOnly();

// wiadomości z pulpitu: { type: 'hb-host', paused: true/false }
// (sprawdzamy nadawcę, nie origin - z dysku, file://, origin to zawsze "null")
window.addEventListener('message', (e) => {
    if (e.source !== window.parent || !e.data || e.data.type !== 'hb-host') return;
    hostPaused = !!e.data.paused;
    if (hostPaused) keys.left = keys.right = false;
    applyPause();
});

// ===== SKRÓT DO TESTÓW =====
// otwórz stronę z #wish na końcu adresu (np. localhost:5500/#wish),
// żeby od razu przejść do banera bez grania. Przed wysłaniem prezentu możesz to usunąć.
if (location.hash === '#wish') {
    score = CONFIG.WIN_GEMS;
    openBanner();
}
