/* ===========================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (OKLab / OKLCH <-> sRGB)
   Использованы стандартные формулы
   =========================== */

function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1/2.4) - 0.055;
    return Math.min(1, Math.max(0, v)) * 255;
}

// sRGB (0..255) -> OKLCH
function rgbToOklch(rr, gg, bb) {
    const r = srgbToLinear(rr), g = srgbToLinear(gg), b = srgbToLinear(bb);
    const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l = Math.cbrt(l_), m = Math.cbrt(m_), s = Math.cbrt(s_);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const bVal = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    const C = Math.sqrt(a*a + bVal*bVal);
    let H = Math.atan2(bVal, a) * 180 / Math.PI;
    if (H < 0) H += 360;
    return { l: L, c: C, h: isNaN(H)?0:H, a, b: bVal };
}
processCard
// OKLCH -> sRGB (0..255)
function oklchToRgb(L, C, H) {
    const hRad = H * Math.PI/180;
    const a = Math.cos(hRad) * C;
    const b = Math.sin(hRad) * C;
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    return [
        Math.round(linearToSrgb(r)),
        Math.round(linearToSrgb(g)),
        Math.round(linearToSrgb(bLin))
    ];
}

function cssOklch(L, C, H) {
    try {
        return `oklch(${(L).toFixed(3)} ${(C).toFixed(4)} ${(H).toFixed(0)}deg)`;
    } catch (e) {
        const [r,g,b] = oklchToRgb(L,C,H);
        return `rgb(${r},${g},${b})`;
    }
}

/* ===========================
   RELATIVE LUMINANCE + CONTRAST RATIO (WCAG)
   =========================== */
function linearChannelForLuminance(c255) {
    const c = c255 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055)/1.055, 2.4);
}
function relativeLuminanceRGB([r,g,b]) {
    return 0.2126 * linearChannelForLuminance(r) +
           0.7152 * linearChannelForLuminance(g) +
           0.0722 * linearChannelForLuminance(b);
}
function contrastRatio(rgb1, rgb2) {
    const L1 = relativeLuminanceRGB(rgb1);
    const L2 = relativeLuminanceRGB(rgb2);
    const lighter = Math.max(L1, L2);
    const darker  = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}

/* ===========================
   QUICK MMCQ (Median Cut Quantization)
   =========================== */

function getPixelsFromImage(img, maxSamples=10000) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = 120, H = 120;
    canvas.width = W; canvas.height = H;
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0,0,W,H).data;
    const pixels = [];
    for (let i=0;i<data.length;i+=4) {
        const a = data[i+3];
        if (a < 125) continue;
        pixels.push([data[i], data[i+1], data[i+2]]);
    }
    if (pixels.length > maxSamples) {
        const step = Math.ceil(pixels.length / maxSamples);
        const sampled = [];
        for (let i=0;i<pixels.length;i+=step) sampled.push(pixels[i]);
        return sampled;
    }
    return pixels;
}

function medianCut(pixels, colorCount=6) {
    if (!pixels.length) return [];
    const initialBox = buildBox(pixels);
    let boxes = [initialBox];

    while (boxes.length < colorCount) {
        boxes.sort((a,b) => (b.pixelCount * rangeSize(b)) - (a.pixelCount * rangeSize(a)));
        const box = boxes.shift();
        if (!box || box.pixelCount <= 1) {
            boxes.push(box);
            break;
        }
        const [box1, box2] = splitBox(box);
        boxes.push(box1, box2);
    }

    return boxes.map(b => {
        let r=0,g=0,bv=0;
        for (const p of b.pixels) { r+=p[0]; g+=p[1]; bv+=p[2]; }
        const cnt = b.pixelCount || 1;
        return { r: Math.round(r/cnt), g: Math.round(g/cnt), b: Math.round(bv/cnt), count: cnt };
    }).sort((a,b) => b.count - a.count);
}

function buildBox(pixels) {
    const box = { pixels: pixels.slice() };
    computeBoxBounds(box);
    box.pixelCount = box.pixels.length;
    return box;
}
function computeBoxBounds(box) {
    let rmin=255,rmax=0,gmin=255,gmax=0,bmin=255,bmax=0;
    for (const p of box.pixels) {
        if (p[0]<rmin) rmin=p[0]; if (p[0]>rmax) rmax=p[0];
        if (p[1]<gmin) gmin=p[1]; if (p[1]>gmax) gmax=p[1];
        if (p[2]<bmin) bmin=p[2]; if (p[2]>bmax) bmax=p[2];
    }
    box.rmin=rmin; box.rmax=rmax; box.gmin=gmin; box.gmax=gmax; box.bmin=bmin; box.bmax=bmax;
}
function rangeSize(box) {
    return Math.max(box.rmax - box.rmin, box.gmax - box.gmin, box.bmax - box.bmin);
}
function splitBox(box) {
    const rRange = box.rmax - box.rmin;
    const gRange = box.gmax - box.gmin;
    const bRange = box.bmax - box.bmin;
    let comp = 'r';
    if (gRange >= rRange && gRange >= bRange) comp = 'g';
    else if (bRange >= rRange && bRange >= gRange) comp = 'b';
    box.pixels.sort((p,q) => p[comp==='r'?0:comp==='g'?1:2] - q[comp==='r'?0:comp==='g'?1:2]);
    const mid = Math.floor(box.pixels.length / 2);
    const p1 = box.pixels.slice(0, mid);
    const p2 = box.pixels.slice(mid);
    const b1 = { pixels: p1 }; computeBoxBounds(b1); b1.pixelCount = p1.length;
    const b2 = { pixels: p2 }; computeBoxBounds(b2); b2.pixelCount = p2.length;
    return [b1, b2];
}

/* ===========================
   SELECTION "BEST" ЦВЕТА
   =========================== */

function selectBestFromClusters(clusters) {
    let best = null, bestScore = -Infinity;
    for (const c of clusters) {
        const max = Math.max(c.r, c.g, c.b);
        const min = Math.min(c.r, c.g, c.b);
        const sat = max > 0 ? (max - min) / max : 0;
        const brightness = (c.r + c.g + c.b) / 3;
        if (brightness < 1 || brightness > 240) continue;
        if (sat < 0.12) continue;
        const brightnessWeight = 1 - Math.abs(brightness - 128) / 128;
        const score = sat * 2.0 + brightnessWeight + Math.log(1 + c.count) / 5;
        if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) best = clusters[0] || { r:128,g:100,b:80, count:1 };
    return best;
}

/* ===========================
   ADAPTIVE CONTRAST
   =========================== */

function ensureContrastTextColor(bgRgb, candidateRgb, options={target:4.5}) {
    const target = options.target || 4.5;
    if (contrastRatio(candidateRgb, bgRgb) >= target) return candidateRgb;
    const ok = rgbToOklch(candidateRgb[0], candidateRgb[1], candidateRgb[2]);
    const bgOk = rgbToOklch(bgRgb[0], bgRgb[1], bgRgb[2]);
    const bgL = bgOk.l;
    const isBgDark = bgL < 0.5;
    const steps = 18;
    let best = candidateRgb;
    let bestContrast = contrastRatio(candidateRgb, bgRgb);
    for (let i=1;i<=steps;i++) {
        const delta = i / steps * 0.5;
        const newL = isBgDark ? Math.min(0.99, ok.l + delta) : Math.max(0.01, ok.l - delta);
        const newC = Math.max(0.0, Math.min(ok.c, 0.18));
        const [r,g,b] = oklchToRgb(newL, newC, ok.h);
        const cr = contrastRatio([r,g,b], bgRgb);
        if (cr > bestContrast) { bestContrast = cr; best = [r,g,b]; }
        if (bestContrast >= target) break;
    }
    if (bestContrast < target) {
        best = (isBgDark ? [255,255,255] : [10,10,10]);
    }
    return best;
}

/* ===========================
   ПАЛИТРА ГЕНЕРАЦИЯ (OKLCH-friendly)
   =========================== */

function generatePaletteFromHue(hue, sat, sourceL) {
    const isLightSource = sourceL > 0.62;
    const isVeryLight = sourceL > 0.8;
    const maxAllowedChroma = 0.1;
    const baseC = Math.min(maxAllowedChroma, sat * 0.55);

    let bgL, borderL, shadowL, titleL, artistL, descL;

    if (isVeryLight) {
        bgL = 0.96; borderL = 0.80; shadowL = 0.70;
        titleL = 0.15; artistL = 0.25; descL = 0.35;
    } else if (isLightSource) {
        bgL = 0.92; borderL = 0.75; shadowL = 0.65;
        titleL = 0.12; artistL = 0.22; descL = 0.32;
    } else {
        bgL = 0.29; borderL = 0.38; shadowL = 0.14;
        titleL = 0.94; artistL = 0.66; descL = 0.86;
    }

    return {
        bg:      { css: cssOklch(bgL,      baseC * 0.5, hue), rgb: oklchToRgb(bgL,      baseC*0.5, hue) },
        border:  { css: cssOklch(borderL,  baseC * 0.9, hue), rgb: oklchToRgb(borderL,  baseC*0.9, hue) },
        shadow:  { css: cssOklch(shadowL,  baseC * 0.8, hue), rgb: oklchToRgb(shadowL,  baseC*0.8, hue) },
        title:   { css: cssOklch(titleL,   baseC * 1.2, hue), rgb: oklchToRgb(titleL,   baseC*1.2, hue) },
        artist:  { css: cssOklch(artistL,  baseC * 1.4, hue), rgb: oklchToRgb(artistL,  baseC*1.4, hue) },
        desc:    { css: cssOklch(descL,    baseC * 0.9, hue), rgb: oklchToRgb(descL,    baseC*0.9, hue) }
    };
}

/* ===========================
   ОБРАБОТКА ОДНОЙ КАРТОЧКИ
   =========================== */

function processCard(card) {
    const img = card.querySelector('.music-image');
    if (!img) return;
    
    const doProcess = () => {
        try {
            const pixels = getPixelsFromImage(img, 5000);
            const clusters = medianCut(pixels, 6);
            const best = selectBestFromClusters(clusters);
            const ok = rgbToOklch(best.r, best.g, best.b);
            const sat = (() => {
                const mx = Math.max(best.r, best.g, best.b);
                const mn = Math.min(best.r, best.g, best.b);
                return mx>0 ? (mx - mn)/mx : 0;
            })();
            
            const pal = generatePaletteFromHue(ok.h, sat, ok.l);
            
            card.style.background = pal.bg.css;
            card.style.border = `1px solid ${pal.border.css}`;
            
            if (pal.bg.rgb[0] + pal.bg.rgb[1] + pal.bg.rgb[2] < 500) {
                card.style.boxShadow = `0 10px 20px -15px ${pal.shadow.css}`;
            } else {
                card.style.boxShadow = '0 58px 25px -12px rgba(0,0,0,0.12)';
            }

            const bgRgb = pal.bg.rgb;
            const titleEl = card.querySelector('.music-title');
            const artistEl = card.querySelector('.music-artist');
            const descEl = card.querySelector('.music-desc');

            const titleRgb = ensureContrastTextColor(bgRgb, pal.title.rgb, {target:4.5});
            const artistRgb = ensureContrastTextColor(bgRgb, pal.artist.rgb, {target:4.5});
            const descRgb = ensureContrastTextColor(bgRgb, pal.desc.rgb, {target:3.5});
            
            if (titleEl) titleEl.style.color = `rgb(${titleRgb[0]},${titleRgb[1]},${titleRgb[2]})`;
            if (artistEl) artistEl.style.color = `rgb(${artistRgb[0]},${artistRgb[1]},${artistRgb[2]})`;
            if (descEl) descEl.style.color = `rgb(${descRgb[0]},${descRgb[1]},${descRgb[2]})`;
        } catch (e) {
            console.warn('processCard error', e);
        }
    };

    if (img.complete && img.naturalWidth) doProcess();
    else img.onload = doProcess;
}


/* ===========================
   ИНИЦИАЛИЗАЦИЯ: обработка всех карточек на странице
   =========================== */

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.music-card').forEach(card => processCard(card));
});

/* ===========================
   JAVASCRIPT ЗАЩИТА ОТ КОПИРОВАНИЯ
   =========================== */

document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.music-card');
    
    cards.forEach(card => {
        // Запрет контекстного меню (правая кнопка мыши)
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Запрет копирования (Ctrl+C / Cmd+C)
        card.addEventListener('copy', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Запрет перетаскивания изображений
        card.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Запрет выделения через клавиатуру
        card.addEventListener('selectstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Защита изображений
        const images = card.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });
            
            img.addEventListener('dragstart', (e) => {
                e.preventDefault();
                return false;
            });
            
            // Запрет сохранения через долгое нажатие (мобильные)
            img.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) {
                    e.preventDefault();
                }
            }, { passive: false });
            
            img.addEventListener('touchmove', (e) => {
                e.preventDefault();
            }, { passive: false });
        });
    });
    
    // Глобальная защита от горячих клавиш
    document.addEventListener('keydown', (e) => {
        // Запрет Ctrl+C, Ctrl+X, Ctrl+A, Ctrl+S
        if (e.ctrlKey || e.metaKey) {
            if (['c', 'x', 'a', 's'].includes(e.key.toLowerCase())) {
                const target = e.target.closest('.music-card');
                if (target) {
                    e.preventDefault();
                    return false;
                }
            }
        }
        
        // Запрет F12, Ctrl+Shift+I (DevTools) - опционально
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')) {
            e.preventDefault();
            return false;
        }
    });
});

card.style.background = pal.bg.css;

