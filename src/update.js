// Keeps players on the latest version.
// GitHub Pages lets browsers reuse files for up to 10 minutes, so after an update a browser can
// run a mix of old and new files. On load, this compares the version built into the code with
// version.json fetched fresh from the server. If they differ, it re-downloads every file the page
// loaded and reloads once.
import { VERSION } from './data/config.js';

const FLAG = 'domjot-updated-to';

export async function updateIfStale() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const { version } = await res.json();
    if (!version || version === VERSION) return false;
    // Only try once per version, so a failed refresh can never loop.
    let tried = null;
    try { tried = sessionStorage.getItem(FLAG); } catch { /* storage unavailable */ }
    if (tried === version) return false;
    try { sessionStorage.setItem(FLAG, version); } catch { /* storage unavailable */ }
    const urls = performance.getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin) && !u.includes('version.json') && !u.endsWith('.mp3'));
    urls.push(location.href.split('#')[0]);
    await Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
    location.reload();
    return true;
  } catch {
    return false;
  }
}
