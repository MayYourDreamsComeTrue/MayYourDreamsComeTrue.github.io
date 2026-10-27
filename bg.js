// =====================================================================
//  TŁO STRONY - gwiazdki pojawiające się co chwilę (jak na griffin3q.github.io)
// =====================================================================
const bgCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('bgStars'));
const bgCtx = bgCanvas.getContext('2d');

// kolory bierzemy ze zmiennych w style.css (:root)
const rootStyle = getComputedStyle(document.documentElement);
const BG_COLOR = rootStyle.getPropertyValue('--bg').trim();         // kolor tła
const STAR_COLOR = rootStyle.getPropertyValue('--star').trim();     // kolor gwiazdek
const GLOW_COLOR = rootStyle.getPropertyValue('--star-glow').trim(); // poświata
const STAR_EVERY = 200;      // co ile ms nowa gwiazdka

// dopasowanie do rozmiaru okna (przy zmianie rozmiaru zaczynamy od nowa)
function resizeBg() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    bgCtx.fillStyle = BG_COLOR;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    // poświata wokół gwiazdek (trzeba ustawić ponownie, bo zmiana rozmiaru ją resetuje)
    bgCtx.shadowBlur = 20;
    bgCtx.shadowColor = GLOW_COLOR;
}

function addStar() {
    const x = bgCanvas.width * Math.random();
    const y = bgCanvas.height * Math.random();
    const r = 2.5 * Math.random();
    bgCtx.beginPath();
    bgCtx.fillStyle = STAR_COLOR;
    bgCtx.arc(x, y, r, 0, Math.PI * 2);
    bgCtx.fill();
}

resizeBg();
window.addEventListener('resize', resizeBg);
setInterval(addStar, STAR_EVERY);
