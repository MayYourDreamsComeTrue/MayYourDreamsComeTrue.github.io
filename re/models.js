// =====================================================================
//  RESIDENT CAKE - modele low-poly składane w kodzie (bez plików 3D)
//  Każdy kawałek postaci to jedna siatka sklejona z prostych brył
//  (pudełka, walce, kule), kolory siedzą w wierzchołkach (vertexColors),
//  cieniowanie płaskie (flatShading) = wygląd "low-poly".
//  Wczytywany po vendor/three.min.js, przed world.js / actors.js / game.js.
// =====================================================================
/* global THREE */
var RE = window.RE || (window.RE = {});

(function () {
    // ----- paleta modeli (kolory postaci są tutaj, nie w CSS - to geometria 3D) -----
    const COL = {
        // Citlali (lewy strój z refki)
        skin: '#fbe3d6', skinDark: '#efc8b8', hair: '#e6dcf0', hairShade: '#b8a6cc', hairTip: '#e58ac0',
        horn: '#1b1446', hornTip: '#8a5ad0', eye: '#3a3f9a', eyeHi: '#ffffff', blush: '#f7a8bd',
        top: '#2b2440', topHi: '#3d3458', glove: '#1f1a30', sash: '#d63a4a', sashDark: '#9a2233',
        gold: '#f2c14e', skirt: '#5b3fa8', skirtDark: '#3d2a7a', skirtLight: '#8a6ad9', tassel: '#c89af0',
        sandal: '#1b1446', pillow: '#f6f0ff', pillowShade: '#c9c2dd',
        // Leon (własny, stylizowany agent: blond włosy, brązowa kurtka)
        lHair: '#e8c76a', lHairDark: '#c9a24a', lJacket: '#7a4a2a', lJacketDark: '#5a3420', lFur: '#e3cfa8',
        lShirt: '#2c3550', lJeans: '#34405e', lBoot: '#3b2a1e', lBelt: '#2a1d14', lEye: '#4f86c6',
        // broń
        gun: '#33313d', gunDark: '#1d1c24', wood: '#7a4b2a', metal: '#8d8aa0',
        // mieszkańcy, szlamy, potwory
        vSkin: '#a6b38f', vSkinDark: '#7f8c6c', vShirt: '#b49a6a', vShirt2: '#8c6f8f', vShirt3: '#6f8c9a',
        vPants: '#5a4634', vHat: '#d9b65a', vScarf: '#8f3b4f', zSkin: '#8fb57a', zShirt: '#6d6a5a',
        mCloak: '#3b1f5c', mCloakDark: '#26123f', mTrim: '#b07ae8',
        bSkin: '#9c8f7c', bSkinDark: '#7a6e5e', bApron: '#c9b79a', bSack: '#a07a4a', bHat: '#f26dab',
        sCloak: '#2d2450', sCloakDark: '#1c1736',
        cakePink: '#f7a8c8', cakeCream: '#fff3f8', cakeLilac: '#c9a8f0', candle: '#a8e0ff', plate: '#e8e0f0',
        present1: '#f26dab', present2: '#6fd0e6', present3: '#f2c14e', ribbon: '#ffffff',
        herb: '#4caf50', herbDark: '#2e7d32', pot: '#9a5a3a', ammoBox: '#6b7a3a', shellBox: '#a83a3a',
    };
    RE.COL = COL;

    // ----- bryły (małe, low-poly) -----
    const G = {
        box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
        cyl: (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 6),
        ball: (r, det) => new THREE.IcosahedronGeometry(r, det === undefined ? 1 : det),
        cone: (r, h, seg) => new THREE.ConeGeometry(r, h, seg || 6),
        torus: (r, t, arc) => new THREE.TorusGeometry(r, t, 4, 7, arc || Math.PI * 2),
        oct: (r) => new THREE.OctahedronGeometry(r, 0),
    };
    RE.G = G;

    const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
    const tmpC = new THREE.Color();

    /**
     * Sklejanie brył w jedną geometrię z kolorem w wierzchołkach.
     * kawałek: [geometria, kolor, [x,y,z], [rx,ry,rz], [sx,sy,sz]]
     * @param {any[][]} list
     */
    function merge(list) {
        const pos = [], nor = [], col = [];
        for (const it of list) {
            const [geo0, color, p, r, s] = it;
            const geo = geo0.index ? geo0.toNonIndexed() : geo0;
            tmpE.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
            tmpQ.setFromEuler(tmpE);
            tmpS.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1);
            tmpP.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
            tmpM.compose(tmpP, tmpQ, tmpS);
            geo.applyMatrix4(tmpM);
            const pa = geo.attributes.position.array, na = geo.attributes.normal.array;
            tmpC.set(color);     // (three sam przelicza sRGB -> liniowe)
            for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
            for (let i = 0; i < pa.length / 3; i++) col.push(tmpC.r, tmpC.g, tmpC.b);
            geo.dispose();
            if (geo !== geo0) geo0.dispose();
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        out.computeBoundingSphere();
        return out;
    }
    RE.merge = merge;

    // wspólny materiał dla nieruchomych rzeczy (świat); postacie dostają własną kopię (błysk po trafieniu)
    RE.mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    RE.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });       // świecące (okna, oczy, płomienie)
    RE.charMat = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x000000 });

    const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat || RE.mat); m.matrixAutoUpdate = true; return m; };
    RE.mesh = mesh;
    const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); return g; };

    // ===================================================================
    //  SZKIELET POSTACI: biodra -> tułów -> głowa / ręce, biodra -> nogi
    //  spec.* to listy kawałków (merge) dla każdej kości
    // ===================================================================
    function rig(spec, mat) {
        const root = new THREE.Group();
        const hips = pivot(0, spec.hipY, 0); root.add(hips);
        const torso = pivot(0, 0, 0); hips.add(torso);
        const head = pivot(0, spec.neckY, 0); torso.add(head);
        const add = (parent, list) => { if (list && list.length) parent.add(mesh(merge(list), mat)); };
        add(hips, spec.hips); add(torso, spec.torso); add(head, spec.head);
        const limbs = {};
        for (const side of [-1, 1]) {
            const k = side < 0 ? 'R' : 'L';      // postać patrzy w +z, więc jej prawa strona to -x
            const arm = pivot(side * spec.shoulderX, spec.shoulderY, 0); torso.add(arm);
            const fore = pivot(0, -spec.upperArm, 0); arm.add(fore);
            add(arm, spec.upperArmParts(side)); add(fore, spec.foreParts(side));
            const leg = pivot(side * spec.hipX, 0, 0); hips.add(leg);
            const shin = pivot(0, -spec.thigh, 0); leg.add(shin);
            add(leg, spec.thighParts(side)); add(shin, spec.shinParts(side));
            limbs['arm' + k] = arm; limbs['fore' + k] = fore; limbs['leg' + k] = leg; limbs['shin' + k] = shin;
        }
        // dłoń prawa: tu wkładamy broń
        const handR = pivot(0, -spec.fore, 0.02); limbs.foreR.add(handR);
        const handL = pivot(0, -spec.fore, 0.02); limbs.foreL.add(handL);
        return Object.assign({ root, hips, torso, head, handR, handL, mat, spec }, limbs);
    }
    RE.rig = rig;

    // ----- Citlali -----
    RE.makeCitlali = function () {
        const C = COL, mat = RE.charMat();
        const braid = (side) => {
            const out = [];
            for (let i = 0; i < 6; i++) {
                const tip = i >= 4;
                out.push([G.box(0.065, 0.075, 0.065), tip ? C.hairTip : (i % 2 ? C.hairShade : C.hair), [side * (0.165 + i * 0.006), 0.06 - i * 0.075, 0.03 - i * 0.012], [0, 0, side * 0.05 * i], [1 - i * 0.05, 1, 1 - i * 0.05]]);
            }
            return out;
        };
        const spec = {
            hipY: 0.8, neckY: 0.36, shoulderX: 0.185, shoulderY: 0.3, hipX: 0.085, thigh: 0.4, upperArm: 0.25, fore: 0.24,
            hips: [
                [G.cyl(0.16, 0.31, 0.36, 8), C.skirt, [0, -0.17, 0]],
                [G.cyl(0.165, 0.26, 0.2, 8), C.skirtLight, [0, -0.09, 0]],
                [G.cyl(0.172, 0.172, 0.075, 8), C.sash, [0, 0.0, 0]],
                [G.box(0.07, 0.06, 0.04), C.gold, [0, 0.0, 0.17]],
                [G.box(0.05, 0.22, 0.02), C.sash, [0.05, -0.13, -0.19], [0.15, 0, 0.12]],
                [G.box(0.05, 0.2, 0.02), C.sashDark, [-0.04, -0.12, -0.19], [0.15, 0, -0.1]],
                [G.box(0.12, 0.07, 0.05), C.sashDark, [0, 0.0, -0.18]],
                // ciemniejsze pasy na spódnicy
                ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i / 8 * Math.PI * 2 + 0.2; return [G.box(0.03, 0.3, 0.02), C.skirtDark, [Math.sin(a) * 0.24, -0.2, Math.cos(a) * 0.24], [0, a, 0], [1, 1, 1]]; }),
                // frędzle na dole
                ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const a = i / 10 * Math.PI * 2; return [G.box(0.035, 0.09, 0.035), i % 2 ? C.tassel : C.hairTip, [Math.sin(a) * 0.29, -0.38, Math.cos(a) * 0.29]]; }),
            ],
            torso: [
                [G.cyl(0.13, 0.15, 0.36, 6), C.top, [0, 0.17, 0]],
                [G.box(0.05, 0.05, 0.03), C.gold, [0, 0.27, 0.13]],
                [G.box(0.025, 0.025, 0.02), '#6fd0e6', [0, 0.27, 0.145]],
                [G.cyl(0.045, 0.05, 0.09, 6), C.skin, [0, 0.38, 0]],
                [G.ball(0.062, 0), C.skin, [-0.165, 0.31, 0]],
                [G.ball(0.062, 0), C.skin, [0.165, 0.31, 0]],
                // długie włosy na plecach (od karku do pasa)
                [G.box(0.27, 0.44, 0.07), C.hair, [0, 0.2, -0.15]],
                [G.box(0.24, 0.08, 0.07), C.hairTip, [0, -0.05, -0.15]],
            ],
            head: [
                [G.ball(0.155, 1), C.skin, [0, 0.15, 0.01], null, [1, 1.05, 1]],
                // włosy: czapa, grzywka, boki
                [G.ball(0.172, 1), C.hair, [0, 0.19, -0.03], null, [1.04, 1, 1.05]],
                [G.box(0.3, 0.08, 0.08), C.hair, [0, 0.26, 0.12], [0.35, 0, 0]],
                [G.box(0.07, 0.2, 0.08), C.hair, [-0.13, 0.12, 0.1]],
                [G.box(0.07, 0.2, 0.08), C.hair, [0.13, 0.12, 0.1]],
                [G.box(0.04, 0.13, 0.03), C.hairShade, [0.03, 0.22, 0.155], [0.2, 0, -0.3]],
                // oczy, błyski, rumieńce, usta
                [G.box(0.045, 0.055, 0.01), C.eye, [-0.055, 0.135, 0.152]],
                [G.box(0.045, 0.055, 0.01), C.eye, [0.055, 0.135, 0.152]],
                [G.box(0.015, 0.015, 0.01), C.eyeHi, [-0.045, 0.15, 0.158]],
                [G.box(0.015, 0.015, 0.01), C.eyeHi, [0.065, 0.15, 0.158]],
                [G.box(0.035, 0.014, 0.01), C.blush, [-0.095, 0.095, 0.142]],
                [G.box(0.035, 0.014, 0.01), C.blush, [0.095, 0.095, 0.142]],
                [G.box(0.025, 0.01, 0.01), C.sashDark, [0, 0.07, 0.153]],
                // ciemne zakrzywione "rogi" ozdób z fioletowym końcem
                [G.torus(0.075, 0.022, Math.PI * 1.25), C.horn, [-0.13, 0.33, -0.02], [0, Math.PI / 2, 0.4]],
                [G.torus(0.075, 0.022, Math.PI * 1.25), C.horn, [0.13, 0.33, -0.02], [0, Math.PI / 2, 0.4]],
                [G.box(0.04, 0.04, 0.04), C.hornTip, [-0.135, 0.39, 0.05]],
                [G.box(0.04, 0.04, 0.04), C.hornTip, [0.135, 0.39, 0.05]],
                ...braid(-1), ...braid(1),
            ],
            upperArmParts: () => [[G.cyl(0.042, 0.036, 0.25, 6), C.skin, [0, -0.125, 0]]],
            foreParts: () => [
                [G.cyl(0.037, 0.032, 0.22, 6), C.glove, [0, -0.11, 0]],
                [G.cyl(0.042, 0.042, 0.03, 6), C.gold, [0, -0.02, 0]],
                [G.ball(0.04, 0), C.skin, [0, -0.245, 0]],
            ],
            thighParts: () => [[G.cyl(0.068, 0.056, 0.4, 6), C.skin, [0, -0.2, 0]]],
            shinParts: () => [
                [G.cyl(0.055, 0.042, 0.36, 6), C.skin, [0, -0.18, 0]],
                // paski sandałów na krzyż + złote kółka
                [G.cyl(0.06, 0.06, 0.025, 6), C.sandal, [0, -0.08, 0]],
                [G.cyl(0.056, 0.056, 0.025, 6), C.gold, [0, -0.16, 0]],
                [G.cyl(0.052, 0.052, 0.025, 6), C.sandal, [0, -0.24, 0]],
                [G.cyl(0.048, 0.048, 0.025, 6), C.sandal, [0, -0.31, 0]],
                [G.box(0.09, 0.045, 0.19), C.sandal, [0, -0.38, 0.035]],
                [G.box(0.092, 0.015, 0.05), C.gold, [0, -0.36, 0.08]],
            ],
        };
        const r = /** @type {any} */ (rig(spec, mat));
        r.height = 1.55;
        return r;
    };

    // ----- Leon (własny projekt: blond agent w brązowej kurtce z futrzanym kołnierzem) -----
    RE.makeLeon = function () {
        const C = COL, mat = RE.charMat();
        const spec = {
            hipY: 0.92, neckY: 0.5, shoulderX: 0.24, shoulderY: 0.43, hipX: 0.1, thigh: 0.46, upperArm: 0.3, fore: 0.28,
            hips: [
                [G.cyl(0.17, 0.16, 0.16, 6), C.lJeans, [0, -0.04, 0]],
                [G.cyl(0.175, 0.175, 0.04, 6), C.lBelt, [0, 0.03, 0]],
                [G.box(0.05, 0.04, 0.02), C.gold, [0, 0.03, 0.17]],
                [G.box(0.08, 0.14, 0.1), C.lBelt, [0.19, -0.05, 0]],            // kabura
            ],
            torso: [
                [G.cyl(0.21, 0.18, 0.48, 6), C.lJacket, [0, 0.24, 0]],
                [G.box(0.14, 0.4, 0.05), C.lShirt, [0, 0.25, 0.17]],
                [G.box(0.02, 0.42, 0.02), C.lJacketDark, [-0.075, 0.24, 0.195]],
                [G.box(0.02, 0.42, 0.02), C.lJacketDark, [0.075, 0.24, 0.195]],
                [G.cyl(0.2, 0.22, 0.09, 7), C.lFur, [0, 0.47, -0.01]],       // futrzany kołnierz
                [G.cyl(0.055, 0.06, 0.08, 6), C.skin, [0, 0.52, 0]],
                [G.box(0.04, 0.3, 0.02), C.lBelt, [0.1, 0.25, 0.19], [0, 0, 0.5]],   // szelka kabury
            ],
            head: [
                [G.ball(0.135, 1), C.skin, [0, 0.14, 0.01], null, [0.95, 1.12, 1]],
                [G.ball(0.148, 1), C.lHair, [0, 0.2, -0.03], null, [1.02, 0.85, 1.05]],
                // przedziałek na bok i grzywka opadająca na oko
                [G.box(0.2, 0.06, 0.12), C.lHair, [-0.04, 0.27, 0.07], [0.3, 0, 0.25]],
                [G.box(0.11, 0.18, 0.05), C.lHair, [0.06, 0.18, 0.12], [0.15, 0, -0.35]],
                [G.box(0.05, 0.12, 0.06), C.lHairDark, [-0.125, 0.15, 0.03]],
                [G.box(0.05, 0.12, 0.06), C.lHairDark, [0.125, 0.15, 0.03]],
                [G.box(0.035, 0.03, 0.01), C.lEye, [-0.045, 0.14, 0.135]],
                [G.box(0.035, 0.03, 0.01), C.lEye, [0.05, 0.14, 0.135]],
                [G.box(0.05, 0.012, 0.01), C.lHairDark, [-0.045, 0.17, 0.134]],
                [G.box(0.05, 0.012, 0.01), C.lHairDark, [0.05, 0.17, 0.134]],
                [G.box(0.03, 0.01, 0.01), C.skinDark, [0.005, 0.06, 0.14]],
            ],
            upperArmParts: () => [[G.cyl(0.06, 0.055, 0.3, 6), C.lJacket, [0, -0.15, 0]]],
            foreParts: () => [
                [G.cyl(0.055, 0.045, 0.26, 6), C.lJacket, [0, -0.13, 0]],
                [G.cyl(0.05, 0.05, 0.03, 6), C.lJacketDark, [0, -0.25, 0]],
                [G.ball(0.048, 0), C.glove, [0, -0.29, 0]],
            ],
            thighParts: () => [[G.cyl(0.08, 0.07, 0.46, 6), C.lJeans, [0, -0.23, 0]]],
            shinParts: () => [
                [G.cyl(0.065, 0.06, 0.3, 6), C.lJeans, [0, -0.15, 0]],
                [G.cyl(0.07, 0.07, 0.16, 6), C.lBoot, [0, -0.36, 0]],
                [G.box(0.1, 0.07, 0.22), C.lBoot, [0, -0.43, 0.04]],
            ],
        };
        const r = /** @type {any} */ (rig(spec, mat));
        r.height = 1.8;
        return r;
    };

    // ----- broń (w dłoni; lufa wzdłuż -Y dłoni, czyli "do przodu" przy uniesionej ręce) -----
    RE.makeHandgun = function () {
        const C = COL;
        const g = mesh(merge([
            [G.box(0.05, 0.2, 0.06), C.gun, [0, -0.08, 0.02]],
            [G.box(0.045, 0.1, 0.1), C.gunDark, [0, 0.0, -0.03]],
            [G.box(0.02, 0.03, 0.02), C.metal, [0, -0.17, 0.05]],
        ]));
        g.userData.muzzle = new THREE.Vector3(0, -0.2, 0.02);
        return g;
    };
    RE.makeShotgun = function () {
        const C = COL;
        const g = mesh(merge([
            [G.box(0.05, 0.62, 0.06), C.gun, [0, -0.2, 0.03]],
            [G.box(0.06, 0.25, 0.08), C.wood, [0, -0.2, -0.03]],
            [G.box(0.06, 0.25, 0.1), C.wood, [0, 0.18, -0.02], [0.15, 0, 0]],
            [G.cyl(0.02, 0.02, 0.6, 5), C.gunDark, [0, -0.22, 0.07]],
        ]));
        g.userData.muzzle = new THREE.Vector3(0, -0.52, 0.06);
        return g;
    };
    RE.makeKnife = function () {
        return mesh(merge([[G.box(0.03, 0.08, 0.04), COL.wood, [0, 0, 0]], [G.box(0.012, 0.18, 0.04), '#d8dce8', [0, -0.12, 0]]]));
    };

    // ----- mieszkaniec wioski ("goście, którzy nie dostali zaproszenia") -----
    RE.makeVillager = function (variant) {
        const C = COL, mat = RE.charMat();
        const zombie = variant === 'zombie';
        const skin = zombie ? C.zSkin : C.vSkin;
        const shirt = zombie ? C.zShirt : [C.vShirt, C.vShirt2, C.vShirt3][Math.floor(Math.random() * 3)];
        const hat = zombie ? null : Math.random() < 0.5 ? 'hat' : 'scarf';
        const head = [
            [G.ball(0.14, 1), skin, [0, 0.14, 0], null, [0.95, 1.1, 1]],
            [G.box(0.11, 0.03, 0.02), C.vSkinDark, [0, 0.06, 0.13]],
            [G.box(0.03, 0.06, 0.04), C.vSkinDark, [0, 0.12, 0.14]],
        ];
        if (hat === 'hat') head.push([G.cyl(0.11, 0.28, 0.05, 7), C.vHat, [0, 0.27, 0]], [G.cyl(0.08, 0.11, 0.1, 7), C.vHat, [0, 0.32, 0]]);
        else if (hat === 'scarf') head.push([G.ball(0.15, 1), C.vScarf, [0, 0.19, -0.03], null, [1.02, 0.9, 1.04]]);
        else head.push([G.box(0.06, 0.05, 0.05), '#5a6a4a', [0.06, 0.26, 0.05]], [G.box(0.05, 0.04, 0.05), '#5a6a4a', [-0.08, 0.24, 0.0]]);
        const spec = {
            hipY: 0.88, neckY: 0.48, shoulderX: 0.22, shoulderY: 0.4, hipX: 0.1, thigh: 0.44, upperArm: 0.3, fore: 0.28,
            hips: [[G.cyl(0.17, 0.18, 0.18, 6), C.vPants, [0, -0.04, 0]]],
            torso: [
                [G.cyl(0.19, 0.18, 0.46, 6), shirt, [0, 0.23, 0], [0.25, 0, 0]],
                [G.box(0.36, 0.06, 0.05), C.vPants, [0, 0.05, 0.12]],
                [G.cyl(0.05, 0.06, 0.08, 6), skin, [0, 0.48, 0.05]],
            ],
            head,
            upperArmParts: () => [[G.cyl(0.055, 0.05, 0.3, 6), shirt, [0, -0.15, 0]]],
            foreParts: () => [[G.cyl(0.045, 0.04, 0.26, 6), skin, [0, -0.13, 0]], [G.ball(0.05, 0), skin, [0, -0.29, 0]]],
            thighParts: () => [[G.cyl(0.075, 0.065, 0.44, 6), C.vPants, [0, -0.22, 0]]],
            shinParts: () => [[G.cyl(0.06, 0.055, 0.4, 6), C.vPants, [0, -0.2, 0]], [G.box(0.09, 0.06, 0.18), '#3a2a20', [0, -0.42, 0.03]]],
        };
        const r = /** @type {any} */ (rig(spec, mat));
        // świecące czerwone oczka (osobna siatka, nie gaśnie w ciemności)
        const eyes = mesh(merge([[G.box(0.035, 0.022, 0.01), '#ff3a3a', [-0.045, 0.16, 0.135]], [G.box(0.035, 0.022, 0.01), '#ff3a3a', [0.045, 0.16, 0.135]]]), RE.glowMat);
        r.head.add(eyes);
        // narzędzie w ręce
        const tool = Math.random();
        if (!zombie) {
            const t = tool < 0.4 ? merge([[G.cyl(0.018, 0.018, 1.0, 5), C.wood, [0, -0.2, 0]], [G.box(0.18, 0.02, 0.02), C.metal, [0, -0.7, 0]], ...[-0.08, 0, 0.08].map((x) => [G.box(0.015, 0.14, 0.015), C.metal, [x, -0.78, 0]])])
                : tool < 0.75 ? merge([[G.cyl(0.02, 0.02, 0.35, 5), C.wood, [0, -0.08, 0]], [G.torus(0.09, 0.012, Math.PI), C.metal, [0.0, -0.28, 0.06], [0, Math.PI / 2, 0]]])
                    : merge([[G.cyl(0.025, 0.025, 0.5, 5), C.wood, [0, -0.1, 0]], [G.cone(0.06, 0.12, 5), '#ffb347', [0, -0.42, 0], [Math.PI, 0, 0]]]);
            r.handR.add(mesh(t));
        }
        r.height = 1.75;
        r.zombie = zombie;
        return r;
    };

    // ----- szlam (Genshin): kopułka z oczkami, dodatek zależny od żywiołu -----
    const SLIME = { pyro: ['#f1a639', '#ffd98a'], hydro: ['#5cc9e6', '#bff2f7'], electro: ['#b07ae8', '#e2c8ff'], dendro: ['#8cc63f', '#d4f08a'] };
    RE.SLIME = SLIME;
    RE.makeSlime = function (kind, big) {
        const [c1, c2] = SLIME[kind] || SLIME.hydro, mat = RE.charMat();
        const s = big ? 1.6 : 1;
        const parts = [
            [G.ball(0.42, 1), c1, [0, 0.36, 0], null, [1, 0.82, 1]],
            [G.ball(0.2, 0), c2, [-0.12, 0.55, 0.18], null, [1, 0.6, 0.5]],
            [G.box(0.07, 0.12, 0.03), '#2b2440', [-0.13, 0.42, 0.36]],
            [G.box(0.07, 0.12, 0.03), '#2b2440', [0.13, 0.42, 0.36]],
            [G.box(0.03, 0.03, 0.02), '#ffffff', [-0.115, 0.46, 0.38]],
            [G.box(0.03, 0.03, 0.02), '#ffffff', [0.145, 0.46, 0.38]],
        ];
        if (kind === 'pyro') parts.push([G.cone(0.12, 0.3, 5), '#ff6b2b', [0, 0.78, 0]], [G.cone(0.07, 0.2, 5), '#ffe08a', [0, 0.76, 0.03]]);
        if (kind === 'hydro') parts.push([G.cone(0.08, 0.2, 6), c2, [0, 0.75, 0]]);
        if (kind === 'electro') parts.push(...[-1, 1].map((x) => [G.cone(0.05, 0.22, 4), '#ffe86b', [x * 0.15, 0.72, 0], [0, 0, -x * 0.4]]));
        if (kind === 'dendro') parts.push([G.box(0.2, 0.03, 0.1), '#4caf50', [0.08, 0.72, 0], [0, 0.3, 0.4]]);
        const root = new THREE.Group();
        const body = mesh(merge(parts), mat);
        body.scale.setScalar(s);
        root.add(body);
        return { root, body, mat, height: 0.8 * s, kind };
    };

    // ----- Abyss-owy kapturnik: unosi się, strzela kulami -----
    RE.makeHood = function () {
        const C = COL, mat = RE.charMat();
        const root = new THREE.Group();
        const body = mesh(merge([
            [G.cone(0.42, 1.1, 7), C.mCloak, [0, 0.75, 0]],
            [G.cyl(0.43, 0.43, 0.06, 7), C.mTrim, [0, 0.22, 0]],
            [G.ball(0.24, 1), C.mCloakDark, [0, 1.32, 0], null, [1, 1.1, 1]],
            [G.cone(0.14, 0.3, 5), C.mCloak, [0, 1.6, -0.06], [-0.4, 0, 0]],
            [G.box(0.1, 0.4, 0.06), C.mTrim, [0, 0.8, 0.33], [-0.35, 0, 0]],
        ]), mat);
        root.add(body);
        const eyes = mesh(merge([[G.box(0.06, 0.03, 0.02), '#f6e9ff', [-0.07, 1.32, 0.22]], [G.box(0.06, 0.03, 0.02), '#f6e9ff', [0.07, 1.32, 0.22]]]), RE.glowMat);
        body.add(eyes);
        const orb = mesh(merge([[G.ball(0.13, 0), '#c48bff', [0.45, 1.0, 0.2]]]), RE.glowMat);
        body.add(orb);
        return { root, body, orb, mat, height: 1.7 };
    };

    // ----- boss: Party Pooper - wielki gbur z workiem prezentów i ukradzioną czapeczką -----
    RE.makeBoss = function () {
        const C = COL, mat = RE.charMat();
        const spec = {
            hipY: 1.6, neckY: 1.25, shoulderX: 0.75, shoulderY: 1.05, hipX: 0.32, thigh: 0.8, upperArm: 0.75, fore: 0.75,
            hips: [[G.cyl(0.55, 0.6, 0.4, 7), '#5a4634', [0, -0.05, 0]]],
            torso: [
                [G.ball(0.8, 1), C.bSkin, [0, 0.6, 0], null, [1, 1.05, 0.85]],
                [G.box(0.9, 0.9, 0.2), C.bApron, [0, 0.45, 0.62], [0.15, 0, 0]],
                [G.ball(0.55, 1), C.bSack, [0, 0.8, -0.85]],
                [G.box(0.35, 0.3, 0.3), C.present1, [0.25, 1.25, -0.8], [0.3, 0.4, 0]],
                [G.box(0.3, 0.3, 0.3), C.present2, [-0.3, 1.2, -0.75], [0.1, -0.3, 0.2]],
                [G.box(0.05, 0.6, 1.2), '#7a5a3a', [0.4, 0.8, -0.2], [0.6, 0, 0.5]],
            ],
            head: [
                [G.ball(0.42, 1), C.bSkin, [0, 0.35, 0.05], null, [1, 0.95, 1]],
                [G.box(0.5, 0.08, 0.1), C.bSkinDark, [0, 0.42, 0.42]],
                [G.box(0.3, 0.06, 0.06), '#3b2a20', [0, 0.18, 0.43]],
                [G.box(0.06, 0.12, 0.05), '#fff3f8', [-0.08, 0.14, 0.44]],
                [G.box(0.06, 0.12, 0.05), '#fff3f8', [0.1, 0.14, 0.44]],
                // ukradziona czapeczka urodzinowa
                [G.cone(0.22, 0.6, 7), C.bHat, [0.1, 0.95, 0], [0, 0, -0.2]],
                [G.ball(0.08, 0), '#f2c14e', [0.16, 1.26, 0]],
                [G.cyl(0.23, 0.23, 0.06, 7), '#f2c14e', [0.06, 0.68, 0], [0, 0, -0.2]],
            ],
            upperArmParts: () => [[G.cyl(0.24, 0.2, 0.75, 6), C.bSkin, [0, -0.37, 0]]],
            foreParts: () => [[G.cyl(0.2, 0.18, 0.7, 6), C.bSkin, [0, -0.35, 0]], [G.ball(0.25, 0), C.bSkinDark, [0, -0.78, 0]]],
            thighParts: () => [[G.cyl(0.26, 0.22, 0.8, 6), '#5a4634', [0, -0.4, 0]]],
            shinParts: () => [[G.cyl(0.22, 0.2, 0.7, 6), C.bSkin, [0, -0.35, 0]], [G.box(0.35, 0.18, 0.55), '#3a2a20', [0, -0.75, 0.1]]],
        };
        const r = /** @type {any} */ (rig(spec, mat));
        const eyes = mesh(merge([[G.box(0.1, 0.06, 0.02), '#ff3a3a', [-0.15, 0.42, 0.47]], [G.box(0.1, 0.06, 0.02), '#ff3a3a', [0.15, 0.42, 0.47]]]), RE.glowMat);
        r.head.add(eyes);
        r.height = 4.2;
        return r;
    };

    // ----- Nieznajomy (handlarz) w kapturze z niebieską latarnią -----
    RE.makeStranger = function () {
        const C = COL;
        const root = new THREE.Group();
        root.add(mesh(merge([
            [G.cone(0.48, 1.55, 7), C.sCloak, [0, 0.78, 0]],
            [G.ball(0.22, 1), C.sCloakDark, [0, 1.5, 0]],
            [G.cone(0.26, 0.45, 6), C.sCloak, [0, 1.62, -0.05], [-0.3, 0, 0]],
            [G.box(0.6, 0.06, 0.4), C.sCloakDark, [0, 1.05, 0.25]],
            [G.box(0.9, 0.7, 0.5), C.wood, [0.9, 0.35, 0.3]],
            [G.box(0.95, 0.05, 0.55), '#5a3420', [0.9, 0.72, 0.3]],
        ])));
        root.add(mesh(merge([
            [G.box(0.07, 0.03, 0.02), '#ffe08a', [-0.07, 1.52, 0.21]], [G.box(0.07, 0.03, 0.02), '#ffe08a', [0.07, 1.52, 0.21]],
            [G.box(0.14, 0.18, 0.14), '#6fd0ff', [-0.45, 1.0, 0.3]],
        ]), RE.glowMat));
        return root;
    };

    // ----- znajdźki -----
    RE.makePickup = function (type) {
        const C = COL;
        if (type === 'gem') return mesh(merge([[G.oct(0.16), '#bff2ff', [0, 0, 0], null, [0.8, 1.2, 0.8]], [G.oct(0.09), '#ffffff', [0, 0, 0.05], null, [0.8, 1.2, 0.8]]]), RE.glowMat);
        if (type === 'herb' || type === 'herbR') return mesh(merge([
            [G.cyl(0.12, 0.09, 0.14, 6), C.pot, [0, 0.07, 0]],
            ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return [G.cone(0.06, 0.3, 4), type === 'herbR' ? (i % 2 ? '#d8424a' : '#9a2a34') : i % 2 ? C.herb : C.herbDark, [Math.sin(a) * 0.05, 0.27, Math.cos(a) * 0.05], [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4]]; }),
        ]));
        if (type === 'ammo') return mesh(merge([[G.box(0.3, 0.16, 0.2), C.ammoBox, [0, 0.08, 0]], [G.box(0.2, 0.02, 0.12), C.gold, [0, 0.17, 0]]]));
        if (type === 'shells') return mesh(merge([[G.box(0.3, 0.16, 0.2), C.shellBox, [0, 0.08, 0]], [G.box(0.2, 0.02, 0.12), C.gold, [0, 0.17, 0]]]));
        // skrzynia z kluczem (cmentarz)
        if (type === 'chest') return mesh(merge([
            [G.box(0.9, 0.5, 0.6), '#6a4a2e', [0, 0.25, 0]], [G.box(0.94, 0.08, 0.64), '#c9a24a', [0, 0.5, 0]],
            [G.box(0.92, 0.22, 0.62), '#5a3e26', [0, 0.62, 0]], [G.box(0.12, 0.16, 0.05), '#c9a24a', [0, 0.45, 0.31]],
        ]));
        // liścik Partybrudasa (ołtarz)
        if (type === 'note') return mesh(merge([[G.box(0.32, 0.02, 0.24), '#f2ead8', [0, 0.01, 0]], [G.box(0.08, 0.025, 0.08), '#e2522c', [0.06, 0.02, 0.04]]]));
        // prezent (w stodole)
        return mesh(merge([
            [G.box(0.55, 0.45, 0.55), C.present1, [0, 0.225, 0]],
            [G.box(0.57, 0.47, 0.1), C.ribbon, [0, 0.225, 0]], [G.box(0.1, 0.47, 0.57), C.ribbon, [0, 0.225, 0]],
            [G.torus(0.08, 0.025), C.ribbon, [-0.07, 0.5, 0], [0, 0, 0.6]], [G.torus(0.08, 0.025), C.ribbon, [0.07, 0.5, 0], [0, 0, -0.6]],
        ]));
    };

    // ----- tort urodzinowy (finał) + płomyki świeczek osobno (świecą i gasną) -----
    RE.makeCake = function (candles) {
        const C = COL;
        const parts = [
            [G.cyl(0.62, 0.62, 0.04, 10), C.plate, [0, 0.02, 0]],
            [G.cyl(0.5, 0.5, 0.3, 10), C.cakePink, [0, 0.19, 0]],
            [G.cyl(0.52, 0.52, 0.05, 10), C.cakeCream, [0, 0.34, 0]],
            [G.cyl(0.36, 0.36, 0.24, 10), C.cakeLilac, [0, 0.48, 0]],
            [G.cyl(0.38, 0.38, 0.05, 10), C.cakeCream, [0, 0.61, 0]],
            ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const a = i / 10 * Math.PI * 2; return [G.ball(0.05, 0), i % 2 ? '#e2522c' : C.cakeCream, [Math.sin(a) * 0.5, 0.36, Math.cos(a) * 0.5]]; }),
        ];
        const flames = [];
        for (let i = 0; i < candles; i++) {
            const a = i / candles * Math.PI * 2;
            const x = Math.sin(a) * 0.22, z = Math.cos(a) * 0.22;
            parts.push([G.cyl(0.022, 0.022, 0.2, 5), i % 2 ? C.candle : C.cakePink, [x, 0.73, z]]);
            flames.push([G.cone(0.035, 0.09, 5), '#ffd36e', [x, 0.88, z]]);
        }
        const root = new THREE.Group();
        root.add(mesh(merge(parts)));
        const fl = mesh(merge(flames), RE.glowMat);
        root.add(fl);
        root.userData.flames = fl;
        return root;
    };
})();
