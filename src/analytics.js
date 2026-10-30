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

// Total games played, read from GoatCounter's public counter: the sum of rounds started at every
// difficulty. Needs the "allow using the visitor counter" setting on the GoatCounter site.
// Returns a number, or null if the counter is not available (setting off, offline, blocked).
const COUNTER = 'https://domjot.goatcounter.com/counter';
const START_EVENTS = ['round-start-easy', 'round-start-medium', 'round-start-hard'];

export async function fetchGamesPlayed() {
  try {
    const results = await Promise.all(START_EVENTS.map(async (p) => {
      const res = await fetch(`${COUNTER}/${p}.json`, { cache: 'no-store' });
      if (res.status === 404) return 0; // that difficulty has not been played yet
      if (!res.ok) throw new Error(`counter ${res.status}`);
      const data = await res.json();
      return parseInt(String(data.count).replace(/[^0-9]/g, ''), 10) || 0;
    }));
    return results.reduce((a, b) => a + b, 0);
  } catch {
    return null;
  }
}
