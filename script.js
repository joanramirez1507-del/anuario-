
const $ = s => document.querySelector(s);
const book = $('#book');
const esc = s => (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const initials = n => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const drive = id => `https://drive.google.com/thumbnail?id=${id}&sz=w900`;
const driveFull = id => `https://drive.google.com/uc?export=view&id=${id}`;
const local = (e, k) => (typeof ARCHIVOS !== 'undefined' && ARCHIVOS[e.nombre] && ARCHIVOS[e.nombre][k]) ? [encodeURI(ARCHIVOS[e.nombre][k])] : [];

// Cada imagen prueba: archivo local (procesar.py) -> Drive. Las firmas se limpian si el navegador lo permite.
function pic(srcs, fallback, sig) {
  return `<img data-srcs='${JSON.stringify(srcs)}' data-fb="${esc(fallback)}" ${sig ? 'data-sig="1"' : ''} alt="">`;
}

function loadImgs(root) {
  root.querySelectorAll('img[data-srcs]').forEach(img => {
    const tries = [];

    JSON.parse(img.dataset.srcs).forEach(u => {
      if (img.dataset.sig) tries.push([u, true]);
      tries.push([u, false]);
    });

    let i = 0;

    const next = () => {
      if (i < tries.length) {
        const [u, cors] = tries[i++];

        if (cors) img.crossOrigin = 'anonymous';
        else img.removeAttribute('crossorigin');

        img.src = u;
        img.dataset.cors = cors ? '1' : '';
      }
      else if (img.dataset.fb) {
        const d = document.createElement('div');
        d.className = 'ini';
        d.textContent = img.dataset.fb;
        img.replaceWith(d);
      }
      else img.remove();
    };

    img.onerror = next;

    img.onload = () => {
      if (img.dataset.sig && img.dataset.cors && !img.dataset.done) {
        cleanSig(img);
      }
    };

    next();
  });
}

function cleanSig(img) {
  img.dataset.done = '1';

  try {
    const sc = Math.min(1, 1100 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * sc);
    const h = Math.round(img.naturalHeight * sc);

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;

    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    const im = ctx.getImageData(0, 0, w, h);
    const p = im.data;
    const lum = i => .299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2];

    const k = Math.max(2, Math.round(Math.min(w, h) * .03));
    let A = 0, L = 0, n = 0;

    for (const [cx, cy] of [[0, 0], [w - k, 0], [0, h - k], [w - k, h - k]]) {
      for (let y = cy; y < cy + k; y++) {
        for (let x = cx; x < cx + k; x++) {
          const i = (y * w + x) * 4;
          A += p[i + 3];
          L += lum(i);
          n++;
        }
      }
    }

    A /= n;
    L /= n;

    const transp = A < 40;
    const dark = !transp && L < 110;

    let x0 = w, y0 = h, x1 = 0, y1 = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let a;

        if (transp) {
          a = p[i + 3];
        }
        else {
          const s = dark
            ? (lum(i) - L) / (255 - L)
            : (L - lum(i)) / Math.max(L, 1);

          a = s < .12 ? 0 : Math.min(255, s * 360);

          p[i] = 14;
          p[i + 1] = 28;
          p[i + 2] = 70;
        }

        p[i + 3] = a;

        if (a > 70) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }

    if (x1 <= x0 || y1 <= y0) return;

    ctx.putImageData(im, 0, 0);

    const px = Math.round((x1 - x0) * .05) + 2;
    const py = Math.round((y1 - y0) * .1) + 2;

    x0 = Math.max(0, x0 - px);
    y0 = Math.max(0, y0 - py);
    x1 = Math.min(w - 1, x1 + px);
    y1 = Math.min(h - 1, y1 + py);

    const o = document.createElement('canvas');
    o.width = x1 - x0 + 1;
    o.height = y1 - y0 + 1;

    if (o.width < 8 || o.height < 4) return;

    o.getContext('2d').drawImage(
      c,
      x0, y0, o.width, o.height,
      0, 0, o.width, o.height
    );

    img.src = o.toDataURL('image/png');

  } catch (e) {
    /* navegador bloqueó la lectura: queda la firma original */
  }
}

// ---------- Páginas ----------

const DECO = `<svg class="deco" viewBox="0 0 480 250" preserveAspectRatio="none" aria-hidden="true">
<polygon points="0,0 480,0 480,186 0,226" fill="#0f4d2e"/>
<polygon points="0,0 330,0 0,150" fill="#fff" opacity=".05"/>
<polygon points="0,226 480,186 480,196 0,236" fill="#c9a227"/>
<polygon points="0,236 480,196 480,201 0,241" fill="#d62d20"/>
</svg>`;

const special = (type, html) => `<div class="page special ${type}">${html}</div>`;

const pages = [];

// PORTADA CON ESCUDO INSTITUCIONAL
pages.push(`
<div class="page cover">
  <div class="medal">
    <img src="assets/escudo.jpg" alt="Escudo institucional">
  </div>
  <h1>ANUARIO</h1>
  <div class="sub">Promoción 2026</div>
  <div class="scr">Siempre adelante</div>
  <div class="inst">I.E. Eugenio Ferro Falla · Campoalegre, Huila</div>
</div>
`);

pages.push(special('light', `<div class="orn">✦</div><h2>Nuestra historia</h2><div class="rule"></div><p>Cada página guarda un rostro, una frase y un sueño. Aquí quedan los recuerdos de una etapa que nos formó con ciencia y virtud.</p><div class="scr">Siempre adelante</div>`));

ESTUDIANTES.forEach((e, i) => {
  const sec = (t, txt) => `<section data-w="${txt.length}"><h3>${t}</h3><div class="fit">${esc(txt)}</div></section>`;

  pages.push(`<div class="page est${Math.max(e.recuerdo.length, e.meta.length, e.gracias.length) > 900 ? ' compact' : ''}">${DECO}
  <div class="photo">${pic([...local(e, 'foto'), drive(e.foto)], initials(e.nombre))}</div>
  <div class="head"><small>I.E. Eugenio Ferro Falla</small><h2>${esc(e.nombre)}</h2><blockquote>“${esc(e.frase)}”</blockquote></div>
  <div class="body">${sec('Mi recuerdo favorito', e.recuerdo)}${sec('Lo que quiero lograr', e.meta)}${sec('Agradecimientos', e.gracias)}</div>
  <div class="ft"><em>Siempre adelante</em><div class="firma">${pic([...local(e, 'firma'), drive(e.firma), driveFull(e.firma)], '', true)}<span>Firma</span></div><span class="num">${i + 3}</span></div></div>`);
});

pages.push(special('light', `<div class="orn">✦</div><h2>Gracias</h2><div class="rule"></div><p>A nuestras familias, docentes y compañeros: lo vivido aquí nos acompañará siempre.</p><div class="scr">Ciencia y Virtud</div>`));

pages.push(special('dark', `<div class="orn">✦</div><div class="scr">Siempre adelante</div><div class="rule"></div><p>Institución Educativa<br>Eugenio Ferro Falla<br>Campoalegre · Huila</p>`));

if (pages.length % 2) {
  pages.splice(
    pages.length - 1,
    0,
    special('light', `<div class="orn">✦</div><h2>Dedicatorias</h2><div class="rule"></div><p>Un espacio para las palabras de amigos y profesores.</p>`)
  );
}

const L = pages.length / 2;
const leaves = [];

for (let i = 0; i < L; i++) {
  const l = document.createElement('div');
  l.className = 'leaf';

  l.innerHTML = `<div class="face front" data-side="r">${pages[2 * i]}</div><div class="face back" data-side="l">${pages[2 * i + 1]}</div>`;

  book.appendChild(l);
  leaves.push(l);
}

book.querySelectorAll('section').forEach(s => {
  s.style.flex = `${25 + Math.pow(+s.dataset.w, .92)} 1 0`;
});

loadImgs(book);

let cur = 0, busy = false;

const z = () => leaves.forEach((l, i) => {
  l.style.zIndex = i < cur ? i : L - i;
});

function render() {
  z();

  book.style.transform = cur === 0
    ? 'translateX(-25%)'
    : cur === L
      ? 'translateX(25%)'
      : 'none';

  $('#prev').disabled = cur === 0;
  $('#next').disabled = cur === L;

  $('#count').textContent = cur === 0
    ? 'Portada'
    : cur === L
      ? 'Contraportada'
      : `Páginas ${2 * cur} – ${2 * cur + 1}`;

  $('#jump').value = cur;
}

function step(dir) {
  if (dir > 0 && cur < L) {
    leaves[cur].style.zIndex = L + 1;
    leaves[cur].classList.add('flipped');
    cur++;
  }
  else if (dir < 0 && cur > 0) {
    cur--;
    leaves[cur].style.zIndex = L + 1;
    leaves[cur].classList.remove('flipped');
  }
  else return false;

  render();
  setTimeout(z, 950);

  return true;
}

function go(target) {
  if (busy || target === cur) return;

  busy = true;

  const d = Math.sign(target - cur);

  (function loop() {
    if (cur !== target) {
      step(d);
      setTimeout(loop, Math.abs(target - cur) > 1 ? 140 : 0);
    }
    else {
      setTimeout(() => busy = false, 900);
    }
  })();
}

const next = () => !busy && step(1);
const prev = () => !busy && step(-1);

$('#next').onclick = next;
$('#prev').onclick = prev;

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
});

book.addEventListener('click', e => {
  const f = e.target.closest('.face');

  if (f) {
    (f.dataset.side === 'r' ? next : prev)();
  }
});

let sx = null;

document.addEventListener('touchstart', e => {
  sx = e.touches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (sx === null) return;

  const dx = e.changedTouches[0].clientX - sx;

  if (Math.abs(dx) > 50) {
    (dx < 0 ? next : prev)();
  }

  sx = null;
});

const jump = $('#jump');

jump.innerHTML = `<option value="0">Portada</option>` +
  ESTUDIANTES.map((e, i) =>
    `<option value="${Math.ceil((i + 2) / 2)}">${esc(e.nombre)}</option>`
  ).join('');

jump.onchange = () => go(+jump.value);

function fitScale() {
  const s = Math.min(
    innerWidth * .96 / 960,
    ($('#stage').clientHeight - 10) / 680,
    1.4
  );

  $('#scaler').style.setProperty('--s', s);
}

function fitText() {
  book.querySelectorAll('.fit').forEach(el => {
    let fs = 13.5;

    el.style.fontSize = fs + 'px';

    while (el.scrollHeight > el.clientHeight + 1 && fs > 7.5) {
      el.style.fontSize = (fs -= .5) + 'px';
    }
  });
}

addEventListener('resize', fitScale);

fitScale();
render();

(document.fonts ? document.fonts.ready : Promise.resolve()).then(fitText);
