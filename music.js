// =====================================================================
//  ODTWARZACZ MP3 "Music Player" + ekran zgody na dźwięk + głośnik w zasobniku
//  Korzysta z systemu okien z desktop.js (openWindow, reuseWin, el...),
//  więc musi być wczytany PO desktop.js.
//
//  Pliki z muzyką wrzuć do folderu assets/music/ (nazwy DOKŁADNIE takie, małymi literami):
//    luna.mp3     - utwór 1 (+ okładka luna-cover.png, pixel art 80x80)
//    track2.mp3   - utwór 2
//    track3.mp3   - utwór 3
//  Brakujący plik nic nie psuje: na liście ma dopisek "file missing" i jest pomijany.
// =====================================================================

const ARTIST = 'Unknown Artist'; // TUTAJ wpisz autora

// PLAYLISTA - jeden obiekt = jeden utwór (kolejność = kolejność na liście).
//   title  - tytuł widoczny w odtwarzaczu i na liście (zmień 'Track 2' / 'Track 3' na prawdziwe)
//   artist - wykonawca
//   src    - ścieżka do pliku mp3 (względna, np. 'assets/music/track2.mp3')
//   cover  - okładka (NIEOBOWIĄZKOWA: bez niej albo gdy pliku brak, pokaże się luna-cover.png)
// Kolejny utwór = skopiuj obiekt i dopisz go na końcu listy.
const TRACKS = [
    {
        title: 'Lullaby of the New Moon (I): Somnias a Luna',
        artist: ARTIST,
        src: 'assets/music/luna.mp3',
        cover: 'assets/music/luna-cover.png',
    },
    {
        title: 'Alhaitham Trailer OST EXTENDED - The Exquisite Night Chimes',
        artist: ARTIST,
        src: 'assets/music/track2.mp3',
        // cover: 'assets/music/track2-cover.png',
    },
    {
        title: 'Vodyanitsa Performs in an Opera - Full Song',
        artist: ARTIST,
        src: 'assets/music/track3.mp3',
        // cover: 'assets/music/track3-cover.png',
    },
    {
        title: 'The World at Bay Beyond the Pillow',
        artist: ARTIST,
        src: 'assets/music/track4.mp3',
        // cover: 'assets/music/track4-cover.png',
    },
];

const MUSIC = {
    VOLUME_DEFAULT: 60,          // głośność na start (0-100), potem pamiętana w localStorage
    VOLUME_KEY: 'hb-volume',     // klucz w localStorage
    VOLUME_STEP: 5,              // strzałki na suwaku głośności
    SEEK_STEP: 5,                // strzałki na pasku postępu (sekundy)
    WIN_W: 560,                  // rozmiar okna odtwarzacza
    WIN_H: 436,                  // (z listą utworów)
    BARS: 16,                    // słupki "equalizera"
    VIS_W: 48,                   // płótno equalizera w pixelach (powiększane x2 w CSS)
    VIS_H: 16,
    VIS_FPS: 20,                 // equalizer odświeża się 20 razy na sekundę (tylko gdy gra muzyka)
    COVER_DEFAULT: 'assets/music/luna-cover.png', // okładka dla utworów bez własnej
    ICON: 'assets/icons/music.png',
    SPEAKER_ICON: 'assets/icons/speaker.png',
};

// pixelowe ikonki przycisków ('#' = pixel, rysowane x2 przez glyphSvg)
const MUSIC_GLYPHS = {
    play:  ['#.....', '###...', '#####.', '######', '#####.', '###...', '#.....'],
    pause: ['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##'],
    stop:  ['######', '######', '######', '######', '######', '######'],
    prev:  ['#...#', '#..##', '#.###', '#####', '#.###', '#..##', '#...#'],
    next:  ['#...#', '##..#', '###.#', '#####', '###.#', '##..#', '#...#'],
    loop:  ['.#####.', '#.....#', '#......', '#...#..', '....##.', '.#####.', '....##.', '....#..'],
    speaker: ['...#....', '..##..#.', '####.#.#', '####.#.#', '####.#.#', '..##..#.', '...#....'],
    muted:   ['...#....', '..##....', '####.#.#', '####..#.', '####.#.#', '..##....', '...#....'],
    note:    ['..###', '..#.#', '..#..', '..#..', '###..', '###..'],
};

// =====================================================================
//  JEDEN WSPÓLNY ODTWARZACZ AUDIO (inne części strony mogą go używać)
// =====================================================================

const musicAudio = new Audio();
musicAudio.preload = 'metadata';
let musicIndex = 0;           // który utwór z TRACKS
/** @type {'one' | 'all' | 'off'} powtarzanie: ten utwór (domyślnie) / cała lista / wyłączone */
let musicLoop = 'one';
let musicWantPlay = false;    // użytkownik chce słuchać (wtedy brakujące pliki są pomijane)
/** @type {('?' | 'ok' | 'missing')[]} czy plik utworu istnieje ('?' = jeszcze nie wiadomo) */
const trackState = TRACKS.map(() => /** @type {'?'} */ ('?'));
const trackDur = TRACKS.map(() => NaN);   // długości utworów (do listy)
let musicMuted = false;
let musicError = '';          // np. 'File not found: ...'
let musicHint = '';           // np. 'Press Play to start'
let musicVolume = MUSIC.VOLUME_DEFAULT;
try {
    const v = parseInt(localStorage.getItem(MUSIC.VOLUME_KEY), 10);
    if (v >= 0 && v <= 100) musicVolume = v;
} catch (err) { /* bez localStorage głośność wraca do domyślnej */ }
musicAudio.volume = musicVolume / 100;
musicAudio.loop = musicLoop === 'one';

/** @type {Set<() => void>} odświeżacze widoków (okno odtwarzacza, zasobnik) */
const musicViews = new Set();
const musicRefresh = () => musicViews.forEach((f) => f());

/**
 * najbliższy utwór w kierunku dir (1 / -1), który nie jest oznaczony jako brakujący
 * (może to być ten sam utwór, gdy reszta nie istnieje); -1 = żaden plik nie istnieje
 * @param {number} from
 * @param {number} dir
 */
function musicFind(from, dir) {
    const n = TRACKS.length;
    for (let k = 1; k <= n; k++) {
        const j = (((from + dir * k) % n) + n) % n;
        if (trackState[j] !== 'missing') return j;
    }
    return -1;
}
/** @param {number} i */
function musicLoad(i) {
    musicIndex = (i + TRACKS.length) % TRACKS.length;
    const t = TRACKS[musicIndex];
    musicError = '';
    musicHint = '';
    if (musicAudio.getAttribute('src') !== t.src) musicAudio.src = t.src;
    musicRefresh();
}

// play() musi być wywołane prosto z kliknięcia (przeglądarki blokują autoodtwarzanie)
function musicPlay() {
    musicWantPlay = true;
    if (!musicAudio.getAttribute('src')) musicLoad(musicIndex);
    if (musicAudio.error) musicAudio.load();          // druga próba po błędzie (np. plik już wrzucony)
    musicHint = '';
    return musicAudio.play().catch((err) => {
        if (err && err.name === 'NotAllowedError') musicHint = 'Press Play to start';
        musicRefresh();                                // brak pliku obsługuje zdarzenie 'error'
    });
}
function musicPause() { musicWantPlay = false; musicAudio.pause(); }
function musicStop() {
    musicWantPlay = false;
    musicAudio.pause();
    if (musicAudio.readyState > 0) musicAudio.currentTime = 0;
    musicRefresh();
}
function musicToggle() { if (musicAudio.paused) musicPlay(); else musicPause(); }
/** @param {number} v 0-100 */
function musicSetVolume(v) {
    musicVolume = Math.round(clamp(v, 0, 100));
    musicAudio.volume = musicVolume / 100;
    try { localStorage.setItem(MUSIC.VOLUME_KEY, String(musicVolume)); } catch (err) { /* jw. */ }
    musicRefresh();
}
/** @param {boolean} m */
function musicSetMuted(m) {
    musicMuted = m;
    musicAudio.muted = m;
    musicRefresh();
}
/** @param {'one' | 'all' | 'off'} l */
function musicSetLoop(l) {
    musicLoop = l;
    musicAudio.loop = l === 'one';      // jeden utwór w kółko robi sama przeglądarka
    musicRefresh();
}
// przycisk powtarzania: ten utwór -> cała lista -> wyłączone -> ...
const musicNextLoop = () => musicSetLoop(musicLoop === 'one' ? 'all' : musicLoop === 'all' ? 'off' : 'one');
/** |< i >| - poprzedni / następny istniejący utwór (od razu gra, bo to kliknięcie) @param {number} dir */
function musicStep(dir) {
    const j = musicFind(musicIndex, dir);
    if (j < 0) { musicError = 'No music files in assets/music/'; musicRefresh(); return; }
    musicLoad(j);
    musicPlay();
}
/** klik w utwór na liście (brakujący plik próbujemy jeszcze raz - może już jest) @param {number} i */
function musicPick(i) {
    if (trackState[i] === 'missing') trackState[i] = '?';
    musicLoad(i);
    musicPlay();
}

// sprawdzenie, które pliki istnieją (i ile trwają) - raz, przy pierwszym otwarciu odtwarzacza;
// osobne Audio tylko z metadanymi, nic nie gra
let musicProbed = false;
function musicProbe() {
    if (musicProbed) return;
    musicProbed = true;
    TRACKS.forEach((t, i) => {
        if (i === musicIndex || trackState[i] !== '?') return;   // bieżący sprawdza główny odtwarzacz
        const a = new Audio();
        a.preload = 'metadata';
        const done = () => { a.removeAttribute('src'); a.load(); musicRefresh(); };
        a.addEventListener('loadedmetadata', () => {
            trackState[i] = 'ok';
            trackDur[i] = a.duration;
            done();
        }, { once: true });
        a.addEventListener('error', () => {
            if (!a.getAttribute('src')) return;                  // to nasze "zwolnienie" pliku
            trackState[i] = 'missing';
            done();
        }, { once: true });
        a.src = t.src;
    });
}

// zdarzenia audio -> odświeżenie widoków
['play', 'pause', 'timeupdate', 'durationchange', 'loadedmetadata', 'seeked', 'waiting', 'playing']
    .forEach((ev) => musicAudio.addEventListener(ev, musicRefresh));
musicAudio.addEventListener('loadedmetadata', () => {
    trackState[musicIndex] = 'ok';
    trackDur[musicIndex] = musicAudio.duration;
});
musicAudio.addEventListener('error', () => {
    if (!musicAudio.getAttribute('src')) return;
    const missing = TRACKS[musicIndex].src;
    trackState[musicIndex] = 'missing';
    // miało grać -> przeskakujemy na następny istniejący plik (bez pętli: brakujące są już oznaczone)
    if (musicWantPlay) {
        const j = musicFind(musicIndex, 1);
        if (j >= 0) {
            musicLoad(j);
            musicPlay();
            musicHint = 'Skipped missing ' + missing.split('/').pop();
            musicRefresh();
            return;
        }
        musicWantPlay = false;
    }
    musicError = 'File missing: ' + missing;     // nie psuje strony, tylko pisze w statusie
    musicRefresh();
});
musicAudio.addEventListener('ended', () => {
    // (powtarzanie jednego utworu robi audio.loop, wtedy 'ended' nie przychodzi)
    if (musicLoop === 'all') {                   // cała lista w kółko
        const j = musicFind(musicIndex, 1);
        if (j >= 0) { musicLoad(j); musicPlay(); return; }
    } else {                                     // bez powtarzania: dalej do końca listy, potem stop
        for (let j = musicIndex + 1; j < TRACKS.length; j++) {
            if (trackState[j] !== 'missing') { musicLoad(j); musicPlay(); return; }
        }
    }
    musicStop();
});

function musicStatus() {
    if (musicError) return musicError;
    if (musicHint) return musicHint;
    if (!musicAudio.paused) return musicAudio.readyState < 3 ? 'Loading...' : 'Playing';
    return musicAudio.currentTime > 0 ? 'Paused' : 'Stopped';
}
/** @param {number} s */
const musicTime = (s) => (isFinite(s) && s >= 0
    ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    : '--:--');

// dla innych skryptów: window.hbMusic.play() itd.
/** @type {any} */ (window).hbMusic = {
    audio: musicAudio, tracks: TRACKS,
    play: musicPlay, pause: musicPause, stop: musicStop, open: () => openMusic(),
    next: () => musicStep(1), prev: () => musicStep(-1), pick: musicPick, setLoop: musicSetLoop,
    info: () => ({ index: musicIndex, loop: musicLoop, states: trackState.slice(), status: musicStatus() }),
};

// =====================================================================
//  PIXELOWY SUWAK (pasek postępu i głośność)
// =====================================================================

/**
 * @param {string} label
 * @param {(v: number, done: boolean) => void} onChange  v = 0..1, done = puszczony przycisk
 * @param {(v: number, dir: number) => number} onKey     strzałki: zwraca nową wartość 0..1
 */
function musicSlider(label, onChange, onKey) {
    const root = el('div', 'music-slider sunken');
    const fill = el('div', 'music-slider-fill');
    const thumb = el('div', 'music-slider-thumb raised');
    root.append(fill, thumb);
    root.tabIndex = 0;
    root.setAttribute('role', 'slider');
    root.setAttribute('aria-label', label);
    root.setAttribute('aria-valuemin', '0');
    root.setAttribute('aria-valuemax', '100');
    const s = { el: root, value: 0, dragging: false, disabled: false };
    const set = (v) => {
        s.value = clamp(v, 0, 1);
        root.style.setProperty('--v', String(s.value));
        root.setAttribute('aria-valuenow', String(Math.round(s.value * 100)));
    };
    const fromEvent = (e) => {
        const r = root.getBoundingClientRect();
        const t = thumb.offsetWidth;
        return clamp((e.clientX - r.left - t / 2) / (r.width - t), 0, 1);
    };
    root.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || s.disabled) return;
        s.dragging = true;
        root.setPointerCapture(e.pointerId);
        set(fromEvent(e));
        onChange(s.value, false);
    });
    root.addEventListener('pointermove', (e) => {
        if (!s.dragging) return;
        set(fromEvent(e));
        onChange(s.value, false);
    });
    const end = () => {
        if (!s.dragging) return;
        s.dragging = false;
        onChange(s.value, true);
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('keydown', (e) => {
        if (s.disabled) return;
        const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
        let v = null;
        if (dir) v = onKey(s.value, dir);
        else if (e.key === 'Home') v = 0;
        else if (e.key === 'End') v = 1;
        if (v === null) return;
        e.preventDefault();
        e.stopPropagation();
        set(v);
        onChange(s.value, true);
    });
    return Object.assign(s, { set });
}

/**
 * przycisk z pixelową ikonką
 * @param {string[]} glyph
 * @param {string} label
 * @param {() => void} action
 */
function musicBtn(glyph, label, action) {
    const b = /** @type {HTMLButtonElement} */ (el('button', 'win-btn music-btn'));
    b.innerHTML = glyphSvg(glyph);
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', action);
    return b;
}

// =====================================================================
//  OKNO ODTWARZACZA
// =====================================================================

function openMusic() {
    if (reuseWin('music')) return;
    if (!musicAudio.getAttribute('src')) musicLoad(musicIndex);
    musicProbe();

    const body = el('div', 'music');
    const top = el('div', 'music-top');
    const cover = /** @type {HTMLImageElement} */ (el('img', 'music-cover'));
    cover.alt = 'Cover art';
    // brak pliku okładki -> domyślna (raz, żeby nie zapętlić błędów)
    cover.addEventListener('error', () => {
        if (!cover.src.endsWith(MUSIC.COVER_DEFAULT)) cover.src = MUSIC.COVER_DEFAULT;
    });
    const lcd = el('div', 'music-lcd sunken');
    const title = el('div', 'music-title');
    const artist = el('div', 'music-artist');
    const timeRow = el('div', 'music-time-row');
    const timeNow = el('span', 'music-time');
    const timeAll = el('span', 'music-total');
    timeRow.append(timeNow, timeAll);
    const vis = /** @type {HTMLCanvasElement} */ (el('canvas', 'music-vis'));
    vis.width = MUSIC.VIS_W;
    vis.height = MUSIC.VIS_H;
    lcd.append(title, artist, timeRow, vis);
    top.append(cover, lcd);

    // pasek postępu: przeciąganie pokazuje czas, puszczenie przewija
    let seekPreview = -1;
    const seek = musicSlider('Seek', (v, done) => {
        const d = musicAudio.duration;
        if (!isFinite(d)) return;
        if (done) { musicAudio.currentTime = v * d; seekPreview = -1; }
        else seekPreview = v * d;
        refresh();
    }, (v, dir) => {
        const d = musicAudio.duration;
        return isFinite(d) ? (musicAudio.currentTime + dir * MUSIC.SEEK_STEP) / d : v;
    });
    seek.el.classList.add('music-seek');

    // przyciski
    const controls = el('div', 'music-controls');
    const prevBtn = musicBtn(MUSIC_GLYPHS.prev, 'Previous', () => musicStep(-1));
    const playBtn = musicBtn(MUSIC_GLYPHS.play, 'Play', musicToggle);
    const stopBtn = musicBtn(MUSIC_GLYPHS.stop, 'Stop', musicStop);
    const nextBtn = musicBtn(MUSIC_GLYPHS.next, 'Next', () => musicStep(1));
    const loopBtn = musicBtn(MUSIC_GLYPHS.loop, 'Loop', musicNextLoop);
    loopBtn.classList.add('music-loop');
    const loopTag = el('span', 'music-loop-tag');
    const muteBtn = musicBtn(MUSIC_GLYPHS.speaker, 'Mute', () => musicSetMuted(!musicMuted));
    controls.append(prevBtn, playBtn, stopBtn, nextBtn, el('span', 'music-gap'), loopBtn, muteBtn);

    // głośność
    const volRow = el('div', 'music-vol-row');
    const volVal = el('span', 'music-vol-val');
    const vol = musicSlider('Volume', (v) => musicSetVolume(v * 100),
        (v, dir) => (musicVolume + dir * MUSIC.VOLUME_STEP) / 100);
    volRow.append(el('span', 'music-vol-label', 'Volume'), vol.el, volVal);

    // lista utworów: klik = graj ten utwór
    const list = el('div', 'music-list sunken');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Playlist');
    const rows = TRACKS.map((t, i) => {
        const row = /** @type {HTMLButtonElement} */ (el('button', 'music-row'));
        row.setAttribute('role', 'listitem');
        const name = el('span', 'music-row-title', `${i + 1}. ${t.title}`);
        const len = el('span', 'music-row-len');
        row.append(name, len);
        row.addEventListener('click', () => musicPick(i));
        return { row, len };
    });
    list.append(...rows.map((r) => r.row));

    const status = el('div', 'statusbar');
    const stText = el('span', '');
    status.append(stText);
    body.append(top, seek.el, controls, volRow, list, status);

    // odświeżenie widoku (wywoływane przez zdarzenia audio, bez pętli)
    let lastSrc = '';
    const refresh = () => {
        const t = TRACKS[musicIndex];
        if (lastSrc !== t.src) {
            lastSrc = t.src;
            cover.src = t.cover || MUSIC.COVER_DEFAULT;
            title.textContent = t.title;
            artist.textContent = t.artist;
        }
        const d = musicAudio.duration;
        const now = seekPreview >= 0 ? seekPreview : musicAudio.currentTime;
        timeNow.textContent = musicTime(now);
        timeAll.textContent = '/ ' + musicTime(d);
        seek.disabled = !isFinite(d);
        seek.el.classList.toggle('disabled', seek.disabled);
        if (!seek.dragging) seek.set(isFinite(d) && d > 0 ? now / d : 0);
        if (!vol.dragging) vol.set(musicVolume / 100);
        volVal.textContent = musicVolume + '%';
        const playing = !musicAudio.paused;
        playBtn.innerHTML = glyphSvg(playing ? MUSIC_GLYPHS.pause : MUSIC_GLYPHS.play);
        playBtn.title = playing ? 'Pause' : 'Play';
        playBtn.setAttribute('aria-label', playBtn.title);
        playBtn.classList.toggle('pressed', playing);
        loopBtn.innerHTML = glyphSvg(MUSIC_GLYPHS.loop);
        loopTag.textContent = musicLoop === 'one' ? '1' : musicLoop === 'all' ? 'ALL' : '';
        if (musicLoop !== 'off') loopBtn.appendChild(loopTag);
        loopBtn.classList.toggle('pressed', musicLoop !== 'off');
        loopBtn.setAttribute('aria-pressed', String(musicLoop !== 'off'));
        loopBtn.title = musicLoop === 'one' ? 'Loop: this track' : musicLoop === 'all' ? 'Loop: whole playlist' : 'Loop: off';
        rows.forEach(({ row, len }, i) => {
            const miss = trackState[i] === 'missing';
            row.classList.toggle('now', i === musicIndex);
            row.classList.toggle('missing', miss);
            if (i === musicIndex) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
            const txt = miss ? 'file missing' : musicTime(i === musicIndex && isFinite(d) ? d : trackDur[i]);
            if (len.textContent !== txt) len.textContent = txt;
        });
        muteBtn.innerHTML = glyphSvg(musicMuted ? MUSIC_GLYPHS.muted : MUSIC_GLYPHS.speaker);
        muteBtn.classList.toggle('pressed', musicMuted);
        muteBtn.title = musicMuted ? 'Unmute' : 'Mute';
        muteBtn.setAttribute('aria-pressed', String(musicMuted));
        prevBtn.disabled = nextBtn.disabled = TRACKS.length < 2;
        const st = musicStatus();
        if (stText.textContent !== st) stText.textContent = st;
        status.classList.toggle('music-error', !!musicError);
        if (playing) visStart();
    };

    // ----- equalizer: udawane słupki, animowane tylko gdy gra muzyka i okno jest widoczne -----
    // (prawdziwy AnalyserNode na file:// potrafi wyciszyć dźwięk, więc słupki są "na niby")
    const vg = vis.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const barCols = ['--music-bar-top', '--music-bar-mid', '--music-bar-low'].map((v) => css.getPropertyValue(v).trim());
    const bars = new Float32Array(MUSIC.BARS);
    const drawBars = () => {
        vg.clearRect(0, 0, MUSIC.VIS_W, MUSIC.VIS_H);
        const bw = MUSIC.VIS_W / MUSIC.BARS;
        for (let i = 0; i < MUSIC.BARS; i++) {
            const h = Math.max(1, Math.round(bars[i] * MUSIC.VIS_H));
            for (let y = 0; y < h; y++) {
                const band = y / MUSIC.VIS_H;  // dół cyjan, środek lawenda, góra róż
                vg.fillStyle = barCols[band > 0.66 ? 0 : band > 0.33 ? 1 : 2];
                vg.fillRect(i * bw, MUSIC.VIS_H - 1 - y, bw - 1, 1);
            }
        }
    };
    let visRaf = 0, visLast = 0;
    const visFrame = (t) => {
        visRaf = 0;
        if (musicAudio.paused || !vis.isConnected || !vis.offsetParent) {
            bars.fill(0);
            drawBars();
            return;                                       // koniec pętli (pauza / okno schowane)
        }
        if (t - visLast >= 1000 / MUSIC.VIS_FPS) {
            visLast = t;
            for (let i = 0; i < MUSIC.BARS; i++) {
                const bass = 1 - i / MUSIC.BARS;          // niskie tony wyżej
                const target = (0.35 + 0.6 * bass) * (0.45 + 0.55 * Math.random());
                bars[i] += (target - bars[i]) * 0.5;
            }
            drawBars();
        }
        visRaf = requestAnimationFrame(visFrame);
    };
    function visStart() { if (!visRaf) visRaf = requestAnimationFrame(visFrame); }
    // po przywróceniu zminimalizowanego okna płótno znów ma rozmiar -> wznawiamy słupki
    new ResizeObserver(() => { if (!musicAudio.paused) visStart(); }).observe(vis);
    drawBars();

    musicViews.add(refresh);
    openWindow({
        id: 'music', title: 'Music Player', icon: MUSIC.ICON, body,
        w: MUSIC.WIN_W, h: MUSIC.WIN_H,
        onClose: () => {
            musicViews.delete(refresh);
            if (visRaf) cancelAnimationFrame(visRaf);
            musicStop();                                  // zamknięcie = koniec muzyki (minimalizacja gra dalej)
        },
    });
    refresh();
    playBtn.focus();
}

// =====================================================================
//  GŁOŚNIK W ZASOBNIKU (obok zegara): klik = okienko z głośnością
// =====================================================================

const trayEl = document.querySelector('.tray');
const traySound = /** @type {HTMLButtonElement} */ (el('button', 'tray-btn'));
traySound.setAttribute('aria-label', 'Volume');
traySound.setAttribute('aria-haspopup', 'true');
trayEl.insertBefore(traySound, trayEl.firstChild);

const volPop = el('div', 'vol-pop raised hidden');
volPop.setAttribute('role', 'dialog');
volPop.setAttribute('aria-label', 'Volume');
const popVal = el('div', 'vol-pop-val');
const popSlider = musicSlider('Volume', (v) => musicSetVolume(v * 100),
    (v, dir) => (musicVolume + dir * MUSIC.VOLUME_STEP) / 100);
const popMute = /** @type {HTMLButtonElement} */ (el('button', 'win-btn vol-pop-mute'));
popMute.addEventListener('click', () => musicSetMuted(!musicMuted));
volPop.append(el('div', 'vol-pop-title', 'Volume'), popSlider.el, popVal, popMute);
document.body.appendChild(volPop);

const refreshTray = () => {
    traySound.innerHTML = glyphSvg(musicMuted ? MUSIC_GLYPHS.muted : MUSIC_GLYPHS.speaker);
    traySound.title = musicMuted ? 'Volume: muted' : `Volume: ${musicVolume}%`;
    if (!popSlider.dragging) popSlider.set(musicVolume / 100);
    popVal.textContent = musicVolume + '%';
    popMute.textContent = musicMuted ? 'Unmute' : 'Mute';
    popMute.classList.toggle('pressed', musicMuted);
};
musicViews.add(refreshTray);
refreshTray();

const closeVolPop = () => volPop.classList.add('hidden');
traySound.addEventListener('click', () => {
    const open = volPop.classList.toggle('hidden') === false;
    if (open) popSlider.el.focus();
});
document.addEventListener('pointerdown', (e) => {
    const t = /** @type {Node} */ (e.target);
    if (!volPop.contains(t) && !traySound.contains(t)) closeVolPop();
}, true);
volPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeVolPop(); traySound.focus(); } });

// =====================================================================
//  EKRAN "SOUND" - po bootowaniu, przy każdym wejściu na stronę.
//  Jeden przycisk: kliknięcie = zgoda przeglądarki na dźwięk (muzykę włącza się w Music Player).
// =====================================================================

function showSoundGate() {
    const gate = el('div', 'sound-gate');
    const box = el('div', 'window raised active sound-box');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'soundGateTitle');
    const bar = el('div', 'titlebar');
    const icon = /** @type {HTMLImageElement} */ (el('img'));
    icon.src = MUSIC.SPEAKER_ICON;
    icon.alt = '';
    const tt = el('span', 'title-text', 'Sound');
    tt.id = 'soundGateTitle';
    bar.append(icon, tt);
    const msg = el('div', 'msg-body');
    const row = el('div', 'msg-row');
    const img = /** @type {HTMLImageElement} */ (el('img'));
    img.src = MUSIC.SPEAKER_ICON;
    img.alt = '';
    row.append(img, el('p', '', 'This experience is better with sound. Allow audio?'));
    const btnRow = el('div', 'msg-btns');
    const ok = /** @type {HTMLButtonElement} */ (el('button', 'win-btn sound-ok', 'Enable sound '));
    ok.insertAdjacentHTML('beforeend', glyphSvg(MUSIC_GLYPHS.note));
    btnRow.appendChild(ok);
    msg.append(row, btnRow);
    const winBody = el('div', 'win-body');
    winBody.appendChild(msg);
    box.append(bar, winBody);
    gate.appendChild(box);
    document.body.appendChild(gate);
    document.body.classList.add('sound-locked');
    closeStart();

    // dopóki okienko jest otwarte, klawiatura i myszka nie docierają do pulpitu
    const trap = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enable(); }
        else e.preventDefault();                          // Tab, Esc, skróty - nic nie robią
        e.stopPropagation();
        ok.focus();
    };
    const keepFocus = () => setTimeout(() => ok.focus(), 0);
    document.addEventListener('keydown', trap, true);
    gate.addEventListener('pointerdown', keepFocus);

    function enable() {
        document.removeEventListener('keydown', trap, true);
        gate.remove();
        document.body.classList.remove('sound-locked');
        // muzyka NIE startuje sama - użytkownik włącza ją w Music Player.
        // To kliknięcie daje stronie "zgodę" przeglądarki (aktywacja użytkownika),
        // a tu tylko wczytujemy informacje o pliku (czas trwania), bez grania.
        musicLoad(0);
    }
    ok.addEventListener('click', enable);
    ok.focus();
}

// okienko pojawia się po ekranie startowym (albo od razu, gdy boot był już w tej karcie)
if (booting) document.addEventListener('hb-boot-done', showSoundGate, { once: true });
else showSoundGate();
