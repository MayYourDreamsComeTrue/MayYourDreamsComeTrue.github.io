// =====================================================================
//  RESIDENT CAKE - postacie i efekty
//  Citlali (gracz), Leon (partner sterowany przez komputer), wrogowie
//  (mieszkańcy, zombie, szlamy, kapturnik z Otchłani, boss Party Pooper),
//  znajdźki, kule przeciwników, cząsteczki, smugi strzałów, cienie.
// =====================================================================
/* global THREE, RE */
(function () {
    const V3 = THREE.Vector3;
    const tmp = new V3(), tmp2 = new V3(), tmp3 = new V3();
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    // obrót o najkrótszy kąt (żeby postać nie kręciła się dookoła przy przejściu przez ±π)
    const turn = (cur, want, max) => {
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return cur + clamp(d, -max, max);
    };
    RE.turn = turn; RE.clamp = clamp; RE.lerp = lerp;

    RE.enemies = []; RE.pickups = []; RE.orbs = [];

    // ===================================================================
    //  ANIMACJE SZKIELETU (proste sinusy)
    // ===================================================================
    function animWalk(r, ph, amt, armsToo) {
        const s = Math.sin(ph);
        r.legL.rotation.x = s * 0.7 * amt;
        r.legR.rotation.x = -s * 0.7 * amt;
        r.shinL.rotation.x = Math.max(0, -Math.cos(ph)) * 0.9 * amt;
        r.shinR.rotation.x = Math.max(0, Math.cos(ph)) * 0.9 * amt;
        r.hips.position.y = r.spec.hipY + Math.abs(Math.cos(ph)) * 0.05 * amt;
        if (armsToo) {
            r.armL.rotation.x = -s * 0.5 * amt; r.armR.rotation.x = s * 0.5 * amt;
            r.foreL.rotation.x = -0.3 * amt; r.foreR.rotation.x = -0.3 * amt;
        }
    }
    function resetPose(r) {
        for (const k of ['armL', 'armR', 'foreL', 'foreR', 'legL', 'legR', 'shinL', 'shinR', 'torso', 'head']) r[k].rotation.set(0, 0, 0);
        r.hips.position.y = r.spec.hipY;
    }
    RE.animWalk = animWalk; RE.resetPose = resetPose;

    // ===================================================================
    //  EFEKTY: cząsteczki (jeden THREE.Points), smugi, błyski, cienie
    // ===================================================================
    const FX = RE.FX = /** @type {any} */ ({});
    const NP = 900;
    let pGeo, pPos, pCol, pVel = [], pLife = new Float32Array(NP), pGrav = new Float32Array(NP), pNext = 0;
    let trGeo, trPos, trLife = new Float32Array(32), trNext = 0;
    let shadows, shN = 0;
    const SH_MAX = 64;
    const flashes = [];
    FX.init = function (scene) {
        pGeo = new THREE.BufferGeometry();
        pPos = new Float32Array(NP * 3).fill(-999);
        pCol = new Float32Array(NP * 3);
        for (let i = 0; i < NP; i++) pVel.push(new V3());
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
        const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, sizeAttenuation: true }));
        pts.frustumCulled = false;
        scene.add(pts);
        // smugi strzałów: 32 odcinki w jednej siatce linii
        trGeo = new THREE.BufferGeometry();
        trPos = new Float32Array(32 * 6);
        trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
        const tr = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ color: '#fff2b0' }));
        tr.frustumCulled = false;
        scene.add(tr);
        // cienie-plamki pod postaciami (jedna siatka instancjonowana)
        const cg = new THREE.CircleGeometry(1, 10); cg.rotateX(-Math.PI / 2);
        shadows = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.38, depthWrite: false }), SH_MAX);
        shadows.frustumCulled = false;
        scene.add(shadows);
        // błyski z lufy: 2 stałe światła (Citlali, Leon) + gwiazdka
        for (let i = 0; i < 2; i++) {
            const light = new THREE.PointLight('#ffcf7a', 0, 9, 1.5);
            const star = new THREE.Mesh(RE.merge([[RE.G.oct(0.14), '#fff2b0', [0, 0, 0], null, [1, 1, 2.2]], [RE.G.oct(0.1), '#ffffff', [0, 0, 0], null, [2.2, 1, 1]]]), RE.glowMat);
            star.visible = false;
            scene.add(light, star);
            flashes.push({ light, star, t: 0 });
        }
    };
    const tc = new THREE.Color();
    FX.burst = function (p, color, n, spd, life, grav, up) {
        tc.set(color);
        for (let k = 0; k < n; k++) {
            const i = pNext; pNext = (pNext + 1) % NP;
            pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
            const v = pVel[i].set(Math.random() - 0.5, Math.random() - 0.5 + (up || 0), Math.random() - 0.5).normalize().multiplyScalar(spd * (0.4 + Math.random() * 0.8));
            if (v.y < 0 && up) v.y *= -1;
            const sh = 0.75 + Math.random() * 0.35;
            pCol[i * 3] = tc.r * sh; pCol[i * 3 + 1] = tc.g * sh; pCol[i * 3 + 2] = tc.b * sh;
            pLife[i] = life * (0.6 + Math.random() * 0.6);
            pGrav[i] = grav;
        }
    };
    const CONF = ['#f26dab', '#5fe1ff', '#ffd36e', '#b98cff', '#ffffff', '#8cc63f'];
    FX.confetti = function (p, n, spd) {
        for (let k = 0; k < n; k++) FX.burst(p, CONF[k % CONF.length], 1, spd || 6, 3.5, 2.2, 1.6);
    };
    FX.tracer = function (a, b) {
        const i = trNext; trNext = (trNext + 1) % 32;
        trPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        trLife[i] = 0.06;
    };
    FX.flash = function (which, p) {
        const f = flashes[which];
        f.t = 0.06; f.light.position.copy(p); f.light.intensity = 25; f.star.position.copy(p); f.star.visible = true;
        f.star.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    };
    FX.shadowsBegin = () => { shN = 0; };
    const sm = new THREE.Matrix4();
    FX.shadow = function (x, z, r) {
        if (shN >= SH_MAX) return;
        sm.makeScale(r, 1, r); sm.setPosition(x, 0.03, z);
        shadows.setMatrixAt(shN++, sm);
    };
    FX.shadowsEnd = () => { shadows.count = shN; shadows.instanceMatrix.needsUpdate = true; };
    FX.update = function (dt) {
        for (let i = 0; i < NP; i++) {
            if (pLife[i] <= 0) continue;
            pLife[i] -= dt;
            const v = pVel[i];
            v.y -= pGrav[i] * dt;
            if (pGrav[i] < 3) v.multiplyScalar(1 - dt * 1.2);        // konfetti spada wolno i się kołysze
            pPos[i * 3] += v.x * dt; pPos[i * 3 + 1] += v.y * dt; pPos[i * 3 + 2] += v.z * dt;
            if (pPos[i * 3 + 1] < 0.02) { pPos[i * 3 + 1] = 0.02; v.set(0, 0, 0); }
            if (pLife[i] <= 0) pPos[i * 3 + 1] = -999;
        }
        pGeo.attributes.position.needsUpdate = true;
        pGeo.attributes.color.needsUpdate = true;
        let tch = false;
        for (let i = 0; i < 32; i++) {
            if (trLife[i] <= 0) continue;
            trLife[i] -= dt;
            if (trLife[i] <= 0) trPos.fill(0, i * 6, i * 6 + 6);
            tch = true;
        }
        if (tch) trGeo.attributes.position.needsUpdate = true;
        for (const f of flashes) {
            if (f.t <= 0) continue;
            f.t -= dt;
            if (f.t <= 0) { f.light.intensity = 0; f.star.visible = false; }
        }
    };
    FX.clear = function () {
        pLife.fill(0); pPos.fill(-999); trLife.fill(0); trPos.fill(0);
        if (pGeo) { pGeo.attributes.position.needsUpdate = true; trGeo.attributes.position.needsUpdate = true; }
    };

    // ===================================================================
    //  TRAFIENIA: promień kontra kula
    // ===================================================================
    RE.raySphere = function (o, d, c, r) {
        tmp3.subVectors(o, c);
        const b = tmp3.dot(d), cc = tmp3.lengthSq() - r * r, disc = b * b - cc;
        if (disc < 0) return Infinity;
        const t = -b - Math.sqrt(disc);
        return t > 0 ? t : (cc < 0 ? 0 : Infinity);
    };
    /** pierwsze trafienie promienia: wróg (część ciała) albo świat */
    RE.hitScan = function (o, d, max) {
        const wall = RE.rayWorld(o, d, max);
        let best = { t: wall, enemy: null, head: false };
        for (const e of RE.enemies) {
            if (!e.alive()) continue;
            for (const part of e.parts()) {
                const t = RE.raySphere(o, d, part.c, part.r);
                if (t < best.t) best = { t, enemy: e, head: part.head };
            }
        }
        best.point = new V3().copy(o).addScaledVector(d, best.t);
        return best;
    };

    // ===================================================================
    //  GRACZ: Citlali
    // ===================================================================
    class Player {
        constructor(scene) {
            /** @type {string} */
            this.weapon = 'hg';
            this.r = RE.makeCitlali();
            this.root = this.r.root;
            this.pos = this.root.position;
            this.yaw = Math.PI;
            this.guns = { hg: RE.makeHandgun(), sg: RE.makeShotgun(), knife: RE.makeKnife() };
            for (const k in this.guns) this.r.handR.add(this.guns[k]);
            scene.add(this.root);
            this.reset();
        }
        reset() {
            this.hp = 100; this.inv = 0; this.ph = 0; this.speed = 0; this.aimT = 0;
            this.knifeT = 0; this.kickT = 0; this.hurtT = 0; this.dead = false; this.cheer = 0;
            this.knock = new V3();
            this.root.rotation.set(0, this.yaw, 0);
            resetPose(this.r);
        }
        setWeapon(w) {
            this.guns.hg.visible = w === 'hg';
            this.guns.sg.visible = w === 'sg';
            this.guns.knife.visible = false;
        }
        chest(out) { return out.set(this.pos.x, this.pos.y + 1.1, this.pos.z); }
        // ruch: in = {f, s, run}, camYaw - kierunek kamery
        update(dt, inp, camYaw, camPitch, aiming, reloading) {
            const r = this.r;
            this.inv = Math.max(0, this.inv - dt);
            this.hurtT = Math.max(0, this.hurtT - dt);
            this.aimT = clamp(this.aimT + (aiming ? dt : -dt) * 6, 0, 1);
            let mx = 0, mz = 0;
            if (!aiming && !this.dead && this.kickT <= 0) {
                const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
                // prawo kamery (s>0) to wektor (-cos, sin) = (-fz, fx)
                mx = fx * inp.f + (-fz) * inp.s;
                mz = fz * inp.f + fx * inp.s;
            }
            const len = Math.hypot(mx, mz);
            const want = len > 0.01 ? (inp.run ? 5.4 : 3.1) : 0;
            this.speed = lerp(this.speed, want, Math.min(1, dt * 10));
            if (len > 0.01) {
                mx /= len; mz /= len;
                this.yaw = turn(this.yaw, Math.atan2(mx, mz), dt * 12);
                this.dir = this.dir || new V3();
                this.dir.set(mx, 0, mz);
            }
            if (aiming) this.yaw = turn(this.yaw, camYaw, dt * 20);
            if (this.speed > 0.05 && this.dir) { this.pos.x += this.dir.x * this.speed * dt; this.pos.z += this.dir.z * this.speed * dt; }
            // odrzut po ciosie
            if (this.knock.lengthSq() > 0.001) { this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(1 - Math.min(1, dt * 6)); }
            RE.pushOut(this.pos, 0.35);
            this.root.rotation.y = this.yaw;

            // ----- poza -----
            this.ph += dt * (this.speed > 4 ? 11 : 8) * Math.min(1, this.speed / 2);
            const walkAmt = Math.min(1, this.speed / 3);
            animWalk(r, this.ph, walkAmt, false);
            r.torso.rotation.set(0, 0, 0);
            r.head.rotation.set(0, 0, 0);
            const a = this.aimT;
            // prawa ręka: przy celowaniu prosto na cel, inaczej broń nisko
            const aimX = -Math.PI / 2 - camPitch;
            const sw = Math.sin(this.ph) * 0.4 * walkAmt;
            r.armR.rotation.set(lerp(-0.45 + sw * 0.3, aimX, a), 0, lerp(0.1, 0.12, a));
            r.foreR.rotation.set(lerp(-0.7, 0, a), 0, 0);
            r.armL.rotation.set(lerp(-sw, aimX + 0.05, a), 0, lerp(-0.08, -0.55, a));
            r.foreL.rotation.set(lerp(-0.3, -0.1, a), 0, 0);
            r.torso.rotation.y = a * 0.15;
            r.head.rotation.x = -camPitch * 0.5 * a;
            if (this.speed > 4) r.torso.rotation.x = 0.15;
            if (reloading) { r.armL.rotation.x = -1.0; r.foreL.rotation.x = -1.2; r.armR.rotation.x = -0.8; r.foreR.rotation.x = -0.9; r.head.rotation.x = 0.3; }
            // nożem: zamach
            if (this.knifeT > 0) {
                this.knifeT -= dt;
                const k = 1 - this.knifeT / 0.4;
                r.armR.rotation.set(-1.4, 0, lerp(1.2, -0.9, Math.min(1, k * 2)));
                r.foreR.rotation.x = -0.3;
                this.guns.knife.visible = true; this.guns.hg.visible = this.guns.sg.visible = false;
                if (this.knifeT <= 0) this.setWeapon(this.weapon);
            }
            // kopniak z obrotem (na zachwianego wroga)
            if (this.kickT > 0) {
                this.kickT -= dt;
                const k = 1 - this.kickT / 0.6;
                this.root.rotation.y = this.yaw + k * Math.PI * 2;
                r.legR.rotation.set(-1.5, 0, -0.6); r.shinR.rotation.x = 0.1;
                r.armL.rotation.z = -1.2; r.armR.rotation.z = 1.2;
            }
            if (this.hurtT > 0) { r.torso.rotation.x = -0.3 * this.hurtT / 0.3; r.head.rotation.x = -0.3; }
            // świętowanie (finał): podskoki z rękami w górze
            if (this.cheer > 0) {
                this.cheer += dt;
                const j = Math.abs(Math.sin(this.cheer * 6));
                this.root.position.y = j * 0.25;
                r.armL.rotation.set(Math.PI - 0.3 + j * 0.3, 0, -0.3); r.armR.rotation.set(Math.PI - 0.3 + j * 0.3, 0, 0.3);
                r.foreL.rotation.x = r.foreR.rotation.x = 0;
            } else this.root.position.y = 0;
            if (this.dead) {
                this.deadT = (this.deadT || 0) + dt;
                this.root.rotation.x = -Math.min(1, this.deadT / 0.5) * Math.PI / 2;
            }
        }
        hurt(dmg, from) {
            if (this.inv > 0 || this.dead || RE.godMode) return false;
            this.hp = Math.max(0, this.hp - dmg);
            this.inv = 0.8; this.hurtT = 0.3;
            if (from) { tmp.subVectors(this.pos, from); tmp.y = 0; tmp.normalize(); this.knock.copy(tmp).multiplyScalar(5); }
            this.flashRed = 1;
            if (this.hp <= 0) { this.dead = true; this.deadT = 0; }
            return true;
        }
    }
    RE.Player = Player;

    // ===================================================================
    //  LEON: idzie za Citlali, chowa się za skrzynkami, strzela, gada
    // ===================================================================
    const QUIPS = {
        kill: ['Bingo.', 'Nice shot!', 'Party crasher down.', 'Not on the guest list.', 'Next!', 'That one wanted frosting.'],
        playerKill: ['Nice shot, birthday girl!', 'Show-off.', 'Where\'d you learn to shoot like that?', 'Remind me never to steal YOUR cake.'],
        slime: ['Slimes? In THIS economy?', 'Is that... jelly? Bouncy jelly?', 'Watch the elemental goo!'],
        hood: ['Floaty guy at twelve o\'clock!', 'Since when do magicians crash parties?'],
        lowhp: ['Use a herb, birthday girl! (H)', 'You\'re hurt - green herb, now! (H)'],
        reload: ['Reloading? I got you covered.', 'Covering!'],
        selfReload: ['Reloading!', 'Hold on, reloading...', 'Cover me, partner!', 'Changing mags - all yours!'],
        idle: ['Still no signal...', 'I hope they didn\'t eat the cake.', 'Stay sharp.', 'Ever think we should just order a new cake?'],
        boss: ['Aim for the hat!', 'Kick him when he staggers! (E)', 'He\'s slow - keep moving!'],
    };
    RE.QUIPS = QUIPS;
    // Leon celowo słabszy: wolniej strzela, pudłuje, reaguje z opóźnieniem, przeładowuje
    const LEON = {
        RANGE: 9, NEAR_PLAYER: 11,        // strzela tylko do wrogów blisko niego i gracza
        REACT: [0.5, 0.9],                // opóźnienie reakcji na nowy cel (s)
        COOL: [0.9, 1.5],                 // przerwa między strzałami (s)
        ACC: 0.6, HEAD: 0.1, HEAD_MUL: 1.5,
        DMG: 30, DMG_BOSS: 8,
        MAG: 8, RELOAD: 2.2, HESITATE: 0.15,
        SHARE: 0.3,                       // max udział Leona w zabójstwach
        SHARE_MIN: 0.2, CATCHUP: 2.5,     // poniżej min: mocniejsze trafienia
    };
    RE.LEON = LEON;
    class Leon {
        constructor(scene) {
            this.r = RE.makeLeon();
            this.root = this.r.root;
            this.pos = this.root.position;
            this.gun = RE.makeHandgun();
            this.r.handR.add(this.gun);
            scene.add(this.root);
            this.reset();
        }
        reset() {
            this.yaw = Math.PI; this.ph = 0; this.speed = 0; this.cool = 1; this.aimT = 0; this.target = null;
            this.say = ''; this.sayT = 0; this.quipCd = 2; this.goal = new V3(); this.stuck = 0; this.shots = 0; this.kills = 0;
            this.react = 0; this.hesT = 0; this.reloadT = 0; this.mag = LEON.MAG;
            this.cheer = 0; this.crouch = 0;
            resetPose(this.r);
        }
        talk(text, force) {
            if (!force && this.quipCd > 0) return;
            this.say = text; this.sayT = 3; this.quipCd = 6;
        }
        quip(kind, force) { const l = QUIPS[kind]; if (l) this.talk(l[Math.floor(Math.random() * l.length)], force); }
        muzzle(out) { return this.gun.localToWorld(out.copy(this.gun.userData.muzzle)); }
        update(dt, player, active) {
            const r = this.r;
            this.sayT -= dt; this.quipCd -= dt; this.cool -= dt; this.reloadT -= dt;
            if (this.sayT <= 0) this.say = '';
            // cel: tylko wróg blisko Leona (≤9 m) i blisko gracza (≤11 m) - resztę zostawia graczowi
            //  woli rannych wrogów i nie tego najbliżej gracza (tego zwykle bierze gracz)
            let pn = null, pnd = 1e9;
            for (const e of RE.enemies) { if (!e.alive()) continue; const d = e.pos.distanceTo(player.pos); if (d < pnd) { pnd = d; pn = e; } }
            let near = null, nd = LEON.RANGE + 4;
            // trzyma się obecnego celu, dopóki ten żyje i jest w zasięgu (zmiana celu = nowa reakcja)
            const t = this.target;
            if (t && t.alive() && t.pos.distanceTo(this.pos) < LEON.RANGE + 1 && t.pos.distanceTo(player.pos) < LEON.NEAR_PLAYER + 1) { near = t; nd = -1e9; }
            for (const e of RE.enemies) {
                if (!e.alive() || e.spawning > 0) continue;
                const d = e.pos.distanceTo(this.pos);
                if (d > LEON.RANGE || e.pos.distanceTo(player.pos) > LEON.NEAR_PLAYER) continue;
                const score = d + e.hp / 15 + (e === pn ? 2 : 0);   // chętnie dobija ranne
                if (score < nd) { nd = score; near = e; }
            }
            near = active ? near : null;
            // nowy cel = chwila na reakcję (Leon nie jest aimbotem)
            if (near !== this.target) { this.target = near; if (near) this.react = LEON.REACT[0] + Math.random() * (LEON.REACT[1] - LEON.REACT[0]); }
            this.react -= dt; this.hesT -= dt;
            // ----- dokąd iść -----
            const pd = this.pos.distanceTo(player.pos);
            if (this.target) {
                // osłona: skrzynka/beczka blisko gracza, po stronie odwrotnej niż wróg
                let bestD = 1e9; this.goal.set(player.pos.x - Math.cos(player.yaw) * 2.2, 0, player.pos.z + Math.sin(player.yaw) * 2.2);
                const ep = this.target.pos;
                const tryCover = (cx, cz, rad) => {
                    if (Math.hypot(cx - player.pos.x, cz - player.pos.z) > 7) return;
                    tmp.set(cx - ep.x, 0, cz - ep.z).normalize();
                    const gx = cx + tmp.x * (rad + 0.6), gz = cz + tmp.z * (rad + 0.6);
                    const d = Math.hypot(gx - this.pos.x, gz - this.pos.z) + Math.hypot(gx - player.pos.x, gz - player.pos.z) * 0.5;
                    if (d < bestD) { bestD = d; this.goal.set(gx, 0, gz); }
                };
                for (const c of RE.circles) if (c.h <= 1.2 && c.r < 3) tryCover(c.x, c.z, c.r);
                for (const b of RE.boxes) if (b.h <= 1.3) tryCover((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2);
            } else {
                // za graczem, trochę z lewej (prawy bark zajmuje kamera)
                const bx = Math.sin(player.yaw), bz = Math.cos(player.yaw);
                this.goal.set(player.pos.x - bx * 2.2 + bz * 1.6, 0, player.pos.z - bz * 2.2 - bx * 1.6);
            }
            tmp.subVectors(this.goal, this.pos); tmp.y = 0;
            const gd = tmp.length();
            let want = 0;
            const hold = RE.game && RE.game.cutHold;   // w przerywniku stoi tam, gdzie go postawiono
            if (gd > 0.6 && !hold) { want = (gd > 5 || pd > 8) ? 5.2 : 3.0; tmp.divideScalar(gd); }
            this.speed = lerp(this.speed, want, Math.min(1, dt * 8));
            if (this.speed > 0.05) {
                const ox = this.pos.x, oz = this.pos.z;
                this.pos.x += tmp.x * this.speed * dt; this.pos.z += tmp.z * this.speed * dt;
                RE.pushOut(this.pos, 0.35);
                const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
                this.stuck = moved < this.speed * dt * 0.3 ? this.stuck + dt : 0;
                if (!this.target) this.yaw = turn(this.yaw, Math.atan2(tmp.x, tmp.z), dt * 8);
            }
            // zgubił się za ścianą albo daleko w tyle: teleport za gracza (poza kadrem)
            if (!hold && (pd > 18 || this.stuck > 1.5)) {
                this.pos.set(player.pos.x - Math.sin(player.yaw) * 2.5, 0, player.pos.z - Math.cos(player.yaw) * 2.5);
                RE.pushOut(this.pos, 0.35);
                this.stuck = 0;
            }
            // ----- strzelanie -----
            this.aimT = clamp(this.aimT + (this.target ? dt : -dt) * 5, 0, 1);
            let pitch = 0;
            if (this.target) {
                const e = this.target;
                tmp2.copy(e.pos); tmp2.y += e.height * 0.6;
                this.yaw = turn(this.yaw, Math.atan2(tmp2.x - this.pos.x, tmp2.z - this.pos.z), dt * 10);
                pitch = Math.atan2(tmp2.y - 1.45, Math.hypot(tmp2.x - this.pos.x, tmp2.z - this.pos.z));
                if (this.cool <= 0 && this.aimT > 0.8 && this.react <= 0 && this.hesT <= 0 && this.reloadT <= 0) {
                    tmp3.set(this.pos.x, 1.5, this.pos.z);
                    if (RE.los(tmp3, tmp2)) {
                        this.cool = LEON.COOL[0] + Math.random() * (LEON.COOL[1] - LEON.COOL[0]);
                        // czasem się zawaha (np. poprawia krawat)
                        if (Math.random() < LEON.HESITATE) this.hesT = 1.5;
                        const m = this.muzzle(new V3());
                        const hit = Math.random() < LEON.ACC;
                        const head = hit && Math.random() < LEON.HEAD;
                        // pudło: smuga obok celu
                        if (!hit) tmp2.set(tmp2.x + (Math.random() - 0.5) * 2.4, tmp2.y + (Math.random() - 0.3) * 1.2, tmp2.z + (Math.random() - 0.5) * 2.4);
                        FX.flash(1, m); FX.tracer(m, tmp2);
                        FX.burst(tmp2, '#ffe9b0', hit ? 5 : 2, 2, 0.25, 6);
                        this.shots++; this.mag--;
                        if (hit) {
                            let dmg = e.type === 'boss' || e.mega ? LEON.DMG_BOSS : LEON.DMG * (head ? LEON.HEAD_MUL / 2 : 1);
                            // limit: gdy Leon ma już ~30% zabójstw, nie dobija (zostawia 1 HP dla gracza)
                            const total = (RE.game && RE.game.totalKills ? RE.game.totalKills() : 0) + 1;
                            // poniżej ~20% zabójstw Leon się "przykłada" (mocniejszy strzał), powyżej 30% nie dobija
                            if (this.kills < total * LEON.SHARE_MIN && e.type !== 'boss' && !e.mega) dmg *= LEON.CATCHUP;
                            if (this.kills >= total * LEON.SHARE) dmg = Math.min(dmg * (head ? 2 : 1), Math.max(0, e.hp - 1)) / (head ? 2 : 1);
                            if (dmg > 0 && e.damage(dmg, head, this.pos, 'leon')) { this.kills++; if (Math.random() < 0.5) this.quip('kill'); }
                        }
                        if (this.mag <= 0) { this.reloadT = LEON.RELOAD; this.mag = LEON.MAG; this.quip('selfReload'); }
                    } else this.cool = 0.4;
                }
            }
            this.root.rotation.y = this.yaw;
            // ----- poza -----
            this.ph += dt * 8 * Math.min(1, this.speed / 2);
            const walkAmt = Math.min(1, this.speed / 3);
            animWalk(r, this.ph, walkAmt, false);
            this.crouch = lerp(this.crouch, this.target && this.speed < 0.5 ? 1 : 0, Math.min(1, dt * 5));
            r.hips.position.y -= this.crouch * 0.25;
            r.legL.rotation.x -= this.crouch * 0.6; r.shinL.rotation.x += this.crouch * 1.0;
            r.legR.rotation.x -= this.crouch * 0.2; r.shinR.rotation.x += this.crouch * 0.6;
            const a = this.aimT, aimX = -Math.PI / 2 - pitch;
            r.armR.rotation.set(lerp(-0.2 + Math.sin(this.ph) * 0.3 * walkAmt, aimX, a), 0, 0);
            r.foreR.rotation.set(lerp(-0.4, 0, a), 0, 0);
            r.armL.rotation.set(lerp(-Math.sin(this.ph) * 0.4 * walkAmt, aimX, a), 0, lerp(0, -0.5, a));
            r.foreL.rotation.set(lerp(-0.2, 0, a), 0, 0);
            r.torso.rotation.set(this.speed > 4 ? 0.12 : 0, 0, 0);
            if (this.cheer > 0) {
                this.cheer += dt;
                r.armR.rotation.set(Math.PI - 0.2 + Math.sin(this.cheer * 5) * 0.3, 0, 0.2); r.foreR.rotation.x = -0.4;
                r.armL.rotation.set(-0.3, 0, 0); r.head.rotation.x = -0.15;
                this.gun.visible = false;
            } else this.gun.visible = true;
        }
    }
    RE.Leon = Leon;

    // ===================================================================
    //  WROGOWIE
    // ===================================================================
    const STATS = {
        villager: { hp: 60, speed: 1.6, dmg: 15, range: 1.5, wind: 0.65, gems: 10, rad: 0.4 },
        zombie: { hp: 85, speed: 1.2, dmg: 18, range: 1.5, wind: 0.8, gems: 12, rad: 0.4 },
        slime: { hp: 34, speed: 2.6, dmg: 10, range: 1.15, wind: 0.45, gems: 6, rad: 0.45 },
        hood: { hp: 70, speed: 2.2, dmg: 12, range: 0, wind: 0, gems: 20, rad: 0.45 },
        mega: { hp: 900, speed: 1.9, dmg: 24, range: 3.0, wind: 0.75, gems: 120, rad: 1.5 },
        boss: { hp: 1300, speed: 2.0, dmg: 25, range: 3.0, wind: 0.8, gems: 160, rad: 1.2 },
    };
    RE.STATS = STATS;
    const POP = { villager: '#a6b38f', zombie: '#8fb57a', hood: '#b07ae8', boss: '#f26dab' };

    class Enemy {
        constructor(scene, type, x, z, opt) {
            opt = opt || {};
            this.type = type; this.st = Object.assign({}, STATS[type]);
            this.kind = opt.kind;
            if (type === 'villager' || type === 'zombie') { this.r = RE.makeVillager(type === 'zombie' ? 'zombie' : ''); this.root = this.r.root; this.mat = this.r.mat; this.height = this.r.height; }
            else if (type === 'boss') { this.r = RE.makeBoss(); this.root = this.r.root; this.mat = this.r.mat; this.height = 4.2; }
            else if (type === 'slime') {
                const m = RE.makeSlime(opt.kind, opt.big); this.root = m.root; this.body = m.body; this.mat = m.mat; this.height = m.height;
                if (opt.big) { this.st.hp = 70; this.st.rad = 0.7; this.st.dmg = 16; this.st.range = 1.6; this.st.gems = 12; }
                this.scale = opt.big ? 1.6 : 1;
                // pół-boss: Królowa Szlamów (ogromna, przywołuje małe szlamy)
                if (opt.mega) { this.mega = true; Object.assign(this.st, STATS.mega); this.scale = 3.2; this.body.scale.setScalar(3.2); }
            } else { const m = RE.makeHood(); this.root = m.root; this.body = m.body; this.orb = m.orb; this.mat = m.mat; this.height = m.height; }
            this.pos = this.root.position;
            this.pos.set(x, 0, z);
            this.hp = this.maxHp = this.st.hp;
            this.state = 'walk'; this.t = 0; this.yaw = 0; this.ph = Math.random() * 6; this.flash = 0;
            this.stagger = 0; this.stagT = 0; this.cool = 1.5 + Math.random() * 1.5; this.spawning = opt.spawn ? 0.8 : 0;
            this.speedMul = 0.85 + Math.random() * 0.3; this.hits = 0; this.dead = false;
            if (this.spawning) this.pos.y = type === 'slime' ? 4 : 0;
            this.root.rotation.y = this.yaw;
            scene.add(this.root);
            this.scene = scene;
            this._parts = [{ c: new V3(), r: 0, head: false }, { c: new V3(), r: 0, head: true }];
        }
        alive() { return !this.dead && this.state !== 'dying'; }
        parts() {
            const p = this.pos, b = this._parts[0], h = this._parts[1];
            if (this.type === 'slime') { const s = this.scale; b.c.set(p.x, p.y + (this.body.position.y + 0.33) * s, p.z); b.r = 0.42 * s; h.c.set(p.x, p.y + 0.62 * s + this.body.position.y, p.z); h.r = 0.16 * s; }
            else if (this.type === 'hood') { b.c.set(p.x, this.body.position.y + 0.8, p.z); b.r = 0.45; h.c.set(p.x, this.body.position.y + 1.34, p.z); h.r = 0.26; }
            else if (this.type === 'boss') {
                b.c.set(p.x, 2.2, p.z); b.r = 1.1;
                this.r.head.getWorldPosition(h.c); h.c.y += 0.45; h.r = 0.62;
            } else {
                this.r.head.getWorldPosition(h.c); h.c.y += 0.15; h.r = 0.19;
                tmp.copy(h.c); this.r.hips.getWorldPosition(b.c); b.c.y += 0.3; b.r = 0.36;
            }
            return this._parts;
        }
        // obrażenia; zwraca true, gdy wróg właśnie zginął
        damage(n, head, from, by) {
            if (!this.alive()) return false;
            if (head) n *= 2;
            this.hp -= n; this.flash = 0.09; this.hits++;
            this.lastBy = by;
            if (from && this.type !== 'boss' && !this.mega) { tmp.subVectors(this.pos, from); tmp.y = 0; tmp.normalize(); this.pos.addScaledVector(tmp, this.type === 'slime' ? 0.25 : 0.12); }
            this.stagger += n * (head ? 2 : 1);
            const limit = this.type === 'boss' ? 260 : this.mega ? 180 : 45;
            if (this.hp <= 0) { this.die(); return true; }
            if (this.stagger >= limit && this.type !== 'hood') {
                this.stagger = 0; this.state = 'stagger'; this.t = this.type === 'boss' ? 2.2 : 1.6;
            }
            return false;
        }
        die() {
            this.state = 'dying'; this.t = 0; this.hp = 0;
            if (RE.onEnemyDown) RE.onEnemyDown(this);
        }
        center(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.55, this.pos.z); }
        update(dt, player, game) {
            const st = this.st;
            // błysk po trafieniu
            this.flash -= dt;
            const f = this.flash > 0 ? 0.9 : 0;
            this.mat.emissive.setRGB(f, f, f);
            if (this.state === 'dying') return this.updateDying(dt, game);
            if (this.spawning > 0) {
                this.spawning -= dt;
                if (this.type === 'slime') this.pos.y = Math.max(0, this.spawning * 5);
                if (this.spawning > 0) return;
                this.pos.y = 0;
            }
            tmp.subVectors(player.pos, this.pos); tmp.y = 0;
            const dist = tmp.length();
            const wantYaw = Math.atan2(tmp.x, tmp.z);
            this.t -= dt; this.cool -= dt; this.ph += dt * 5;
            const r = this.r;
            if (this.type === 'slime') return this.updateSlime(dt, dist, wantYaw, player, game);
            if (this.type === 'hood') return this.updateHood(dt, dist, wantYaw, player, game);
            if (this.type === 'boss') return this.updateBoss(dt, dist, wantYaw, player, game);
            // ----- mieszkańcy i zombie -----
            resetPose(r);
            if (this.state === 'stagger') {
                // zachwianie: ręce do głowy, kołysanie (wtedy działa kopniak E)
                r.torso.rotation.x = -0.25 + Math.sin(this.ph * 2) * 0.1;
                r.armL.rotation.set(-2.4, 0, 0.3); r.armR.rotation.set(-2.4, 0, -0.3); r.foreL.rotation.x = r.foreR.rotation.x = -1.6;
                r.head.rotation.x = -0.4;
                if (this.t <= 0) this.state = 'walk';
            } else if (this.state === 'wind') {
                this.yaw = turn(this.yaw, wantYaw, dt * 6);
                const k = 1 - this.t / st.wind;
                r.armR.rotation.x = -2.8 * k; r.armL.rotation.x = -1.2 * k; r.torso.rotation.x = -0.2 * k;
                if (this.t <= 0) {
                    this.state = 'recover'; this.t = 0.6;
                    if (dist < st.range + 0.4 && !player.dead) player.hurt(st.dmg * (game.diff || 1), this.pos);
                }
            } else if (this.state === 'recover') {
                const k = this.t / 0.6;
                r.armR.rotation.x = -0.4 * k; r.torso.rotation.x = 0.4 * k;
                if (this.t <= 0) this.state = 'walk';
            } else {
                // marsz chwiejnym krokiem w stronę gracza
                this.yaw = turn(this.yaw, wantYaw, dt * 4);
                if (dist < st.range && this.cool <= 0 && !player.dead) { this.state = 'wind'; this.t = st.wind; this.cool = 1.4; }
                else if (dist > st.range * 0.8 && !player.dead) {
                    const sp = st.speed * this.speedMul;
                    this.pos.x += Math.sin(this.yaw) * sp * dt; this.pos.z += Math.cos(this.yaw) * sp * dt;
                    animWalk(r, this.ph * 0.9, 0.8, false);
                }
                // ręce do przodu jak u zombie / narzędzie w górze
                if (this.type === 'zombie') { r.armL.rotation.x = -1.4 + Math.sin(this.ph) * 0.1; r.armR.rotation.x = -1.5 + Math.cos(this.ph) * 0.1; }
                else { r.armR.rotation.x = -0.6; r.foreR.rotation.x = -0.6; r.armL.rotation.x = Math.sin(this.ph) * 0.3; }
                r.torso.rotation.z = Math.sin(this.ph * 0.5) * 0.08;
                r.head.rotation.z = Math.sin(this.ph * 0.37) * 0.25;
            }
            RE.pushOut(this.pos, st.rad);
            this.root.rotation.y = this.yaw;
        }
        updateSlime(dt, dist, wantYaw, player, game) {
            const st = this.st, s = this.scale;
            if (this.mega) {
                const frac = this.hp / this.maxHp;
                if (!this.sum1 && frac < 0.6) { this.sum1 = true; game.bossSummon(this); }
                if (!this.sum2 && frac < 0.3) { this.sum2 = true; game.bossSummon(this); }
            }
            this.yaw = turn(this.yaw, wantYaw, dt * 6);
            let hop = 0;
            if (this.state === 'stagger') { this.body.rotation.z = Math.sin(this.ph * 3) * 0.3; if (this.t <= 0) { this.state = 'walk'; this.body.rotation.z = 0; } }
            else if (this.state === 'wind') {
                // przysiad i skok na gracza
                const k = 1 - this.t / st.wind;
                this.body.scale.set(s * (1 + k * 0.25), s * (1 - k * 0.35), s * (1 + k * 0.25));
                if (this.t <= 0) {
                    this.state = 'recover'; this.t = 0.5; this.body.scale.setScalar(s);
                    if (dist < st.range + 0.5 && !player.dead) player.hurt(st.dmg, this.pos);
                    this.pos.x += Math.sin(this.yaw) * 0.5; this.pos.z += Math.cos(this.yaw) * 0.5;
                    if (this.mega) { FX.burst(tmp.set(this.pos.x, 0.3, this.pos.z), RE.SLIME[this.kind][0], 30, 6, 0.6, 9, 0.5); game.shake = 0.4; }
                }
            } else if (this.state === 'recover') { if (this.t <= 0) this.state = 'walk'; }
            else {
                if (dist < st.range && this.cool <= 0 && !player.dead) { this.state = 'wind'; this.t = st.wind; this.cool = 1.2; }
                else {
                    hop = Math.abs(Math.sin(this.ph * 1.2));
                    if (hop > 0.15) { this.pos.x += Math.sin(this.yaw) * st.speed * this.speedMul * dt; this.pos.z += Math.cos(this.yaw) * st.speed * this.speedMul * dt; }
                    const sq = hop < 0.15 ? 1 - (0.15 - hop) * 2 : 1;
                    this.body.scale.set(s * (2 - sq), s * sq, s * (2 - sq));
                }
            }
            this.body.position.y = hop * 0.5 * s;
            RE.pushOut(this.pos, st.rad);
            this.root.rotation.y = this.yaw;
        }
        updateHood(dt, dist, wantYaw, player, game) {
            // unosi się, trzyma dystans 7..11 m, krąży i strzela kulami
            this.yaw = turn(this.yaw, wantYaw, dt * 5);
            this.body.position.y = 0.35 + Math.sin(this.ph) * 0.15;
            const sp = this.st.speed;
            let mv = 0;
            if (dist > 11) mv = 1; else if (dist < 7) mv = -1;
            const side = Math.sin(this.ph * 0.3) > 0 ? 1 : -1;
            this.pos.x += (Math.sin(this.yaw) * mv + Math.cos(this.yaw) * side * 0.5) * sp * dt;
            this.pos.z += (Math.cos(this.yaw) * mv - Math.sin(this.yaw) * side * 0.5) * sp * dt;
            this.orb.rotation.y += dt * 4;
            if (this.state === 'stagger' && this.t <= 0) this.state = 'walk';
            if (this.cool <= 0 && dist < 16 && !player.dead) {
                tmp.set(this.pos.x, 1.2, this.pos.z); player.chest(tmp2);
                if (RE.los(tmp, tmp2)) { this.cool = 2.4 + Math.random(); RE.fireOrb(tmp, tmp2, this.st.dmg); } else this.cool = 0.5;
            }
            RE.pushOut(this.pos, this.st.rad);
            this.root.rotation.y = this.yaw;
        }
        updateBoss(dt, dist, wantYaw, player, game) {
            const r = this.r, st = this.st;
            resetPose(r);
            // przywołanie szlamów przy 66% i 33% życia
            const frac = this.hp / this.maxHp;
            if (!this.sum1 && frac < 0.66) { this.sum1 = true; game.bossSummon(this); }
            if (!this.sum2 && frac < 0.33) { this.sum2 = true; game.bossSummon(this); }
            if (this.state === 'stagger') {
                r.torso.rotation.x = -0.3; r.head.rotation.x = -0.4 + Math.sin(this.ph * 3) * 0.1;
                r.armL.rotation.set(-0.5, 0, 0.8); r.armR.rotation.set(-0.5, 0, -0.8);
                if (this.t <= 0) { this.state = 'walk'; this.cool = 1; }
            } else if (this.state === 'roar') {
                // zamach przed szarżą
                this.yaw = turn(this.yaw, wantYaw, dt * 3);
                r.armL.rotation.set(-2.6, 0, 0.5); r.armR.rotation.set(-2.6, 0, -0.5); r.head.rotation.x = -0.4; r.torso.rotation.x = -0.2;
                if (this.t <= 0) { this.state = 'charge'; this.t = 1.3; this.hitDone = false; }
            } else if (this.state === 'charge') {
                this.yaw = turn(this.yaw, wantYaw, dt * 0.8);
                const ox = this.pos.x, oz = this.pos.z;
                this.pos.x += Math.sin(this.yaw) * 9 * dt; this.pos.z += Math.cos(this.yaw) * 9 * dt;
                animWalk(r, this.ph * 3, 1, true);
                r.torso.rotation.x = 0.35;
                if (!this.hitDone && dist < 1.9) { this.hitDone = true; player.hurt(30, this.pos); }
                RE.pushOut(this.pos, st.rad);
                const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
                if (moved < 9 * dt * 0.4 && this.t < 1.1) { this.state = 'stagger'; this.t = 1.6; FX.burst(this.center(tmp), '#e8dccc', 25, 5, 0.6, 9); game.shake = 0.5; }
                if (this.t <= 0) { this.state = 'walk'; this.cool = 2.5; }
            } else if (this.state === 'slam') {
                this.yaw = turn(this.yaw, wantYaw, dt * 2);
                const k = 1 - this.t / 0.9;
                r.armL.rotation.set(-3 * Math.min(1, k * 1.4), 0, 0.2); r.armR.rotation.set(-3 * Math.min(1, k * 1.4), 0, -0.2);
                if (this.t <= 0) {
                    this.state = 'recover'; this.t = 0.8;
                    tmp.set(this.pos.x + Math.sin(this.yaw) * 1.8, 0.2, this.pos.z + Math.cos(this.yaw) * 1.8);
                    FX.burst(tmp, '#cfc6b8', 40, 7, 0.7, 12, 0.6);
                    game.shake = 0.6;
                    if (Math.hypot(player.pos.x - tmp.x, player.pos.z - tmp.z) < 3.4) player.hurt(28, tmp);
                }
            } else if (this.state === 'recover') {
                r.armL.rotation.x = r.armR.rotation.x = -1.2 * (this.t / 0.8); r.torso.rotation.x = 0.4 * (this.t / 0.8);
                if (this.t <= 0) { this.state = 'walk'; this.cool = 1.5; }
            } else {
                this.yaw = turn(this.yaw, wantYaw, dt * 2.5);
                if (!player.dead && this.cool <= 0 && dist < st.range) { this.state = 'slam'; this.t = 0.9; }
                else if (!player.dead && this.cool <= 0 && dist > 7 && Math.random() < dt * 0.8) { this.state = 'roar'; this.t = 0.9; }
                else if (dist > 2.2) {
                    this.pos.x += Math.sin(this.yaw) * st.speed * dt; this.pos.z += Math.cos(this.yaw) * st.speed * dt;
                    animWalk(r, this.ph * 0.8, 0.9, true);
                }
                r.torso.rotation.z = Math.sin(this.ph * 0.4) * 0.06;
            }
            RE.pushOut(this.pos, st.rad);
            this.root.rotation.y = this.yaw;
        }
        updateDying(dt, game) {
            this.t += dt;
            const len = this.type === 'boss' || this.mega ? 2.2 : 0.75;
            const k = Math.min(1, this.t / (len * 0.7));
            if (this.type === 'slime') { const s = this.scale; this.body.scale.set(s * (1 + k * 0.5), s * (1 - k * 0.7), s * (1 + k * 0.5)); this.body.position.y = 0; }
            else if (this.type === 'hood') { this.body.position.y = Math.max(0, 0.35 - k); this.body.rotation.x = -k * 1.4; }
            else { this.root.rotation.x = -k * k * Math.PI / 2; if (this.r) { this.r.armL.rotation.x = -2 * k; this.r.armR.rotation.x = -2 * k; } }
            if (this.t >= len) {
                // "pop": chmurka cząsteczek, znajdźki, znika
                const col = this.type === 'slime' ? RE.SLIME[this.kind][0] : POP[this.type];
                this.center(tmp);
                FX.burst(tmp, col, this.type === 'boss' || this.mega ? 120 : 30, this.type === 'boss' || this.mega ? 7 : 4, 0.8, 7, 0.5);
                FX.burst(tmp, '#ffffff', 10, 3, 0.5, 4, 0.5);
                this.scene.remove(this.root);
                this.dead = true;
                if (game.onEnemyGone) game.onEnemyGone(this);
            }
        }
    }
    RE.Enemy = Enemy;

    // ===================================================================
    //  KULE KAPTURNIKA (8 w puli, świecące)
    // ===================================================================
    let orbMeshes = [];
    RE.initOrbs = function (scene) {
        for (let i = 0; i < 8; i++) {
            const m = RE.mesh(RE.merge([[RE.G.ball(0.16, 0), '#c48bff', [0, 0, 0]], [RE.G.ball(0.09, 0), '#ffffff', [0, 0, 0]]]), RE.glowMat);
            m.visible = false; scene.add(m);
            orbMeshes.push(m);
            RE.orbs.push({ m, v: new V3(), life: 0, dmg: 0 });
        }
    };
    RE.fireOrb = function (from, to, dmg) {
        const o = RE.orbs.find((x) => x.life <= 0);
        if (!o) return;
        o.m.position.copy(from); o.v.subVectors(to, from).normalize().multiplyScalar(7.5);
        o.life = 4; o.dmg = dmg; o.m.visible = true;
    };
    RE.updateOrbs = function (dt, player) {
        for (const o of RE.orbs) {
            if (o.life <= 0) continue;
            o.life -= dt;
            const step = o.v.length() * dt;
            tmp.copy(o.v).normalize();
            const hit = RE.rayWorld(o.m.position, tmp, step);
            o.m.position.addScaledVector(o.v, dt);
            o.m.rotation.y += dt * 6;
            player.chest(tmp2);
            if (tmp2.distanceTo(o.m.position) < 0.55 && !player.dead) { player.hurt(o.dmg, o.m.position); o.life = 0; }
            if (hit < step) o.life = 0;
            if (o.life <= 0) { o.m.visible = false; FX.burst(o.m.position, '#c48bff', 12, 3, 0.4, 3); }
        }
    };
    RE.clearOrbs = () => { for (const o of RE.orbs) { o.life = 0; o.m.visible = false; } };

    // ===================================================================
    //  ZNAJDŹKI: primogemy, amunicja, zioła (zbierane automatycznie)
    // ===================================================================
    RE.dropPickup = function (scene, type, x, z, amount) {
        const mesh = RE.makePickup(type);
        mesh.position.set(x, 0.3, z);
        scene.add(mesh);
        const p = { type, mesh, t: Math.random() * 6, amount: amount || 1, vy: 3, y: 0.3, scene };
        RE.pickups.push(p);
        return p;
    };
    RE.updatePickups = function (dt, player, collect) {
        for (let i = RE.pickups.length - 1; i >= 0; i--) {
            const p = RE.pickups[i];
            p.t += dt;
            // podskok po wypadnięciu, potem unoszenie się i obrót
            if (p.vy !== 0) { p.y += p.vy * dt; p.vy -= 12 * dt; if (p.y <= 0.3 && p.vy < 0) { p.y = 0.3; p.vy = 0; } }
            const m = p.mesh;
            m.rotation.y += dt * 2;
            m.position.y = p.y + (p.vy === 0 ? Math.sin(p.t * 3) * 0.08 : 0) + (p.type === 'gem' ? 0.35 : 0);
            const d = Math.hypot(player.pos.x - m.position.x, player.pos.z - m.position.z);
            if (p.type === 'gem' && d < 3.5 && d > 0.01) {      // magnes na primogemy
                const k = Math.min(1, dt * 7 / d);
                m.position.x += (player.pos.x - m.position.x) * k; m.position.z += (player.pos.z - m.position.z) * k;
            }
            if (d < 1.1 && !player.dead) {
                if (collect(p) !== false) { p.scene.remove(m); RE.pickups.splice(i, 1); }
            }
        }
    };
    RE.clearPickups = () => { for (const p of RE.pickups) p.scene.remove(p.mesh); RE.pickups.length = 0; };
})();
