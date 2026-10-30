// Anonymous play counts, sent to GoatCounter (https://domjot.goatcounter.com).
// The page view itself is counted by the script tag in index.html. These are extra events, so the
// dashboard shows how many games were actually played. No personal data is sent.
// GoatCounter's script loads asynchronously, so events wait in a short queue until it is ready.

const queue = [];
let timer = null;

function flush() {
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== 'function') return false;
  while (queue.length) gc.count(queue.shift());
  return true;
}

export function trackEvent(name, title) {
  queue.push({ path: name, title: title || name, event: true });
  if (flush() || timer) return;
  let tries = 0;
  timer = setInterval(() => {
    if (flush() || ++tries > 30) { clearInterval(timer); timer = null; }
  }, 1000);
}
