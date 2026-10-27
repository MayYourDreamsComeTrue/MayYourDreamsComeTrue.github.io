// =====================================================================
//  RESIDENT CAKE - walizka (attaché case) w stylu RE4
//  Siatka komórek; każdy przedmiot ma kształt (np. pistolet 3x2), można go
//  przeciągać myszką, R obraca w trakcie przeciągania. Amunicja i zioła
//  leżą w walizce, primogemy to zwykły licznik, a przedmioty fabularne
//  są w osobnej zakładce KEY ITEMS. Ta sama walizka służy u kupca.
//  Model (dane) jest tu, a zasady gry (leczenie, broń) daje game.js przez api.
// =====================================================================
/* global RE */
(function () {
    // ----- przedmioty: rozmiar w komórkach, stos, opis -----
    const ITEMS = {
        hg: { name: 'Handgun', w: 3, h: 2, kind: 'weapon', desc: 'Trusty 9mm. 10 rounds. Reliable - like a good partner.' },
        sg: { name: 'Shotgun', w: 5, h: 2, kind: 'weapon', desc: 'Riot gun. 6 shells. Party crashers hate this one trick.' },
        ammoHg: { name: 'Handgun Ammo', w: 1, h: 1, kind: 'ammo', max: 50, ammo: 'hg', price: 1, desc: '9mm rounds for the handgun. Stacks up to 50.' },
        ammoSg: { name: 'Shotgun Shells', w: 2, h: 1, kind: 'ammo', max: 20, ammo: 'sg', price: 4, desc: '12 gauge shells. Stacks up to 20.' },
        herbG: { name: 'Green Herb', w: 1, h: 2, kind: 'herb', heal: 50, price: 20, desc: 'Restores some health. Mix with another herb to make it stronger.' },
        herbR: { name: 'Red Herb', w: 1, h: 2, kind: 'herb', heal: 0, price: 30, desc: 'Useless on its own. Mix it with a Green Herb.' },
        herbGG: { name: 'Mixed Herbs (G+G)', w: 1, h: 2, kind: 'herb', heal: 80, price: 45, desc: 'Two green herbs. Restores a lot of health.' },
        herbGR: { name: 'Mixed Herbs (G+R)', w: 1, h: 2, kind: 'herb', heal: 100, price: 70, desc: 'Green + red. Restores ALL health. Smells like birthday tea.' },
    };
    const KEYS = {
        invite: { name: 'Party Invitation', desc: '"You\'re invited! Where: a creepy village. Dress code: armed." The birthday party Citlali refuses to miss.' },
        present: { name: 'Stolen Present', desc: 'Still wrapped. Rattles suspiciously. Found in the barn.' },
        candles: { name: 'Birthday Candles', desc: 'A box of birthday candles. No cake yet - that\'s the problem.' },
        moonKey: { name: 'Moon Key', desc: 'An old key shaped like a crescent moon. Found in a grave chest.' },
        note: { name: 'Pooper\'s Note', desc: '"Cake party at the village square. Midnight. No guests allowed. - The Party Pooper"' },
    };
    const RECIPES = { 'herbG+herbG': 'herbGG', 'herbG+herbR': 'herbGR', 'herbR+herbG': 'herbGR' };
    const CASES = [{ w: 8, h: 6, name: 'Attaché Case M' }, { w: 10, h: 7, name: 'Attaché Case L' }];

    // ----- pixelowe ikonki (litera = kolor) -----
    const PAL = {
        k: '#1b1446', g: '#5f574f', s: '#c2c3c7', w: '#f4f0e6', b: '#7a5232', y: '#ffd36e', o: '#c9a24a', r: '#d8424a',
        d: '#9a2a34', l: '#4caf50', e: '#2e7d32', p: '#9a5a3a', a: '#6b7a3a', m: '#8a3a32', c: '#5fe1ff',
    };
    const ICONS = {
        hg: [
            '............',
            '.kkkkkkkkkk.',
            '.ksssssssssk',
            '.kggggggggk.',
            '.....kbbbk..',
            '.....kbbk...',
            '....kbbbk...',
            '....kkkk....',
        ],
        sg: [
            '....................',
            '....................',
            'kkkkkkkkkkkkkkkk....',
            'sssssssssssssssskkk.',
            'kgggggggkkbbbbbbbbbk',
            '........kbk.kbbbbbbk',
            '........kk...kkkkkkk',
            '....................',
        ],
        ammoHg: ['......', '.yyyy.', '.oyoy.', '.aaaa.', '.aaaa.', '......'],
        ammoSg: ['........', '.rrrrrr.', '.oooooo.', '........'],
        herbG: ['.l..', 'lell', '.ll.', 'lle.', '.l..', 'pppp', 'pppp', '.pp.'],
        herbR: ['.r..', 'rdrr', '.rr.', 'rrd.', '.r..', 'pppp', 'pppp', '.pp.'],
        herbGG: ['l.l.', 'lell', 'elle', '.ll.', '.l..', 'pppp', 'pppp', '.pp.'],
        herbGR: ['r.l.', 'rdll', 'drle', '.rl.', '.l..', 'pppp', 'pppp', '.pp.'],
    };
    function icon(type, rot) {
        const rows = ICONS[type] || ['k'];
        const w = rows[0].length, h = rows.length;
        const cv = document.createElement('canvas');
        cv.width = rot ? h : w; cv.height = rot ? w : h;
        const c = cv.getContext('2d');
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const ch = rows[y][x];
            if (ch === '.') continue;
            c.fillStyle = PAL[ch];
            // obrót o 90° zgodnie z zegarem
            if (rot) c.fillRect(h - 1 - y, x, 1, 1); else c.fillRect(x, y, 1, 1);
        }
        return cv;
    }

    // ===================================================================
    //  MODEL
    // ===================================================================
    const Inv = RE.Inv = /** @type {any} */ ({ ITEMS, KEYS, CASES, w: 8, h: 6, items: [], keys: [], uid: 1, level: 0 });

    const dims = (it) => { const d = ITEMS[it.type]; return it.rot ? [d.h, d.w] : [d.w, d.h]; };
    Inv.dims = dims;
    // czy przedmiot (typ+obrót) zmieści się w (x, y), pomijając przedmiot ignoreUid
    Inv.canPlace = function (type, x, y, rot, ignoreUid) {
        const d = ITEMS[type], w = rot ? d.h : d.w, h = rot ? d.w : d.h;
        if (x < 0 || y < 0 || x + w > Inv.w || y + h > Inv.h) return false;
        for (const o of Inv.items) {
            if (o.uid === ignoreUid) continue;
            const [ow, oh] = dims(o);
            if (x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y) return false;
        }
        return true;
    };
    Inv.findSpot = function (type) {
        for (const rot of [false, true]) for (let y = 0; y < Inv.h; y++) for (let x = 0; x < Inv.w; x++) {
            if (Inv.canPlace(type, x, y, rot)) return { x, y, rot };
        }
        return null;
    };
    Inv.find = (uid) => Inv.items.find((o) => o.uid === uid);
    Inv.count = (type) => Inv.items.reduce((n, o) => n + (o.type === type ? o.qty : 0), 0);
    Inv.has = (type) => Inv.items.some((o) => o.type === type);
    Inv.hasKey = (k) => Inv.keys.includes(k);
    Inv.addKey = (k) => { if (!Inv.keys.includes(k)) Inv.keys.push(k); };
    Inv.removeKey = (k) => { Inv.keys = Inv.keys.filter((x) => x !== k); };
    Inv.remove = (uid) => { Inv.items = Inv.items.filter((o) => o.uid !== uid); };

    // dokłada ile się da; zwraca ile weszło (dry = tylko sprawdź)
    Inv.add = function (type, qty, dry) {
        const snap = dry ? Inv.save() : null;
        const d = ITEMS[type], max = d.max || 1;
        let left = qty;
        if (d.max) for (const o of Inv.items) {
            if (o.type !== type || o.qty >= max) continue;
            const n = Math.min(left, max - o.qty); o.qty += n; left -= n;
            if (!left) break;
        }
        while (left > 0) {
            const sp = Inv.findSpot(type);
            if (!sp) break;
            const n = Math.min(left, max);
            Inv.items.push({ uid: Inv.uid++, type, x: sp.x, y: sp.y, rot: sp.rot, qty: n });
            left -= n;
        }
        if (snap) Inv.load(snap);
        return qty - left;
    };
    // zabiera n sztuk (najpierw z najmniejszych stosów); zwraca ile zabrał
    Inv.take = function (type, n) {
        let got = 0;
        const st = Inv.items.filter((o) => o.type === type).sort((a, b) => a.qty - b.qty);
        for (const o of st) {
            const k = Math.min(n - got, o.qty); o.qty -= k; got += k;
            if (o.qty <= 0) Inv.remove(o.uid);
            if (got >= n) break;
        }
        return got;
    };
    Inv.move = function (uid, x, y, rot) {
        const it = Inv.find(uid);
        if (!it || !Inv.canPlace(it.type, x, y, rot, uid)) return false;
        it.x = x; it.y = y; it.rot = rot;
        return true;
    };
    // broń w kolejności w walizce (od góry, od lewej) - pod klawisze 1 / 2
    Inv.weapons = () => Inv.items.filter((o) => ITEMS[o.type].kind === 'weapon').sort((a, b) => a.y - b.y || a.x - b.x).map((o) => o.type);
    Inv.recipe = (a, b) => RECIPES[a + '+' + b] || null;
    // mieszanie: oba znikają, wynik ląduje na miejscu drugiego (albo gdziekolwiek)
    Inv.combine = function (uidA, uidB) {
        const a = Inv.find(uidA), b = Inv.find(uidB);
        if (!a || !b || a === b) return null;
        const out = Inv.recipe(a.type, b.type);
        if (!out) return null;
        Inv.remove(a.uid); Inv.remove(b.uid);
        const it = { uid: Inv.uid++, type: out, x: b.x, y: b.y, rot: b.rot, qty: 1 };
        if (!Inv.canPlace(out, it.x, it.y, it.rot)) { const sp = Inv.findSpot(out); if (sp) Object.assign(it, sp); }
        Inv.items.push(it);
        return it;
    };
    Inv.upgrade = function () {
        if (Inv.level >= CASES.length - 1) return false;
        Inv.level++; Inv.w = CASES[Inv.level].w; Inv.h = CASES[Inv.level].h;
        return true;
    };
    Inv.save = () => JSON.parse(JSON.stringify({ w: Inv.w, h: Inv.h, level: Inv.level, items: Inv.items, keys: Inv.keys, uid: Inv.uid }));
    Inv.load = function (o) {
        o = JSON.parse(JSON.stringify(o));
        Inv.w = o.w; Inv.h = o.h; Inv.level = o.level || 0; Inv.items = o.items; Inv.keys = o.keys || []; Inv.uid = o.uid || 1;
    };
    // nowa walizka z listą [typ, ilość]
    Inv.reset = function (list, level, keys) {
        Inv.level = level || 0; Inv.w = CASES[Inv.level].w; Inv.h = CASES[Inv.level].h;
        Inv.items = []; Inv.keys = (keys || []).slice(); Inv.uid = 1;
        for (const [t, n] of list) Inv.add(t, n);
    };

    // ===================================================================
    //  WIDOK: siatka, przeciąganie, panel opisu, przyciski, sklep
    // ===================================================================
    let api = null, el = null, sel = null, drag = null, combineFrom = null, discardArm = null, tab = 'case', shopMode = false;
    const CELL = () => el.grid.getBoundingClientRect().width / Inv.w;

    Inv.init = function (a) {
        api = a;
        const $ = (id) => document.getElementById(id);
        el = {
            root: $('case'), grid: $('caseGrid'), keys: $('keyList'), title: $('caseTitle'), gems: $('caseGems'),
            name: $('infoName'), desc: $('infoDesc'), qty: $('infoQty'), use: $('btnUse'), comb: $('btnCombine'), disc: $('btnDiscard'), sell: $('btnSell'),
            shop: $('shopPanel'), shopList: $('shopList'), status: $('caseStatus'), tabCase: $('tabCase'), tabKeys: $('tabKeys'), love: $('caseLove'), close: $('caseClose'),
        };
        el.use.addEventListener('click', () => useSel());
        el.comb.addEventListener('click', () => { if (sel && ITEMS[sel.type].kind === 'herb') { combineFrom = sel.uid; status('Combine with...? Click another herb.'); render(); } });
        el.disc.addEventListener('click', () => discardSel());
        el.sell.addEventListener('click', () => sellSel());
        el.tabCase.addEventListener('click', () => { tab = 'case'; render(); });
        el.tabKeys.addEventListener('click', () => { tab = 'keys'; render(); });
        el.close.addEventListener('click', () => api.close());
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    Inv.open = function (shop) {
        shopMode = !!shop; tab = 'case'; sel = null; combineFrom = null; discardArm = null; drag = null;
        el.root.classList.remove('hidden');
        el.root.classList.toggle('shop', shopMode);
        status(shopMode ? '"Welcome, stranger! What\'re ya buyin\'?"' : 'Drag items to arrange. R rotates while dragging.');
        render();
    };
    Inv.close = function () { cancelDrag(); el.root.classList.add('hidden'); };
    Inv.isOpen = () => el && !el.root.classList.contains('hidden');
    Inv.render = () => { if (Inv.isOpen()) render(); };
    function status(t) { el.status.textContent = t; }

    function render() {
        el.title.textContent = shopMode ? 'THE STRANGER' : CASES[Inv.level].name.toUpperCase();
        el.gems.textContent = String(api.gems());
        el.love.innerHTML = api.loveHtml();
        el.tabCase.classList.toggle('on', tab === 'case');
        el.tabKeys.classList.toggle('on', tab === 'keys');
        el.grid.classList.toggle('hidden', tab !== 'case');
        el.keys.classList.toggle('hidden', tab !== 'keys');
        el.shop.classList.toggle('hidden', !shopMode);
        el.grid.style.setProperty('--cols', String(Inv.w));
        el.grid.style.setProperty('--rows', String(Inv.h));
        // przedmioty
        el.grid.innerHTML = '';
        for (const it of Inv.items) {
            const [w, h] = dims(it);
            const d = document.createElement('div');
            d.className = 'case-item' + (sel && sel.uid === it.uid ? ' sel' : '') + (combineFrom === it.uid ? ' comb' : '');
            d.style.setProperty('--x', String(it.x)); d.style.setProperty('--y', String(it.y));
            d.style.setProperty('--w', String(w)); d.style.setProperty('--h', String(h));
            d.dataset.uid = String(it.uid); d.dataset.type = it.type;
            d.title = ITEMS[it.type].name;
            d.appendChild(icon(it.type, it.rot));
            if (ITEMS[it.type].max) { const q = document.createElement('b'); q.textContent = String(it.qty); d.appendChild(q); }
            if (api.equipped() === it.type) { const q = document.createElement('i'); q.textContent = 'E'; d.appendChild(q); }
            d.addEventListener('pointerdown', (ev) => onDown(ev, it, d));
            el.grid.appendChild(d);
        }
        // przedmioty fabularne
        el.keys.innerHTML = Inv.keys.length ? '' : '<p>No key items yet.</p>';
        for (const k of Inv.keys) {
            const b = document.createElement('button');
            b.className = 'key-item' + (sel && sel.key === k ? ' sel' : '');
            b.textContent = KEYS[k].name;
            b.addEventListener('click', () => { sel = { key: k }; render(); });
            el.keys.appendChild(b);
        }
        // opis zaznaczonego
        if (sel && !sel.key && !Inv.find(sel.uid)) sel = null;
        const s = sel && (sel.key ? KEYS[sel.key] : Inv.find(sel.uid) && ITEMS[sel.type]);
        el.name.textContent = s ? s.name : '-';
        el.desc.textContent = s ? s.desc : (tab === 'keys' ? 'Story items live here. They never take up space.' : 'Select an item to see what it does.');
        const it = sel && !sel.key ? Inv.find(sel.uid) : null;
        el.qty.textContent = it && ITEMS[it.type].max ? 'x' + it.qty : it && ITEMS[it.type].heal ? 'Heals ' + ITEMS[it.type].heal + '%' : '';
        const kind = it ? ITEMS[it.type].kind : '';
        el.use.textContent = kind === 'weapon' ? 'Equip' : 'Use';
        el.use.disabled = !it || kind === 'ammo' || (kind === 'weapon' && api.equipped() === it.type);
        el.comb.disabled = !it || kind !== 'herb';
        el.disc.disabled = !it || kind === 'weapon';
        el.disc.textContent = discardArm && it && discardArm === it.uid ? 'Sure?' : 'Discard';
        el.sell.classList.toggle('hidden', !shopMode);
        el.sell.disabled = !it || kind === 'weapon';
        el.sell.textContent = it && kind !== 'weapon' ? 'Sell +' + sellPrice(it) : 'Sell';
        if (shopMode) renderShop();
    }

    // ----- akcje -----
    function useSel() {
        const it = sel && Inv.find(sel.uid);
        if (!it) return;
        const d = ITEMS[it.type];
        if (d.kind === 'weapon') { api.equip(it.type); status('Equipped: ' + d.name + '.'); }
        else if (d.kind === 'herb') {
            if (!d.heal) { status('A red herb does nothing alone. Combine it with a green one!'); return; }
            const r = api.heal(d.heal);
            if (r === 'full') { status('Already in perfect health.'); return; }
            Inv.take(it.type, 1); sel = null; status('Used ' + d.name + '. Feeling better!');
        }
        render(); api.changed();
    }
    function discardSel() {
        const it = sel && Inv.find(sel.uid);
        if (!it || ITEMS[it.type].kind === 'weapon') return;
        if (discardArm !== it.uid) { discardArm = it.uid; render(); return; }
        Inv.remove(it.uid); discardArm = null; sel = null;
        status('Discarded ' + ITEMS[it.type].name + '.');
        render(); api.changed();
    }
    function sellPrice(it) { return (ITEMS[it.type].price || 0) * it.qty; }
    function sellSel() {
        const it = sel && Inv.find(sel.uid);
        if (!it || ITEMS[it.type].kind === 'weapon') return;
        const p = sellPrice(it);
        Inv.remove(it.uid); sel = null; api.addGems(p);
        status('"Heh heh, thank you!" (+' + p + ' Primogems)');
        render(); api.changed();
    }
    function tryCombine(a, b) {
        const out = Inv.combine(a, b);
        combineFrom = null;
        if (!out) { status('Those don\'t mix.'); render(); return false; }
        sel = { uid: out.uid, type: out.type };
        status('Mixed: ' + ITEMS[out.type].name + '!');
        render(); api.changed();
        return true;
    }

    // ----- kupiec -----
    function shopItems() {
        const list = [
            { id: 'ammoHg', label: 'Handgun ammo x15', type: 'ammoHg', qty: 15, cost: 40 },
            { id: 'ammoSg', label: 'Shotgun shells x6', type: 'ammoSg', qty: 6, cost: 60 },
            { id: 'herbG', label: 'Green herb', type: 'herbG', qty: 1, cost: 50 },
            { id: 'herbR', label: 'Red herb', type: 'herbR', qty: 1, cost: 70 },
        ];
        if (Inv.level < CASES.length - 1) list.push({ id: 'case', label: CASES[Inv.level + 1].name + ' (' + CASES[Inv.level + 1].w + 'x' + CASES[Inv.level + 1].h + ')', type: 'case', qty: 1, cost: 300 });
        return list;
    }
    function renderShop() {
        el.shopList.innerHTML = '';
        shopItems().forEach((s, i) => {
            const b = document.createElement('button');
            b.className = 'shop-item';
            b.disabled = api.gems() < s.cost;
            b.innerHTML = '<span>' + (i + 1) + '. ' + s.label + '</span><b>' + s.cost + '</b>';
            b.addEventListener('click', () => Inv.buy(i));
            el.shopList.appendChild(b);
        });
    }
    Inv.buy = function (i) {
        const s = shopItems()[i];
        if (!s) return false;
        if (api.gems() < s.cost) { status('"Not enough cash, stranger!"'); render(); return false; }
        if (s.id === 'case') { Inv.upgrade(); api.addGems(-s.cost); status('"A bigger case! More room for presents."'); }
        else {
            if (Inv.add(s.type, s.qty, true) < s.qty) { status('No room in the case! Sell or discard something first.'); render(); return false; }
            Inv.add(s.type, s.qty); api.addGems(-s.cost); status('"Heh heh, thank you!"');
        }
        render(); api.changed();
        return true;
    };

    // ----- przeciąganie myszką -----
    function onDown(ev, it, d) {
        if (ev.button !== 0) return;
        ev.preventDefault();
        discardArm = discardArm === it.uid ? discardArm : null;
        if (combineFrom && combineFrom !== it.uid) { tryCombine(combineFrom, it.uid); return; }
        sel = { uid: it.uid, type: it.type };
        const r = d.getBoundingClientRect(), c = CELL();
        drag = { uid: it.uid, type: it.type, rot: it.rot, rot0: it.rot, gx: Math.floor((ev.clientX - r.left) / c), gy: Math.floor((ev.clientY - r.top) / c), sx: ev.clientX, sy: ev.clientY, moved: false, el: null, px: ev.clientX, py: ev.clientY };
        render();
    }
    function ghost() {
        if (drag.el) drag.el.remove();
        const d = ITEMS[drag.type], w = drag.rot ? d.h : d.w, h = drag.rot ? d.w : d.h;
        const g = document.createElement('div');
        g.className = 'case-item ghost';
        g.style.setProperty('--w', String(w)); g.style.setProperty('--h', String(h));
        g.appendChild(icon(drag.type, drag.rot));
        el.grid.appendChild(g);
        drag.el = g;
        const src = el.grid.querySelector('[data-uid="' + drag.uid + '"]');
        if (src) src.classList.add('lifted');
    }
    function target() {
        const r = el.grid.getBoundingClientRect(), c = CELL();
        return { x: Math.round((drag.px - r.left) / c - drag.gx - 0.5), y: Math.round((drag.py - r.top) / c - drag.gy - 0.5) };
    }
    function place() {
        if (!drag || !drag.el) return;
        const t = target(), c = CELL();
        drag.el.style.setProperty('--x', String(t.x)); drag.el.style.setProperty('--y', String(t.y));
        const other = overlapOne(t.x, t.y);
        const ok = Inv.canPlace(drag.type, t.x, t.y, drag.rot, drag.uid);
        drag.el.classList.toggle('ok', ok || !!other);
        drag.el.classList.toggle('bad', !ok && !other);
        void c;
    }
    // upuszczenie zioła na inne zioło = mieszanie
    function overlapOne(x, y) {
        const d = ITEMS[drag.type], w = drag.rot ? d.h : d.w, h = drag.rot ? d.w : d.h;
        const hit = Inv.items.filter((o) => { if (o.uid === drag.uid) return false; const [ow, oh] = dims(o); return x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y; });
        return hit.length === 1 && Inv.recipe(drag.type, hit[0].type) ? hit[0] : null;
    }
    function onMove(ev) {
        if (!drag) return;
        drag.px = ev.clientX; drag.py = ev.clientY;
        if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 5) { drag.moved = true; ghost(); }
        place();
    }
    function onUp() {
        if (!drag) return;
        const dr = drag; drag = null;
        if (!dr.moved) return;
        drag = dr;
        const t = target(), other = overlapOne(t.x, t.y);
        drag = null;
        if (other) { tryCombine(dr.uid, other.uid); return; }
        if (Inv.move(dr.uid, t.x, t.y, dr.rot)) status('Moved ' + ITEMS[dr.type].name + '.');
        else status('It doesn\'t fit there.');
        render(); api.changed();
    }
    function cancelDrag() { if (drag && drag.el) drag.el.remove(); drag = null; }
    // R w trakcie przeciągania: obrót o 90°
    Inv.rotateDrag = function () {
        if (!drag || !drag.moved) return false;
        drag.rot = !drag.rot;
        const t = drag.gx; drag.gx = drag.gy; drag.gy = t;
        const d = ITEMS[drag.type], w = drag.rot ? d.h : d.w, h = drag.rot ? d.w : d.h;
        drag.gx = Math.min(drag.gx, w - 1); drag.gy = Math.min(drag.gy, h - 1);
        ghost(); place();
        return true;
    };
    Inv.dragging = () => !!drag;
    // dla testów: zaznacz przedmiot danego typu
    Inv.select = function (type) { const it = Inv.items.find((o) => o.type === type); sel = it ? { uid: it.uid, type } : null; render(); return !!it; };
    Inv.useSelected = useSel;
    Inv.sellSelected = sellSel;
    Inv.icon = icon;
})();
