// =====================================================================
//  RESIDENT CAKE - przerywniki filmowe (na silniku gry)
//  Ujęcie (shot): kamera jedzie z punktu A do B i patrzy z C na D,
//  kwestie pojawiają się literka po literce. Spacja = dalej
//  (najpierw dopisuje całą kwestię), Esc = pomiń całość.
//  Po pominięciu i tak wołamy script.end(), który ustawia stan gry.
//  Kwestia może być funkcją (np. zależną od sympatii) albo wyborem
//  { choice: [opcja A, opcja B] } - klawisz 1 / 2 albo klik; opcja ma
//  tekst, fn (np. +sympatia) i reply (kwestie wstawiane zaraz po wyborze).
// =====================================================================
/* global THREE, RE */
(function () {
    const V3 = THREE.Vector3;
    const Cut = RE.Cut = /** @type {any} */ ({ active: false });
    let cam, el, script, shots, shot, idx, sT, lineIdx, typed, doneT, onDone, choice = null;
    const pA = new V3(), pB = new V3(), lA = new V3(), lB = new V3(), tv = new V3();
    const TYPE_SPEED = 45;          // liter na sekundę
    const AUTO_NEXT = 4.5;          // po tylu sekundach od dopisania kwestia leci sama dalej
    const ease = (k) => k * k * (3 - 2 * k);
    const val = (a) => (typeof a === 'function' ? a() : a);

    Cut.init = function (camera, elements) { cam = camera; el = elements; };

    Cut.play = function (s, done) {
        script = s; shots = s.shots; idx = -1; onDone = done;
        Cut.active = true;
        el.root.classList.add('on');
        el.hint.classList.remove('hidden');
        nextShot();
    };

    function nextShot() {
        idx++;
        if (idx >= shots.length) { finish(); return; }
        shot = shots[idx];
        shot.lines = (shot.lines || []).slice();
        sT = 0; lineIdx = -1;
        if (shot.enter) shot.enter();
        const c = val(shot.cam), l = val(shot.look);
        pA.fromArray(c[0]); pB.fromArray(c[1] || c[0]);
        lA.fromArray(l[0]); lB.fromArray(l[1] || l[0]);
        if (shot.big) { el.big.textContent = shot.big; el.big.classList.remove('hidden'); el.big.classList.remove('pop'); void el.big.offsetWidth; el.big.classList.add('pop'); }
        else el.big.classList.add('hidden');
        nextLine();
    }

    function nextLine() {
        lineIdx++;
        const lines = shot.lines || [];
        if (lineIdx >= lines.length) {
            el.box.classList.add('hidden');
            if (lines.length) nextShot();
            return;
        }
        let line = lines[lineIdx];
        if (typeof line === 'function') line = lines[lineIdx] = line();
        if (line && line.choice) { showChoice(line.choice); return; }
        const [who, text, fn] = line;
        typed = 0; doneT = 0;
        el.box.classList.remove('hidden');
        el.name.textContent = who || '';
        el.name.className = 'cut-name who-' + (who || 'none').split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
        el.name.classList.toggle('hidden', !who);
        el.text.textContent = '';
        el.text.dataset.full = text;
        if (fn) fn();
    }

    // wybór w rozmowie: dwa przyciski, kwestie-odpowiedzi wchodzą zaraz po nim
    function showChoice(opts) {
        choice = opts;
        el.box.classList.remove('hidden');
        el.name.textContent = 'Citlali'; el.name.className = 'cut-name who-citlali';
        el.text.textContent = ''; el.text.dataset.full = '';
        typed = 0;
        el.choices.innerHTML = '';
        opts.forEach((o, i) => {
            const b = document.createElement('button');
            b.className = 'cut-choice';
            b.textContent = (i + 1) + '. ' + o.text;
            b.addEventListener('click', () => Cut.choose(i));
            el.choices.appendChild(b);
        });
        el.choices.classList.remove('hidden');
    }
    Cut.choose = function (i) {
        if (!Cut.active || !choice || !choice[i]) return false;
        const o = choice[i];
        choice = null;
        el.choices.classList.add('hidden');
        if (o.fn) o.fn();
        shot.lines.splice(lineIdx + 1, 0, ...(o.reply || []));
        nextLine();
        return true;
    };
    Cut.choosing = () => !!choice;

    function finish() {
        choice = null;
        if (el.choices) el.choices.classList.add('hidden');
        Cut.active = false;
        el.root.classList.remove('on');
        el.box.classList.add('hidden');
        el.big.classList.add('hidden');
        el.hint.classList.add('hidden');
        const s = script; script = null;
        if (s && s.end) s.end();
        if (onDone) onDone();
    }

    Cut.update = function (dt) {
        if (!Cut.active) return;
        sT += dt;
        const dur = shot.dur || 4;
        const k = ease(Math.min(1, sT / dur));
        cam.position.lerpVectors(pA, pB, k);
        tv.lerpVectors(lA, lB, k);
        cam.lookAt(tv);
        if (shot.fov && cam.fov !== shot.fov) { cam.fov = shot.fov; cam.updateProjectionMatrix(); }
        if (shot.tick) shot.tick(dt, sT);
        const lines = shot.lines || [];
        if (choice) { /* czekamy na wybór */ } else if (lineIdx < lines.length && lines.length) {
            const full = el.text.dataset.full || '';
            if (typed < full.length) {
                typed = Math.min(full.length, typed + dt * TYPE_SPEED);
                el.text.textContent = full.slice(0, Math.floor(typed));
            } else {
                doneT += dt;
                if (doneT > AUTO_NEXT) nextLine();
            }
        } else if (!lines.length && sT >= (shot.wait !== undefined ? shot.wait : dur)) nextShot();
    };

    // Spacja: dopisz kwestię albo przejdź dalej
    Cut.next = function () {
        if (!Cut.active || choice) return;
        const lines = shot.lines || [];
        if (!lines.length) { nextShot(); return; }
        const full = el.text.dataset.full || '';
        if (typed < full.length) { typed = full.length; el.text.textContent = full; }
        else nextLine();
    };
    Cut.skip = function () { if (Cut.active) finish(); };

    // ===================================================================
    //  SCENARIUSZE (g = interfejs gry z game.js)
    // ===================================================================
    const P = (x, y, z) => [x, y, z];
    // wybór z dwóch opcji: [tekst, +sympatia, odpowiedzi]
    const pick = (g, a, b) => ({ choice: [a, b].map(([text, love, reply]) => ({ text, reply, fn: () => g.addLove(love) })) });
    const L = (g, hi, lo) => () => (g.love() >= 60 ? hi : lo);
    RE.CUTS = {
        // ----- 1. przyjazd do wioski -----
        intro(g) {
            const pl = g.player, le = g.leon;
            let crashers = [];
            return {
                shots: [
                    {
                        enter() { g.placeActors(0, 68, Math.PI, 1.3, 69.2, Math.PI); },
                        cam: [P(14, 10, 84), P(6, 6.5, 76)], look: [P(0, 2, 40), P(0, 2, 45)], dur: 5, wait: 4.2, fov: 60,
                        lines: [['', 'Somewhere in a creepy little village... on a very special night.']],
                    },
                    {
                        cam: [P(-1.2, 1.7, 64.6), P(-0.6, 1.6, 65.2)], look: [P(0.6, 1.45, 68.6)], dur: 6,
                        lines: [
                            ['Leon', 'Creepy village, angry locals, zero phone signal... feels like home.'],
                            ['Citlali', 'Focus, Leon. Someone stole the BIRTHDAY CAKE.'],
                            ['Leon', '...The birthday cake? Those monsters.'],
                        ],
                    },
                    {
                        cam: [P(0.4, 1.55, 66.4), P(0.2, 1.5, 66.8)], look: [P(0, 1.45, 68)], dur: 5,
                        lines: [
                            ['Citlali', 'The candles, the presents, all of it. Tonight we take it back.'],
                            ['Leon', 'Mission: rescue the cake, protect the presents, make a wish. Got it.'],
                            ['Citlali', 'And nobody touches the frosting. Nobody.'],
                            ['Leon', 'By the way... nice outfit. Dressed up for the party?'],
                            pick(g, ['"It\'s for SHOOTING things. ...But thanks."', 10, [['Citlali', 'Don\'t read into it, Kennedy. I always look this good.'], ['Leon', 'Noted. Very noted.']]],
                                ['"Eyes on the road, Kennedy."', 3, [['Leon', 'Yes ma\'am. Eyes on the road. ...The road is also very nice.'], ['Citlali', '...Hmph.']]]),
                        ],
                    },
                    {
                        enter() { crashers = g.spawnPath(); },
                        cam: [P(1.5, 2.2, 70.5), P(1.2, 2.0, 70)], look: [P(0, 1.4, 50), P(0, 1.2, 40)], dur: 4,
                        lines: [['Leon', 'Heads up - party crashers. Candles don\'t light themselves!']],
                    },
                ],
                end() { g.placeActors(0, 68, Math.PI, 1.3, 69.2, Math.PI); if (!crashers.length) g.spawnPath(); g.startStage('path'); },
            };
        },

        // ----- 2. prezent w stodole + liścik od złodzieja -----
        mid(g) {
            const W = RE.W;
            return {
                shots: [
                    {
                        enter() { g.placeActors(W.PRESENT.x - 0.2, W.PRESENT.z + 1.4, Math.PI, W.PRESENT.x + 1.3, W.PRESENT.z + 2.2, Math.PI - 0.5); },
                        cam: [P(W.PRESENT.x - 1.4, 1.3, W.PRESENT.z + 3.2), P(W.PRESENT.x - 1.0, 1.1, W.PRESENT.z + 2.4)], look: [P(W.PRESENT.x, 0.4, W.PRESENT.z)], dur: 4, fov: 55,
                        lines: [
                            ['Citlali', 'A present! And... a box of birthday candles!'],
                            ['', 'A note is taped to the box:'],
                            ['', '"Thanks for the cake! Signed, The Party Pooper. P.S. No wishes for you."'],
                        ],
                    },
                    {
                        cam: [P(W.PRESENT.x + 0.8, 1.6, W.PRESENT.z + 4.2)], look: [P(W.PRESENT.x + 0.6, 1.4, W.PRESENT.z + 1.8)], dur: 3,
                        lines: [
                            ['Leon', 'The Party Pooper? That\'s... actually terrifying.'],
                            ['Citlali', 'Nobody cancels a birthday wish on MY watch.'],
                        ],
                    },
                    {
                        enter() { g.hidePresent(); g.spawnAmbush(); },
                        cam: [P(31, 2.2, -37), P(31, 1.9, -35)], look: [P(31, 1.4, -24)], dur: 3,
                        lines: [['Leon', 'Uh-oh. They brought friends. And jelly!']],
                    },
                ],
                end() { g.hidePresent(); g.spawnAmbush(); g.afterMid(); },
            };
        },

        // ----- 3. wejście bossa -----
        boss(g) {
            return {
                shots: [
                    {
                        enter() { g.spawnBoss(); g.placeActors(0, 11, Math.PI, 1.4, 12.2, Math.PI); },
                        cam: [P(3, 1.0, -4), P(2, 0.8, -6)], look: [P(0, 3.4, -14)], dur: 4, fov: 58,
                        tick(dt, t) { g.bossRoar(t); },
                        lines: [['Party Pooper', 'PARTY... OVER! CAKE... MINE!']],
                    },
                    {
                        cam: [P(-1.6, 1.6, 14.5), P(-1.2, 1.55, 14)], look: [P(0.4, 1.4, 11.4)], dur: 4,
                        lines: [
                            ['Citlali', 'Put. The cake. DOWN.'],
                            ['Leon', 'Aim for the head... or the party hat. He\'s wearing it wrong anyway.'],
                        ],
                    },
                ],
                end() { g.spawnBoss(); g.placeActors(0, 11, Math.PI, 1.4, 12.2, Math.PI); g.startBossFight(); },
            };
        },

        // ----- 4. finał: impreza, tort, świeczki, życzenie -----
        finale(g) {
            const PT = RE.W.PARTY;
            return {
                shots: [
                    {
                        enter() { g.setupParty(); },
                        cam: [P(5, 2.4, PT.z + 6), P(2.5, 1.9, PT.z + 4.6)], look: [P(0, 1.0, PT.z)], dur: 5, fov: 55,
                        lines: [
                            ['Leon', 'Mission accomplished. Cake: rescued. Frosting: mostly intact.'],
                            ['Citlali', 'And the candles survived too!'],
                        ],
                    },
                    {
                        enter() { g.cheer(true); g.confetti(); },
                        big: 'HAPPY BIRTHDAY!',
                        cam: [P(0, 1.7, PT.z + 5.2), P(0, 2.2, PT.z + 6.2)], look: [P(0, 1.3, PT.z + 1)], dur: 4,
                        tick(dt, t) { if (t % 1.2 < dt) g.confetti(); },
                        lines: [
                            ['Leon', 'HAPPY BIRTHDAY!!!'],
                            ['Stranger', 'Heh heh heh... happy birthday, stranger.'],
                        ],
                    },
                    {
                        enter() { g.cheer(false); },
                        cam: [P(-0.6, 1.5, PT.z + 2.4), P(-0.3, 1.3, PT.z + 1.9)], look: [P(0, 1.0, PT.z)], dur: 5,
                        lines: [
                            ['Citlali', 'Okay, okay... time to make a wish.'],
                            ['Leon', 'Make it a good one. I\'d say... 160 Primogems\' worth.'],
                            ['', '* Citlali closes her eyes and makes a wish *'],
                        ],
                    },
                    {
                        enter() { g.blowCandles(); g.cheer(true); },
                        cam: [P(0, 4.5, PT.z + 7), P(0, 3.0, PT.z + 5.5)], look: [P(0, 1.0, PT.z)], dur: 4,
                        tick(dt, t) { if (t % 0.9 < dt) g.confetti(); },
                        lines: [
                            ['Citlali', 'Done! And no, I\'m not telling.'],
                            ['Leon', 'Then may every single one of them come true. Happy birthday!'],
                        ],
                    },
                    // prezent od Leona
                    {
                        enter() { g.cheer(false); g.placeActors(PT.x - 0.5, PT.z + 2.2, Math.PI / 2, PT.x + 0.7, PT.z + 2.2, -Math.PI / 2); },
                        cam: [P(PT.x + 0.1, 1.55, PT.z + 4.6), P(PT.x + 0.1, 1.5, PT.z + 3.9)], look: [P(PT.x + 0.1, 1.35, PT.z + 2.2)], dur: 6,
                        lines: [
                            ['Leon', 'Oh - one more thing. I, uh... got you something.'],
                            ['', '* Leon hands Citlali a tiny box. Inside: a hairpin shaped like a star. *'],
                            ['Citlali', 'A star...? You remembered I like stars?'],
                            L(g, ['Leon', 'You mentioned it once. Back at the campfire. I listen, you know.'], ['Leon', 'Lucky guess. ...Okay, the Stranger told me.']),
                            ['Citlali', 'I-it\'s not like I\'m happy or anything! ...Okay. I\'m a little happy.'],
                        ],
                    },
                    // prawie-pocałunek... i konfetti
                    {
                        cam: [P(PT.x + 0.1, 1.6, PT.z + 5.4), P(PT.x + 0.1, 1.55, PT.z + 4.7)], look: [P(PT.x + 0.1, 1.4, PT.z + 2.2)], dur: 5, fov: 38,
                        tick(dt, t) { g.leanIn(Math.min(1, t / 4)); },
                        lines: [
                            ['', '* Citlali blushes. Leon leans in a little... *'],
                            L(g, ['Citlali', '...Leon. Thank you. For tonight. For everything.'], ['Citlali', 'D-don\'t get any ideas, Kennedy...']),
                            ['Leon', 'Happy birthday, Cit-'],
                        ],
                    },
                    {
                        enter() { g.leanIn(0); g.confettiCannon(); g.cheer(true); },
                        big: '* POP! *',
                        cam: [P(PT.x + 3, 2.4, PT.z + 6), P(PT.x + 1.5, 2.0, PT.z + 5)], look: [P(PT.x, 1.2, PT.z + 1.6)], dur: 5,
                        tick(dt, t) { if (t % 0.7 < dt) g.confetti(); },
                        lines: [
                            ['Stranger', 'Heh heh heh! CONFETTI CANNON! That\'ll be ten Primogems, strangers!'],
                            ['Citlali', '...Of COURSE.'],
                            ['Leon', 'Worth every gem.'],
                            L(g, ['', '* Citlali hugs Leon anyway. Tightly. Everyone saw. Nobody minds. *'], ['', '* Citlali hugs Leon anyway. Quickly. Nobody saw. Probably. *']),
                        ],
                    },
                ],
                end() { g.setupParty(); g.blowCandles(); g.leanIn(0); g.cheer(true); g.showEnd(); },
            };
        },

        // ----- przerwa przy ognisku (między rozdziałem 3 a 4) -----
        campfire(g) {
            const F = RE.W.BONFIRE;
            const sit = () => g.placeActors(F.x - 1.7, F.z + 1.1, Math.PI * 0.75, F.x + 1.6, F.z + 1.2, -Math.PI * 0.75);
            return {
                shots: [
                    {
                        enter: sit,
                        cam: [P(F.x + 4, 3.2, F.z + 6), P(F.x + 2.6, 2.2, F.z + 4.6)], look: [P(F.x, 0.8, F.z)], dur: 5, wait: 4, fov: 55,
                        lines: [['', 'The candles are safe. The cake is still missing. A short break by the fire...']],
                    },
                    {
                        cam: [P(F.x + 0.2, 1.4, F.z + 3.4), P(F.x, 1.3, F.z + 3.0)], look: [P(F.x, 0.9, F.z + 1)], dur: 6,
                        lines: [
                            ['Leon', 'Most people celebrate birthdays with balloons. We do it with shotguns.'],
                            ['Citlali', 'Balloons are overrated. Shotguns don\'t pop when you sit on them.'],
                            ['Leon', 'Fair. Very fair.'],
                            ['Leon', 'So... what are you going to wish for? When we get the cake back.'],
                            pick(g, ['"That\'s classified."', 4, [['Leon', 'Classified? I have clearance, you know.'], ['Citlali', 'Not THIS clearance.']]],
                                ['"...Maybe I\'ll tell you. Someday."', 10, [['Leon', 'I\'ll hold you to that.'], ['Citlali', 'D-don\'t make it a big deal! ...I like stars, by the way. Random fact.']]]),
                        ],
                    },
                    {
                        cam: [P(F.x - 3.2, 1.5, F.z + 2.8), P(F.x - 3.0, 1.45, F.z + 2.4)], look: [P(F.x + 0.5, 1.0, F.z + 1.1)], dur: 6,
                        lines: [
                            ['Leon', 'Here. Your hands are cold - take my jacket.'],
                            ['Citlali', 'I\'m NOT cold. I\'m a little... chilly. Statistically.'],
                            pick(g, ['Take the jacket', 10, [['', '* Citlali takes the jacket. It smells like gunpowder and cheap cologne. *'], ['Citlali', '...It\'s warm. That\'s all. Don\'t look at me.']]],
                                ['Refuse (but scoot closer)', 6, [['', '* Citlali scoots a little closer to the fire. And to Leon. Purely for warmth. *'], ['Leon', 'Purely for warmth.'], ['Citlali', 'PURELY for warmth!']]]),
                        ],
                    },
                    {
                        cam: [P(F.x + 3.5, 1.7, F.z - 1.5), P(F.x + 3.2, 1.6, F.z - 1.0)], look: [P(F.x - 0.5, 1.0, F.z + 1)], dur: 5,
                        lines: [
                            ['Leon', 'Break\'s over. That cake won\'t rescue itself.'],
                            ['Citlali', 'Lead the way, agent. ...And Leon? Thanks.'],
                            L(g, ['Leon', 'Anytime, birthday girl. Anytime.'], ['Leon', 'For the jacket? Or my charming personality?']),
                            ['Leon', 'The tracks go west - through the forest, past the lake.'],
                        ],
                    },
                ],
                end() { g.enterChapter(4, 'flow', true); },
            };
        },

        // ----- jezioro: Królowa Szlamów + Leon osłania Citlali -----
        lake(g) {
            let boss = null;
            return {
                shots: [
                    {
                        enter() { g.placeActors(-86, -3, -Math.PI / 2, -85, -1.5, -Math.PI / 2); },
                        cam: [P(-84, 3, 0), P(-86, 2.4, -1)], look: [P(-104, 1, 10)], dur: 5, wait: 3, fov: 55,
                        lines: [
                            ['', 'The forest opens onto a silent, moonlit lake...'],
                            ['Citlali', 'It\'s... actually beautiful.'],
                            ['Leon', 'Not as beautiful as- uh. Watch the water.'],
                        ],
                    },
                    {
                        enter() { boss = g.spawnMega(); boss.spawning = 1.5; boss.pos.y = 6; },
                        cam: [P(-87, 1.2, -4), P(-88, 1.0, -5)], look: [P(-97, 3, 0), P(-97, 2, 0)], dur: 3.5,
                        tick(dt) { if (boss && boss.spawning > 0) { boss.spawning -= dt; boss.pos.y = Math.max(0, boss.spawning * 4); } },
                        lines: [['', '* Something HUGE rises from the lake *'], ['Slime Matriarch', 'BLOOOOORP!']],
                    },
                    {
                        enter() { if (boss) { boss.spawning = 0; boss.pos.y = 0; } g.placeActors(-88.6, -4.6, -Math.PI / 2, -89.4, -3.6, -2.2); g.shake = 0.6; },
                        cam: [P(-86.4, 1.4, -6.4), P(-86.8, 1.3, -6)], look: [P(-89, 0.9, -4)], dur: 5,
                        lines: [
                            ['Leon', 'LOOK OUT!'],
                            ['', '* Leon pulls Citlali out of the way as the giant slime slams down *'],
                            ['Citlali', 'I... I saw it coming! I was going to dodge! ...Thank you.'],
                            pick(g, ['"My hero." (sarcastic... mostly)', 8, [['Leon', 'I\'ll take "mostly".']]],
                                ['"Get off me, it\'s jumping again!"', 4, [['Leon', 'Right! Right. Sorry. Shooting now.']]]),
                        ],
                    },
                ],
                end() { g.placeActors(-88.6, -4.6, -Math.PI / 2, -89.4, -3.6, -2.2); g.startMegaFight(); },
            };
        },

        // ----- liścik na ołtarzu kaplicy -----
        chapel(g) {
            const A = RE.W.ALTAR;
            return {
                shots: [
                    {
                        enter() { g.placeActors(A.x - 0.4, A.z + 1.6, Math.PI, A.x + 1, A.z + 2.2, Math.PI - 0.4); },
                        cam: [P(A.x - 1.6, 1.8, A.z + 3.4), P(A.x - 1.2, 1.6, A.z + 2.8)], look: [P(A.x, 1.1, A.z - 0.3)], dur: 5, fov: 55,
                        lines: [
                            ['', 'A note lies on the altar, sticky with frosting:'],
                            ['', '"Midnight. Village square. The cake is MINE. No guests, no candles, no wishes. - The Party Pooper"'],
                        ],
                    },
                    {
                        cam: [P(A.x + 1.2, 1.6, A.z + 4.4)], look: [P(A.x + 0.3, 1.4, A.z + 1.8)], dur: 4,
                        lines: [
                            ['Leon', 'He doubled back to the square. Clever. Rude, but clever.'],
                            ['Citlali', 'Midnight is in ten minutes. Leon - we are NOT missing this birthday.'],
                            ['Leon', 'Then let\'s crash his party.'],
                        ],
                    },
                ],
                end() { g.enterChapter(6, 'flow', true); },
            };
        },
    };
})();
