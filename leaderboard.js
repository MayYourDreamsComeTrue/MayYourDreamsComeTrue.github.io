// =====================================================================
//  LEADERBOARD - tu edytujesz tabelę wyników (ikona "High Scores"
//  na środku pulpitu). Sam program okna jest w scores.js.
//
//  Jak dodać albo zmienić wynik:
//  - Znajdź grę poniżej (np. 'Citlali Run') i dopisz nową linię
//    w jej liście:   { name: 'Imię', score: 1234 },
//  - Zmiana wyniku = zmień liczbę przy imieniu.
//  - Kolejność nie ma znaczenia - tabela sama sortuje od najlepszego
//    i rozdaje medale (złoty, srebrny, brązowy) za miejsca 1-3.
//  - Nowa gra = nowy wpis:   'Nazwa gry': [ { name: ..., score: ... } ],
//  - Imię w apostrofach '...', liczba bez spacji i kropek, przecinek
//    na końcu każdej linii.
//  - Plik zapisz i odśwież stronę (F5).
// =====================================================================

var LEADERBOARD = {
    'Citlali Run': [
        { name: 'Jully',      score: 1004 },
        { name: 'The Griffin', score: 3411 },
    ],
    'Slime Invaders': [
        { name: 'Jully',      score: 1000 },
        { name: 'The Griffin', score: 960 },
    ],
    'Primo-Man': [
        { name: 'Jully',      score: 2530 },
        { name: 'The Griffin', score: 6140 },
    ],
};

// tekst pod tabelą (jak dopisać swój wynik)
var LEADERBOARD_NOTE = 'Want your score added? Contact me on Discord: .chisana.kitsune';
