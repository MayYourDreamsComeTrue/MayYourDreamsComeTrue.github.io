// =====================================================================
//  RESIDENT CAKE - świat: nocna wioska (droga, rynek ze studnią, stodoła)
//  Wszystko nieruchome jest sklejone w kilka dużych siatek (mało wywołań
//  rysowania). Tu są też przeszkody (kolizje) i promień "czy coś zasłania".
//  Układ mapy (x w prawo/wschód, z w dół mapy/południe):
//    droga wejściowa: x≈0, z 70 -> 15   rynek: środek (0,0), r≈17
//    ścieżka do stodoły: (10,-10) -> (30,-27)   stodoła: x 24..38, z -42..-28
//    na zachód: ognisko (-33,1.5) -> leśna ścieżka x -37..-86 -> jezioro (-106,13)
//    i kaplica x -116..-102, z -46..-30 (drzwi od północy) z cmentarzem obok
// =====================================================================
/* global THREE, RE */
(function () {
    const G = RE.G, merge = RE.merge;
    const W = {
        BOUNDS: { x0: -38, x1: 44, z0: -48, z1: 78 },    // gdzie wolno chodzić
        SQUARE: { x: 0, z: 0, r: 17 },
        BARN: { x0: 24, x1: 38, z0: -42, z1: -28, door0: 29, door1: 33, h: 5 },
        PRESENT: { x: 31, z: -38.5 },
        STRANGER: { x: 20, z: -13.5 },
        PARTY: { x: 0, z: 6 },                            // stół z tortem w finale
        START: { x: 0, z: 68 },
        LANTERNS: [[2.2, 58], [-2.2, 37], [2.4, 18], [-7, -7], [8, -6], [27.6, -27], [31, -35],
            [-50, 3.6], [-66, -6.8], [-80, 3.2], [-90, -14], [-104.4, -28], [-95, -1]],
        // zachód: leśna ścieżka -> jezioro -> stara kaplica z cmentarzem
        ZONES: [
            { x0: -38, x1: 44, z0: -48, z1: 78 },          // wioska
            { x0: -86, x1: -37, z0: -9, z1: 5 },           // leśna ścieżka
            { x0: -126, x1: -84, z0: -52, z1: 30 },        // jezioro i kaplica
        ],
        BONFIRE: { x: -33, z: 1.5 },
        LAKE: { x: -106, z: 13, r: 12 },
        CHAPEL: { x0: -116, x1: -102, z0: -46, z1: -30, door0: -111, door1: -107, h: 6 },
        CHEST: { x: -90, z: -48 },
        ALTAR: { x: -109, z: -44.4 },
    };
    // środek leśnej ścieżki (wije się)
    W.forestZ = (x) => -2 + Math.sin(x * 0.12) * 2.2;
    // odległość punktu od obszaru, po którym można chodzić (0 = w środku)
    W.outDist = function (x, z) {
        let best = 1e9;
        for (const r of W.ZONES) {
            const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
            best = Math.min(best, Math.hypot(dx, dz));
        }
        return best;
    };
    RE.W = W;

    /** @type {{x0:number,x1:number,z0:number,z1:number,h:number}[]} */
    const boxes = [];
    /** @type {{x:number,z:number,r:number,h:number}[]} */
    const circles = [];
    RE.boxes = boxes; RE.circles = circles;

    const solid = [], glow = [];      // listy kawałków do sklejenia
    const LIGHT_POOL = 8, pool = [];  // światła punktowe (stała liczba)
    const rnd = (a, b) => a + Math.random() * (b - a);

    // ----- kolory świata -----
    const C = {
        grass: ['#2c4632', '#31503a', '#2a4030', '#365640'], dirt: '#6b5a44', dirt2: '#5e4f3c', cobble: ['#5d5868', '#676176', '#544f60'],
        hill: '#243a2c', wall: '#8a7a68', wall2: '#9a8a74', beam: '#4a3626', roof: '#6b2f3a', roof2: '#5a3a5a', door: '#3b2a20',
        window: '#ffcf7a', barn: '#8a3a32', barnTrim: '#e8dccc', hay: '#d9b65a', hayDark: '#b8943a', fence: '#5a4632',
        trunk: '#4a3628', leaf: ['#1f3a2c', '#24442f', '#1a3326'], stone: '#77727f', stoneDark: '#5a5664', water: '#2a4a7a',
        lantern: '#ffcf7a', post: '#3a2a20', barrel: '#7a5232', barrelRing: '#3a3440', crate: '#9a7448', moon: '#f6f0ff',
        mud: '#3a3a3a', grave: '#6e6a78', glassA: '#f26dab', glassB: '#6fd0e6', glassC: '#f2c14e', fire: '#ffb347', fire2: '#ff7a3a',
    };

    // ----- prostokąt-przeszkoda + jego kawałki -----
    function addBox(cx, cz, w, d, h, color, rotY) {
        solid.push([G.box(w, h, d), color, [cx, h / 2, cz], [0, rotY || 0, 0]]);
        boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h });
    }

    // ----- ziemia: siatka z kolorem w wierzchołkach (trawa, droga, bruk), poza mapą wzgórza -----
    function segDist(x, z, ax, az, bx, bz) {
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
        return Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az)));
    }
    function onPath(x, z) {
        if (z > 12 && z < 82 && Math.abs(x - Math.sin(z * 0.08) * 1.2) < 2.2) return true;
        // odcinek rynek -> stodoła
        if (segDist(x, z, 9, -9, 31, -28) < 1.9) return true;
        // rynek -> ognisko -> las -> rozwidlenie (kaplica / jezioro)
        if (segDist(x, z, -14, -3, -37, -2) < 1.8) return true;
        if (x < -36 && x > -88 && Math.abs(z - W.forestZ(x)) < 1.7) return true;
        if (segDist(x, z, -87, W.forestZ(-87), -95, -16) < 1.6 || segDist(x, z, -95, -16, -109, -29) < 1.6) return true;
        return segDist(x, z, -87, W.forestZ(-87), -94, 2) < 1.6;
    }
    function buildGround() {
        const geo = new THREE.PlaneGeometry(220, 170, 110, 85);
        geo.rotateX(-Math.PI / 2);
        geo.translate(-32, 0, 15);
        const p = geo.attributes.position, col = [];
        const c = new THREE.Color();
        const L = W.LAKE, CH = W.CHAPEL;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i);
            const out = Math.max(W.outDist(x, z) - 2, 0);
            let y = 0;
            if (out > 0) y = out * 0.45 + Math.sin(x * 0.3) * Math.cos(z * 0.27) * 1.2 + rnd(0, 0.6);
            else y = rnd(-0.02, 0.04);
            p.setY(i, y);
            const inSquare = Math.hypot(x - W.SQUARE.x, z - W.SQUARE.z) < W.SQUARE.r;
            const inBarn = x > W.BARN.x0 && x < W.BARN.x1 && z > W.BARN.z0 && z < W.BARN.z1;
            const inChapel = x > CH.x0 && x < CH.x1 && z > CH.z0 && z < CH.z1;
            const lakeD = Math.hypot(x - L.x, z - L.z);
            let k;
            if (out > 0) k = C.hill;
            else if (lakeD < L.r + 0.8) { k = C.mud; if (lakeD < L.r) p.setY(i, -0.4); }
            else if (inChapel) k = C.cobble[(i >> 1) % 3];
            else if (inBarn) k = (i % 3) ? C.hay : C.hayDark;
            else if (inSquare) k = C.cobble[i % 3];
            else if (onPath(x, z)) k = (i % 2) ? C.dirt : C.dirt2;
            else k = C.grass[(i * 7 + (i >> 3)) % 4];
            c.set(k);
            col.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        geo.computeVertexNormals();
        return new THREE.Mesh(geo, RE.mat);
    }

    // ----- dach dwuspadowy (wspólny dla domów i stodoły) -----
    // Kalenica wzdłuż osi X (alongX) albo Z. len = długość ściany pod kalenicą, wid = szerokość domu
    // w poprzek, baseY = góra ścian, rise = wysokość szczytu. Dwie części, obie zamknięte bryły
    // (przeciągnięty profil, więc żadna ściana nie znika przez odwrócone trójkąty):
    //  - połać: profil "daszka" z grubością t, z okapem (oh) po bokach i ohEnd na końcach,
    //  - szczyt: trójkątny graniastosłup w kolorze ścian, który domyka dom od góry do kalenicy.
    function gableRoof(cx, cz, baseY, len, wid, rise, alongX, roofColor, gableColor) {
        const oh = 0.45, ohEnd = 0.35, t = 0.18;
        const k = rise / (wid / 2);           // nachylenie połaci
        const a = wid / 2 + oh, drop = oh * k; // okap schodzi niżej, po linii połaci
        const V = (x, y) => new THREE.Vector2(x, y);
        // spód połaci leży dokładnie na skosie szczytu, wierzch t wyżej
        const slab = new THREE.ExtrudeGeometry(new THREE.Shape([
            V(-a, t - drop), V(-a, -drop), V(0, rise), V(a, -drop), V(a, t - drop), V(0, rise + t),
        ]), { depth: len + ohEnd * 2, bevelEnabled: false, steps: 1 });
        slab.translate(0, 0, -(len / 2 + ohEnd));
        const gable = new THREE.ExtrudeGeometry(new THREE.Shape([V(-wid / 2, 0), V(wid / 2, 0), V(0, rise)]),
            { depth: len, bevelEnabled: false, steps: 1 });
        gable.translate(0, 0, -len / 2);
        // profil leży w płaszczyźnie (x, y) i jest przeciągany wzdłuż z; obrót o 90° kładzie kalenicę wzdłuż X
        const rot = [0, alongX ? Math.PI / 2 : 0, 0];
        solid.push([slab, roofColor, [cx, baseY, cz], rot], [gable, gableColor, [cx, baseY, cz], rot]);
    }

    // ----- dom: ściany, belki, dach dwuspadowy, drzwi, świecące okna -----
    function house(cx, cz, w, d, rot90) {
        const h = 3.2;
        if (rot90) { const t = w; w = d; d = t; }
        const wallC = Math.random() < 0.5 ? C.wall : C.wall2;
        addBox(cx, cz, w, d, h, wallC);
        // belki w rogach i pod dachem
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.push([G.box(0.25, h, 0.25), C.beam, [cx + sx * w / 2, h / 2, cz + sz * d / 2]]);
        solid.push([G.box(w + 0.1, 0.2, d + 0.1), C.beam, [cx, h, cz]]);
        // dach: kalenica wzdłuż dłuższego boku (belka pod dachem wystaje 0.1 nad ściany)
        const along = w >= d;
        gableRoof(cx, cz, h + 0.1, along ? w : d, along ? d : w, Math.min(w, d) * 0.38, along, Math.random() < 0.6 ? C.roof : C.roof2, wallC);
        // drzwi i okna na każdej ścianie (świecą na ciepło)
        const faces = [[0, d / 2 + 0.02, 0], [0, -d / 2 - 0.02, Math.PI], [w / 2 + 0.02, 0, Math.PI / 2], [-w / 2 - 0.02, 0, -Math.PI / 2]];
        faces.forEach(([fx, fz, ry], i) => {
            const len = (i < 2 ? w : d);
            if (i === 0) solid.push([G.box(1.0, 2.0, 0.06), C.door, [cx + fx, 1.0, cz + fz], [0, ry, 0]]);
            for (const o of [-0.3, 0.3]) {
                if (Math.random() < 0.25) continue;
                const off = o * len;
                const wx = cx + fx + (i < 2 ? off : 0), wz = cz + fz + (i < 2 ? 0 : off);
                glow.push([G.box(0.7, 0.7, 0.05), Math.random() < 0.8 ? C.window : '#ffe9b0', [wx, 1.9, wz], [0, ry, 0]]);
                solid.push([G.box(0.85, 0.1, 0.08), C.beam, [wx, 1.52, wz], [0, ry, 0]]);
            }
        });
    }

    function tree(x, z, s) {
        solid.push([G.cyl(0.15 * s, 0.22 * s, 1.4 * s, 5), C.trunk, [x, 0.7 * s, z]]);
        for (let i = 0; i < 3; i++) solid.push([G.cone((1.5 - i * 0.35) * s, 1.6 * s, 6), C.leaf[i % 3], [x, (1.6 + i * 0.9) * s, z], [0, rnd(0, 3), 0]]);
        if (W.outDist(x, z) < 1) circles.push({ x, z, r: 0.45 * s, h: 5 * s });
    }
    function barrel(x, z) {
        solid.push([G.cyl(0.38, 0.38, 1.0, 8), C.barrel, [x, 0.5, z]], [G.cyl(0.4, 0.4, 0.06, 8), C.barrelRing, [x, 0.2, z]], [G.cyl(0.4, 0.4, 0.06, 8), C.barrelRing, [x, 0.8, z]]);
        circles.push({ x, z, r: 0.4, h: 1.0 });
    }
    function crate(x, z, s) {
        addBox(x, z, s, s, s, C.crate);
        solid.push([G.box(s + 0.02, 0.08, s + 0.02), C.beam, [x, s * 0.5, z]]);
    }
    function fence(x0, z0, x1, z1) {
        const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.6));
        const ang = Math.atan2(x1 - x0, z1 - z0);
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            solid.push([G.box(0.14, 1.1, 0.14), C.fence, [x0 + (x1 - x0) * t, 0.55, z0 + (z1 - z0) * t]]);
        }
        for (const y of [0.45, 0.85]) solid.push([G.box(0.06, 0.1, len), C.fence, [(x0 + x1) / 2, y, (z0 + z1) / 2], [0, ang, 0]]);
        // przeszkoda: cienkie prostokąty wzdłuż płotu (płot jest zawsze prosty w x albo z)
        boxes.push({ x0: Math.min(x0, x1) - 0.12, x1: Math.max(x0, x1) + 0.12, z0: Math.min(z0, z1) - 0.12, z1: Math.max(z0, z1) + 0.12, h: 1.1 });
    }
    function lantern(x, z) {
        solid.push([G.cyl(0.07, 0.09, 2.6, 5), C.post, [x, 1.3, z]], [G.box(0.5, 0.06, 0.06), C.post, [x + 0.2, 2.55, z]], [G.box(0.26, 0.05, 0.26), C.post, [x + 0.4, 2.48, z]]);
        glow.push([G.box(0.2, 0.28, 0.2), C.lantern, [x + 0.4, 2.3, z]]);
        circles.push({ x, z, r: 0.15, h: 2.6 });
    }
    function hay(x, z, rot) {
        addBox(x, z, rot ? 0.9 : 1.6, rot ? 1.6 : 0.9, 0.8, C.hay);
        solid.push([G.box(rot ? 0.92 : 1.62, 0.06, rot ? 1.62 : 0.92), C.hayDark, [x, 0.55, z]]);
    }

    // ----- stodoła: ściany z dziurą na drzwi, dach, siano, prezent w środku -----
    function barn() {
        const B = W.BARN, t = 0.4, h = B.h;
        const wall = (x0, x1, z0, z1) => addBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, C.barn);
        wall(B.x0, B.x1, B.z0, B.z0 + t);                // tył
        wall(B.x0, B.x0 + t, B.z0, B.z1);                // lewa
        wall(B.x1 - t, B.x1, B.z0, B.z1);                // prawa
        wall(B.x0, B.door0, B.z1 - t, B.z1);             // przód lewy
        wall(B.door1, B.x1, B.z1 - t, B.z1);             // przód prawy
        solid.push([G.box(B.door1 - B.door0, 1.2, t), C.barn, [(B.door0 + B.door1) / 2, h - 0.6, B.z1 - t / 2]]);   // nad drzwiami
        // białe ramy (krzyżyki na skrzydłach drzwi)
        for (const x of [B.door0 - 1, B.door1 + 1]) {
            solid.push([G.box(1.8, 0.15, 0.06), C.barnTrim, [x, 2, B.z1 + 0.03], [0, 0, 0.8]], [G.box(1.8, 0.15, 0.06), C.barnTrim, [x, 2, B.z1 + 0.03], [0, 0, -0.8]]);
        }
        // dach
        // dach: kalenica od drzwi do tyłu (szczyt nad wrotami, jak w prawdziwej stodole)
        gableRoof((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, h, B.z1 - B.z0, B.x1 - B.x0, 3.4, false, C.roof, C.barn);
        // siano
        hay(26, -40); hay(26, -38.8, false); hay(36, -40, true); hay(36, -32, true); hay(26, -31); hay(27.8, -40);
        solid.push([G.box(1.6, 0.8, 0.9), C.hay, [26, 1.2, -40]]);
    }

    // ----- ognisko na skraju wioski (scena przy ognisku + kupiec) -----
    function bonfire() {
        const F = W.BONFIRE;
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; solid.push([G.ball(0.22, 0), C.stoneDark, [F.x + Math.sin(a) * 0.75, 0.1, F.z + Math.cos(a) * 0.75]]); }
        for (let i = 0; i < 4; i++) solid.push([G.cyl(0.08, 0.1, 1.1, 5), C.trunk, [F.x, 0.25, F.z], [Math.PI / 2 - 0.5, i * Math.PI / 2 + 0.4, 0]]);
        glow.push([G.cone(0.38, 0.9, 5), C.fire2, [F.x, 0.5, F.z]], [G.cone(0.22, 0.7, 5), C.fire, [F.x + 0.05, 0.55, F.z - 0.04], [0, 0.6, 0]]);
        // kłody do siedzenia
        solid.push([G.cyl(0.22, 0.22, 1.8, 6), C.trunk, [F.x - 1.7, 0.22, F.z + 0.4], [Math.PI / 2, 0.3, 0]], [G.cyl(0.22, 0.22, 1.8, 6), C.trunk, [F.x + 1.6, 0.22, F.z + 0.6], [Math.PI / 2, -0.4, 0]]);
        circles.push({ x: F.x, z: F.z, r: 0.85, h: 0.5 });
    }

    // ----- zachód: las, jezioro, kaplica z dzwonnicą, cmentarz -----
    function westlands() {
        // gęsto po bokach leśnej ścieżki + zwalone pnie jako osłony
        for (let x = -84; x < -40; x += rnd(2.6, 3.6)) {
            tree(x, rnd(-8.6, -7.4), rnd(1.1, 1.6));
            tree(x + 1.4, rnd(3.4, 4.6), rnd(1.1, 1.6));
        }
        [[-47, -5.5], [-58, 1.5], [-71, -5], [-77, 1]].forEach(([x, z], i) => {
            solid.push([G.cyl(0.32, 0.36, 2.6, 6), C.trunk, [x, 0.32, z], [0, 0, Math.PI / 2 + (i % 2 ? 0.2 : -0.2)]]);
            boxes.push({ x0: x - 1.3, x1: x + 1.3, z0: z - 0.4, z1: z + 0.4, h: 0.7 });
        });
        [[-55, -4], [-63, 0.5], [-74, -0.5]].forEach(([x, z]) => crate(x, z, 1));
        // jezioro: tafla, kamienie na brzegu, lilie; wody nie da się przejść
        const L = W.LAKE;
        solid.push([new THREE.CircleGeometry(L.r + 0.3, 24), C.water, [L.x, 0.04, L.z], [-Math.PI / 2, 0, 0]]);
        glow.push([G.box(0.6, 0.02, 7), '#8a8ad0', [L.x + 3, 0.06, L.z - 1], [0, -0.5, 0]]);
        for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; solid.push([G.ball(rnd(0.3, 0.6), 0), C.stone, [L.x + Math.sin(a) * (L.r + 0.6), 0.1, L.z + Math.cos(a) * (L.r + 0.6)]]); }
        for (let i = 0; i < 8; i++) solid.push([G.cyl(0.4, 0.4, 0.03, 7), C.leaf[1], [L.x + rnd(-8, 8), 0.07, L.z + rnd(-8, 8)]]);
        circles.push({ x: L.x, z: L.z, r: L.r, h: 0.02 });
        // kaplica: kamienne ściany, drzwi od północy, dach dwuspadowy, witraże, ławki, ołtarz
        const K = W.CHAPEL, t = 0.5, h = K.h;
        const wall = (x0, x1, z0, z1) => addBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, C.stone);
        wall(K.x0, K.x1, K.z0, K.z0 + t);
        wall(K.x0, K.x0 + t, K.z0, K.z1);
        wall(K.x1 - t, K.x1, K.z0, K.z1);
        wall(K.x0, K.door0, K.z1 - t, K.z1);
        wall(K.door1, K.x1, K.z1 - t, K.z1);
        solid.push([G.box(K.door1 - K.door0, 2, t), C.stone, [(K.door0 + K.door1) / 2, h - 1, K.z1 - t / 2]]);
        gableRoof((K.x0 + K.x1) / 2, (K.z0 + K.z1) / 2, h, K.z1 - K.z0, K.x1 - K.x0, 4, false, C.roof2, C.stone);
        // dzwonnica z czterospadowym daszkiem
        addBox(K.x0 + 1.5, K.z1 + 1, 3.4, 3.4, 11, C.stoneDark);
        solid.push([new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), C.roof2, [K.x0 + 1.5, 12.2, K.z1 + 1], [0, Math.PI / 4, 0], [3.1, 2.4, 3.1]]);
        glow.push([G.box(1, 1.4, 0.05), C.glassC, [K.x0 + 1.5, 8.5, K.z1 + 2.73]]);
        // witraże po bokach (świecą)
        [-42, -38, -34].forEach((z, i) => {
            const c = [C.glassA, C.glassB, C.glassC][i];
            glow.push([G.box(0.06, 1.8, 1), c, [K.x0 - 0.03, 3.4, z]], [G.box(0.06, 1.8, 1), c, [K.x1 + 0.03, 3.4, z]]);
        });
        glow.push([G.ball(0.7, 1), C.glassA, [(K.x0 + K.x1) / 2, h - 0.2, K.z1 + 0.03], null, [1, 1, 0.08]]);
        // ławki i ołtarz ze świecami
        for (const z of [-42.6, -40.2, -37.8, -35.4]) { addBox(-112.6, z, 3.4, 0.7, 0.9, C.beam); addBox(-105.4, z, 3.4, 0.7, 0.9, C.beam); }
        addBox(W.ALTAR.x, W.ALTAR.z - 0.4, 3, 1.1, 1.1, C.stone);
        for (const dx of [-1.2, -0.8, 0.8, 1.2]) { solid.push([G.cyl(0.05, 0.05, 0.3, 5), '#fff3f8', [W.ALTAR.x + dx, 1.25, W.ALTAR.z - 0.6]]); glow.push([G.cone(0.04, 0.1, 4), C.fire, [W.ALTAR.x + dx, 1.45, W.ALTAR.z - 0.6]]); }
        // cmentarz: nagrobki, krzyże, płot z przejściem
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            const x = -98 + i * 2.8 + rnd(-0.3, 0.3), z = -48 + j * 3.2;
            if (Math.hypot(x - W.CHEST.x, z - W.CHEST.z) < 2.5 || Math.random() < 0.15) continue;
            addBox(x, z, 0.9, 0.3, 1.0, C.grave);
            if ((i + j) % 2) solid.push([G.box(0.16, 0.8, 0.16), C.grave, [x, 1.3, z]], [G.box(0.6, 0.16, 0.16), C.grave, [x, 1.45, z]]);
            else solid.push([G.cyl(0.45, 0.45, 0.3, 8), C.grave, [x, 1.0, z], [Math.PI / 2, 0, 0], [1, 1, 1]]);
        }
        fence(-100, -34.5, -96, -34.5); fence(-91, -34.5, -86, -34.5); fence(-86, -51, -86, -34.5);
        tree(-88, -40, 1.2); tree(-118, -24, 1.4); tree(-121, -6, 1.3); tree(-90, 22, 1.3); tree(-87, -26, 1.1);
        [[-96, -22], [-118, -16], [-101, -4]].forEach(([x, z]) => barrel(x, z));
        [[-92, -28, 1], [-112, -18, 1.1], [-98, -12, 1]].forEach(([x, z, sc]) => crate(x, z, sc));
    }

    // drzwi kaplicy: osobna siatka + przeszkoda, którą zdejmujemy po otwarciu kluczem
    function chapelDoor(scene) {
        const K = W.CHAPEL, w = K.door1 - K.door0;
        const pivot = new THREE.Group();
        pivot.position.set(K.door0, 0, K.z1 - 0.25);
        const m = new THREE.Mesh(merge([
            [G.box(w, 4, 0.2), C.door, [w / 2, 2, 0]],
            [G.box(w, 0.15, 0.24), C.barrelRing, [w / 2, 1, 0]], [G.box(w, 0.15, 0.24), C.barrelRing, [w / 2, 3, 0]],
            [G.box(0.3, 0.3, 0.26), '#c9a24a', [w / 2, 2, 0]],
        ]), RE.mat);
        pivot.add(m); scene.add(pivot);
        const box = { x0: K.door0, x1: K.door1, z0: K.z1 - 0.5, z1: K.z1, h: 4 };
        boxes.push(box);
        RE.chapelDoor = {
            open: false,
            setOpen(v) {
                this.open = v;
                pivot.rotation.y = v ? -1.9 : 0;
                const i = boxes.indexOf(box);
                if (v && i >= 0) boxes.splice(i, 1);
                if (!v && i < 0) boxes.push(box);
            },
        };
    }

    // ----- studnia na rynku -----
    function well() {
        solid.push([G.cyl(1.2, 1.3, 0.9, 10), C.stone, [0, 0.45, 0]], [G.cyl(0.95, 0.95, 0.05, 10), C.water, [0, 0.7, 0]]);
        for (const x of [-1.05, 1.05]) solid.push([G.box(0.15, 2.2, 0.15), C.beam, [x, 1.1, 0]]);
        solid.push([G.box(2.4, 0.12, 0.15), C.beam, [0, 2.2, 0]]);
        solid.push([new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), C.roof, [0, 2.6, 0], [0, Math.PI / 4, 0], [1.8, 0.8, 1.8]]);
        circles.push({ x: 0, z: 0, r: 1.3, h: 0.9 });
    }

    // ----- budowanie całości -----
    RE.buildWorld = function (scene) {
        scene.add(buildGround());
        // domy wokół rynku i przy drodze
        house(-14, -12, 8, 6); house(-17, 6, 6, 8); house(14, 12, 7, 6); house(-3, -21, 9, 6); house(17, 1, 6, 6, true);
        house(-9, 30, 6, 5); house(9, 41, 5, 6); house(-10, 52, 7, 5, true); house(10, 62, 6, 5);
        house(-25, -26, 7, 6); house(5, -33, 6, 5);
        barn(); well(); bonfire(); westlands(); chapelDoor(scene);
        // płoty wzdłuż drogi
        fence(-3.5, 22, -3.5, 28); fence(3.5, 24, 3.5, 34); fence(-3.5, 44, -3.5, 49); fence(3.6, 50, 3.6, 57);
        fence(22, -24, 22, -18); fence(40, -44, 40, -26);
        // beczki i skrzynie (osłony dla Leona)
        [[5.5, 26], [-5.5, 41], [4.6, 47], [-6.5, 8], [9, -3], [-9.5, -3], [6, -13], [-4, -12], [24, -20], [34, -25], [22, -33]].forEach(([x, z]) => barrel(x, z));
        [[-5.5, 20, 1.1], [5.8, 34.5, 1], [-6, 60, 1.1], [11, 6, 1.1], [-11, 13, 1], [12.6, -11, 1], [-8.5, -16, 1.2], [28.5, -24, 1.1], [35, -30.5, 1]].forEach(([x, z, s]) => crate(x, z, s));
        // latarnie
        W.LANTERNS.forEach(([x, z]) => lantern(x - 0.4, z));
        // las dookoła (poza mapą gęsto, w środku pojedyncze drzewa)
        for (let n = 0, tries = 0; n < 380 && tries < 20000; tries++) {
            const x = rnd(-142, 58), z = rnd(-66, 92), o = W.outDist(x, z);
            if (o < 1 || o > 15) continue;
            tree(x, z, rnd(1.0, 1.7)); n++;
        }
        [[-14, 40], [14, 30], [-20, 22], [22, 20], [-28, -8], [30, 2], [-30, 12], [36, -10], [-22, 60], [20, 70], [16, 52], [-18, -40], [12, -44], [-32, 35]].forEach(([x, z]) => tree(x, z, rnd(1, 1.4)));

        const world = new THREE.Mesh(merge(solid), RE.mat);
        const lights = new THREE.Mesh(merge(glow), RE.glowMat);
        scene.add(world, lights);

        // ----- niebo: księżyc i gwiazdy (podążają za kamerą, bez mgły) -----
        const sky = new THREE.Group();
        const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 12), new THREE.MeshBasicMaterial({ color: C.moon, fog: false }));
        moon.position.set(-120, 110, -160); moon.lookAt(0, 0, 0);
        const halo = new THREE.Mesh(new THREE.CircleGeometry(16, 12), new THREE.MeshBasicMaterial({ color: '#8a8ad0', transparent: true, opacity: 0.25, fog: false }));
        halo.position.copy(moon.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0);
        const sp = [];
        for (let i = 0; i < 500; i++) {
            const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.15;
            sp.push(Math.cos(a) * Math.cos(e) * 250, Math.sin(e) * 250, Math.sin(a) * Math.cos(e) * 250);
        }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, sizeAttenuation: false, fog: false }));
        sky.add(moon, halo, stars);
        scene.add(sky);

        // ----- światła: niebo, księżyc, stała liczba latarni (zmiana liczby świateł = przebudowa shaderów, więc nigdy nie dokładamy w trakcie) -----
        scene.add(new THREE.HemisphereLight('#6a70c0', '#2a2236', 1.6));
        const moonL = new THREE.DirectionalLight('#a8b8ff', 1.1); moonL.position.set(-60, 100, -40); scene.add(moonL);
        const spots = W.LANTERNS.map(([x, z]) => [x, 2.4, z]).concat([[W.BONFIRE.x, 1.2, W.BONFIRE.z], [W.ALTAR.x, 2, W.ALTAR.z]]);
        for (let i = 0; i < LIGHT_POOL; i++) {
            const l = new THREE.PointLight('#ffb36b', 18, 15, 1.4);
            l.position.set(spots[i][0], spots[i][1], spots[i][2]);
            scene.add(l); pool.push(l);
        }
        // stała liczba świateł (zmiana = przebudowa shaderów); co chwilę przypinamy je do najbliższych latarni
        let lt = 0;
        RE.updateLights = function (dt, x, z) {
            lt -= dt;
            if (lt > 0) return;
            lt = 0.3;
            /** @type {Array<[number, number[]]>} */
            const near = spots.map((p) => /** @type {[number, number[]]} */ ([Math.hypot(p[0] - x, p[2] - z), p])).sort((a, b) => a[0] - b[0]);
            pool.forEach((l, i) => l.position.set(near[i][1][0], near[i][1][1], near[i][1][2]));
        };
        return { sky };
    };

    // ===================================================================
    //  KOLIZJE: wypychanie koła (postać) z prostokątów i kół, granice mapy
    // ===================================================================
    RE.pushOut = function (p, r) {
        for (const b of boxes) {
            const cx = Math.max(b.x0, Math.min(b.x1, p.x)), cz = Math.max(b.z0, Math.min(b.z1, p.z));
            const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
            else {
                // środek w środku prostokąta: wypchnij najkrótszą drogą
                const opts = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]];
                opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
                p.x += opts[0][0]; p.z += opts[0][1];
            }
        }
        for (const c of circles) {
            const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
            if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
        }
        if (W.outDist(p.x, p.z) > 0) {
            let bx = p.x, bz = p.z, bd = 1e9;
            for (const r of W.ZONES) {
                const cx = Math.max(r.x0, Math.min(r.x1, p.x)), cz = Math.max(r.z0, Math.min(r.z1, p.z)), d = Math.hypot(cx - p.x, cz - p.z);
                if (d < bd) { bd = d; bx = cx; bz = cz; }
            }
            p.x = bx; p.z = bz;
        }
    };

    // promień przez świat: odległość do pierwszej przeszkody (albo max)
    RE.rayWorld = function (o, d, max) {
        let best = max;
        if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) best = t; }
        for (const b of boxes) {
            let t0 = 0, t1 = best;
            const ax = [[o.x, d.x, b.x0, b.x1], [o.y, d.y, 0, b.h], [o.z, d.z, b.z0, b.z1]];
            let ok = true;
            for (const [oo, dd, lo, hi] of ax) {
                if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) { ok = false; break; } continue; }
                let ta = (lo - oo) / dd, tb = (hi - oo) / dd;
                if (ta > tb) { const t = ta; ta = tb; tb = t; }
                if (ta > t0) t0 = ta;
                if (tb < t1) t1 = tb;
                if (t0 > t1) { ok = false; break; }
            }
            if (ok && t0 < best) best = t0;
        }
        for (const c of circles) {
            const fx = o.x - c.x, fz = o.z - c.z, a = d.x * d.x + d.z * d.z;
            if (a < 1e-9) continue;
            const bq = 2 * (fx * d.x + fz * d.z), cq = fx * fx + fz * fz - c.r * c.r, disc = bq * bq - 4 * a * cq;
            if (disc < 0) continue;
            const t = (-bq - Math.sqrt(disc)) / (2 * a);
            if (t > 0 && t < best) { const y = o.y + d.y * t; if (y >= 0 && y <= c.h) best = t; }
        }
        return best;
    };
    const tmpD = new THREE.Vector3();
    RE.los = function (a, b) {
        tmpD.subVectors(b, a);
        const len = tmpD.length();
        if (len < 1e-4) return true;
        tmpD.divideScalar(len);
        return RE.rayWorld(a, tmpD, len) >= len - 0.05;
    };
})();
