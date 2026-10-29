// On-screen interface, built with plain DOM elements over the 3D canvas.
import { DIFFICULTIES, MONEY } from '../data/config.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const fmt = (n) => `${n.toLocaleString()} <span class="unit">latinum</span>`;

export function createUI(root, h) {
  root.innerHTML = '';

  // Top-left: money.
  const money = el('div', 'panel money hidden');
  money.innerHTML = `
    <div class="row"><span class="dot human"></span><span class="who">You</span><span class="amt" data-k="human"></span></div>
    <div class="row"><span class="dot computer"></span><span class="who" data-k="oppName"></span><span class="amt" data-k="computer"></span></div>
    <div class="row pot"><span class="who">Pot</span><span class="amt" data-k="pot"></span></div>`;
  root.append(money);

  // Top-center: turn banner.
  const banner = el('div', 'banner hidden');
  root.append(banner);

  // Top-right: bumpers.
  const board = el('div', 'panel board hidden');
  board.innerHTML = `
    <div class="row"><span class="dot human"></span><span>Your bumpers</span><b data-k="h">0</b></div>
    <div class="row"><span class="dot computer"></span><span>Opponent bumpers</span><b data-k="c">0</b></div>
    <div class="row"><span>Gate bumper</span><b data-k="gate">dark</b></div>
    <div class="row hole" data-k="hole">Hole closed</div>`;
  root.append(board);

  // Bottom: action bar.
  const bar = el('div', 'actionbar hidden');
  bar.innerHTML = `
    <div class="group raise">
      <button data-a="raiseAdd" title="Each click adds 50 latinum">Raise +50</button>
      <span class="pending" data-k="pending"></span>
      <button data-a="raisePlace" class="primary">Place raise</button>
      <button data-a="raiseClear" title="Clear the raise">✕</button>
    </div>
    <div class="group">
      <button data-a="guide" aria-pressed="false">Guide: off</button>
    </div>
    <div class="group views">
      <button data-a="view" data-v="overhead">Overhead</button>
      <button data-a="view" data-v="player">Player</button>
      <button data-a="view" data-v="bar">Bar</button>
    </div>
    <div class="group">
      <button data-a="sound" aria-pressed="true">Sound: on</button>
      <button data-a="help" title="Rules and controls">?</button>
    </div>`;
  root.append(bar);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'raiseAdd') h.onRaiseAdd();
    else if (a === 'raisePlace') h.onRaisePlace();
    else if (a === 'raiseClear') h.onRaiseClear();
    else if (a === 'guide') h.onGuideToggle();
    else if (a === 'view') h.onView(b.dataset.v);
    else if (a === 'sound') h.onSoundToggle();
    else if (a === 'help') showHelp();
  });

  // Right: power meter.
  const power = el('div', 'power hidden');
  power.innerHTML = '<div class="fill"></div><div class="label">0%</div>';
  root.append(power);

  // Hint line above the action bar.
  const hint = el('div', 'hint hidden');
  root.append(hint);

  const toasts = el('div', 'toasts');
  root.append(toasts);

  // Large center-screen announcement for important moments.
  const announceBox = el('div', 'announce hidden');
  root.append(announceBox);
  let announceTimer = null;

  const q = (parent, k) => parent.querySelector(`[data-k="${k}"]`);
  const btn = (a) => bar.querySelector(`[data-a="${a}"]`);

  function modal(contentHtml, buttons, cls = '') {
    return new Promise((resolve) => {
      const overlay = el('div', `overlay ${cls}`);
      const card = el('div', 'card');
      card.innerHTML = contentHtml;
      const row = el('div', 'buttons');
      for (const b of buttons) {
        const x = el('button', b.cls || '', b.label);
        if (b.disabled) x.disabled = true;
        x.addEventListener('click', () => {
          if (b.keepOpen) { resolve(b.value); return; }
          overlay.remove();
          resolve(b.value);
        });
        row.append(x);
      }
      card.append(row);
      overlay.append(card);
      root.append(overlay);
      const first = row.querySelector('button.primary') || row.querySelector('button');
      if (first) first.focus({ preventScroll: true });
    });
  }

  function showHelp() {
    return modal(`
      <h2>How to play dom-jot</h2>
      <div class="help">
        <h3>Goal</h3>
        <p>Light the bumpers, take control of the table, then sink your own glowing ball, the <b>terik</b>, in the hole.
        Your terik is <span class="c-human">green</span>. The computer's is <span class="c-computer">blue</span>.
        The 8 whitish balls are obstacles.</p>
        <h3>Bumpers</h3>
        <p>Any ball your shot sends into a bumper lights it in your color. Hitting an opponent's lit bumper steals it.
        Your turn continues as long as each shot lights or steals at least one bumper.</p>
        <h3>The hole</h3>
        <p>The hole opens for you when <b>all 10 bumpers are lit</b>, you own <b>at least 6</b>, and you own the
        <b>gate bumper</b> beside the hole. The hexagon glows in your color. Then bounce your terik off one of your lit
        bumpers into the hole to win. Call it: <b>Dom-jot!</b></p>
        <p>If your terik drops into your open hole without touching a bumper first, it goes back to its start spot and your turn ends.</p>
        <h3>Scratch</h3>
        <p>Any other ball in the hole is a scratch. Only the shooter pays for it: <b>the shooter's own bumpers go dark</b>,
        the shooter pays ${MONEY.scratchPenalty} latinum to the opponent, and the turn passes. The opponent keeps their bumpers.</p>
        <h3>Latinum</h3>
        <p>You start the session with ${MONEY.startingBank}. Each round costs ${MONEY.openingBet} from each player.
        Before a shot you may raise once per turn, ${MONEY.raiseStep} per click, up to the size of the pot. Your opponent calls or folds.
        Winning in one unbroken turn from no bumpers is <b>straight nines</b> and earns a ${MONEY.straightNinesBonus} bonus.
        Your bank lasts until you close or reload the page.</p>
        <h3>Controls</h3>
        <ul>
          <li><b>Shoot:</b> press on your terik, drag back away from where you want it to go, release. Longer pull, more power.</li>
          <li><b>Fine aim:</b> while holding, use the left and right arrow keys. <b>Escape</b> cancels.</li>
          <li><b>Camera:</b> drag empty space to rotate, wheel to zoom, right-drag to slide.</li>
          <li><b>Guide:</b> shows the path to the first thing your shot will hit.</li>
        </ul>
      </div>`, [{ label: 'Close', value: true, cls: 'primary' }], 'wide');
  }

  return {
    showHud(on) {
      for (const x of [money, banner, board, bar]) x.classList.toggle('hidden', !on);
    },

    updateMoney({ human, computer, pot, oppName }) {
      q(money, 'human').innerHTML = fmt(human);
      q(money, 'computer').innerHTML = fmt(computer);
      q(money, 'pot').innerHTML = fmt(pot);
      q(money, 'oppName').textContent = oppName;
    },

    setTurn(text, player) {
      banner.textContent = text;
      banner.dataset.player = player || '';
    },

    setBoard({ human, computer, gate, holeFor }) {
      q(board, 'h').textContent = human;
      q(board, 'c').textContent = computer;
      const g = q(board, 'gate');
      g.textContent = gate === 'human' ? 'yours' : gate === 'computer' ? 'opponent' : 'dark';
      g.className = gate ? `c-${gate}` : '';
      const hole = q(board, 'hole');
      hole.textContent = holeFor === 'human' ? 'Hole OPEN for you' : holeFor === 'computer' ? 'Hole open for opponent' : 'Hole closed';
      hole.className = `row hole ${holeFor ? `open c-${holeFor}` : ''}`;
    },

    setRaise({ enabled, pending, max }) {
      btn('raiseAdd').disabled = !enabled || pending + MONEY.raiseStep > max;
      btn('raisePlace').disabled = !enabled || pending <= 0;
      btn('raiseClear').disabled = !enabled || pending <= 0;
      q(bar, 'pending').textContent = pending > 0 ? `${pending}` : '';
      bar.querySelector('.raise').classList.toggle('disabled', !enabled);
    },

    setGuide(on) {
      btn('guide').textContent = `Guide: ${on ? 'on' : 'off'}`;
      btn('guide').setAttribute('aria-pressed', String(on));
    },

    setSound(on) {
      btn('sound').textContent = `Sound: ${on ? 'on' : 'off'}`;
      btn('sound').setAttribute('aria-pressed', String(on));
    },

    setHint(text) {
      hint.textContent = text || '';
      hint.classList.toggle('hidden', !text);
    },

    showPower(p) {
      if (p === null || p === undefined) { power.classList.add('hidden'); return; }
      power.classList.remove('hidden');
      power.querySelector('.fill').style.height = `${Math.round(p * 100)}%`;
      power.querySelector('.label').textContent = `${Math.round(p * 100)}%`;
    },

    // Shows a big message in the middle of the screen. Resolves when it hides.
    announce(title, detail, kind = 'info', ms = 3800) {
      clearTimeout(announceTimer);
      announceBox.className = `announce ${kind}`;
      announceBox.innerHTML = `<div class="a-title">${title}</div>${detail ? `<div class="a-detail">${detail}</div>` : ''}`;
      return new Promise((resolve) => {
        announceTimer = setTimeout(() => {
          announceBox.classList.add('out');
          setTimeout(() => { announceBox.className = 'announce hidden'; resolve(); }, 400);
        }, ms);
      });
    },

    toast(text, kind = 'info', ms = 3600) {
      const t = el('div', `toast ${kind}`, text);
      toasts.append(t);
      while (toasts.children.length > 4) toasts.firstChild.remove();
      setTimeout(() => t.classList.add('fade'), ms);
      setTimeout(() => t.remove(), ms + 600);
    },

    showStart({ difficulty, banks, canPlay, note }) {
      const opts = Object.entries(DIFFICULTIES).map(([k, d]) => `
        <label class="diff ${k === difficulty ? 'sel' : ''}">
          <input type="radio" name="diff" value="${k}" ${k === difficulty ? 'checked' : ''}>
          <b>${d.label}</b><span>${d.opponent}</span>
        </label>`).join('');
      const overlay = el('div', 'overlay start');
      overlay.innerHTML = `
        <div class="card">
          <div class="title">DOM-JOT</div>
          <p class="challenge">"Play dom-jot, human?"</p>
          <div class="diffs">${opts}</div>
          <p class="bank">Your bank: <b>${banks.human}</b> latinum · Opponent: <b>${banks.computer}</b> latinum<br>
          <span class="muted">Each round costs ${MONEY.openingBet} latinum from each player.</span></p>
          ${note ? `<p class="note bad">${note}</p>` : ''}
          <div class="buttons">
            <button data-b="help">How to play</button>
            <button data-b="play" class="primary" ${canPlay ? '' : 'disabled'}>Play</button>
          </div>
        </div>`;
      root.append(overlay);
      overlay.querySelectorAll('.diff input').forEach((i) => i.addEventListener('change', () => {
        overlay.querySelectorAll('.diff').forEach((d) => d.classList.toggle('sel', d.querySelector('input').checked));
      }));
      overlay.querySelector('[data-b="help"]').addEventListener('click', () => showHelp());
      overlay.querySelector('[data-b="play"]').focus();
      return new Promise((resolve) => {
        overlay.querySelector('[data-b="play"]').addEventListener('click', () => {
          const sel = overlay.querySelector('.diff input:checked');
          overlay.remove();
          resolve(sel ? sel.value : difficulty);
        });
      });
    },

    promptCall({ oppName, amount, bank }) {
      const short = bank < amount;
      return modal(`
        <h2>${oppName} raises ${amount}</h2>
        <p>Call to match the raise, or fold and give up the pot.</p>
        <p class="muted">Your bank: ${bank} latinum.${short ? ` You can only cover ${bank}, so calling puts you all in.` : ''}</p>`,
      [
        { label: 'Fold', value: false },
        { label: short ? `Call all in (${bank})` : `Call ${amount}`, value: true, cls: 'primary' },
      ]);
    },

    showResult({ title, lines, primary, secondary, mood }) {
      const buttons = [];
      if (secondary) buttons.push({ label: secondary, value: 'secondary' });
      buttons.push({ label: primary, value: 'primary', cls: 'primary' });
      return modal(`<h2 class="${mood || ''}">${title}</h2>${lines.map((l) => `<p>${l}</p>`).join('')}`, buttons, 'result');
    },

    showHelp,

    setThinking(text) {
      banner.classList.toggle('thinking', !!text);
      if (text) banner.textContent = text;
    },
  };
}
