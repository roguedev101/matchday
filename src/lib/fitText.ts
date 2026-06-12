import type { Directive } from 'vue'

const resizeHandlers = new WeakMap<HTMLElement, () => void>()

// Shrink the font until the text fits its container; the element's
// white-space: nowrap + ellipsis remain as a fallback for extreme cases.
function fit(el: HTMLElement) {
  el.style.fontSize = ''
  for (let i = 0; i < 4 && el.clientWidth && el.scrollWidth > el.clientWidth; i++) {
    const size = parseFloat(getComputedStyle(el).fontSize)
    el.style.fontSize = `${(size * el.clientWidth) / el.scrollWidth - 0.5}px`
  }
}

/** Scales a one-line label's font-size down so it fits without truncating. */
export const vFitText: Directive<HTMLElement> = {
  mounted(el) {
    const onResize = () => fit(el)
    resizeHandlers.set(el, onResize)
    window.addEventListener('resize', onResize)
    fit(el)
    // Web fonts change metrics after first layout; measure again once loaded.
    document.fonts?.ready.then(() => fit(el))
  },
  updated(el) {
    fit(el)
  },
  unmounted(el) {
    const onResize = resizeHandlers.get(el)
    if (onResize) window.removeEventListener('resize', onResize)
  },
}
