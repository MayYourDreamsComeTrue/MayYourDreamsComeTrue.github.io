// =====================================================================
//  HIGH SCORES - okienko z tabelą wyników (ikona na środku pulpitu)
//  Dane (gry, imiona, wyniki) są w leaderboard.js - tam je edytujesz.
//  Korzysta z systemu okien z desktop.js (openWindow, reuseWin, el...),
//  więc musi być wczytany PO desktop.js i PO leaderboard.js.
//  Kolory w desktop.css (sekcja 15).
// =====================================================================

const LB = {
    WIN_W: 460,           // rozmiar okna
    WIN_H: 400,
    MEDALS: ['gold', 'silver', 'bronze'], // klasy medali za miejsca 1-3
    SPARKS: 4,            // ile iskierek mruga wokół pucharu
};

function openLeaderboard() {
    if (reuseWin('scores')) return;
    /** @type {Record<string, {name: string, score: number}[]>} */
    const data = typeof LEADERBOARD === 'object' && LEADERBOARD ? LEADERBOARD : {};

    const body = el('div', 'lb');

    // ----- nagłówek: puchar z iskierkami + tytuł -----
    const head = el('div', 'lb-head');
    const cup = el('div', 'lb-cup');
    const cupImg = /** @type {HTMLImageElement} */ (el('img'));
    cupImg.src = 'assets/icons/trophy.png';
    cupImg.alt = '';
    cup.appendChild(cupImg);
    for (let i = 0; i < LB.SPARKS; i++) cup.appendChild(el('span', 'lb-spark s' + i));
    head.append(cup, el('h2', 'lb-title', 'HIGH SCORES'), cup.cloneNode(true));
    body.appendChild(head);

    // ----- tabela dla każdej gry (posortowana od najlepszego) -----
    const list = el('div', 'lb-list sunken');
    Object.keys(data).forEach((game) => {
        const rows = (data[game] || []).slice().sort((a, b) => b.score - a.score);
        const sec = el('section', 'lb-game');
        sec.appendChild(el('h3', 'lb-game-title', game));
        const table = el('table', 'lb-table');
        rows.forEach((r, i) => {
            const tr = el('tr', i < LB.MEDALS.length ? 'top ' + LB.MEDALS[i] : '');
            const rank = el('td', 'lb-rank');
            if (i < LB.MEDALS.length) rank.appendChild(el('span', 'lb-medal ' + LB.MEDALS[i], String(i + 1)));
            else rank.textContent = (i + 1) + '.';
            tr.append(rank, el('td', 'lb-name', r.name), el('td', 'lb-score', String(r.score).padStart(6, '0')));
            table.appendChild(tr);
        });
        if (!rows.length) table.appendChild(el('tr')).appendChild(el('td', 'lb-empty', 'No scores yet'));
        sec.appendChild(table);
        list.appendChild(sec);
    });
    body.appendChild(list);

    // ----- informacja jak dopisać wynik -----
    const note = typeof LEADERBOARD_NOTE === 'string' ? LEADERBOARD_NOTE : '';
    if (note) body.appendChild(el('p', 'lb-note', note));

    openWindow({ id: 'scores', title: 'High Scores', icon: 'assets/icons/trophy.png', body, w: LB.WIN_W, h: LB.WIN_H });
}
