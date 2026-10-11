const SLIDE_OUT_MS = 400; // matches .slide.out in events.css
const SCROLL_BASE_MS = 2500;
const SCROLL_MS_PER_PX = 40;

export function scrollDistance(textWidth, boxWidth) {
  return Math.max(0, Math.ceil(textWidth - boxWidth));
}

export function createBox(key) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.dataset.box = key;
  for (const part of ["box", "title", "name"]) {
    const el = document.createElement("div");
    el.className = part;
    slot.append(el);
  }
  return slot;
}

export function setTitle(slot, text) {
  slot.querySelector(".title").textContent = text;
}

export function setName(slot, name, animate = true) {
  if (slot.dataset.name === name) return;
  slot.dataset.name = name;
  const holder = slot.querySelector(".name");
  for (const old of holder.querySelectorAll(".slide:not(.out)")) {
    if (!animate) {
      old.remove();
      continue;
    }
    old.classList.add("out");
    setTimeout(() => old.remove(), SLIDE_OUT_MS);
  }
  const slide = document.createElement("span");
  slide.className = animate ? "slide in" : "slide";
  const text = document.createElement("span");
  text.className = "text";
  text.textContent = name;
  slide.append(text);
  holder.append(slide);
  fitName(slot);
}

// Long names glide back and forth instead of shrinking or being cut off.
export function fitName(slot) {
  const holder = slot.querySelector(".name");
  const slide = holder.querySelector(".slide:not(.out)");
  if (!slide) return;
  const text = slide.firstElementChild;
  const distance = scrollDistance(text.offsetWidth, holder.clientWidth);
  slide.classList.toggle("scrolling", distance > 0);
  text.style.setProperty("--scroll", `-${distance}px`);
  text.style.setProperty("--scroll-ms", `${SCROLL_BASE_MS + distance * SCROLL_MS_PER_PX}ms`);
}
