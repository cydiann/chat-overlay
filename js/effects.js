const SVG_NS = "http://www.w3.org/2000/svg";

export function renderStarfield(layer, config) {
  layer.replaceChildren();
  if (!config.stars) return;
  for (let i = 0; i < config.starcount; i++) {
    const star = document.createElement("span");
    star.className = "star";
    const size = (1 + Math.random() * 2).toFixed(1);
    star.style.cssText =
      `left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;` +
      `width:${size}px;height:${size}px;` +
      `animation-duration:${(2 + Math.random() * 4).toFixed(2)}s;animation-delay:-${(Math.random() * 6).toFixed(2)}s`;
    layer.append(star);
  }
}

function shoot(layer) {
  const star = document.createElement("span");
  star.className = "shooting";
  star.style.left = `${20 + Math.random() * 70}%`;
  star.style.top = `${Math.random() * 40}%`;
  layer.append(star);
  setTimeout(() => star.remove(), 1400);
}

export function startShootingStars(layer, getConfig) {
  let timer;
  const schedule = () => {
    timer = setTimeout(() => {
      const config = getConfig();
      if (config.stars && config.shooting) shoot(layer);
      schedule();
    }, 8000 + Math.random() * 12000);
  };
  schedule();
  return { stop: () => clearTimeout(timer) };
}

export function sparklePop(bubble) {
  for (let i = 0; i < 6; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 18;
    p.style.setProperty("--dx", `${(Math.cos(angle) * dist).toFixed(1)}px`);
    p.style.setProperty("--dy", `${(Math.sin(angle) * dist - 12).toFixed(1)}px`);
    p.style.animationDelay = `${Math.round(Math.random() * 120)}ms`;
    bubble.append(p);
    setTimeout(() => p.remove(), 1300);
  }
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function drawConstellation(svgLayer, fromBubble, toBubble) {
  const base = svgLayer.getBoundingClientRect();
  const point = bubble => {
    const r = bubble.querySelector(".pill").getBoundingClientRect();
    return { x: (r.left - base.left + 10).toFixed(1), y: (r.top - base.top + r.height / 2).toFixed(1) };
  };
  const a = point(fromBubble);
  const b = point(toBubble);
  const group = svgEl("g", { class: "constellation" });
  group.append(
    svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
    svgEl("circle", { cx: a.x, cy: a.y, r: 2 }),
    svgEl("circle", { cx: b.x, cy: b.y, r: 2 }),
  );
  svgLayer.append(group);
  setTimeout(() => group.remove(), 2600);
}
