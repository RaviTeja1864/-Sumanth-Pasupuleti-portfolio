(function() {
  function parseHSL(hslStr) {
    const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
    if (!match) return { h: 40, s: 80, l: 80 };
    return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
  }

  function buildGlowVars(glowColor, intensity) {
    const { h, s, l } = parseHSL(glowColor);
    const base = `${h}deg ${s}% ${l}%`;
    const opacities = [100, 60, 50, 40, 30, 20, 10];
    const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
    const vars = {};
    for (let i = 0; i < opacities.length; i++) {
      vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
    }
    return vars;
  }

  const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
  const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
  const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

  function buildGradientVars(colors) {
    const vars = {};
    for (let i = 0; i < 7; i++) {
      const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
      vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
    }
    vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
    return vars;
  }

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInCubic(x) { return x * x * x; }

  function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }) {
    const t0 = performance.now() + delay;
    function tick() {
      const elapsed = performance.now() - t0;
      const t = Math.min(elapsed / duration, 1);
      onUpdate(start + (end - start) * ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else if (onEnd) onEnd();
    }
    setTimeout(() => requestAnimationFrame(tick), delay);
  }

  function initBorderGlow(container, options = {}) {
    const config = {
      edgeSensitivity: options.edgeSensitivity ?? 30,
      glowColor: options.glowColor ?? '40 80 80',
      backgroundColor: options.backgroundColor ?? '#120F17',
      borderRadius: options.borderRadius ?? 28,
      glowRadius: options.glowRadius ?? 40,
      glowIntensity: options.glowIntensity ?? 1.0,
      coneSpread: options.coneSpread ?? 25,
      animated: options.animated ?? false,
      colors: options.colors ?? ['#c084fc', '#f472b6', '#38bdf8'],
      fillOpacity: options.fillOpacity ?? 0.5,
    };

    const card = container;
    card.classList.add('border-glow-card');
    
    // Set static CSS variables
    card.style.setProperty('--card-bg', config.backgroundColor);
    card.style.setProperty('--edge-sensitivity', config.edgeSensitivity);
    card.style.setProperty('--border-radius', `${config.borderRadius}px`);
    card.style.setProperty('--glow-padding', `${config.glowRadius}px`);
    card.style.setProperty('--cone-spread', config.coneSpread);
    card.style.setProperty('--fill-opacity', config.fillOpacity);

    // Set glow and gradient variables
    const glowVars = buildGlowVars(config.glowColor, config.glowIntensity);
    for (const key in glowVars) {
      card.style.setProperty(key, glowVars[key]);
    }
    const gradientVars = buildGradientVars(config.colors);
    for (const key in gradientVars) {
      card.style.setProperty(key, gradientVars[key]);
    }

    // Add edge-light span if it doesn't exist
    if (!card.querySelector('.edge-light')) {
      const edgeLight = document.createElement('span');
      edgeLight.className = 'edge-light';
      card.appendChild(edgeLight);
    }

    // Ensure content is wrapped in border-glow-inner if needed
    // But for a simple img, we might just want to wrap the img
    // We'll assume the user wraps their content or we do it here
    const children = Array.from(card.childNodes).filter(node => !node.classList?.contains('edge-light'));
    const inner = document.createElement('div');
    inner.className = 'border-glow-inner';
    children.forEach(child => inner.appendChild(child));
    card.appendChild(inner);

    function getCenterOfElement(el) {
      const { width, height } = el.getBoundingClientRect();
      return [width / 2, height / 2];
    }

    function getEdgeProximity(el, x, y) {
      const [cx, cy] = getCenterOfElement(el);
      const dx = x - cx;
      const dy = y - cy;
      let kx = Infinity;
      let ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    }

    function getCursorAngle(el, x, y) {
      const [cx, cy] = getCenterOfElement(el);
      const dx = x - cx;
      const dy = y - cy;
      if (dx === 0 && dy === 0) return 0;
      const radians = Math.atan2(dy, dx);
      let degrees = radians * (180 / Math.PI) + 90;
      if (degrees < 0) degrees += 360;
      return degrees;
    }

    function handlePointerMove(e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const edge = getEdgeProximity(card, x, y);
      const angle = getCursorAngle(card, x, y);

      card.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`);
      card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
    }

    card.addEventListener('pointermove', handlePointerMove);

    if (config.animated) {
      const angleStart = 110;
      const angleEnd = 465;
      card.classList.add('sweep-active');
      card.style.setProperty('--cursor-angle', `${angleStart}deg`);

      animateValue({ duration: 500, onUpdate: v => card.style.setProperty('--edge-proximity', v) });
      animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: v => {
        card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`);
      }});
      animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: v => {
        card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`);
      }});
      animateValue({ ease: easeInCubic, delay: 2500, duration: 1500, start: 100, end: 0,
        onUpdate: v => card.style.setProperty('--edge-proximity', v),
        onEnd: () => card.classList.remove('sweep-active'),
      });
    }

    return function destroy() {
      card.removeEventListener('pointermove', handlePointerMove);
    };
  }

  window.BorderGlow = { init: initBorderGlow };
})();
