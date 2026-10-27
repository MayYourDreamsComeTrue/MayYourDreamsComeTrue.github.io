// =====================================================================
//  RESIDENT CAKE - główna pętla gry
//  Kamera zza ramienia (jak w RE4), sterowanie, strzelanie, etapy misji,
//  HUD, walizka (re/inventory.js) i kupiec, rozdziały z zapisem
//  (localStorage), wątek Citlali + Leon (sympatia, wybory w rozmowach),
//  pauza (okno pulpitu / utrata fokusu), monit "PC ONLY" i haczyk do testów (window.hbRE).
// =====================================================================
/* global THREE, RE */
(function () {
    const $ = (id) => document.getElementById(id);
    const V3 = THREE.Vector3;
    const { clamp, lerp } = RE;
    const FX = RE.FX, W = RE.W;

    // ----- ustawienia (wszystkie liczby rozgrywki w jednym miejscu) -----
    const CONFIG = {
        RENDER_SCALE: 0.6,       // rozdzielczość renderu względem okna (pixelowy wygląd + szybkość)
        RENDER_SCALE_BIG: 0.45,  // to samo dla bardzo dużych okien (> 1,6 mln pikseli)
        SENS: 0.0023,            // czułość myszy
        SENS_AIM: 0.0013,        // czułość przy celowaniu
        FOV: 60, FOV_AIM: 42,
        MIN_W: 1024, MIN_H: 640,           // monit PC ONLY (strona otwarta sama)
        EMBED_MIN_W: 816, EMBED_MIN_H: 560, // w okienku pulpitu
        LOVE_START: 30,          // sympatia na start (0..100)
        SAVE_KEY: 'hb-re-save',  // zapis w localStorage
    };
    const WEAP = {
        hg: { name: 'HANDGUN', cap: 10, rate: 0.24, reload: 1.2, dmg: 30, pellets: 1, spread: 0.004, kick: 0.012 },
        sg: { name: 'SHOTGUN', cap: 6, rate: 0.9, reload: 2.0, dmg: 15, pellets: 7, spread: 0.065, kick: 0.05 },
    };
    // ----- rozdziały: etap, start, kupiec, wyposażenie przy wyborze z menu -----
    const CHAPTERS = [null,
        { stage: 'path', name: 'The Outskirts', start: [0, 68, Math.PI], merchant: null },
        { stage: 'square', name: 'Siege of the Square', start: [0, 16, Math.PI], merchant: null },
        { stage: 'barn', name: 'The Stolen Present', start: [6, -4, 2.46], merchant: [W.STRANGER.x, W.STRANGER.z, -2.3] },
        { stage: 'forest', name: 'Moonlit Lake', start: [-35.5, -1.5, -Math.PI / 2], merchant: [-31, 4.4, -2.5] },
        { stage: 'chapel', name: 'The Old Chapel', start: [-89, -8, Math.PI], merchant: [-86.6, -12, -1.4] },
        { stage: 'boss', name: 'The Party Pooper', start: [-34, -4, Math.PI / 2], merchant: [-31, 4.4, -2.5] },
    ];
    const BASE = [['hg', 1], ['sg', 1]];
    const LOADOUT = [null,
        { items: [['ammoHg', 30], ['ammoSg', 6], ['herbG', 1]], gems: 0, keys: ['invite'], level: 0 },
        { items: [['ammoHg', 30], ['ammoSg', 8], ['herbG', 2]], gems: 60, keys: ['invite'], level: 0 },
        { items: [['ammoHg', 40], ['ammoSg', 10], ['herbG', 2]], gems: 150, keys: ['invite'], level: 0 },
        { items: [['ammoHg', 45], ['ammoSg', 12], ['herbG', 2], ['herbR', 1]], gems: 220, keys: ['invite', 'present', 'candles'], level: 0 },
        { items: [['ammoHg', 50], ['ammoSg', 14], ['herbG', 2], ['herbGR', 1]], gems: 300, keys: ['invite', 'present', 'candles'], level: 1 },
        { items: [['ammoHg', 60], ['ammoSg', 16], ['herbG', 2], ['herbGR', 1]], gems: 380, keys: ['invite', 'present', 'candles', 'note'], level: 1 },
    ];
    // rozmowy w trakcie gry: [Leon, odpowiedź Citlali]
    const BANTER = [
        ['You shoot like you\'ve done this before.', 'Birthday tradition. Don\'t ask.'],
        ['If we survive this, I owe you a slice of cake.', 'You owe me the WHOLE cake, Kennedy.'],
        ['Has anyone told you you\'re cute when you\'re angry?', 'I-I\'m not angry! ...And I\'m not cute! Shut up!'],
        ['I\'d take a bullet for you. Or a slime. Mostly a slime.', 'Hmph. Slimes are easy. Try taking a bad joke for me.'],
        ['Partner, I think the creepy villagers are jealous of us.', 'Of what? Your hair gel budget?'],
        ['You know, you\'re the best partner I\'ve had.', '...You\'re saying that because I carry the herbs.'],
        ['Nice night for a walk. Minus the monsters.', 'Is that your idea of a date? ...Not that this is a date!'],
        ['Stay close. For tactical reasons.', 'Tactical. Sure. ...Fine.'],
    ];

    // ===================================================================
    //  WebGL + scena
    // ===================================================================
    const canvas = $('reCanvas');
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    } catch (err) {
        $('loadErr').classList.remove('hidden');
        $('title').classList.add('hidden');
        return;
    }
    renderer.setPixelRatio(1);
    const NIGHT = '#151638';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(NIGHT);
    scene.fog = new THREE.FogExp2(NIGHT, 0.03);
    const camera = new THREE.PerspectiveCamera(CONFIG.FOV, 1, 0.08, 400);
    const world = RE.buildWorld(scene);
    FX.init(scene);
    RE.initOrbs(scene);
    const player = new RE.Player(scene);
    const leon = new RE.Leon(scene);

    // Nieznajomy (sklep) - pojawia się po obronie rynku
    const stranger = RE.makeStranger();
    stranger.position.set(W.STRANGER.x, 0, W.STRANGER.z);
    stranger.rotation.y = -2.3;
    stranger.visible = false;
    scene.add(stranger);
    const strangerCol = { x: W.STRANGER.x, z: W.STRANGER.z, r: 0.5, h: 1.7 };
    RE.circles.push(strangerCol);
    function placeStranger(m) {
        stranger.visible = !!m;
        if (!m) { strangerCol.x = strangerCol.z = 9999; return; }
        stranger.position.set(m[0], 0, m[1]); stranger.rotation.y = m[2];
        strangerCol.x = m[0]; strangerCol.z = m[1];
    }
    // skrzynia z kluczem na cmentarzu i liścik na ołtarzu kaplicy
    const chest = RE.makePickup('chest');
    chest.position.set(W.CHEST.x, 0, W.CHEST.z);
    scene.add(chest);
    RE.circles.push({ x: W.CHEST.x, z: W.CHEST.z, r: 0.55, h: 0.7 });
    const note = RE.makePickup('note');
    note.position.set(W.ALTAR.x, 1.11, W.ALTAR.z - 0.4);
    scene.add(note);
    // prezent w stodole
    const present = RE.makePickup('present');
    present.position.set(W.PRESENT.x, 0, W.PRESENT.z);
    scene.add(present);
    // tort w łapie bossa
    const bossCake = RE.makeCake(6);
    bossCake.scale.setScalar(1.3);
    // impreza (finał): stół, tort, prezenty, chorągiewki, czapeczki, szlamy-goście
    const party = new THREE.Group();
    party.visible = false;
    scene.add(party);
    let partyCake = null, hats = [];
    (function buildParty() {
        const G = RE.G, C = RE.COL, PT = W.PARTY;
        const items = [
            [G.box(2.4, 0.08, 1.3), C.cakePink, [0, 0.78, 0]], [G.box(2.5, 0.25, 1.4), C.cakeCream, [0, 0.66, 0]],
            ...[[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]].map(([x, z]) => [G.box(0.1, 0.74, 0.1), C.wood, [x, 0.37, z]]),
            [G.box(0.5, 0.4, 0.5), C.present2, [-1.8, 0.2, 0.3], [0, 0.3, 0]], [G.box(0.52, 0.42, 0.1), C.ribbon, [-1.8, 0.2, 0.3], [0, 0.3, 0]],
            [G.box(0.4, 0.5, 0.4), C.present3, [1.9, 0.25, -0.2], [0, -0.4, 0]], [G.box(0.1, 0.52, 0.42), C.ribbon, [1.9, 0.25, -0.2], [0, -0.4, 0]],
            [G.box(0.55, 0.45, 0.55), C.present1, [-1.6, 0.22, -0.8], [0, 0.8, 0]],
            [G.box(0.05, 3.2, 0.05), C.wood, [-3.2, 1.6, -1]], [G.box(0.05, 3.2, 0.05), C.wood, [3.2, 1.6, -1]],
        ];
        // chorągiewki między słupkami
        for (let i = 0; i < 13; i++) {
            const x = -3 + i * 0.5, y = 3.0 - Math.sin(i / 12 * Math.PI) * 0.6;
            items.push([G.cone(0.14, 0.3, 3), ['#f26dab', '#5fe1ff', '#ffd36e', '#b98cff'][i % 4], [x, y - 0.15, -1], [Math.PI, 0, 0]]);
        }
        const m = RE.mesh(RE.merge(items));
        party.add(m);
        partyCake = RE.makeCake(6);
        partyCake.position.set(0, 0.82, 0);
        party.add(partyCake);
        // szlamy w czapeczkach - też zaproszone
        for (const [k, x, z] of [['hydro', -2.4, 1.2], ['dendro', 2.5, 1.0]]) {
            const s = RE.makeSlime(k, false);
            s.root.position.set(x, 0, z); s.root.rotation.y = +x < 0 ? 0.6 : -0.6;
            s.root.add(RE.mesh(RE.merge([[G.cone(0.13, 0.32, 6), '#f26dab', [0, 0.85, 0]], [G.ball(0.04, 0), '#ffd36e', [0, 1.02, 0]]])));
            party.add(s.root);
        }
        party.position.set(PT.x, 0, PT.z);
        // czapeczki dla Citlali i Leona (zakładane w finale)
        for (const r of [player.r, leon.r]) {
            const h = RE.mesh(RE.merge([[G.cone(0.1, 0.26, 6), r === player.r ? '#5fe1ff' : '#f26dab', [0, 0, 0]], [G.ball(0.035, 0), '#ffd36e', [0, 0.14, 0]]]));
            h.position.set(0.02, r === player.r ? 0.42 : 0.36, -0.02); h.rotation.z = -0.25; h.visible = false;
            r.head.add(h); hats.push(h);
        }
    })();

    // laser celownika: linia + czerwona kropka
    const laserGeo = new THREE.BufferGeometry();
    laserGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const laser = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: '#ff2a4a', transparent: true, opacity: 0.7 }));
    laser.frustumCulled = false;
    const dot = RE.mesh(RE.merge([[RE.G.ball(0.035, 0), '#ff3a5a', [0, 0, 0]]]), RE.glowMat);
    scene.add(laser, dot);

    // ===================================================================
    //  STAN GRY
    // ===================================================================
    /** @type {any} */
    const S = {
        mode: 'title',          // title | cut | play | paused | case | shop | dead | end
        stage: 'path', sub: '', wave: 0, waveT: 0, chapter: 1, trig: 0,
        gems: 0, weapon: 'hg', mags: { hg: 10, sg: 6 }, love: CONFIG.LOVE_START,
        kills: 0, shots: 0, hits: 0, time: 0, banterT: 30, banterI: 0,
        reloadT: 0, fireCd: 0, cp: null, boss: null, haveCandles: false, protectedOnce: false,
        flags: { doorOpen: false, chestOpen: false, noteTaken: false, presentTaken: false },
    };
    // amunicja: naboje w magazynku liczymy tu, zapas leży w walizce (RE.Inv)
    function ammoSlot(w, type) {
        return {
            get mag() { return S.mags[w]; }, set mag(v) { S.mags[w] = v; },
            get res() { return RE.Inv.count(type); },
            set res(v) { const c = RE.Inv.count(type); if (v < c) RE.Inv.take(type, c - v); else if (v > c) RE.Inv.add(type, v - c); },
        };
    }
    S.ammo = { hg: ammoSlot('hg', 'ammoHg'), sg: ammoSlot('sg', 'ammoSg') };
    const HEALS = ['herbG', 'herbGG', 'herbGR'];
    Object.defineProperty(S, 'herbs', { enumerable: true, get: () => HEALS.reduce((n, t) => n + RE.Inv.count(t), 0) });
    const cam = { yaw: Math.PI, pitch: -0.05, shake: 0 };
    const input = { f: 0, s: 0, run: false, aim: false };
    const keys = {};
    let locked = false, frozen = false, hostPaused = false, pcBlocked = false, deadT = 0;
    const g = { player, leon, scene, shake: 0, diff: 1 };
    RE.game = g;

    // ===================================================================
    //  HUD (tekst zmieniamy tylko, gdy się zmienił)
    // ===================================================================
    const cache = {};
    const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
    function toast(msg, cls) {
        const d = document.createElement('div');
        d.className = 'toast ' + (cls || '');
        d.textContent = msg;
        $('toasts').appendChild(d);
        setTimeout(() => d.remove(), 2600);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    }
    function objective(t) { setText('objText', t); }
    let hitT = 0;
    function updateHud(dt) {
        const hp = Math.ceil(player.hp);
        $('hpFill').style.width = hp + '%';
        const stc = hp > 60 ? 'fine' : hp > 25 ? 'caution' : 'danger';
        if (cache.hpState !== stc) { cache.hpState = stc; const e = $('hpState'); e.className = stc; e.textContent = stc.toUpperCase(); }
        setText('herbCount', String(S.herbs));
        setText('gemCount', String(S.gems));
        const a = S.ammo[S.weapon];
        setText('wpName', WEAP[S.weapon].name);
        setText('ammoMag', String(a.mag)); setText('ammoRes', String(a.res));
        $('ammoMag').classList.toggle('empty', a.mag === 0);
        const ws = RE.Inv.weapons();
        $('slot1').classList.toggle('on', S.weapon === ws[0]); $('slot2').classList.toggle('on', S.weapon === ws[1]);
        const lh = loveHtml();
        if (cache.love !== lh) { cache.love = lh; $('loveHearts').innerHTML = lh; }
        subT -= dt; if (subT <= 0) show('sub', false);
        $('reloadTag').classList.toggle('hidden', S.reloadT <= 0);
        $('cross').classList.toggle('hidden', !(input.aim && S.mode === 'play'));
        hitT -= dt; $('hitMark').classList.toggle('hidden', hitT <= 0);
        // czerwona winieta po ciosie i przy niskim życiu
        player.flashRed = Math.max(0, (player.flashRed || 0) - dt * 2.5);
        $('hurt').style.opacity = String(Math.min(1, player.flashRed * 0.8 + (hp <= 25 ? 0.35 + Math.sin(S.time * 5) * 0.1 : 0)));
        if (S.boss) { $('bossFill').style.width = Math.max(0, S.boss.hp / S.boss.maxHp * 100) + '%'; }
        // dymek Leona nad głową
        const b = $('bubble');
        if (leon.say && (S.mode === 'play')) {
            tmpV.set(leon.pos.x, leon.pos.y + 2.15, leon.pos.z).project(camera);
            if (tmpV.z < 1) {
                b.classList.remove('hidden');
                if (b.textContent !== leon.say) b.textContent = leon.say;
                const x = clamp((tmpV.x * 0.5 + 0.5) * window.innerWidth, 90, window.innerWidth - 90), y = clamp((-tmpV.y * 0.5 + 0.5) * window.innerHeight, 70, window.innerHeight - 140);
                b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
            } else b.classList.add('hidden');
        } else b.classList.add('hidden');
    }
    const tmpV = new V3(), tmpV2 = new V3(), tmpD = new V3();
    // sympatia Citlali <-> Leon: 5 serduszek
    function loveHtml() {
        let h = '';
        for (let i = 0; i < 5; i++) h += `<i class="heart${S.love >= (i + 1) * 20 - 10 ? ' on' : ''}">&#9829;</i>`;
        return h;
    }
    g.love = () => S.love;
    g.addLove = function (d) {
        S.love = clamp(S.love + d, 0, 100);
        if (d > 0 && S.mode === 'play') toast('Affection +' + d, 'love');
    };
    // kwestia Citlali na dole ekranu (Leon mówi w dymku)
    let subT = 0;
    function citSay(t) {
        $('sub').innerHTML = '<b class="who-citlali">Citlali</b> ' + t.replace(/[<>&]/g, '');
        show('sub', true); subT = 3.6;
    }
    g.citSay = citSay;
    function banter() {
        const b = BANTER[S.banterI++ % BANTER.length];
        leon.talk(b[0], true);
        setTimeout(() => { if (S.mode === 'play') citSay(b[1]); }, 2600);
    }

    // ===================================================================
    //  EKRANY / TRYBY
    // ===================================================================
    function show(id, on) { $(id).classList.toggle('hidden', !on); }
    function setMode(m) {
        S.mode = m;
        show('hud', m === 'play' || m === 'shop' || m === 'case');
        if (m !== 'shop' && m !== 'case') RE.Inv.close();
        show('dead', m === 'dead');
        show('end', m === 'end');
        show('title', m === 'title');
        if (m !== 'play') { input.aim = false; if (locked) document.exitPointerLock(); }
        if (m === 'play') lockPointer();
        if (m === 'title') refreshTitle();
    }
    // ----- walizka i kupiec -----
    function openCase(shop) {
        if (S.mode !== 'play' || player.dead) return;
        setMode(shop ? 'shop' : 'case');
        RE.Inv.open(shop);
    }
    function closeCase() {
        if (S.mode !== 'case' && S.mode !== 'shop') return;
        setMode('play');
    }
    g.openCase = openCase;
    const invApi = {
        gems: () => S.gems,
        addGems: (n) => { S.gems += n; },
        equipped: () => S.weapon,
        equip: (w) => switchWeapon(w, true),
        heal: (n) => { if (player.hp >= 100) return 'full'; heal(n); return 'ok'; },
        loveHtml,
        changed: () => { if (!RE.Inv.has(S.weapon)) switchWeapon(RE.Inv.weapons()[0], true); },
        close: closeCase,
    };
    function lockPointer() {
        if (locked || pcBlocked) return;
        try {
            const p = /** @type {any} */ (canvas.requestPointerLock());
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* brak blokady (np. test) - działa też bez niej */ }
    }

    // ===================================================================
    //  ETAPY MISJI
    // ===================================================================
    function alive() { return RE.enemies.filter((e) => !e.dead).length; }
    function spawn(type, x, z, opt) { const e = new RE.Enemy(scene, type, x, z, opt); RE.enemies.push(e); return e; }
    g.spawn = spawn;
    const SLIMES = ['pyro', 'hydro', 'electro', 'dendro'];
    const SQ_SPAWNS = [[-24, -4], [24, -9], [-24, 15], [22, 16], [8, -27], [-13, -27], [-8, 18], [26, -20]];
    const PATH_N = 8;
    g.spawnPath = function () {
        if (RE.enemies.some((e) => e.stage === 'path')) return RE.enemies;
        const out = [[1, 44, 'villager'], [-1.5, 40, 'villager'], [2, 36, 'villager'], [-1, 31, 'villager'], [0.5, 27, 'zombie'], [-2, 21, 'slime:dendro'], [2.4, 20, 'slime:pyro'], [0, 18, 'zombie']]
            .map(([x, z, t]) => { const [type, kind] = String(t).split(':'); const e = spawn(type, x, z, { kind }); e.stage = 'path'; e.yaw = 0; return e; });
        return out;
    };
    const WAVES = [null,
        ['villager', 'villager', 'villager', 'zombie', 'slime:pyro', 'slime:hydro', 'villager', 'slime:electro'],
        ['villager', 'zombie', 'villager', 'hood', 'slime:dendro:big', 'zombie', 'villager', 'slime:pyro', 'slime:hydro'],
        ['zombie', 'zombie', 'hood', 'slime:pyro:big', 'villager', 'villager', 'slime:electro', 'hood', 'zombie', 'villager'],
    ];
    function spawnWave(n) {
        const list = WAVES[n], id = S.waveId = (S.waveId || 0) + 1;   // id: po powtórce stare timery nic nie robią
        list.forEach((t, i) => {
            const [type, kind, big] = t.split(':');
            const [x, z] = SQ_SPAWNS[(i + n * 3) % SQ_SPAWNS.length];
            setTimeout(() => { if (S.stage === 'square' && S.waveId === id) { S.pend--; spawn(type, x + Math.random() * 2 - 1, z + Math.random() * 2 - 1, { kind, big: !!big, spawn: true }); } }, i * 700);
        });
        S.waveLeft = list.length;
        S.pend = list.length;   // ilu jeszcze nie wyszło (fala nie kończy się przed ostatnim)
        if (n === 1) setTimeout(() => leon.quip('slime', true), 2500);
        if (n === 2) setTimeout(() => leon.quip('hood', true), 3500);
    }
    g.spawnAmbush = function () {
        if (S.ambushed) return;
        S.ambushed = true;
        [['villager', 26, -22], ['villager', 33, -20], ['zombie', 37, -22], ['slime', 29, -18, 'pyro'], ['slime', 31, -21, 'electro'], ['villager', 22.5, -21], ['hood', 30, -15], ['slime', 35, -17, 'hydro'], ['villager', 28, -16]]
            .forEach(([t, x, z, k]) => { const e = spawn(t, x, z, { kind: k, spawn: t === 'slime' }); e.stage = 'barn'; });
    };
    g.hidePresent = () => {
        present.visible = false; S.haveCandles = true; S.flags.presentTaken = true;
        RE.Inv.addKey('present'); RE.Inv.addKey('candles');
    };
    // grupy wrogów (lista [typ, x, z, rodzaj szlamu, duży])
    // grupa wrogów wychodzi po kolei; pend[tag] = ilu jeszcze czeka (etap nie kończy się za wcześnie),
    // fieldId: po zmianie rozdziału / powtórce stare timery nic nie robią
    let fieldId = 0;
    const pend = {};
    function group(list, tag) {
        const id = fieldId;
        pend[tag] = (pend[tag] || 0) + list.length;
        list.forEach(([t, x, z, k, big], i) => setTimeout(() => {
            if (id !== fieldId || S.mode === 'title') return;
            pend[tag]--;
            const e = spawn(t, x, z, { kind: k, big: !!big, spawn: true }); e.stage = tag;
        }, i * 350));
    }
    const pending = () => Object.values(pend).reduce((a, b) => a + b, 0);
    const FOREST = [
        [['villager', -56, -1], ['villager', -58, -4], ['zombie', -60, 0], ['villager', -54, 2], ['slime', -52, -5, 'dendro']],
        [['zombie', -72, -3], ['zombie', -70, 1], ['hood', -77, -1], ['slime', -68, -5, 'hydro', true], ['villager', -66, 2], ['slime', -70, -2, 'electro']],
        [['villager', -90, -6], ['villager', -89, 2], ['villager', -87, -10], ['zombie', -92, -2], ['hood', -93, -12], ['slime', -91, -8, 'pyro']],
    ];
    const YARD = [['zombie', -96, -42], ['zombie', -92, -45], ['zombie', -98, -38], ['villager', -94, -39], ['hood', -99, -48], ['zombie', -90, -40], ['slime', -95, -30, 'electro'], ['villager', -88, -44]];
    const NAVE = [['hood', -112, -43], ['hood', -105, -43], ['zombie', -110, -38], ['zombie', -107, -37], ['villager', -109, -41], ['slime', -113, -34, 'pyro'], ['slime', -104, -34, 'hydro']];
    // pół-boss: Królowa Szlamów nad jeziorem
    g.spawnMega = function () {
        if (S.boss && !S.boss.dead && S.boss.mega) return S.boss;
        S.boss = spawn('slime', -97, 0, { kind: 'hydro', mega: true });
        S.boss.yaw = Math.PI / 2;
        return S.boss;
    };
    g.startMegaFight = function () {
        g.spawnMega();
        S.sub = 'midboss';
        objective('Defeat the Slime Matriarch!');
        $('bossName').textContent = 'THE SLIME MATRIARCH';
        show('bossBar', true);
        checkpoint();
        setMode('play');
    };
    g.afterMid = function () { S.sub = 'ambush'; objective('Survive the ambush!'); setMode('play'); };

    // ----- punkt kontrolny + zapis (localStorage) -----
    function checkpoint() {
        S.cp = {
            chapter: S.chapter, stage: S.stage, sub: S.sub, inv: RE.Inv.save(), mags: Object.assign({}, S.mags), gems: S.gems, love: S.love,
            weapon: S.weapon, flags: Object.assign({}, S.flags), x: player.pos.x, z: player.pos.z, yaw: player.yaw, protectedOnce: S.protectedOnce,
        };
        const old = loadSave();
        writeSave(Object.assign({}, S.cp, { max: Math.max(S.chapter, old ? old.max || 1 : 1), kills: S.kills, time: S.time }));
    }
    function loadSave() { try { return JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY) || 'null'); } catch (e) { return null; } }
    function writeSave(o) { try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(o)); } catch (e) { /* tryb prywatny / brak miejsca */ } }
    // stan rekwizytów świata zależny od postępu
    function applyFlags() {
        const f = S.flags;
        present.visible = !f.presentTaken;
        RE.chapelDoor.setOpen(f.doorOpen);
        chest.rotation.x = 0; chest.userData.open = f.chestOpen;
        note.visible = !f.noteTaken;
    }
    function startStage(name, retry) {
        S.stage = name; S.sub = ''; S.wave = 0; S.waveT = 0; S.trig = 0;
        if (name === 'path') { objective(`Clear the path (0/${PATH_N})`); g.spawnPath(); if (!retry) chapterCard(1); }
        if (name === 'square') { S.wave = 1; spawnWave(1); objective('Defend the square - wave 1/3'); }
        if (name === 'barn') { S.ambushed = false; objective('Search the barn for the stolen present'); }
        if (name === 'forest') objective('Follow the forest path to the lake');
        if (name === 'chapel') { S.sub = 'yard'; objective('Find a way into the old chapel'); }
        if (name === 'boss') { S.sub = 'approach'; objective('Stop the Party Pooper - get to the village square!'); }
        S.banterT = 7 + Math.random() * 4;
        checkpoint();
        setMode('play');
    }
    g.startStage = startStage;
    // ----- rozdziały -----
    function clearField() {
        fieldId++;
        for (const k in pend) pend[k] = 0;
        for (const e of RE.enemies) scene.remove(e.root);
        RE.enemies.length = 0;
        RE.clearPickups(); RE.clearOrbs(); FX.clear();
        S.boss = null;
        if (bossCake.parent) bossCake.parent.remove(bossCake);
        bossCake.visible = true;
        show('bossBar', false);
    }
    function applyLoadout(n) {
        const L = LOADOUT[n];
        RE.Inv.reset(BASE.concat(L.items), L.level, L.keys);
        S.gems = L.gems; S.mags = { hg: 10, sg: 6 }; S.weapon = 'hg';
        player.weapon = 'hg'; player.setWeapon('hg');
        S.flags = { doorOpen: false, chestOpen: false, noteTaken: n > 5, presentTaken: n > 3 };
        S.haveCandles = n > 3;
        if (n > 4) S.love = Math.max(S.love, 50);
    }
    // how: 'new' (wybór z menu, domyślne wyposażenie) | 'flow' (dalej w grze) ; place = ustaw postacie na starcie
    function enterChapter(n, how, place) {
        const C = CHAPTERS[n];
        clearField();
        S.chapter = n;
        if (how === 'new') applyLoadout(n);
        if (n < 6) { party.visible = false; for (const h of hats) h.visible = false; }
        applyFlags();
        placeStranger(C.merchant);
        if (place) {
            const [x, z, yaw] = C.start;
            g.placeActors(x, z, yaw, x - Math.sin(yaw) * 1.6 + Math.cos(yaw) * 1.2, z - Math.cos(yaw) * 1.6 - Math.sin(yaw) * 1.2, yaw);
        }
        chapterCard(n);
        if (C.merchant && n > 3) setTimeout(() => toast('The Stranger is waiting nearby... [E] to trade'), 3500);
        startStage(C.stage);
    }
    g.enterChapter = enterChapter;
    let cardTimer = 0;
    function chapterCard(n) {
        $('chNum').textContent = 'CHAPTER ' + n;
        $('chName').textContent = CHAPTERS[n].name;
        const c = $('chapterCard');
        c.classList.remove('hidden', 'go'); void c.offsetWidth; c.classList.add('go');
        clearTimeout(cardTimer);
        cardTimer = setTimeout(() => c.classList.add('hidden'), 3600);
    }

    g.spawnBoss = function () {
        if (S.boss && !S.boss.dead) return S.boss;
        S.boss = spawn('boss', 0, -14);
        S.boss.yaw = 0;
        S.boss.r.handL.add(bossCake);
        bossCake.position.set(0, -0.2, 0.4);
        S.boss.state = 'intro';
        return S.boss;
    };
    g.bossRoar = function (t) {
        const b = S.boss; if (!b) return;
        b.yaw = 0; b.root.rotation.y = 0;
        RE.resetPose(b.r);
        const k = Math.min(1, t / 1.2);
        b.r.armR.rotation.set(-2.6 * k, 0, -0.4); b.r.armL.rotation.set(-1.2, 0, 0.3); b.r.head.rotation.x = -0.35 * k;
        if (t > 1.2 && t < 1.25) g.shake = 0.5;
    };
    g.startBossFight = function () {
        const b = g.spawnBoss();
        b.state = 'walk'; b.cool = 2;
        S.stage = 'boss'; S.sub = 'fight';
        objective('Defeat the Party Pooper!');
        $('bossName').textContent = 'THE PARTY POOPER';
        show('bossBar', true);
        leon.quip('boss', true);
        checkpoint();
        setMode('play');
    };
    g.bossSummon = function (b) {
        toast(b.mega ? 'The Slime Matriarch splits!' : 'The Party Pooper calls for backup!', 'warn');
        const n = b.mega ? 3 : 4;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; spawn('slime', b.pos.x + Math.cos(a) * 3.5, b.pos.z + Math.sin(a) * 3.5, { kind: SLIMES[(i + (b.mega ? 1 : 0)) % 4], spawn: true }); }
        leon.quip('slime', true);
    };
    g.placeActors = function (px, pz, pyaw, lx, lz, lyaw) {
        player.pos.set(px, 0, pz); player.yaw = pyaw; player.root.rotation.set(0, pyaw, 0); player.speed = 0;
        leon.pos.set(lx, 0, lz); leon.yaw = lyaw; leon.root.rotation.set(0, lyaw, 0); leon.speed = 0;
        cam.yaw = pyaw; cam.pitch = -0.05;
    };

    // finał
    g.setupParty = function () {
        party.visible = true;
        for (const h of hats) h.visible = true;
        partyCake.userData.flames.visible = true;
        bossCake.visible = false;
        const PT = W.PARTY;
        g.placeActors(PT.x - 0.7, PT.z + 1.6, Math.PI, PT.x + 0.8, PT.z + 1.7, Math.PI + 0.2);
        stranger.visible = true;
        stranger.position.set(PT.x + 3.3, 0, PT.z + 1.2); stranger.rotation.y = -1.9;
        // sprzątanie pola walki
        for (const e of RE.enemies) if (!e.dead) { scene.remove(e.root); e.dead = true; }
        RE.enemies.length = 0;
        RE.clearOrbs();
        show('bossBar', false);
        leon.target = null; leon.aimT = 0;
    };
    g.cheer = function (on) { player.cheer = on ? 0.01 : 0; leon.cheer = on ? 0.01 : 0; };
    g.confetti = function () {
        const PT = W.PARTY;
        for (let i = 0; i < 3; i++) FX.confetti(tmpV.set(PT.x + (Math.random() - 0.5) * 4, 2.5, PT.z + (Math.random() - 0.5) * 2), 40, 5);
    };
    // finał: Citlali i Leon nachylają się do siebie (k 0..1)
    g.leanIn = function (k) {
        const PT = W.PARTY;
        player.pos.x = PT.x - 0.5 + 0.2 * k; leon.pos.x = PT.x + 0.7 - 0.2 * k;
        player.r.head.rotation.z = -0.15 * k; leon.r.head.rotation.z = 0.15 * k;
    };
    g.confettiCannon = function () {
        const PT = W.PARTY;
        for (let i = 0; i < 5; i++) FX.confetti(tmpV.set(PT.x + (i - 2) * 0.8, 1.6 + Math.random(), PT.z + 2), 80, 8);
        g.shake = 0.35;
    };
    g.blowCandles = function () {
        if (!partyCake.userData.flames.visible) return;
        partyCake.userData.flames.visible = false;
        FX.burst(tmpV.set(W.PARTY.x, 1.8, W.PARTY.z), '#e8e0f0', 30, 1.5, 1.5, -0.5, 1);
        FX.confetti(tmpV.set(W.PARTY.x, 2, W.PARTY.z), 120, 7);
    };
    g.showEnd = function () {
        const t = Math.round(S.time), acc = S.shots ? Math.round(S.hits / S.shots * 100) : 0;
        $('stats').innerHTML = '';
        for (const [k, v] of [['Time', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`], ['Party crashers stopped', String(S.kills)], ['Accuracy', acc + '%'], ['Primogems', String(S.gems)], ['Leon\'s assists', String(leon.kills)], ['Partner affection', loveHtml()]]) {
            const li = document.createElement('li'); li.innerHTML = `<span>${k}</span><b>${v}</b>`; $('stats').appendChild(li);
        }
        setMode('end');
        S.won = true;
        const sv = loadSave();
        if (sv) { sv.max = 6; sv.done = true; writeSave(sv); }
    };

    function playCut(name) {
        setMode('cut');
        show('hud', false);
        RE.Cut.play(RE.CUTS[name](g), () => {});
    }

    // ----- logika etapów co klatkę -----
    const near = (x, z, r) => Math.hypot(player.pos.x - x, player.pos.z - z) < r;
    const tagLeft = (tag) => RE.enemies.filter((e) => e.stage === tag && !e.dead).length + (pend[tag] || 0);
    function updateStage(dt) {
        const st = S.stage;
        if (st === 'path') {
            const left = tagLeft('path');
            if (S.sub === '') {
                objective(`Clear the path (${PATH_N - left}/${PATH_N})`);
                if (left === 0) { S.sub = 'go'; objective('Reach the village square'); leon.talk('Path\'s clear. The square is up ahead.', true); }
            }
            if (S.sub === 'go' && player.pos.z < 15) { S.chapter = 2; chapterCard(2); startStage('square'); }
        } else if (st === 'square') {
            const left = alive();
            if (S.wave > 0) objective(`Defend the square - wave ${S.wave}/3 (${Math.max(left, 0)} left)`);
            if (left === 0 && S.wave > 0 && !(S.pend > 0)) {
                S.waveT += dt;
                if (S.waveT > 2.5 && S.waveT < 100) {
                    if (S.wave < 3) { S.wave++; S.waveT = 0; spawnWave(S.wave); toast('Wave ' + S.wave + '!', 'warn'); }
                    else {
                        S.waveT = 1000; S.wave = 0;
                        toast('The square is safe!');
                        setTimeout(() => toast('A mysterious merchant has arrived...'), 1500);
                        leon.talk('Tracks lead to the barn. And... is that a merchant?', true);
                        S.chapter = 3; chapterCard(3); placeStranger(CHAPTERS[3].merchant);
                        startStage('barn');
                    }
                }
            } else S.waveT = 0;
        } else if (st === 'barn') {
            if (S.sub === 'ambush' && alive() === 0) {
                S.sub = 'return'; objective('Rest at the campfire on the west edge of the village');
                leon.talk('Candles secured. Let\'s catch our breath by the campfire.', true);
            }
            if (S.sub === 'return' && near(W.BONFIRE.x, W.BONFIRE.z, 6)) playCut('campfire');
        } else if (st === 'forest') {
            const x = player.pos.x;
            if (S.trig === 0 && x < -44) { S.trig = 1; group(FOREST[0], 'forest'); leon.talk('Movement in the trees!', true); }
            if (S.trig === 1 && x < -61) { S.trig = 2; group(FOREST[1], 'forest'); setTimeout(() => leon.quip('hood', true), 1200); }
            if (S.trig === 2 && x < -78) { S.trig = 3; group(FOREST[2], 'forest'); }
            if (S.trig === 3 && S.sub === '' && alive() === 0 && !pending() && x < -83) { S.sub = 'cut'; playCut('lake'); }
            if (S.sub === 'midboss' && S.boss && S.boss.dead) {
                S.sub = 'done'; show('bossBar', false);
                toast('The Slime Matriarch is down!', 'good');
                leon.talk('Jelly: defeated. Next stop - that old chapel.', true);
                setTimeout(() => { if (S.stage === 'forest') enterChapter(5, 'flow', false); }, 3000);
            }
        } else if (st === 'chapel') {
            if (S.trig === 0 && player.pos.z < -18) { S.trig = 1; group(YARD, 'yard'); leon.talk('The graveyard is waking up. Of course it is.', true); }
            if (S.sub === 'inside' && player.pos.z < -31.5 && player.pos.x < W.CHAPEL.x1 && player.pos.x > W.CHAPEL.x0) {
                S.sub = 'nave'; group(NAVE, 'nave'); objective('Clear the chapel!'); leon.talk('Ambush! Behind the pews!', true);
            }
            if (S.sub === 'nave' && tagLeft('nave') === 0 && RE.enemies.every((e) => e.stage !== 'nave')) { S.sub = 'altar'; objective('Check the altar'); }
        } else if (st === 'boss') {
            if (S.sub === 'approach' && Math.hypot(player.pos.x, player.pos.z) < 11) { S.sub = 'cut'; playCut('boss'); }
            if (S.boss && S.boss.dead && S.sub === 'fight') {
                S.sub = 'won';
                setTimeout(() => playCut('finale'), 1200);
            }
        }
        // Leon raz osłania Citlali, gdy jest bardzo źle
        if (!S.protectedOnce && S.chapter >= 2 && player.hp > 0 && player.hp < 35 && alive() > 0) protect();
        // pogawędki, gdy jest spokojnie
        S.banterT -= dt;
        if (S.banterT <= 0) { S.banterT = 40 + Math.random() * 30; if (alive() === 0 && !leon.say) banter(); }
    }
    function protect() {
        S.protectedOnce = true;
        player.inv = 2.5;
        leon.pos.set(player.pos.x - Math.sin(player.yaw) * 0.9, 0, player.pos.z - Math.cos(player.yaw) * 0.9);
        RE.pushOut(leon.pos, 0.35);
        for (const e of RE.enemies) {
            if (!e.alive() || e.type === 'boss' || e.mega || e.pos.distanceTo(player.pos) > 4.5) continue;
            tmpV.subVectors(e.pos, player.pos).setY(0).normalize();
            e.pos.addScaledVector(tmpV, 2.2); e.state = 'stagger'; e.t = 1.4;
        }
        FX.burst(tmpV.set(player.pos.x, 1.2, player.pos.z), '#ffd36e', 30, 4, 0.5, 4);
        g.shake = 0.4;
        leon.talk('HEY! Hands off my partner!', true);
        setTimeout(() => citSay('I... had it handled! ...Thanks, Leon.'), 1800);
        g.addLove(8);
    }

    // ===================================================================
    //  WALKA GRACZA
    // ===================================================================
    function camDir(out) { return out.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)); }
    // promień celowania: od kamery, ale zaczyna się na wysokości gracza (żeby nie trafiać skrzynek za plecami)
    function aimRay(o, d) {
        camera.getWorldDirection(d);
        o.copy(camera.position);
        tmpV2.set(player.pos.x, player.pos.y + 1.5, player.pos.z).sub(o);
        o.addScaledVector(d, Math.max(0, tmpV2.dot(d)));
    }
    function fire() {
        if (S.mode !== 'play' || player.dead || player.kickT > 0) return;
        if (!input.aim) { knife(); return; }
        if (S.reloadT > 0 || S.fireCd > 0) return;
        const w = WEAP[S.weapon], a = S.ammo[S.weapon];
        if (a.mag <= 0) { if (a.res > 0) reload(); else toast('Out of ammo!', 'warn'); return; }
        a.mag--; S.fireCd = w.rate; S.shots++;
        const o = new V3(), d = new V3();
        aimRay(o, d);
        const muzzle = player.guns[S.weapon].localToWorld(player.guns[S.weapon].userData.muzzle.clone());
        FX.flash(0, muzzle);
        let hitAny = false;
        const killed = new Set();
        for (let i = 0; i < w.pellets; i++) {
            const dd = d.clone();
            if (w.spread) { dd.x += (Math.random() - 0.5) * w.spread * 2; dd.y += (Math.random() - 0.5) * w.spread * 2; dd.z += (Math.random() - 0.5) * w.spread * 2; dd.normalize(); }
            const h = RE.hitScan(o, dd, 70);
            FX.tracer(muzzle, h.point);
            if (h.enemy) {
                hitAny = true;
                const fall = S.weapon === 'sg' ? (h.t > 9 ? 0.5 : 1) : 1;
                if (h.enemy.damage(w.dmg * fall, h.head, player.pos, 'player')) killed.add(h.enemy);
                FX.burst(h.point, h.head ? '#ffffff' : '#ffd36e', 6, 3, 0.3, 6);
            } else if (h.t < 70) FX.burst(h.point, '#cfc6b8', 4, 2, 0.3, 8, 0.5);
        }
        if (hitAny) { S.hits++; hitT = 0.15; }
        if (killed.size && Math.random() < 0.35) leon.quip('playerKill');
        cam.pitch = clamp(cam.pitch + w.kick, -0.6, 0.75);
        g.shake = Math.max(g.shake, S.weapon === 'sg' ? 0.18 : 0.05);
        if (a.mag === 0 && a.res > 0) setTimeout(() => { if (S.ammo[S.weapon] === a && a.mag === 0) reload(); }, 250);
    }
    function knife() {
        if (player.knifeT > 0) return;
        player.knifeT = 0.4;
        setTimeout(() => {
            for (const e of RE.enemies) {
                if (!e.alive()) continue;
                tmpV.subVectors(e.pos, player.pos); tmpV.y = 0;
                const d = tmpV.length();
                if (d > 1.9 + e.st.rad) continue;
                const ang = Math.abs(Math.atan2(tmpV.x, tmpV.z) - player.yaw) % (Math.PI * 2);
                if (Math.min(ang, Math.PI * 2 - ang) > 1.1) continue;
                if (e.damage(22, false, player.pos, 'player')) leon.quip('playerKill');
                FX.burst(e.center(tmpV2), '#ffffff', 6, 2, 0.25, 5);
                hitT = 0.15;
            }
        }, 150);
    }
    function reload() {
        const w = WEAP[S.weapon], a = S.ammo[S.weapon];
        if (S.reloadT > 0 || a.mag >= w.cap || a.res <= 0 || S.mode !== 'play') return;
        S.reloadT = w.reload; S.reloadW = S.weapon;
        if (alive() > 2 && Math.random() < 0.4) leon.quip('reload');
    }
    function finishReload() {
        const w = WEAP[S.reloadW], a = S.ammo[S.reloadW];
        const n = Math.min(w.cap - a.mag, a.res);
        a.mag += n; a.res -= n;
    }
    function switchWeapon(w, fromCase) {
        if (!w || S.weapon === w || !RE.Inv.has(w) || (S.mode !== 'play' && !fromCase)) return;
        S.weapon = w; S.reloadT = 0; S.fireCd = 0.25;
        player.weapon = w; player.setWeapon(w);
    }
    function heal(n) {
        player.hp = Math.min(100, player.hp + n);
        FX.burst(tmpV.set(player.pos.x, 1.2, player.pos.z), '#8cc63f', 25, 2, 0.8, -1, 1);
        toast('+' + n + ' HP', 'good');
    }
    // H: najsłabsze zioło, które leczy (mieszanki zostają na gorsze chwile)
    function useHerb() {
        if (S.mode !== 'play' || player.dead) return;
        const t = HEALS.find((x) => RE.Inv.count(x) > 0);
        if (!t) { toast(RE.Inv.has('herbR') ? 'Red herb alone does nothing - mix it with green [Tab]' : 'No herbs!', 'warn'); return; }
        if (player.hp >= 100) { toast('Already at full health'); return; }
        RE.Inv.take(t, 1);
        heal(RE.Inv.ITEMS[t].heal);
    }
    // E: kopniak > prezent > sklep
    function kickTarget() {
        let best = null, bd = 2.6;
        for (const e of RE.enemies) { if (!e.alive() || e.state !== 'stagger') continue; const d = e.pos.distanceTo(player.pos) - e.st.rad; if (d < bd) { bd = d; best = e; } }
        return best;
    }
    function interactable() {
        if (S.mode !== 'play' || player.dead) return null;
        const k = kickTarget();
        if (k) return { what: 'kick', text: '[E] Roundhouse kick!', e: k };
        if (S.stage === 'barn' && present.visible && Math.hypot(player.pos.x - W.PRESENT.x, player.pos.z - W.PRESENT.z) < 2.2) return { what: 'present', text: '[E] Open the present' };
        if (S.stage === 'chapel') {
            const K = W.CHAPEL;
            if (!S.flags.doorOpen && near((K.door0 + K.door1) / 2, K.z1, 2.8)) return RE.Inv.hasKey('moonKey') ? { what: 'unlock', text: '[E] Unlock the door (Moon Key)' } : { what: 'door', text: '[E] Examine the door' };
            if (!S.flags.chestOpen && near(W.CHEST.x, W.CHEST.z, 2)) return { what: 'chest', text: '[E] Open the chest' };
            if (S.sub === 'altar' && note.visible && near(W.ALTAR.x, W.ALTAR.z + 0.9, 2.2)) return { what: 'note', text: '[E] Read the note' };
        }
        if (stranger.visible && Math.hypot(player.pos.x - stranger.position.x, player.pos.z - stranger.position.z) < 2.8) return { what: 'shop', text: '[E] Talk to the Stranger' };
        return null;
    }
    function interact() {
        const it = interactable();
        if (!it) return;
        if (it.what === 'kick') {
            player.kickT = 0.6;
            const e = it.e;
            player.yaw = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
            setTimeout(() => {
                if (e.alive()) { e.damage(e.type === 'boss' ? 120 : 80, false, player.pos, 'player'); }
                for (const o of RE.enemies) {
                    if (o === e || !o.alive() || o.type === 'boss') continue;
                    if (o.pos.distanceTo(player.pos) < 3) { o.damage(20, false, player.pos, 'player'); tmpV.subVectors(o.pos, player.pos).setY(0).normalize(); o.pos.addScaledVector(tmpV, 1.5); }
                }
                FX.burst(e.center(tmpV), '#ffffff', 20, 4, 0.4, 6);
                g.shake = 0.3; hitT = 0.2;
                leon.talk('Nice kick!', true);
            }, 300);
        } else if (it.what === 'present') {
            playCut('mid');
        } else if (it.what === 'shop') openCase(true);
        else if (it.what === 'door') {
            toast('Locked. The keyhole is shaped like a crescent moon.');
            leon.talk('A moon-shaped keyhole. Graveyards love hiding keys...', true);
            objective('Find the moon-shaped key (graveyard)');
        } else if (it.what === 'chest') {
            if (tagLeft('yard') > 0) { toast('The dead guard it... clear the graveyard first!', 'warn'); return; }
            S.flags.chestOpen = true; chest.rotation.x = -0.12;
            RE.Inv.addKey('moonKey');
            FX.burst(tmpV.set(W.CHEST.x, 0.9, W.CHEST.z), '#ffd36e', 30, 2, 0.8, -1, 1);
            toast('Got: Moon Key (Key Items)', 'good');
            objective('Unlock the chapel door');
            leon.talk('A key in a grave. Classic.', true);
        } else if (it.what === 'unlock') {
            RE.Inv.removeKey('moonKey');
            S.flags.doorOpen = true; RE.chapelDoor.setOpen(true);
            toast('The chapel door creaks open...');
            S.sub = 'inside'; objective('Search the chapel');
            setTimeout(() => citSay('Ladies first? ...Fine. Stay behind me, Kennedy.'), 600);
        } else if (it.what === 'note') {
            note.visible = false; S.flags.noteTaken = true;
            RE.Inv.addKey('note');
            playCut('chapel');
        }
    }

    // ----- zbieranie, śmierć wrogów -----
    // znajdźka -> walizka; jeśli się nie mieści, zostaje na ziemi ("No room")
    const PICK = { ammo: ['ammoHg', 10], shells: ['ammoSg', 4], herb: ['herbG', 1], herbR: ['herbR', 1] };
    function collect(p) {
        if (p.type === 'gem') { S.gems += p.amount; toast(`+${p.amount} Primogems`, 'gem'); return true; }
        const m = PICK[p.type];
        if (!m) return true;
        const want = p.qty !== undefined ? p.qty : m[1];
        const got = RE.Inv.add(m[0], want);
        const name = RE.Inv.ITEMS[m[0]].name;
        if (got === 0) {
            if (!(p.noRoomT > S.time)) { toast('No room for ' + name + '! [Tab] to sort the case', 'warn'); p.noRoomT = S.time + 3; }
            return false;
        }
        toast(`+${got} ${name}`, m[0].startsWith('herb') ? 'good' : '');
        if (got < want) { p.qty = want - got; p.noRoomT = S.time + 3; return false; }
        return true;
    }
    RE.onEnemyDown = function (e) {
        S.kills++;
        if (e.type === 'boss') {
            toast('The Party Pooper is down!', 'good');
            bossCake.visible = false;
            g.shake = 0.8;
        }
    };
    g.onEnemyGone = function (e) {
        RE.dropPickup(scene, 'gem', e.pos.x, e.pos.z, e.st.gems);
        const lowAmmo = S.ammo.hg.res + S.ammo.hg.mag < 12;
        const r = Math.random();
        if (r < (lowAmmo ? 0.55 : 0.28)) RE.dropPickup(scene, 'ammo', e.pos.x + 0.5, e.pos.z + 0.3);
        else if (r < (lowAmmo ? 0.65 : 0.4)) RE.dropPickup(scene, 'herb', e.pos.x - 0.4, e.pos.z + 0.4);
        else if (r < (lowAmmo ? 0.75 : 0.52)) RE.dropPickup(scene, 'shells', e.pos.x + 0.3, e.pos.z - 0.5);
        else if (r < (lowAmmo ? 0.78 : 0.57)) RE.dropPickup(scene, 'herbR', e.pos.x - 0.3, e.pos.z - 0.4);
        if (e.type === 'boss' || e.mega) { RE.dropPickup(scene, 'herb', e.pos.x + 1, e.pos.z); RE.dropPickup(scene, 'ammo', e.pos.x - 1, e.pos.z); }
        const i = RE.enemies.indexOf(e);
        if (i >= 0) RE.enemies.splice(i, 1);
    };

    // ----- śmierć gracza i powrót do punktu kontrolnego -----
    function restore(cp) {
        RE.Inv.load(cp.inv);
        S.gems = cp.gems; S.mags = Object.assign({}, cp.mags); S.love = cp.love; S.flags = Object.assign({}, cp.flags);
        S.chapter = cp.chapter; S.protectedOnce = !!cp.protectedOnce;
        S.weapon = RE.Inv.has(cp.weapon) ? cp.weapon : 'hg';
        S.haveCandles = S.flags.presentTaken;
        S.reloadT = 0; S.fireCd = 0;
        player.root.rotation.set(0, 0, 0);
        player.reset(); player.setWeapon(S.weapon); player.weapon = S.weapon;
        player.pos.set(cp.x, 0, cp.z); player.yaw = cp.yaw;
        leon.reset(); leon.pos.set(cp.x + 1.2, 0, cp.z + 1.2);
        cam.yaw = cp.yaw; cam.pitch = -0.05;
        deadT = 0;
        if (S.chapter < 6) { party.visible = false; for (const h of hats) h.visible = false; }
        applyFlags();
        placeStranger(CHAPTERS[S.chapter].merchant);
        if (S.chapter < 3) placeStranger(null);
    }
    function retry() {
        const cp = S.cp;
        clearField();
        restore(cp);
        if (cp.sub === 'midboss') { S.stage = 'forest'; g.startMegaFight(); }
        else if (cp.stage === 'boss' && cp.sub === 'fight') { g.spawnBoss(); g.startBossFight(); }
        else startStage(cp.stage, true);
    }
    function continueGame() {
        const sv = loadSave();
        if (!sv) return newGame();
        resetRun();
        S.kills = sv.kills || 0; S.time = sv.time || 0;
        S.cp = sv;
        retry();
        chapterCard(S.chapter);
    }
    function resetRun() {
        clearField();
        Object.assign(S, { stage: 'path', sub: '', wave: 0, chapter: 1, gems: 0, weapon: 'hg', mags: { hg: 10, sg: 6 }, love: CONFIG.LOVE_START, kills: 0, shots: 0, hits: 0, time: 0, reloadT: 0, fireCd: 0, boss: null, haveCandles: false, ambushed: false, won: false, protectedOnce: false, banterI: 0 });
        S.flags = { doorOpen: false, chestOpen: false, noteTaken: false, presentTaken: false };
        party.visible = false; for (const h of hats) h.visible = false;
        partyCake.userData.flames.visible = true;
        placeStranger(null);
        player.root.rotation.set(0, 0, 0);
        player.reset(); player.weapon = 'hg'; player.setWeapon('hg');
        leon.reset(); leon.kills = 0; leon.shots = 0;
        applyLoadout(1);
        applyFlags();
    }
    function newGame() {
        resetRun();
        g.placeActors(0, 68, Math.PI, 1.3, 69.2, Math.PI);
        playCut('intro');
    }
    // wybór rozdziału z menu (domyślne wyposażenie)
    function playChapter(n) {
        resetRun();
        applyLoadout(n);
        if (n === 3) placeStranger(CHAPTERS[3].merchant);
        enterChapter(n, 'new', true);
    }
    g.totalKills = () => S.kills;
    // ekran tytułowy: Continue / Chapters
    function refreshTitle() {
        const sv = loadSave();
        show('continueBtn', !!sv);
        show('chaptersBtn', !!sv);
        if (sv) $('continueBtn').innerHTML = '&#9654; Continue - Chapter ' + sv.chapter;
        const list = $('chapterList');
        list.innerHTML = '';
        for (let n = 1; n <= 6; n++) {
            const b = document.createElement('button');
            b.className = 'btn small';
            const open = sv && n <= (sv.max || 1);
            b.disabled = !open;
            b.textContent = n + '. ' + (open ? CHAPTERS[n].name : '???');
            b.addEventListener('click', () => playChapter(n));
            list.appendChild(b);
        }
    }

    // ===================================================================
    //  KAMERA ZZA RAMIENIA
    // ===================================================================
    function updateCamera(dt) {
        const a = player.aimT;
        const pivot = tmpV.set(player.pos.x, player.pos.y + 1.5 - (player.dead ? 1 : 0), player.pos.z);
        const f = camDir(tmpD);
        const rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
        const offR = lerp(0.75, 0.95, a), back = lerp(3.3, 1.7, a), up = lerp(0.2, 0.12, a);
        const sx = pivot.x + rx * offR, sz = pivot.z + rz * offR;
        const want = tmpV2.set(sx - f.x * back, pivot.y + up - f.y * back, sz - f.z * back);
        // kolizja kamery ze ścianami: promień od głowy do kamery
        const o = new V3(pivot.x, pivot.y, pivot.z);
        const dir = new V3().subVectors(want, o);
        const len = dir.length(); dir.divideScalar(len);
        const hit = RE.rayWorld(o, dir, len + 0.25);
        const dist = Math.max(0.3, Math.min(len, hit - 0.25));
        camera.position.copy(o).addScaledVector(dir, dist);
        if (camera.position.y < 0.25) camera.position.y = 0.25;
        g.shake = Math.max(0, g.shake - dt * 2);
        if (g.shake > 0) camera.position.add(new V3((Math.random() - 0.5) * g.shake * 0.3, (Math.random() - 0.5) * g.shake * 0.3, 0));
        camera.lookAt(sx + f.x * 20, pivot.y + up + f.y * 20, sz + f.z * 20);
        const fov = lerp(CONFIG.FOV, CONFIG.FOV_AIM, a);
        if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    function updateLaser() {
        const on = S.mode === 'play' && player.aimT > 0.6 && !player.dead;
        laser.visible = dot.visible = on;
        if (!on) return;
        const o = new V3(), d = new V3();
        aimRay(o, d);
        const h = RE.hitScan(o, d, 60);
        const m = player.guns[S.weapon].localToWorld(player.guns[S.weapon].userData.muzzle.clone());
        const arr = laserGeo.attributes.position.array;
        arr[0] = m.x; arr[1] = m.y; arr[2] = m.z; arr[3] = h.point.x; arr[4] = h.point.y; arr[5] = h.point.z;
        laserGeo.attributes.position.needsUpdate = true;
        dot.position.copy(h.point).addScaledVector(d, -0.05);
        $('cross').classList.toggle('on-enemy', !!h.enemy);
    }

    // ===================================================================
    //  PĘTLA
    // ===================================================================
    function separate() {
        const es = RE.enemies;
        for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
            const a = es[i], b = es[j];
            if (!a.alive() || !b.alive()) continue;
            const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.st.rad + b.st.rad;
            if (d < m && d > 1e-4) {
                const k = (m - d) / d * 0.5, wa = a.type === 'boss' ? 0.1 : 1, wb = b.type === 'boss' ? 0.1 : 1;
                a.pos.x -= dx * k * wa; a.pos.z -= dz * k * wa; b.pos.x += dx * k * wb; b.pos.z += dz * k * wb;
            }
        }
        // gracz i Leon też się nie przenikają z wrogami
        for (const who of [player, leon]) for (const e of es) {
            if (!e.alive()) continue;
            const dx = who.pos.x - e.pos.x, dz = who.pos.z - e.pos.z, d = Math.hypot(dx, dz), m = 0.35 + e.st.rad;
            if (d < m && d > 1e-4) { who.pos.x += dx / d * (m - d); who.pos.z += dz / d * (m - d); }
        }
    }
    function update(dt) {
        // walizka / kupiec = pauza (świat stoi)
        if (S.mode === 'case' || S.mode === 'shop') { updateHud(dt); return; }
        const playing = S.mode === 'play';
        g.cutHold = S.mode === 'cut';
        if (playing) S.time += dt;
        // gracz
        input.f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
        input.s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        input.run = !!(keys.ShiftLeft || keys.ShiftRight);
        const inp = playing ? input : { f: 0, s: 0, run: false };
        if (S.reloadT > 0 && playing) { S.reloadT -= dt; if (S.reloadT <= 0) finishReload(); }
        S.fireCd -= dt;
        player.update(dt, inp, cam.yaw, cam.pitch, playing && input.aim && !player.dead, S.reloadT > 0);
        leon.update(dt, player, playing);
        if (playing || S.mode === 'dead') {
            for (const e of RE.enemies.slice()) e.update(dt, player, g);
            separate();
            RE.updateOrbs(dt, player);
            RE.updatePickups(dt, player, collect);
            updateStage(dt);
            if (player.hp < 30 && player.hp > 0 && S.herbs > 0) leon.quip('lowhp');
            if (Math.random() < dt * 0.02 && alive() === 0) leon.quip('idle');
        }
        if (playing && player.dead) { deadT += dt; if (deadT > 1.6) { setMode('dead'); } }
        // przerywnik ustawia kamerę sam
        if (S.mode === 'cut') RE.Cut.update(dt);
        else if (S.mode !== 'title') updateCamera(dt);
        updateLaser();
        FX.update(dt);
        // cienie pod postaciami
        FX.shadowsBegin();
        FX.shadow(player.pos.x, player.pos.z, 0.4);
        FX.shadow(leon.pos.x, leon.pos.z, 0.42);
        for (const e of RE.enemies) if (!e.dead) FX.shadow(e.pos.x, e.pos.z, e.st.rad * 1.1);
        FX.shadowsEnd();
        // gwiazdy i księżyc jadą z kamerą
        world.sky.position.copy(camera.position);
        RE.updateLights(dt, player.pos.x, player.pos.z);
        // prompt E
        const it = playing ? interactable() : null;
        const pr = $('prompt');
        if (it) { pr.classList.remove('hidden'); setText('prompt', it.text); } else pr.classList.add('hidden');
        // ekran tytułowy: kamera powoli krąży nad wioską
        if (S.mode === 'title') {
            const t = performance.now() / 1000 * 0.05;
            const v = S.view;   // (test) stały widok [x, y, z, celX, celY, celZ]
            if (v) camera.position.set(v[0], v[1], v[2]); else camera.position.set(Math.sin(t) * 30, 14, 30 + Math.cos(t) * 30);
            if (v) camera.lookAt(v[3], v[4], v[5]); else camera.lookAt(0, 1, 10);
        }
        updateHud(dt);
    }

    let last = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        if (frozen) return;
        update(dt);
        renderer.render(scene, camera);
    }

    // ===================================================================
    //  ROZMIAR, PAUZA, PC ONLY
    // ===================================================================
    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        const sc = w * h > 1600000 ? CONFIG.RENDER_SCALE_BIG : CONFIG.RENDER_SCALE;
        renderer.setSize(Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc)), false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', () => { resize(); queuePc(); });
    resize();

    const EMBEDDED = window.self !== window.top;
    if (EMBEDDED) document.documentElement.classList.add('embedded');
    const MIN_W = EMBEDDED ? CONFIG.EMBED_MIN_W : CONFIG.MIN_W, MIN_H = EMBEDDED ? CONFIG.EMBED_MIN_H : CONFIG.MIN_H;
    $('pcMin').textContent = `${MIN_W}×${MIN_H}`;
    const touchOnlyMq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const finePointerMq = window.matchMedia('(any-pointer: fine)');
    let pcQueued = false;
    function checkPc() {
        pcQueued = false;
        const w = window.innerWidth, h = window.innerHeight;
        const touch = touchOnlyMq.matches && !finePointerMq.matches;
        pcBlocked = touch || w < MIN_W || h < MIN_H;
        $('pcSize').textContent = `${w}×${h}`;
        $('pcTouch').classList.toggle('hidden', !touch);
        show('pcOnly', pcBlocked);
        applyFreeze();
    }
    function queuePc() { if (!pcQueued) { pcQueued = true; requestAnimationFrame(checkPc); } }
    touchOnlyMq.addEventListener('change', queuePc);
    finePointerMq.addEventListener('change', queuePc);

    // zamrożenie: monit PC, pulpit (okno zminimalizowane), karta w tle, utrata fokusu
    let blurred = false;
    function applyFreeze() {
        const stop = pcBlocked || hostPaused || document.hidden || blurred;
        if (stop && !frozen) {
            frozen = true;
            for (const k in keys) keys[k] = false;
            input.aim = false;
            if (S.mode === 'play') pauseGame();
        } else if (!stop && frozen) {
            frozen = false; last = 0;
        }
    }
    function pauseGame() {
        if (S.mode !== 'play') return;
        S.mode = 'paused';
        show('paused', true);
        input.aim = false;
        // zwalniamy kursor, żeby dało się kliknąć "Resume"
        if (locked) document.exitPointerLock();
    }
    function resumeGame() {
        if (S.mode !== 'paused') return;
        show('paused', false);
        setMode('play');
    }
    window.addEventListener('blur', () => { blurred = true; applyFreeze(); });
    window.addEventListener('focus', () => { blurred = false; applyFreeze(); });
    document.addEventListener('visibilitychange', applyFreeze);
    // wiadomości z pulpitu: { type: 'hb-host', paused } (sprawdzamy nadawcę - z dysku origin to "null")
    window.addEventListener('message', (e) => {
        if (e.source !== window.parent || !e.data || e.data.type !== 'hb-host') return;
        hostPaused = !!e.data.paused;
        applyFreeze();
    });
    checkPc();

    // ===================================================================
    //  STEROWANIE
    // ===================================================================
    document.addEventListener('pointerlockchange', () => {
        const was = locked;
        locked = document.pointerLockElement === canvas;
        if (was && !locked && S.mode === 'play') pauseGame();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => { if (S.mode === 'play') e.preventDefault(); });
    canvas.addEventListener('mousedown', (e) => {
        if (S.mode !== 'play') return;
        if (!locked) lockPointer();
        if (e.button === 2) input.aim = true;
        if (e.button === 0) fire();
        e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) input.aim = false; });
    window.addEventListener('mousemove', (e) => {
        if (S.mode !== 'play' || player.dead) return;
        // bez blokady kursora obracamy tylko z wciśniętym przyciskiem (żeby kamera nie wariowała)
        if (!locked && !e.buttons) return;
        const s = input.aim ? CONFIG.SENS_AIM : CONFIG.SENS;
        cam.yaw -= e.movementX * s;
        cam.pitch = clamp(cam.pitch - e.movementY * s, -0.6, 0.75);
    });
    window.addEventListener('keydown', (e) => {
        if (e.repeat && (e.code === 'Space' || e.code === 'Escape')) return;
        keys[e.code] = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (e.code === 'Tab') e.preventDefault();
        if (S.mode === 'cut') {
            if (e.code === 'Space' || e.code === 'Enter') RE.Cut.next();
            if (e.code === 'Digit1' || e.code === 'Digit2') RE.Cut.choose(e.code === 'Digit1' ? 0 : 1);
            if (e.code === 'Escape') RE.Cut.skip();
            return;
        }
        if (S.mode === 'case' || S.mode === 'shop') {
            if (e.code === 'KeyR') RE.Inv.rotateDrag();
            if (S.mode === 'shop' && /^Digit[1-9]$/.test(e.code)) RE.Inv.buy(+e.code.slice(5) - 1);
            if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyI' || (S.mode === 'shop' && e.code === 'KeyE')) closeCase();
            return;
        }
        if (S.mode === 'paused' && (e.code === 'Space' || e.code === 'Enter')) { resumeGame(); return; }
        if (S.mode !== 'play') return;
        if (e.code === 'KeyR') reload();
        if (e.code === 'Digit1') switchWeapon(RE.Inv.weapons()[0]);
        if (e.code === 'Digit2') switchWeapon(RE.Inv.weapons()[1]);
        if (e.code === 'Tab' || e.code === 'KeyI') openCase(false);
        if (e.code === 'KeyE') interact();
        if (e.code === 'KeyH') useHerb();
        if (e.code === 'Escape' && !locked) pauseGame();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    $('startBtn').addEventListener('click', () => { newGame(); });
    $('continueBtn').addEventListener('click', continueGame);
    $('chaptersBtn').addEventListener('click', () => $('chapterList').classList.toggle('hidden'));
    $('resumeBtn').addEventListener('click', resumeGame);
    $('paused').addEventListener('click', (e) => { if (e.target === $('paused')) resumeGame(); });
    $('retryBtn').addEventListener('click', retry);
    $('againBtn').addEventListener('click', () => { show('end', false); newGame(); });

    RE.Cut.init(camera, { root: $('cut'), box: $('cutBox'), name: $('cutName'), text: $('cutText'), big: $('cutBig'), hint: $('cutHint'), choices: $('cutChoices') });
    RE.Inv.init(invApi);
    applyLoadout(1);
    player.weapon = 'hg'; player.setWeapon('hg');
    setMode('title');
    requestAnimationFrame(frame);

    // ===================================================================
    //  HACZYK DO TESTÓW (automaty w przeglądarce bez myszy)
    // ===================================================================
    window.hbRE = {
        S, cam, player, leon, g,
        state: () => ({ mode: S.mode, stage: S.stage, sub: S.sub, wave: S.wave, hp: player.hp, gems: S.gems, kills: S.kills, enemies: alive(), leonShots: leon.shots, leonKills: leon.kills, cut: RE.Cut.active, ammo: JSON.parse(JSON.stringify(S.ammo)), won: !!S.won, px: player.pos.x, pz: player.pos.z, frozen, boss: S.boss ? S.boss.hp : null, herbs: S.herbs, chapter: S.chapter, love: S.love, weapon: S.weapon, keys: RE.Inv.keys.slice(), inv: RE.Inv.items.map((o) => o.type + ':' + o.qty), choosing: RE.Cut.choosing(), door: S.flags.doorOpen }),
        start: newGame,
        chapter: (n) => { RE.Cut.skip(); playChapter(n); },
        cont: continueGame,
        choose: (i) => RE.Cut.choose(i),
        inv: RE.Inv,
        openCase: () => openCase(false),
        closeCase,
        interact,
        save: loadSave,
        clearSave: () => { try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) { /* nic */ } },
        skipCut: () => RE.Cut.skip(),
        nextLine: () => RE.Cut.next(),
        key: (code, down) => { keys[code] = down; },
        aim: (on) => { input.aim = on; },
        fire,
        // obróć kamerę na najbliższego wroga (głowa/tułów)
        aimAt: (head) => {
            let best = null, bd = 1e9;
            for (const e of RE.enemies) { if (!e.alive()) continue; const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
            if (!best) return false;
            const p = best.parts()[head ? 1 : 0].c;
            player.yaw = cam.yaw = Math.atan2(p.x - player.pos.x, p.z - player.pos.z);
            for (let i = 0; i < 4; i++) {
                updateCamera(0);
                const d = new V3().subVectors(p, camera.position).normalize();
                cam.yaw = Math.atan2(d.x, d.z) ; cam.pitch = Math.asin(d.y);
            }
            player.yaw = cam.yaw;
            return true;
        },
        spawn: (t, x, z, opt) => spawn(t, x, z, opt),
        drop: (t, x, z) => RE.dropPickup(scene, t, x, z),
        startStage: (n) => { RE.Cut.skip(); startStage(n); },
        teleport: (x, z, yaw) => { player.pos.set(x, 0, z); if (yaw !== undefined) { player.yaw = cam.yaw = yaw; } },
        killAll: () => { for (const e of RE.enemies) if (e.alive()) e.damage(99999, false, null, 'test'); },
        god: (on) => { RE.godMode = on; },
        win: () => {
            RE.Cut.skip();
            if (S.stage !== 'boss' || S.sub !== 'fight') { S.stage = 'boss'; g.spawnBoss(); g.startBossFight(); }
            if (S.boss) S.boss.damage(99999, false, null, 'test');
        },
        setDiff: (d) => { g.diff = d; },
        view: (v) => { S.view = v; },
    };
})();
