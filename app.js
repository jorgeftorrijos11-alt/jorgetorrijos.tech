// Interacciones de la página (sin dependencias).
(() => {
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // nav sólida al bajar
  const nav = $('.nav');
  const alBajar = () => nav.classList.toggle('solida', scrollY > 40);
  addEventListener('scroll', alBajar, { passive: true });
  alBajar();

  // reloj local
  const reloj = $('#reloj');
  if (reloj) {
    const pinta = () => {
      reloj.textContent = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) + ' · tu hora';
    };
    pinta();
    setInterval(pinta, 30000);
  }

  // aparecer al entrar en pantalla
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visto');
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  $$('.aparece').forEach((el, i) => {
    const hermanos = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains('aparece')) : [];
    el.style.setProperty('--d', `${Math.max(0, hermanos.indexOf(el)) * 0.08}s`);
    obs.observe(el);
  });

  // contadores
  const formato = new Intl.NumberFormat('es-MX');
  const obsCifras = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      obsCifras.unobserve(e.target);
      const el = e.target;
      const fin = Number(el.dataset.cuenta);
      const suf = el.dataset.sufijo || '';
      if (reducir) { el.textContent = formato.format(fin) + suf; return; }
      const dur = 1600;
      const t0 = performance.now();
      const paso = (ahora) => {
        const p = Math.min(1, (ahora - t0) / dur);
        const v = Math.round(fin * (1 - Math.pow(1 - p, 4)));
        el.textContent = formato.format(v) + suf;
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  }, { threshold: 0.6 });
  $$('[data-cuenta]').forEach((el) => obsCifras.observe(el));

  // industria: el paso activo cambia la captura del visor
  const pasos = $$('.paso');
  const imgs = $$('.visor-pantalla img');
  const activar = (n) => {
    pasos.forEach((p, i) => p.classList.toggle('activo', i === n));
    imgs.forEach((im, i) => im.classList.toggle('activa', i === n));
  };
  if (pasos.length) {
    activar(0);
    const obsPasos = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => { if (e.isIntersecting) activar(Number(e.target.dataset.paso)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    pasos.forEach((p) => obsPasos.observe(p));
  }

  // juegos: carril horizontal ligado al scroll
  const juegos = $('.juegos');
  const carril = $('.carril');
  const barra = $('.juegos-progreso i');
  const horizontal = matchMedia('(min-width: 761px)');
  let distancia = 0;
  const medir = () => {
    if (!horizontal.matches) { carril.style.transform = ''; juegos.style.height = ''; return; }
    distancia = Math.max(0, carril.scrollWidth - innerWidth);
    juegos.style.height = `${innerHeight + distancia}px`;
    mover();
  };
  const mover = () => {
    if (!horizontal.matches) return;
    const r = juegos.getBoundingClientRect();
    const total = juegos.offsetHeight - innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    carril.style.transform = `translate3d(${-p * distancia}px,0,0)`;
    if (barra) barra.style.transform = `scaleX(${p})`;
  };
  if (juegos && carril) {
    addEventListener('scroll', mover, { passive: true });
    addEventListener('resize', medir);
    horizontal.addEventListener('change', medir);
    addEventListener('load', medir);
    medir();
  }

  // luz que sigue al mouse en las cartas
  $$('.carta').forEach((c) => {
    c.addEventListener('pointermove', (ev) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${ev.clientX - r.left}px`);
      c.style.setProperty('--my', `${ev.clientY - r.top}px`);
    });
  });

  // botón imán
  const iman = $('.iman');
  if (iman && !reducir && matchMedia('(pointer: fine)').matches) {
    const zona = iman.parentElement;
    zona.addEventListener('pointermove', (ev) => {
      const r = iman.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < 260) iman.style.transform = `translate(${dx * 0.28}px, ${dy * 0.28}px) scale(1.04)`;
      else iman.style.transform = '';
    });
    zona.addEventListener('pointerleave', () => { iman.style.transform = ''; });
  }
})();
