// =====================================================================
//  PASJANS (Klondike) - okno "Solitaire" na pulpicie (index.html)
//  Jak klasyczny pasjans z Windowsa (ale talia 40 kart - patrz TALIA niżej), na kartach są portrety
//  postaci (pixel art) z jednego arkusza assets/solitaire/portraits.png.
//  Korzysta z systemu okien z desktop.js (openWindow, reuseWin, el...),
//  więc musi być wczytany PO desktop.js.
//
//  Sterowanie: przeciąganie kart myszą, podwójny klik = karta na stos
//  docelowy (as -> król), klik w talię = dobierz, Ctrl+Z = cofnij,
//  F2 = nowe rozdanie. Kolory kart i stołu są w desktop.css (sekcja 10).
//  Każde rozdanie sprawdza solver (SOLVER niżej) - gracz dostaje tylko układy do wygrania.
// =====================================================================

const SOL = {
    CARD_W: 56,           // karta w "logicznych" pixelach (na ekranie x1/x2/x3 - całkowita skala)
    CARD_H: 80,
    ART_W: 48,            // portret na karcie (taki sam rozmiar jak kafelek w portraits.png)
    ART_H: 54,
    ART_X: 4,             // gdzie na karcie zaczyna się portret (od lewego górnego rogu)
    ART_Y: 12,
    IDX_X: 3,             // gdzie w rogu jest ranga i kolor (A, 2..7, J, Q, K + serduszko itd.)
    IDX_Y: 3,
    GAP: 8,               // odstęp między kolumnami
    MARGIN: 8,            // margines stołu
    ROW_GAP: 12,          // odstęp między górnym rzędem (talia, stosy) a kolumnami
    DOWN_STEP: 4,         // o ile niżej leży każda zakryta karta w kolumnie
    UP_STEP: 13,          // ... a każda odkryta (widać rangę i kolor)
    MIN_UP_STEP: 6,       // najmniejszy odstęp, gdy długa kolumna nie mieści się w oknie
    WASTE_STEP: 12,       // przesunięcie 3 kart obok talii w trybie Draw Three
    MAX_SCALE: 3,         // największe powiększenie (duże zmaksymalizowane okno)
    WIN_W: 944,           // rozmiar okna (karty x2 mieszczą się przy 1366x768)
    WIN_H: 700,
    UNDO_MAX: 300,        // ile ruchów pamięta Ctrl+Z
    DRAG_PX: 4,           // od ilu pixeli ruchu myszą klik zamienia się w przeciąganie
    SHEET: 'assets/solitaire/portraits.png',
    SHEET_W: 480,         // szerokość arkusza (10 portretów po 48 px)
    SHEET_COLS: 10,
    BACK_Y: 216,          // rewers karty leży w arkuszu pod portretami (x = 0)
    // punktacja jak w Windows ("Standard")
    PTS_WASTE_TAB: 5,     // karta z odłożonych do kolumny
    PTS_TO_FOUND: 10,     // karta na stos docelowy
    PTS_FLIP: 5,          // odkrycie karty w kolumnie
    PTS_FOUND_TAB: -15,   // zdjęcie karty ze stosu docelowego
    PTS_RECYCLE_1: -100,  // przełożenie talii od nowa (Draw One)
    PTS_RECYCLE_3: -20,   // ... (Draw Three)
    BONUS_TIME: 700000,   // bonus za wygraną: BONUS_TIME / sekundy (gdy gra trwała ponad 30 s)
    // animacja wygranej (karty skaczą i zostawiają ślad); wartości na klatkę 60 Hz,
    // przeliczane przez czas klatki, więc tak samo szybko przy 60 i 165 Hz
    FX_GRAVITY: 0.32,     // grawitacja (x skala kart)
    FX_BOUNCE: 0.72,      // ile prędkości zostaje po odbiciu od dołu
    FX_VX_MIN: 2,         // prędkość pozioma: od..do (x skala kart)
    FX_VX_MAX: 5,
    FX_VY_MAX: 5,         // początkowy podskok w górę: 0..tyle
    FX_LAUNCH_MS: 320,    // co ile ms wylatuje następna karta
    STORE_KEY: 'hb-solitaire-draw', // zapamiętany tryb Draw One / Draw Three
    HELP_KEY: 'hb-solitaire-help-seen', // "Don't show this again" w okienku How to Play
    HELP_W: 560,          // rozmiar okienka How to Play (dłuższy tekst się przewija)
    HELP_H: 560,
    // rozdawanie tylko wygrywalnych układów (solver niżej)
    SOLVE_MS: 200,        // ile ms solver może myśleć nad jednym rozdaniem
    DEAL_TRIES: 25,       // ile tasowań najwyżej sprawdzamy przy jednym "Deal"
    DEAL_MS: 1500,        // ... i ile ms łącznie; potem zostaje ostatnie tasowanie
};

// kolory (kier, karo, trefl, pik) - pierwsze dwa czerwone
const SOL_SUIT_NAMES = ['hearts', 'diamonds', 'clubs', 'spades'];
// ===== TALIA 40 KART (jak hiszpańska talia) =====
// Mamy 40 portretów, więc talia ma 40 kart i każda postać jest dokładnie raz:
// 4 kolory x 10 rang: A, 2, 3, 4, 5, 6, 7, J, Q, K (bez 8, 9, 10).
// W kodzie ranga to liczba 1..10 (1 = as, 8 = walet, 9 = dama, 10 = król),
// więc "o jeden niżej/wyżej" działa samo: walet leży bezpośrednio na 7 w kolumnie,
// a na stosie docelowym po 7 idzie walet (A..7, J, Q, K).
const SOL_RANK_COUNT = 10;    // ile rang w kolorze (król = SOL_RANK_COUNT)
const SOL_RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
const SOL_RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', 'Jack', 'Queen', 'King'];
// pixelowe symbole kolorów 7x7 ('#' = zapalony pixel)
const SOL_SUIT_GLYPHS = [
    ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],   // kier
    ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],   // karo
    ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],   // trefl
    ['...#...', '..###..', '.#####.', '#######', '.##.##.', '...#...', '..###..'],   // pik
];
// pierścień na pustym miejscu po talii (klik = przełóż odłożone karty z powrotem)
const SOL_RING_GLYPH = ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'];
// "ptaszek" przy zaznaczonej opcji w menu
const SOL_CHECK_GLYPH = ['.....#', '....##', '#..##.', '####..', '.##...'];

// ===== KTÓRY PORTRET NA KTÓREJ KARCIE =====
// Portrety są numerowane w arkuszu wierszami: 0..9 górny rząd, 30..39 dolny.
// Każdy kolor dostaje jeden rząd arkusza (kier 0-9, karo 10-19, trefl 20-29,
// pik 30-39), a w rzędzie po kolei A, 2..7, J, Q, K - każdy portret dokładnie raz.
/**
 * @param {number} suit
 * @param {number} rank
 */
function solArtIndex(suit, rank) {
    return suit * SOL_RANK_COUNT + rank - 1;
}

// TUTAJ treść instrukcji (okienko "How to Play": pokazuje się samo przy pierwszym
// uruchomieniu pasjansa, potem Help > How to Play albo F1). Zwykły tekst, każdy Enter
// to nowa linia; znak ` zapisz jako \`.
const SOL_HELP_TEXT = `HOW TO PLAY

Goal: move all 40 cards to the four piles at the top, one pile per suit, from Ace up to King.

- Click the deck to flip a new card.
- In the columns, stack cards downward, alternating red and black: K, Q, J, 7, 6 ... A.
- Only a King can go into an empty column.
- Drag a card (or a whole valid stack) to move it. Double-click a card to send it to its pile.
- Ctrl+Z undoes a move. F2 deals a new game. Draw Three is in the Game menu. F1 opens this help.
- Every deal can be won: a built-in solver checks each shuffle before dealing (Draw One rules).

WHY NO 8, 9, 10?

This deck has 40 cards, so every character appears exactly once.

Fun fact: that's just like the classic 40-card Spanish deck (baraja española). It has no 8s or 9s, and no 10s either - after the 7 come the face cards: Sota (Jack), Caballo (Knight) and Rey (King).

Have fun and Happy Birthday!
`;

/**
 * okienko "How to Play" (jedno naraz); zamknięcie zapisuje "Don't show this again"
 */
function solHowToPlay() {
    if (reuseWin('sol-help')) return;
    const body = el('div', 'sol-help');
    const area = el('div', 'notepad-text sunken');
    area.tabIndex = 0;                         // strzałki / PageDown przewijają tekst
    area.setAttribute('role', 'document');
    area.setAttribute('aria-label', 'How to Play');
    renderNote(area, SOL_HELP_TEXT);
    const foot = el('div', 'sol-help-foot');
    const label = el('label', 'sol-help-check');
    const box = /** @type {HTMLInputElement} */ (el('input'));
    box.type = 'checkbox';
    box.checked = true;                        // domyślnie zaznaczone = pokaż tylko za pierwszym razem
    label.append(box, el('span', '', "Don't show this again"));
    const ok = el('button', 'win-btn', 'OK');
    foot.append(label, ok);
    body.append(area, foot);
    const win = openWindow({
        id: 'sol-help', title: 'How to Play', icon: 'assets/icons/solitaire.png', body,
        w: SOL.HELP_W, h: SOL.HELP_H, maximizable: false, minimizable: false,
        onClose: () => {
            if (box.checked) localStorage.setItem(SOL.HELP_KEY, '1');
            else localStorage.removeItem(SOL.HELP_KEY);
        },
    });
    ok.addEventListener('click', () => closeWin(win));
    win.el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && e.target !== box)) { e.preventDefault(); closeWin(win); }
    });
    area.focus();
    area.scrollTop = 0;
}

// ===== SOLVER: czy rozdanie da się wygrać? =====
// Przy Draw One i nieograniczonym przekładaniu talii każdą kartę z talii/odłożonych da się
// w końcu dobrać, więc dla solvera talia to po prostu ZBIÓR dostępnych kart (kolejność
// nie ma znaczenia). Solver zna też zakryte karty (sprawdza rozdanie, nie podpowiada graczowi).
// Szukanie w głąb (DFS) z pamięcią odwiedzonych stanów i limitem czasu.
// Karta = liczba id = kolor * 10 + ranga - 1 (tak samo jak karty w openSolitaire).

/** @typedef {{down: number[], up: number[]}} SolCol */
/** @typedef {{cols: SolCol[], found: number[], talon: number[]}} SolState */
/** @typedef {{card: number, to: 'found'|'tab', j: number}} SolMove */

const solRankOf = (/** @type {number} */ id) => id % SOL_RANK_COUNT + 1;
const solSuitOf = (/** @type {number} */ id) => Math.floor(id / SOL_RANK_COUNT);
const solIsRed = (/** @type {number} */ id) => solSuitOf(id) < 2;

/**
 * @param {SolState} start
 * @param {number} budgetMs
 * @returns {{solved: boolean, timeout: boolean, moves: SolMove[], nodes: number, ms: number}}
 */
function solSolve(start, budgetMs) {
    const t0 = performance.now();
    let nodes = 0, timeout = false;
    const seen = new Set();
    /** @type {SolMove[]} */
    const path = [];
    const clone = (/** @type {SolState} */ s) => ({
        cols: s.cols.map((c) => ({ down: c.down.slice(), up: c.up.slice() })),
        found: s.found.slice(),
        talon: s.talon.slice(),
    });
    // kolumny są zamienne, więc w kluczu są posortowane (mniej powtórzonych stanów)
    const key = (/** @type {SolState} */ s) => s.found.join('') + '|' + s.talon.join(',') + '|' +
        s.cols.map((c) => c.down.join(',') + '/' + c.up.join(',')).sort().join(';');
    const canFound = (s, id) => s.found[solSuitOf(id)] === solRankOf(id) - 1;
    const canTab = (/** @type {SolCol} */ c, id) => {
        const top = c.up[c.up.length - 1];
        if (top === undefined) return !c.down.length && solRankOf(id) === SOL_RANK_COUNT;
        return solRankOf(id) === solRankOf(top) - 1 && solIsRed(id) !== solIsRed(top);
    };
    // "bezpieczny" ruch na stos: obie karty o 1 niższe w przeciwnym kolorze już są na stosach,
    // więc tej karty nic w kolumnach nie potrzebuje - robimy go bez szukania alternatyw
    const safe = (s, id) => {
        const r = solRankOf(id);
        if (r <= 2) return true;
        return (solIsRed(id) ? [2, 3] : [0, 1]).every((k) => s.found[k] >= r - 1);
    };
    // zdejmuje kartę (z całym ciągiem nad nią) i odkrywa kartę pod spodem
    const take = (/** @type {SolState} */ s, id) => {
        const ti = s.talon.indexOf(id);
        if (ti >= 0) { s.talon.splice(ti, 1); return [id]; }
        if (s.found[solSuitOf(id)] === solRankOf(id)) { s.found[solSuitOf(id)]--; return [id]; }
        for (const c of s.cols) {
            const k = c.up.indexOf(id);
            if (k < 0) continue;
            const run = c.up.splice(k);
            if (!c.up.length && c.down.length) c.up.push(c.down.pop());
            return run;
        }
        return [];
    };
    const apply = (/** @type {SolState} */ s, /** @type {SolMove} */ m) => {
        const run = take(s, m.card);
        if (m.to === 'found') s.found[m.j]++;
        else s.cols[m.j].up.push(...run);
    };

    /** @param {SolState} s */
    const gen = (s) => {
        /** @type {SolMove[]} */
        const a = [], b = [], c = [], d = [], e = [];
        const empty = s.cols.findIndex((col) => !col.up.length && !col.down.length);
        // 1) na stosy docelowe (z kolumn i z talii)
        s.cols.forEach((col) => {
            const top = col.up[col.up.length - 1];
            if (top !== undefined && canFound(s, top)) a.push({ card: top, to: 'found', j: solSuitOf(top) });
        });
        s.talon.forEach((id) => { if (canFound(s, id)) a.push({ card: id, to: 'found', j: solSuitOf(id) }); });
        // 2) cały odkryty ciąg na inną kolumnę - tylko gdy coś odkrywa albo zwalnia miejsce
        s.cols.forEach((col, i) => {
            if (!col.up.length) return;
            const lead = col.up[0];
            const useful = col.down.length > 0 || solRankOf(lead) !== SOL_RANK_COUNT;
            if (useful) {
                s.cols.forEach((dst, j) => {
                    if (j === i || !canTab(dst, lead)) return;
                    if (!dst.up.length && j !== empty) return;      // puste kolumny są takie same
                    b.push({ card: lead, to: 'tab', j });
                });
            }
            // 4) część ciągu - tylko gdy karta pod spodem może od razu iść na stos
            for (let k = 1; k < col.up.length; k++) {
                if (!canFound(s, col.up[k - 1])) continue;
                s.cols.forEach((dst, j) => {
                    if (j !== i && dst.up.length && canTab(dst, col.up[k])) d.push({ card: col.up[k], to: 'tab', j });
                });
            }
        });
        // 3) karta z talii do kolumny
        s.talon.forEach((id) => {
            s.cols.forEach((dst, j) => {
                if (!canTab(dst, id)) return;
                if (!dst.up.length && j !== empty) return;
                c.push({ card: id, to: 'tab', j });
            });
        });
        // 5) karta ze stosu docelowego z powrotem do kolumny (rzadko potrzebne)
        s.found.forEach((r, suit) => {
            if (r < 3) return;
            const id = suit * SOL_RANK_COUNT + r - 1;
            s.cols.forEach((dst, j) => { if (dst.up.length && canTab(dst, id)) e.push({ card: id, to: 'tab', j }); });
        });
        // najpierw ruchy odkrywające więcej zakrytych kart
        b.sort((x, y) => downUnder(s, y.card) - downUnder(s, x.card));
        return [...a, ...b, ...c, ...d, ...e];
    };
    const downUnder = (s, id) => {
        const col = s.cols.find((cc) => cc.up.includes(id));
        return col ? col.down.length : 0;
    };

    /** @param {SolState} s */
    const dfs = (s) => {
        if (s.found.every((f) => f === SOL_RANK_COUNT)) return true;
        if (timeout || (++nodes % 256 === 0 && performance.now() - t0 > budgetMs)) { timeout = true; return false; }
        const k = key(s);
        if (seen.has(k)) return false;
        seen.add(k);
        const moves = gen(s);
        // bezpieczny ruch na stos = jedyna gałąź
        const forced = moves.find((m) => m.to === 'found' && safe(s, m.card));
        for (const m of forced ? [forced] : moves) {
            const s2 = clone(s);
            apply(s2, m);
            path.push(m);
            if (dfs(s2)) return true;
            path.pop();
            if (timeout) return false;
        }
        return false;
    };
    const solved = dfs(clone(start));
    return { solved, timeout, moves: solved ? path.slice() : [], nodes, ms: performance.now() - t0 };
}

/**
 * tasowanie Fisher-Yates + rozdanie jak w Klondike: kolumny 1..7 kart (28), reszta (12) w talii
 * @param {() => number} rnd   losowanie 0..1 (Math.random)
 * @returns {{tab: number[][], stock: number[]}}  id kart; w kolumnie ostatnia = odkryta
 */
function solDealIds(rnd) {
    const deck = Array.from({ length: SOL_RANK_COUNT * 4 }, (_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    /** @type {number[][]} */
    const tab = [[], [], [], [], [], [], []];
    for (let i = 0; i < 7; i++) {
        for (let k = i; k < 7; k++) tab[k].push(deck.pop());
    }
    return { tab, stock: deck };
}

/** @param {{tab: number[][], stock: number[]}} d */
const solDealState = (d) => ({
    cols: d.tab.map((col) => ({ down: col.slice(0, -1), up: col.slice(-1) })),
    found: [0, 0, 0, 0],
    talon: d.stock.slice().sort((x, y) => x - y),
});

/**
 * losuje rozdanie, które solver umie wygrać (Draw One); gdy w limicie się nie uda - ostatnie
 * @param {() => number} rnd
 */
function solWinnableDeal(rnd) {
    const t0 = performance.now();
    let d = solDealIds(rnd), tries = 1;
    while (!solSolve(solDealState(d), SOL.SOLVE_MS).solved) {
        if (tries >= SOL.DEAL_TRIES || performance.now() - t0 > SOL.DEAL_MS) return { deal: d, winnable: false, tries };
        d = solDealIds(rnd);
        tries++;
    }
    return { deal: d, winnable: true, tries };
}

/** @param {string[]} rows */
function solGlyphSvg(rows, cls) {
    let rects = '';
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    });
    return `<svg class="${cls}" viewBox="0 0 ${rows[0].length} ${rows.length}" aria-hidden="true">${rects}</svg>`;
}

/**
 * @typedef {Object} SolCard
 * @property {number} id
 * @property {number} suit     0 kier, 1 karo, 2 trefl, 3 pik
 * @property {number} rank     1 (as) .. 7, 8 (walet), 9 (dama), 10 (król)
 * @property {boolean} up      odkryta?
 * @property {HTMLElement} el
 * @property {number} x        ostatnia pozycja na stole (px)
 * @property {number} y
 */
/**
 * @typedef {Object} SolPile
 * @property {'stock'|'waste'|'found'|'tab'} kind
 * @property {number} i
 * @property {SolCard[]} arr
 */

// do testów z konsoli przeglądarki (ustawiane, gdy okno jest otwarte)
/** @type {any} */
var hbSolitaire = null;

const solRed = (/** @type {SolCard} */ c) => c.suit < 2;

function openSolitaire() {
    if (reuseWin('solitaire')) return;

    // ----- stan gry -----
    const mk = (kind, i) => /** @type {SolPile} */ ({ kind, i, arr: [] });
    const st = {
        s: 2,                                   // aktualna skala kart
        ox: 0,                                  // przesunięcie, żeby karty były na środku
        draw: localStorage.getItem(SOL.STORE_KEY) === '3' ? 3 : 1,
        stock: mk('stock', 0),
        waste: mk('waste', 0),
        found: [0, 1, 2, 3].map((i) => mk('found', i)),
        tab: [0, 1, 2, 3, 4, 5, 6].map((i) => mk('tab', i)),
        score: 0,
        time: 0,
        started: false,
        won: false,
        fan: 0,                                 // Draw Three: ile kart z ostatniego dobrania leży wachlarzem
        winnable: true,                         // czy solver potwierdził, że rozdanie da się wygrać
        /** @type {any[]} */
        undo: [],
    };
    /** @type {SolPile[]} */
    const piles = [st.stock, st.waste, ...st.found, ...st.tab];
    let timerId = 0;

    // ----- układ okna -----
    const body = el('div', 'sol');
    const menu = el('div', 'menubar');
    const table = el('div', 'sol-table');
    table.tabIndex = 0;
    table.setAttribute('aria-label', 'Solitaire table');
    const status = el('div', 'statusbar');
    const stScore = el('span', '', '');
    const stTime = el('span', 'sol-time', '');
    status.append(stScore, stTime);
    body.append(menu, table, status);

    // puste miejsca: talia, 4 stosy docelowe, 7 kolumn
    const mkSlot = (/** @type {SolPile} */ p, html) => {
        const s = el('div', 'sol-slot');
        s.dataset.kind = p.kind;
        if (html) s.innerHTML = html;
        table.appendChild(s);
        return s;
    };
    const slots = new Map();
    slots.set(st.stock, mkSlot(st.stock, solGlyphSvg(SOL_RING_GLYPH, 'sol-ring')));
    slots.set(st.waste, null);
    st.found.forEach((p) => slots.set(p, mkSlot(p, '<b>A</b>')));
    st.tab.forEach((p) => slots.set(p, mkSlot(p, '')));

    // ----- 40 kart (elementy DOM tworzone raz, potem tylko przesuwane) -----
    /** @type {SolCard[]} */
    const cards = [];
    for (let suit = 0; suit < 4; suit++) {
        for (let rank = 1; rank <= SOL_RANK_COUNT; rank++) {
            const e = el('div', 'sol-card ' + (suit < 2 ? 'red' : 'black'));
            const idx = (cls) => {
                const s = el('span', 'sol-idx ' + cls);
                s.append(el('b', '', SOL_RANKS[rank]));
                s.insertAdjacentHTML('beforeend', solGlyphSvg(SOL_SUIT_GLYPHS[suit], 'sol-suit'));
                return s;
            };
            const art = el('i', 'sol-art');
            const a = solArtIndex(suit, rank);
            art.style.backgroundPosition =
                `calc(var(--s) * ${-(a % SOL.SHEET_COLS) * SOL.ART_W}px) calc(var(--s) * ${-Math.floor(a / SOL.SHEET_COLS) * SOL.ART_H}px)`;
            e.append(idx('tl'), art, idx('br'));
            e.dataset.id = String(cards.length);
            e.setAttribute('aria-label', `${SOL_RANK_NAMES[rank]} of ${SOL_SUIT_NAMES[suit]}`);
            table.appendChild(e);
            cards.push({ id: cards.length, suit, rank, up: false, el: e, x: 0, y: 0 });
        }
    }

    // ----- pozycje na stole -----
    const colX = (i) => st.ox + i * (SOL.CARD_W + SOL.GAP) * st.s;
    const topY = () => SOL.MARGIN * st.s;
    const tabY = () => (SOL.MARGIN + SOL.CARD_H + SOL.ROW_GAP) * st.s;
    /** lewy górny róg pustego miejsca danego stosu */
    const pileXY = (/** @type {SolPile} */ p) => {
        if (p.kind === 'stock') return [colX(0), topY()];
        if (p.kind === 'waste') return [colX(1), topY()];
        if (p.kind === 'found') return [colX(3 + p.i), topY()];
        return [colX(p.i), tabY()];
    };

    // największa całkowita skala, przy której cały stół się mieści
    const fit = () => {
        const w = table.clientWidth, h = table.clientHeight;
        if (!w || !h) return;
        const needW = 7 * SOL.CARD_W + 6 * SOL.GAP + 2 * SOL.MARGIN;
        const needH = SOL.MARGIN * 2 + SOL.CARD_H * 2 + SOL.ROW_GAP + 6 * SOL.DOWN_STEP + 4 * SOL.MIN_UP_STEP;
        st.s = clamp(Math.floor(Math.min(w / needW, h / needH)), 1, SOL.MAX_SCALE);
        table.style.setProperty('--s', String(st.s));
        st.ox = Math.floor((w - (7 * SOL.CARD_W + 6 * SOL.GAP) * st.s) / 2);
        slots.forEach((s, p) => {
            if (!s) return;
            const [x, y] = pileXY(p);
            s.style.transform = `translate(${x}px, ${y}px)`;
        });
        render();
    };

    /**
     * @param {SolCard} c
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    const put = (c, x, y, z) => {
        c.x = x;
        c.y = y;
        c.el.style.transform = `translate(${x}px, ${y}px)`;
        c.el.style.zIndex = String(z);
        c.el.classList.toggle('down', !c.up);
    };

    // ustawia wszystkie karty tam, gdzie są w stanie gry
    function render() {
        const s = st.s;
        const [sx, sy] = pileXY(st.stock);
        st.stock.arr.forEach((c, i) => put(c, sx, sy, 1 + i));
        const [wx, wy] = pileXY(st.waste);
        const n = st.waste.arr.length;
        // Draw Three jak w Windows: wachlarzem leżą tylko karty z ostatniego dobrania (po zagraniu
        // jednej zostają 2, potem 1); starsze leżą pod spodem w stosie
        const fan = st.draw === 3 ? n - Math.min(n, st.fan) : n;
        st.waste.arr.forEach((c, i) => put(c, wx + (i >= fan ? (i - fan) * SOL.WASTE_STEP * s : 0), wy, 100 + i));
        st.found.forEach((p) => {
            const [fx, fy] = pileXY(p);
            p.arr.forEach((c, i) => put(c, fx, fy, 200 + i));
        });
        const h = table.clientHeight;
        st.tab.forEach((p) => {
            const [x, y0] = pileXY(p);
            const downs = p.arr.filter((c) => !c.up).length;
            const ups = p.arr.length - downs;
            // długa kolumna: odkryte karty ściskają się, żeby zmieścić się w oknie
            let up = SOL.UP_STEP * s;
            const avail = h - y0 - (SOL.CARD_H + SOL.MARGIN) * s - downs * SOL.DOWN_STEP * s;
            if (ups > 1 && (ups - 1) * up > avail) up = Math.max(SOL.MIN_UP_STEP * s, Math.floor(avail / (ups - 1)));
            let y = y0;
            p.arr.forEach((c, i) => {
                put(c, x, y, 300 + i);
                y += c.up ? up : SOL.DOWN_STEP * s;
            });
        });
        updateStatus();
    }

    function updateStatus() {
        stScore.textContent = `Score: ${st.score}`;
        stTime.textContent = `Time: ${st.time}`;
    }

    // ----- zasady -----
    /** @param {SolCard} c */
    const locate = (c) => {
        for (const p of piles) {
            const idx = p.arr.indexOf(c);
            if (idx >= 0) return { p, idx };
        }
        return null;
    };

    // czy można podnieść karty od pozycji idx (w kolumnie: odkryty ciąg malejący, kolory na zmianę)
    /**
     * @param {SolPile} p
     * @param {number} idx
     */
    function canPick(p, idx) {
        if (idx < 0 || idx >= p.arr.length) return false;
        if (p.kind === 'stock') return false;
        if (p.kind !== 'tab') return idx === p.arr.length - 1;
        for (let k = idx; k < p.arr.length; k++) {
            const c = p.arr[k];
            if (!c.up) return false;
            const nx = p.arr[k + 1];
            if (nx && (nx.rank !== c.rank - 1 || solRed(nx) === solRed(c))) return false;
        }
        return true;
    }

    // czy karty (pierwsza = najwyższa) można położyć na stos
    /**
     * @param {SolCard[]} moving
     * @param {SolPile} dst
     */
    function canDrop(moving, dst) {
        const lead = moving[0];
        const top = dst.arr[dst.arr.length - 1];
        if (dst.kind === 'found') {
            if (moving.length !== 1) return false;
            return top ? top.suit === lead.suit && lead.rank === top.rank + 1 : lead.rank === 1;
        }
        if (dst.kind === 'tab') {
            if (!top) return lead.rank === SOL_RANK_COUNT;   // na puste miejsce tylko król
            return top.up && lead.rank === top.rank - 1 && solRed(lead) !== solRed(top);
        }
        return false;
    }

    // ----- cofanie (Ctrl+Z): zapis całego stanu przed każdym ruchem -----
    const snap = () => ({
        piles: piles.map((p) => p.arr.map((c) => c.id)),
        up: cards.map((c) => c.up),
        score: st.score,
        fan: st.fan,
    });
    const pushUndo = () => {
        st.undo.push(snap());
        if (st.undo.length > SOL.UNDO_MAX) st.undo.shift();
    };
    function undo() {
        if (st.won || !st.undo.length) return;
        const u = st.undo.pop();
        piles.forEach((p, i) => { p.arr = u.piles[i].map((id) => cards[id]); });
        cards.forEach((c, i) => { c.up = u.up[i]; });
        st.score = u.score;
        st.fan = u.fan;
        render();
    }

    // ----- zegar (działa tylko w trakcie gry; nic nie kręci się w tle) -----
    const startTimer = () => {
        if (st.started || st.won) return;
        st.started = true;
        timerId = window.setInterval(() => { st.time++; updateStatus(); }, 1000);
    };
    const stopTimer = () => { clearInterval(timerId); timerId = 0; };

    // ----- ruchy -----
    /**
     * przenosi karty od pozycji idx stosu src na stos dst
     * @param {SolPile} src
     * @param {number} idx
     * @param {SolPile} dst
     * @returns {boolean} czy ruch był dozwolony
     */
    function move(src, idx, dst) {
        if (st.won || src === dst || !canPick(src, idx)) return false;
        if (src.kind === 'found' && dst.kind === 'found') return false;   // as między pustymi stosami = nabijanie punktów
        const moving = src.arr.slice(idx);
        if (!canDrop(moving, dst)) return false;
        startTimer();
        pushUndo();
        src.arr.splice(idx);
        dst.arr.push(...moving);
        if (src.kind === 'waste') st.fan = st.waste.arr.length ? Math.max(1, st.fan - 1) : 0;
        if (dst.kind === 'found') st.score += SOL.PTS_TO_FOUND;
        else if (src.kind === 'waste') st.score += SOL.PTS_WASTE_TAB;
        else if (src.kind === 'found') st.score += SOL.PTS_FOUND_TAB;
        // odsłonięta zakryta karta w kolumnie odwraca się sama
        const top = src.arr[src.arr.length - 1];
        if (src.kind === 'tab' && top && !top.up) { top.up = true; st.score += SOL.PTS_FLIP; }
        st.score = Math.max(0, st.score);
        render();
        if (st.found.every((p) => p.arr.length === SOL_RANK_COUNT)) win();   // 4 x 10 = cała talia
        return true;
    }

    // klik w talię: dobierz 1 (albo 3) karty, a gdy talia pusta - przełóż odłożone z powrotem
    function drawCards() {
        if (st.won) return;
        if (!st.stock.arr.length) {
            if (!st.waste.arr.length) return;
            startTimer();
            pushUndo();
            const back = st.waste.arr.splice(0).reverse();
            back.forEach((c) => { c.up = false; });
            st.stock.arr.push(...back);
            st.fan = 0;
            st.score = Math.max(0, st.score + (st.draw === 1 ? SOL.PTS_RECYCLE_1 : SOL.PTS_RECYCLE_3));
        } else {
            startTimer();
            pushUndo();
            st.fan = 0;
            for (let k = 0; k < st.draw && st.stock.arr.length; k++) {
                const c = st.stock.arr.pop();
                c.up = true;
                st.waste.arr.push(c);
                st.fan++;
            }
        }
        render();
    }

    // podwójny klik: karta z wierzchu leci na pasujący stos docelowy
    /** @param {SolCard} c */
    function toFoundation(c) {
        const at = locate(c);
        if (!at || at.idx !== at.p.arr.length - 1 || at.p.kind === 'found' || !c.up) return false;
        return st.found.some((f) => move(at.p, at.idx, f));
    }

    // nowe rozdanie: tasowanie (Fisher-Yates), 7 kolumn (1..7 kart = 28, ostatnia odkryta),
    // reszta (12) w talii; solver sprawdza, czy da się wygrać - jak nie, tasujemy jeszcze raz
    function newDeal() {
        stopFx();
        stopTimer();
        const { deal, winnable } = solWinnableDeal(Math.random);
        piles.forEach((p) => { p.arr = []; });
        cards.forEach((c) => { c.up = false; c.el.classList.remove('gone'); });
        deal.tab.forEach((col, i) => { st.tab[i].arr = col.map((id) => cards[id]); });
        st.tab.forEach((p) => { p.arr[p.arr.length - 1].up = true; });
        st.stock.arr = deal.stock.map((id) => cards[id]);
        st.winnable = winnable;
        st.fan = 0;
        st.score = 0;
        st.time = 0;
        st.started = false;
        st.won = false;
        st.undo = [];
        render();
    }

    // ----- przeciąganie (pointer events + transform, maks. 1 przesunięcie na klatkę) -----
    /** @type {{p: SolPile, idx: number, moving: SolCard[], sx: number, sy: number, dx: number, dy: number, active: boolean}|null} */
    let drag = null;
    let dragQueued = false;
    const applyDrag = () => {
        dragQueued = false;
        if (!drag || !drag.active) return;
        drag.moving.forEach((c) => { c.el.style.transform = `translate(${c.x + drag.dx}px, ${c.y + drag.dy}px)`; });
    };

    // gdzie upuścić: stos, z którym przeciągana karta pokrywa się najbardziej (i ruch jest dozwolony)
    function dropTarget() {
        const lead = drag.moving[0];
        const w = SOL.CARD_W * st.s, h = SOL.CARD_H * st.s;
        const lx = lead.x + drag.dx, ly = lead.y + drag.dy;
        let best = null, bestArea = 0;
        [...st.found, ...st.tab].forEach((p) => {
            if (p === drag.p || !canDrop(drag.moving, p)) return;
            const top = p.arr[p.arr.length - 1];
            const [px, py] = top ? [top.x, top.y] : pileXY(p);
            const ox = Math.min(lx + w, px + w) - Math.max(lx, px);
            const oy = Math.min(ly + h, py + h) - Math.max(ly, py);
            const area = ox > 0 && oy > 0 ? ox * oy : 0;
            if (area > bestArea) { bestArea = area; best = p; }
        });
        return best;
    }

    table.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        table.focus({ preventScroll: true });
        if (fx) { finishFx(); return; }               // klik w trakcie animacji wygranej ją kończy
        const t = /** @type {HTMLElement} */ (e.target);
        const cardEl = /** @type {HTMLElement|null} */ (t.closest('.sol-card'));
        if (!cardEl) {
            if (t.closest('.sol-slot[data-kind="stock"]')) drawCards();
            return;
        }
        const c = cards[Number(cardEl.dataset.id)];
        const at = locate(c);
        if (!at) return;
        if (at.p.kind === 'stock') { drawCards(); return; }
        if (!canPick(at.p, at.idx)) return;
        // przechwycenie myszy dopiero przy ruchu - zwykły klik/dwuklik trafia wtedy w kartę
        drag = { p: at.p, idx: at.idx, moving: at.p.arr.slice(at.idx), sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, active: false };
    });
    table.addEventListener('pointermove', (e) => {
        if (!drag) return;
        if (!drag.active && !(e.buttons & 1)) { drag = null; return; }   // przycisk puszczony poza stołem
        drag.dx = e.clientX - drag.sx;
        drag.dy = e.clientY - drag.sy;
        if (!drag.active) {
            if (Math.hypot(drag.dx, drag.dy) < SOL.DRAG_PX) return;
            drag.active = true;
            table.setPointerCapture(e.pointerId);
            drag.moving.forEach((c, k) => { c.el.classList.add('dragging'); c.el.style.zIndex = String(2000 + k); });
        }
        if (!dragQueued) { dragQueued = true; requestAnimationFrame(applyDrag); }
    });
    const endDrag = (/** @type {boolean} */ drop) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (!d.active) return;
        d.moving.forEach((c) => c.el.classList.remove('dragging'));
        drag = d;
        const dst = drop ? dropTarget() : null;
        drag = null;
        if (!dst || !move(d.p, d.idx, dst)) render();   // niedozwolony ruch = karty wracają na miejsce
    };
    table.addEventListener('pointerup', () => endDrag(true));
    table.addEventListener('pointercancel', () => endDrag(false));
    table.addEventListener('dblclick', (e) => {
        const cardEl = /** @type {HTMLElement|null} */ ((/** @type {HTMLElement} */ (e.target)).closest('.sol-card'));
        if (cardEl) toFoundation(cards[Number(cardEl.dataset.id)]);
    });

    // ----- WYGRANA: karty po kolei wyskakują ze stosów i odbijają się, zostawiając ślad -----
    /** @type {{raf: number, cv: HTMLCanvasElement}|null} */
    let fx = null;
    let fxCanvas = null;
    const sheetImg = new Image();
    sheetImg.src = SOL.SHEET;

    // rysuje kartę na canvasie (te same kolory co w CSS - zmienne z :root)
    /** @param {SolCard} c */
    function cardBitmap(c, col) {
        const s = st.s, W = SOL.CARD_W, H = SOL.CARD_H;
        const cv = document.createElement('canvas');
        cv.width = W * s;
        cv.height = H * s;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        const box = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x * s, y * s, w * s, h * s); };
        box(0, 0, W, H, col.edge);
        box(1, 1, W - 2, H - 2, col.face);
        [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].forEach(([x, y]) => g.clearRect(x * s, y * s, s, s));
        box(SOL.ART_X - 1, SOL.ART_Y - 1, SOL.ART_W + 2, SOL.ART_H + 2, col.artEdge);
        const a = solArtIndex(c.suit, c.rank);
        g.drawImage(sheetImg, (a % SOL.SHEET_COLS) * SOL.ART_W, Math.floor(a / SOL.SHEET_COLS) * SOL.ART_H, SOL.ART_W, SOL.ART_H,
            SOL.ART_X * s, SOL.ART_Y * s, SOL.ART_W * s, SOL.ART_H * s);
        const ink = solRed(c) ? col.red : col.black;
        const index = () => {
            g.fillStyle = ink;
            g.font = `${8 * s}px ${col.font}`;
            g.textBaseline = 'top';
            const label = SOL_RANKS[c.rank];
            g.fillText(label, SOL.IDX_X * s, SOL.IDX_Y * s);
            const gx = SOL.IDX_X + Math.round(g.measureText(label).width / s) + 1;
            SOL_SUIT_GLYPHS[c.suit].forEach((row, y) => {
                for (let x = 0; x < row.length; x++) if (row[x] === '#') box(gx + x, SOL.IDX_Y + y, 1, 1, ink);
            });
        };
        index();
        g.save();
        g.translate(W * s, H * s);
        g.rotate(Math.PI);                       // dolny prawy róg = ten sam napis do góry nogami
        index();
        g.restore();
        return cv;
    }

    function startFx() {
        stopFx();
        const css = getComputedStyle(table);
        const v = (n) => css.getPropertyValue(n).trim();
        const col = { edge: v('--card-edge'), face: v('--card-face'), artEdge: v('--card-art-edge'), red: v('--card-red'), black: v('--card-black'), font: v('--font') };
        const W = table.clientWidth, H = table.clientHeight, s = st.s;
        const cv = /** @type {HTMLCanvasElement} */ (el('canvas', 'sol-fx'));
        cv.width = W;
        cv.height = H;
        table.appendChild(cv);
        fxCanvas = cv;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        // kolejność jak w Windows: najpierw królowie ze wszystkich stosów, potem damy... aż do asów
        /** @type {SolCard[]} */
        const queue = [];
        for (let r = SOL_RANK_COUNT - 1; r >= 0; r--) st.found.forEach((p) => queue.push(p.arr[r]));
        const cw = SOL.CARD_W * s, ch = SOL.CARD_H * s;
        /** @type {{c: SolCard, img: HTMLCanvasElement, x: number, y: number, vx: number, vy: number}[]} */
        const flying = [];
        let last = performance.now();
        let nextLaunch = last;
        fx = { raf: 0, cv };
        const frame = (now) => {
            if (!fx) return;
            const k = Math.min(3, (now - last) / (1000 / 60));   // ile "klatek 60 Hz" minęło
            last = now;
            if (queue.length && now >= nextLaunch) {
                const c = queue.shift();
                c.el.classList.add('gone');                     // karta znika ze stosu i leci
                const dir = Math.random() < 0.5 ? -1 : 1;
                flying.push({
                    c, img: cardBitmap(c, col), x: c.x, y: c.y,
                    vx: dir * (SOL.FX_VX_MIN + Math.random() * (SOL.FX_VX_MAX - SOL.FX_VX_MIN)) * s,
                    vy: -Math.random() * SOL.FX_VY_MAX * s,
                });
                nextLaunch = now + SOL.FX_LAUNCH_MS;
            }
            for (let i = flying.length - 1; i >= 0; i--) {
                const f = flying[i];
                f.vy += SOL.FX_GRAVITY * s * k;
                f.x += f.vx * k;
                f.y += f.vy * k;
                if (f.y + ch > H) { f.y = H - ch; f.vy = -f.vy * SOL.FX_BOUNCE; }
                g.drawImage(f.img, Math.round(f.x), Math.round(f.y));   // bez czyszczenia = ślad
                if (f.x + cw < 0 || f.x > W) flying.splice(i, 1);
            }
            if (!queue.length && !flying.length) { finishFx(); return; }
            fx.raf = requestAnimationFrame(frame);
        };
        fx.raf = requestAnimationFrame(frame);
    }
    // koniec animacji (sama albo klik): zostaje obrazek ze śladami + okienko z gratulacjami
    function finishFx() {
        if (!fx) return;
        cancelAnimationFrame(fx.raf);
        fx = null;
        cards.forEach((c) => c.el.classList.add('gone'));
        showMessage({
            id: 'sol-win', title: 'Solitaire', icon: 'assets/icons/solitaire.png',
            text: 'You win! Happy Birthday!',
            buttons: [{ label: 'Deal Again', action: newDeal }, { label: 'OK' }],
        });
    }
    function stopFx() {
        if (fx) cancelAnimationFrame(fx.raf);
        fx = null;
        if (fxCanvas) fxCanvas.remove();
        fxCanvas = null;
        const w = wins.get('sol-win');
        if (w) closeWin(w);
    }

    function win() {
        st.won = true;
        stopTimer();
        if (st.time > 30) st.score += Math.floor(SOL.BONUS_TIME / st.time);
        updateStatus();
        stTime.textContent = `Time: ${st.time}  You win!`;
        startFx();
    }

    // ----- menu (Game działa, Help pokazuje krótką instrukcję) -----
    /** @type {HTMLElement|null} */
    let openPop = null;
    /** @type {HTMLElement|null} */
    let openTitle = null;                  // podświetlony tytuł otwartego menu
    const closePop = () => {
        if (openPop) { openPop.remove(); openPop = null; }
        if (openTitle) { openTitle.classList.remove('open'); openTitle = null; }
    };
    const setDraw = (n) => {
        st.draw = n;
        localStorage.setItem(SOL.STORE_KEY, String(n));
        newDeal();
    };
    const about = () => showMessage({
        id: 'sol-about', title: 'About Solitaire', icon: 'assets/icons/solitaire.png',
        text: 'Solitaire - Klondike with a 40-card deck. Made with love for your birthday!',
    });
    /** @type {Record<string, (() => [string, string, () => void, boolean?] | null)[]>} */
    const MENUS = {
        Game: [
            () => ['Deal', 'F2', newDeal],
            () => ['Undo', 'Ctrl+Z', undo],
            () => null,
            () => ['Draw One', '', () => setDraw(1), st.draw === 1],
            () => ['Draw Three', '', () => setDraw(3), st.draw === 3],
            () => null,
            () => ['Exit', '', () => closeWin(win95)],
        ],
        Help: [() => ['How to Play', 'F1', solHowToPlay], () => null, () => ['About Solitaire', '', about]],
    };
    Object.entries(MENUS).forEach(([name, items]) => {
        const m = el('span', '', name);
        const show = () => {
            closePop();
            const pop = el('div', 'menu-pop raised');
            pop.dataset.menu = name;
            items.forEach((get) => {
                const it = get();
                if (!it) { pop.appendChild(el('div', 'menu-sep')); return; }
                const row = el('div', 'menu-item');
                const label = el('span', 'sol-menu-label');
                const check = el('span', 'sol-check');
                if (it[3]) check.innerHTML = solGlyphSvg(SOL_CHECK_GLYPH, 'sol-check-svg');
                label.append(check, el('span', '', it[0]));
                row.append(label, el('span', 'menu-key', it[1]));
                row.addEventListener('click', () => { closePop(); it[2](); });
                pop.appendChild(row);
            });
            pop.style.left = m.offsetLeft + 'px';
            pop.style.top = (m.offsetTop + m.offsetHeight) + 'px';
            win95.el.appendChild(pop);
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
        menu.appendChild(m);
    });
    const outside = (e) => { if (openPop && !openPop.contains(/** @type {Node} */ (e.target))) closePop(); };
    document.addEventListener('pointerdown', outside);
    // Esc zamyka menu także wtedy, gdy fokus nie jest w oknie (klik w tytuł menu)
    const escMenu = (e) => { if (e.key === 'Escape' && openPop) closePop(); };
    document.addEventListener('keydown', escMenu);

    // skala kart przeliczana tylko przy zmianie rozmiaru okna (□, przeciąganie okna przeglądarki)
    const ro = new ResizeObserver(() => fit());

    const win95 = openWindow({
        id: 'solitaire', title: 'Solitaire', icon: 'assets/icons/solitaire.png', body,
        w: SOL.WIN_W, h: SOL.WIN_H,
        onClose: () => {
            stopFx();
            stopTimer();
            ro.disconnect();
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escMenu);
            hbSolitaire = null;
        },
    });

    // ----- skróty klawiszowe (gdy fokus jest w oknie pasjansa) -----
    win95.el.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        else if (e.key === 'F2') { e.preventDefault(); newDeal(); }
        else if (e.key === 'F1') { e.preventDefault(); solHowToPlay(); }
        else if (e.key === 'Escape') closePop();
    });

    // do testów z konsoli: stan, ruch, wymuszona wygrana
    hbSolitaire = {
        st, cards, piles, move, drawCards, undo, newDeal, toFoundation, canPick, canDrop, render, locate,
        // solver od bieżącego stanu (talia + odłożone = zbiór; tylko do testów / auto-gry)
        solveNow: (ms = 2000) => solSolve({
            cols: st.tab.map((p) => ({ down: p.arr.filter((c) => !c.up).map((c) => c.id), up: p.arr.filter((c) => c.up).map((c) => c.id) })),
            found: st.found.map((p) => p.arr.length),
            talon: [...st.stock.arr, ...st.waste.arr].map((c) => c.id).sort((x, y) => x - y),
        }, ms),
        // wszystkie karty na stosy docelowe -> animacja wygranej
        debugWin: () => {
            piles.forEach((p) => { p.arr = []; });
            cards.forEach((c) => { c.up = true; st.found[c.suit].arr.push(c); });
            render();
            win();
        },
    };

    newDeal();
    ro.observe(table);
    fit();
    table.focus({ preventScroll: true });
    // pierwsze uruchomienie: instrukcja na wierzchu (potem tylko Help > How to Play / F1)
    if (!localStorage.getItem(SOL.HELP_KEY)) solHowToPlay();
}
