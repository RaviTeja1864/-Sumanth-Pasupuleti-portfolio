/**
 * DotField — Vanilla JS port of the React Bits DotField component.
 * Creates an interactive canvas-based dot grid with cursor bulge effect.
 */
(function () {
  const TWO_PI = Math.PI * 2;

  function initDotField(container, options = {}) {
    const config = {
      dotRadius: options.dotRadius ?? 1.5,
      dotSpacing: options.dotSpacing ?? 14,
      cursorRadius: options.cursorRadius ?? 500,
      cursorForce: options.cursorForce ?? 0.1,
      bulgeOnly: options.bulgeOnly ?? true,
      bulgeStrength: options.bulgeStrength ?? 67,
      glowRadius: options.glowRadius ?? 160,
      sparkle: options.sparkle ?? false,
      waveAmplitude: options.waveAmplitude ?? 0,
      gradientFrom: options.gradientFrom ?? '#94a3b8',
      gradientTo: options.gradientTo ?? 'rgba(180, 151, 207, 0.25)',
      glowColor: options.glowColor ?? '#120F17',
    };

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    wrapper.classList.add('dot-field-wrapper');

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    wrapper.appendChild(canvas);

    // Create SVG glow overlay
    const glowId = 'dot-field-glow-' + Math.random().toString(36).slice(2, 9);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

    const defs = document.createElementNS(svgNS, 'defs');
    const radialGrad = document.createElementNS(svgNS, 'radialGradient');
    radialGrad.id = glowId;
    const stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', config.glowColor);
    const stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', 'transparent');
    radialGrad.appendChild(stop1);
    radialGrad.appendChild(stop2);
    defs.appendChild(radialGrad);
    svg.appendChild(defs);

    const glowCircle = document.createElementNS(svgNS, 'circle');
    glowCircle.setAttribute('cx', '-9999');
    glowCircle.setAttribute('cy', '-9999');
    glowCircle.setAttribute('r', config.glowRadius);
    glowCircle.setAttribute('fill', `url(#${glowId})`);
    glowCircle.style.opacity = '0';
    glowCircle.style.willChange = 'opacity';
    svg.appendChild(glowCircle);
    wrapper.appendChild(svg);

    container.appendChild(wrapper);

    // State
    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots = [];
    let w = 0, h = 0, offsetX = 0, offsetY = 0;
    let rafId = null;
    let frameCount = 0;
    let glowOpacity = 0;
    let engagement = 0;
    const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };

    function doResize() {
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      offsetX = rect.left + window.scrollX;
      offsetY = rect.top + window.scrollY;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildDots();
    }

    function buildDots() {
      const step = config.dotRadius + config.dotSpacing;
      const cols = Math.floor(w / step);
      const rows = Math.floor(h / step);
      const padX = (w % step) / 2;
      const padY = (h % step) / 2;
      dots = new Array(rows * cols);
      let idx = 0;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          dots[idx++] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
        }
      }
    }

    function onMouseMove(e) {
      mouse.x = e.pageX - offsetX;
      mouse.y = e.pageY - offsetY;
    }

    function updateMouseSpeed() {
      const dx = mouse.prevX - mouse.x;
      const dy = mouse.prevY - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      mouse.speed += (dist - mouse.speed) * 0.5;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    }

    function tick() {
      frameCount++;
      const len = dots.length;
      const t = frameCount * 0.02;
      const cr = config.cursorRadius;
      const crSq = cr * cr;
      const rad = config.dotRadius / 2;
      const isBulge = config.bulgeOnly;

      const targetEngagement = Math.min(mouse.speed / 5, 1);
      engagement += (targetEngagement - engagement) * 0.06;
      if (engagement < 0.001) engagement = 0;

      glowOpacity += (engagement - glowOpacity) * 0.08;
      glowCircle.setAttribute('cx', mouse.x);
      glowCircle.setAttribute('cy', mouse.y);
      glowCircle.style.opacity = glowOpacity;

      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, config.gradientFrom);
      grad.addColorStop(1, config.gradientTo);
      ctx.fillStyle = grad;

      ctx.beginPath();

      for (let i = 0; i < len; i++) {
        const d = dots[i];
        const dx = mouse.x - d.ax;
        const dy = mouse.y - d.ay;
        const distSq = dx * dx + dy * dy;

        if (distSq < crSq && engagement > 0.01) {
          const dist = Math.sqrt(distSq);
          if (isBulge) {
            const t2 = 1 - dist / cr;
            const push = t2 * t2 * config.bulgeStrength * engagement;
            const angle = Math.atan2(dy, dx);
            d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
            d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
          } else {
            const angle = Math.atan2(dy, dx);
            const move = (500 / dist) * (mouse.speed * config.cursorForce);
            d.vx += Math.cos(angle) * -move;
            d.vy += Math.sin(angle) * -move;
          }
        } else if (isBulge) {
          d.sx += (d.ax - d.sx) * 0.1;
          d.sy += (d.ay - d.sy) * 0.1;
        }

        if (!isBulge) {
          d.vx *= 0.9;
          d.vy *= 0.9;
          d.x = d.ax + d.vx;
          d.y = d.ay + d.vy;
          d.sx += (d.x - d.sx) * 0.1;
          d.sy += (d.y - d.sy) * 0.1;
        }

        let drawX = d.sx;
        let drawY = d.sy;
        if (config.waveAmplitude > 0) {
          drawY += Math.sin(d.ax * 0.03 + t) * config.waveAmplitude;
          drawX += Math.cos(d.ay * 0.03 + t * 0.7) * config.waveAmplitude * 0.5;
        }

        if (config.sparkle) {
          const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
          if ((hash % 100) < 3) {
            ctx.moveTo(drawX + rad * 1.8, drawY);
            ctx.arc(drawX, drawY, rad * 1.8, 0, TWO_PI);
          } else {
            ctx.moveTo(drawX + rad, drawY);
            ctx.arc(drawX, drawY, rad, 0, TWO_PI);
          }
        } else {
          ctx.moveTo(drawX + rad, drawY);
          ctx.arc(drawX, drawY, rad, 0, TWO_PI);
        }
      }

      ctx.fill();
      rafId = requestAnimationFrame(tick);
    }

    // Init
    let resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    }

    const speedInterval = setInterval(updateMouseSpeed, 20);

    doResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    // Cleanup function
    return function destroy() {
      cancelAnimationFrame(rafId);
      clearInterval(speedInterval);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      wrapper.remove();
    };
  }

  // Expose globally
  window.DotField = { init: initDotField };
})();
