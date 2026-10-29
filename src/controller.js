// Runs the game: rounds, coin toss, turns, shots, betting and the computer opponent.
import {
  HUMAN, COMPUTER, COLORS, DIFFICULTIES, MONEY,
} from './data/config.js';
import { BUMPERS, GATE_INDEX, HOLE, PHYSICS } from './data/tableLayout.js';
import {
  terikId, createBumpers, countOwned, holeOpenFor, createShotTracker, onBumperHit, onDrop, finishShot,
  isStraightNines,
} from './game/rules.js';
import {
  createSession, canPlay, newOpponent, startRound, maxRaise, canRaise, applyRaise, payScratchPenalty,
  awardPot, payStraightNines, newTurn,
} from './game/betting.js';
import { createRoundWorld, respotBall } from './game/setup.js';
import { isValidSpot } from './physics/placement.js';
import { chooseShot, decideRaise, respondToRaise } from './ai/ai.js';
import { createScene, createControls, CameraRig } from './render/scene.js';
import { createTable } from './render/tableModel.js';
import { createBallViews } from './render/balls.js';
import { createStick, createGuide, createCoin } from './render/props.js';
import { Tweens, toWorld, easeOut } from './render/util.js';
import { createShotInput, MAX_PULL } from './input/shotInput.js';
import { createUI } from './ui/ui.js';
import { createSound } from './audio/sound.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  constructor({ canvas, uiRoot }) {
    this.canvas = canvas;
    this.tweens = new Tweens();
    const { renderer, scene, camera } = createScene(canvas);
    Object.assign(this, { renderer, scene, camera });

    this.table = createTable(scene);
    this.ballViews = createBallViews(scene);
    this.stick = createStick(scene);
    this.guide = createGuide(scene);
    this.coin = createCoin(scene);
    this.sound = createSound();

    this.session = createSession();
    this.difficulty = 'medium';
    this.phase = 'menu';
    this.world = null;
    this.bumpers = createBumpers();
    this.guideOn = false;
    this.pendingRaise = 0;
    this.lastAimAngle = null;
    this.time = 0;

    // Shot input first, so it can claim drags on the terik before the camera does.
    this.input = createShotInput({
      canvas,
      camera,
      canAim: () => this.phase === 'aim',
      getBall: () => (this.world ? this.world.getBall(terikId(HUMAN)) : null),
      onAim: (s) => this.onAim(s),
      onShoot: (s) => this.onHumanShoot(s),
      onCancel: () => this.onAimCancel(),
    });
    this.controls = createControls(camera, canvas);
    this.rig = new CameraRig(camera, this.controls, this.tweens);

    this.ui = createUI(uiRoot, {
      onRaiseAdd: () => this.onRaiseAdd(),
      onRaiseClear: () => { this.pendingRaise = 0; this.refreshRaise(); },
      onRaisePlace: () => this.onRaisePlace(),
      onGuideToggle: () => {
        this.guideOn = !this.guideOn;
        this.ui.setGuide(this.guideOn);
        if (!this.guideOn) this.guide.hide();
      },
      onView: (v) => this.setView(v),
      onSoundToggle: () => {
        this.sound.setEnabled(!this.sound.isEnabled());
        this.ui.setSound(this.sound.isEnabled());
      },
    });
    window.addEventListener('pointerdown', () => this.sound.unlock(), true);
    window.addEventListener('keydown', () => this.sound.unlock(), true);

    this.table.setAllBumpers(this.bumpers);
  }

  get oppName() { return DIFFICULTIES[this.difficulty].opponent; }

  start() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    this.showMenu();
  }

  // ---------- Frame update ----------

  update(dt) {
    this.time += dt;
    if (this.phase === 'shooting') this.stepPhysics(dt);
    if (this.world) this.ballViews.sync(this.world, dt);
    this.table.update(dt, this.time);
    this.stick.update(dt);
    this.tweens.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  stepPhysics(dt) {
    this.acc += dt;
    const events = [];
    let steps = 0;
    while (this.acc >= PHYSICS.dt && steps < 60 && !this.shotDone) {
      this.acc -= PHYSICS.dt;
      steps++;
      events.length = 0;
      this.world.step(events);
      for (const e of events) this.handleEvent(e);
      if (this.world.time - this.shotStart > PHYSICS.maxSimTime) {
        for (const b of this.world.balls) { b.vx = 0; b.vy = 0; }
      }
      if (!this.world.isMoving()) this.shotDone = true;
    }
    if (this.shotDone) {
      this.phase = 'resolving';
      this.resolveShot();
    }
  }

  handleEvent(e) {
    const t = this.tracker;
    if (e.type === 'bumper') {
      const change = onBumperHit(t, e.ballId, e.bumperIndex);
      this.sound.bumper(!!change, t.shooter);
      if (change) {
        this.table.setBumperOwner(change.index, change.to);
        this.refreshBoard(true);
      }
    } else if (e.type === 'ball') {
      this.sound.ballClick(e.speed);
    } else if (e.type === 'rail' || e.type === 'wall') {
      this.sound.rail(e.speed);
    } else if (e.type === 'drop') {
      const b = this.world.getBall(e.ballId);
      this.ballViews.startDrop(e.ballId, b.x, b.y);
      this.sound.drop();
      const r = onDrop(t, e.ballId);
      if (r === 'scratch' && !this.scratchShown) {
        this.scratchShown = true;
        this.table.setAllBumpers(this.bumpers);
        this.sound.scratch();
        this.ui.toast(t.shooter === HUMAN ? 'Scratch! Your bumpers go dark.' : `Scratch by ${this.oppName}! Its bumpers go dark.`, t.shooter === HUMAN ? 'bad' : 'good');
        this.refreshBoard();
      } else if (r === 'win') {
        for (const x of this.world.balls) { x.vx = 0; x.vy = 0; }
        this.shotDone = true;
      }
    }
  }

  // ---------- Menu and rounds ----------

  async showMenu() {
    this.phase = 'menu';
    this.ui.showHud(false);
    this.ui.setHint(null);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    const ok = canPlay(this.session, HUMAN) && canPlay(this.session, COMPUTER);
    this.difficulty = await this.ui.showStart({
      difficulty: this.difficulty,
      banks: this.session.banks,
      canPlay: ok,
      note: ok ? null : 'You need at least 100 latinum to play. Close or reload the page to start a new session.',
    });
    this.controls.autoRotate = false;
    this.startRound();
  }

  async startRound() {
    this.phase = 'toss';
    this.pendingHoleCard = false;
    this.roundMoney = startRound(this.session);
    this.bumpers = createBumpers();
    this.table.stopLightShow();
    this.table.setAllBumpers(this.bumpers);
    this.table.setHexGlow(null);
    this.ballViews.clear();
    this.world = null;
    this.ui.showHud(true);
    this.updateMoney();
    this.refreshBoard();
    this.ui.setTurn('Coin toss');
    this.refreshRaise();
    this.ui.toast(`Opening bets: ${MONEY.openingBet} latinum each. Pot ${this.roundMoney.pot}.`);

    const first = await this.coinToss();

    const { world, startPositions } = createRoundWorld();
    this.world = world;
    this.startPositions = startPositions;
    this.ballViews.build(world);
    await this.rig.bar();
    this.beginTurn(first);
  }

  async coinToss() {
    const humanFirst = Math.random() < 0.5; // decided first, then animated
    let intoHole = Math.random() < 0.08;
    await this.rig.bar();
    for (;;) {
      let land;
      if (intoHole) land = { x: HOLE.x + 4, y: HOLE.y - 2 };
      else {
        do {
          land = { x: -30 + Math.random() * 60, y: -16 + Math.random() * 30 };
        } while (!isValidSpot(land.x, land.y, [], { holeGap: 8, startGap: 4 }));
      }
      this.rig.lookAt(land.x, land.y, 46, 34);
      this.sound.coin();
      await this.coin.toss(this.tweens, { humanFirst, land, intoHole });
      this.sound.coinLand();
      if (!intoHole) {
        await this.rig.flyTo(toWorld(land.x, land.y - 9, 13), toWorld(land.x, land.y, 0), 0.7);
        break;
      }
      this.ui.toast('The coin rolled into the hole! Toss again.');
      await delay(900);
      intoHole = false;
    }
    await delay(600);
    await this.ui.eventCard({
      title: humanFirst ? 'You shoot first' : `${this.oppName} shoots first`,
      lines: [
        humanFirst ? 'The coin landed with the <b>Starfleet emblem</b> face up.' : 'The coin landed with the <b>Nausicaan glyph</b> face up.',
        `Your terik is <span class="c-human">green</span>. ${this.oppName}'s is <span class="c-computer">blue</span>.
         Light bumpers in your color, open the hole, then bounce your terik off one of your bumpers into the hole.`,
      ],
      mood: humanFirst ? 'good' : 'computer',
      button: 'Start',
    });
    this.coin.hide();
    return humanFirst ? HUMAN : COMPUTER;
  }

  // ---------- Turns ----------

  beginTurn(player) {
    this.turnPlayer = player;
    this.ownedAtTurnStart = countOwned(this.bumpers, player);
    newTurn(this.roundMoney);
    this.pendingRaise = 0;
    this.playTurn(player, false);
  }

  playTurn(player, continuing) {
    this.refreshBoard();
    this.updateMoney();
    if (player === HUMAN) {
      this.phase = 'aim';
      this.ui.setTurn(continuing ? 'Your turn continues' : 'Your turn', HUMAN);
      this.ui.setHint('Press on your green terik, drag back, release to shoot.');
      this.refreshRaise();
    } else {
      this.phase = 'computer';
      this.ui.setHint(null);
      this.ui.setTurn(`${this.oppName}'s turn${continuing ? ' continues' : ''}`, COMPUTER);
      this.refreshRaise();
      this.computerTurn();
    }
  }

  async computerTurn() {
    await delay(650);
    if (this.phase !== 'computer') return;
    const amt = decideRaise(this.difficulty, this.session, this.roundMoney, this.bumpers);
    if (amt > 0) {
      this.sound.raise();
      const calls = await this.ui.promptCall({ oppName: this.oppName, amount: amt, bank: this.session.banks[HUMAN] });
      const res = applyRaise(this.session, this.roundMoney, COMPUTER, amt, calls);
      this.updateMoney();
      if (res.result === 'fold') { this.endByFold(COMPUTER); return; }
      this.ui.toast(res.result === 'allIn' ? `You go all in with ${res.paid}.` : `You call ${amt}.`);
    }
    this.ui.setThinking(`${this.oppName} is lining up a shot...`);
    const shot = await chooseShot(this.world, this.bumpers, COMPUTER, this.difficulty, {
      yieldEvery: 8, pot: this.roundMoney.pot,
    });
    this.ui.setThinking(null);
    this.ui.setTurn(`${this.oppName}'s turn`, COMPUTER);
    if (this.phase !== 'computer') return;
    const b = this.world.getBall(terikId(COMPUTER));
    const pull = shot.power ** (1 / 1.6) * MAX_PULL * 0.35;
    await this.tweens.add(0.9, (k) => this.stick.aim(b, shot.angle, pull * easeOut(k), COLORS.computer));
    await delay(150);
    this.executeShot(COMPUTER, shot.angle, shot.power);
  }

  executeShot(player, angle, power) {
    this.phase = 'shooting';
    this.guide.hide();
    this.ui.showPower(null);
    this.ui.setHint(null);
    this.pendingRaise = 0;
    this.refreshRaise();
    this.tracker = createShotTracker(this.bumpers, player);
    this.holeBefore = holeOpenFor(this.bumpers);
    this.shotDone = false;
    this.scratchShown = false;
    this.acc = 0;
    this.shotStart = this.world.time;
    const b = this.world.getBall(terikId(player));
    this.stick.strike(b, angle);
    this.sound.strike(power);
    this.world.strike(terikId(player), angle, power * PHYSICS.maxShotSpeed);
  }

  async resolveShot() {
    const t = this.tracker;
    const out = finishShot(t);
    const shooter = t.shooter;
    const who = shooter === HUMAN ? 'You' : this.oppName;
    this.refreshBoard();

    if (out.type === 'win') { await this.handleWin(shooter); return; }

    // The hole opened for the computer during its shot: stop and warn before it can shoot again.
    if (this.pendingHoleCard) {
      this.pendingHoleCard = false;
      if (holeOpenFor(this.bumpers) === COMPUTER) {
        const owned = countOwned(this.bumpers, COMPUTER);
        await this.ui.eventCard({
          title: `Hole open for ${this.oppName}`,
          lines: [
            `All 10 bumpers are lit. ${this.oppName} owns ${owned} of them, including the gate bumper beside the hole, so the hole in the center now glows blue.`,
            `It can now win by bouncing its blue terik off one of its lit bumpers into the hole.`,
            out.type === 'continue'
              ? `It lit a bumper on that shot, so it shoots again now.`
              : `Your turn: steal back the gate bumper, or enough bumpers that it owns fewer than 6, to close the hole.`,
          ],
          mood: 'computer',
        });
      }
    }

    if (out.type === 'scratch') {
      const paid = payScratchPenalty(this.session, shooter);
      this.updateMoney();
      this.respotDropped(t);
      const lost = t.scratchLost;
      const bumpersText = (n) => (n === 1 ? '1 lit bumper' : `${n} lit bumpers`);
      const mine = shooter === HUMAN;
      const what = this.describeDropped(t);
      const lines = mine
        ? [`${what} went into the hole before it was open for you.`,
          `You lose ${lost ? `your ${bumpersText(lost)}` : 'no bumpers (you had none lit)'} and pay ${paid} latinum to ${this.oppName}.`,
          `${this.oppName}'s bumpers are not affected. The ball goes back to its start spot, and the turn passes to ${this.oppName}.`]
        : [`${what} went into the hole on ${this.oppName}'s shot.`,
          `${this.oppName} loses ${lost ? bumpersText(lost) : 'nothing (it had no bumpers lit)'} and pays you ${paid} latinum.`,
          '<b>Your bumpers are safe.</b> The ball goes back to its start spot, and it is your turn.'];
      await this.ui.eventCard({ title: mine ? 'Scratch!' : `Scratch by ${this.oppName}`, lines, mood: mine ? 'bad' : 'good' });
      this.beginTurn(out.next);
      return;
    }
    if (out.type === 'noBumperFirst') {
      this.respotDropped(t);
      const mine = shooter === HUMAN;
      await this.ui.eventCard({
        title: 'No bumper first',
        lines: [
          `${mine ? 'Your' : `${this.oppName}'s`} terik dropped into the open hole without touching a bumper first, so it does not win.`,
          'To win, the terik must bounce off one of its own lit bumpers on the way in.',
          `It goes back to its start spot. No penalty. The turn passes to ${mine ? this.oppName : 'you'}.`,
        ],
        mood: mine ? 'bad' : 'good',
      });
      this.beginTurn(out.next);
      return;
    }
    if (out.type === 'continue') {
      const parts = [];
      if (t.lit) parts.push(`lit ${t.lit}`);
      if (t.stolen) parts.push(`stole ${t.stolen}`);
      this.ui.toast(`${who} ${parts.join(' and ')}. Turn continues.`, shooter === HUMAN ? 'good' : 'info', 1800);
      await delay(500);
      this.playTurn(shooter, true);
      return;
    }
    this.ui.toast(`No bumper changed. Turn passes.`, 'info', 1600);
    await delay(700);
    this.beginTurn(out.next);
  }

  // Names the balls that dropped in a scratch, from the human's point of view.
  describeDropped(t) {
    const names = [...new Set(t.dropped.map((id) => {
      if (id === terikId(HUMAN)) return 'Your green terik';
      if (id === terikId(COMPUTER)) return `${this.oppName}'s blue terik`;
      return 'An obstacle ball';
    }))];
    return names.join(' and ');
  }

  respotDropped(t) {
    for (const id of t.dropped) {
      const spot = respotBall(this.world, this.startPositions, id);
      this.ballViews.respot(id, spot.x, spot.y);
    }
  }

  // ---------- Round endings ----------

  async handleWin(winner) {
    this.phase = 'roundOver';
    this.stick.hide();
    this.ui.setTurn(winner === HUMAN ? 'Dom-jot! You win' : `Dom-jot! ${this.oppName} wins`, winner);
    this.table.startLightShow();
    if (winner === HUMAN) this.sound.win(); else this.sound.lose();
    const pot = awardPot(this.session, this.roundMoney, winner);
    const bonus = isStraightNines(this.ownedAtTurnStart) ? payStraightNines(this.session, winner) : 0;
    this.updateMoney();
    await delay(1500); // let the light show play before the card
    this.finishRound({ winner, reason: 'win', pot, bonus, how: this.describeWin(winner) });
  }

  // How the round was won, for the result card.
  describeWin(winner) {
    const t = this.tracker;
    const bumper = t && t.lastTerikBumper !== null ? this.describeBumper(t.lastTerikBumper) : 'a lit bumper';
    const owned = countOwned(this.bumpers, winner);
    const lines = [];
    if (winner === HUMAN) {
      lines.push(`Your green terik bounced off ${bumper} and dropped into the open hole.`);
      lines.push(`You owned ${owned} of the 10 bumpers, including the gate bumper.`);
    } else {
      lines.push(`${this.oppName}'s blue terik bounced off ${bumper} and dropped into the open hole.`);
      lines.push(`${this.oppName} owned ${owned} of the 10 bumpers, including the gate bumper.`);
    }
    return lines;
  }

  // Names a bumper by where it sits, as seen from the front rail.
  describeBumper(i) {
    if (i === GATE_INDEX) return 'the gate bumper beside the hole';
    const b = BUMPERS[i];
    const dx = b.x - HOLE.x;
    const dy = b.y - HOLE.y;
    const words = [];
    if (Math.abs(dy) > 4) words.push(dy > 0 ? 'back' : 'front');
    if (Math.abs(dx) > 4) words.push(dx < 0 ? 'left' : 'right');
    const far = Math.hypot(dx, dy) > 30 ? 'far ' : '';
    return `the ${far}${words.join('-')} bumper`;
  }

  endByFold(winner) {
    this.phase = 'roundOver';
    this.stick.hide();
    this.ui.setTurn('Round over');
    const pot = awardPot(this.session, this.roundMoney, winner);
    this.updateMoney();
    this.finishRound({ winner, reason: 'fold', pot, bonus: 0 });
  }

  async finishRound({ winner, reason, pot, bonus, how = [] }) {
    this.phase = 'roundOver';
    this.ui.setHint(null);
    this.refreshRaise();
    const youWin = winner === HUMAN;
    let title;
    if (reason === 'fold') title = youWin ? `${this.oppName} folds. You win!` : 'You folded.';
    else title = youWin ? 'Dom-jot! You win the round!' : `Dom-jot! ${this.oppName} wins the round.`;
    const lines = [...how];
    if (reason === 'fold') {
      lines.push(youWin ? `${this.oppName} would not match your raise and gave up the round.`
        : `You did not match ${this.oppName}'s raise and gave up the round.`);
    }
    lines.push(youWin ? `You collect the pot of <b>${pot}</b> latinum.` : `${this.oppName} collects the pot of <b>${pot}</b> latinum.`);
    if (bonus > 0) {
      lines.push(youWin
        ? `<b>Straight nines!</b> You won in one unbroken turn starting with no bumpers. ${this.oppName} pays you a ${bonus} latinum bonus.`
        : `<b>Straight nines!</b> ${this.oppName} won in one unbroken turn starting with no bumpers. You pay a ${bonus} latinum bonus.`);
    }
    lines.push(`Your bank: <b>${this.session.banks[HUMAN]}</b> latinum. ${this.oppName}: <b>${this.session.banks[COMPUTER]}</b> latinum.`);
    const humanBroke = !canPlay(this.session, HUMAN);
    const compBroke = !canPlay(this.session, COMPUTER);
    if (humanBroke) lines.push('You have less than 100 latinum, so you cannot play another round. Close or reload the page to start a new session with 500.');
    const choice = await this.ui.showResult({
      title, lines, mood: youWin ? 'good' : 'computer',
      primary: humanBroke ? 'OK' : (compBroke ? 'Continue' : 'Play again'),
      secondary: humanBroke || compBroke ? null : 'Change opponent',
    });
    this.table.stopLightShow();
    if (compBroke) {
      await this.ui.showResult({
        title: 'You cleaned out the table!',
        lines: [`The ${this.oppName} has less than 100 latinum left and leaves the Bonestell.`,
          `A new opponent sits down with a fresh ${MONEY.newOpponentBank} latinum. You keep your bank of ${this.session.banks[HUMAN]}.`],
        primary: 'Next opponent', mood: 'good',
      });
      newOpponent(this.session);
      this.showMenu();
      return;
    }
    if (!humanBroke && choice === 'primary') this.startRound();
    else this.showMenu();
  }

  // ---------- Human input ----------

  onAim(s) {
    this.lastAimAngle = s.angle;
    this.stick.aim(s.ball, s.angle, s.pull, COLORS.human);
    this.ui.showPower(s.power);
    if (this.guideOn) {
      const cast = this.world.castBall(terikId(HUMAN), s.angle);
      this.guide.show(s.ball, cast, COLORS.human);
    }
  }

  onAimCancel() {
    this.stick.hide();
    this.guide.hide();
    this.ui.showPower(null);
  }

  onHumanShoot(s) {
    if (this.phase !== 'aim') return;
    this.executeShot(HUMAN, s.angle, s.power);
  }

  onRaiseAdd() {
    if (this.phase !== 'aim') return;
    const max = maxRaise(this.session, this.roundMoney, HUMAN);
    if (this.pendingRaise + MONEY.raiseStep <= max) this.pendingRaise += MONEY.raiseStep;
    this.refreshRaise();
  }

  async onRaisePlace() {
    if (this.phase !== 'aim' || this.pendingRaise <= 0) return;
    const amt = this.pendingRaise;
    this.pendingRaise = 0;
    this.phase = 'betting';
    this.refreshRaise();
    this.sound.raise();
    this.ui.setThinking(`You raise ${amt}. ${this.oppName} is deciding...`);
    await delay(900);
    const calls = respondToRaise(this.difficulty, this.session, this.roundMoney, this.bumpers, amt);
    const res = applyRaise(this.session, this.roundMoney, HUMAN, amt, calls);
    this.ui.setThinking(null);
    this.updateMoney();
    if (res.result === 'fold') {
      this.ui.toast(`${this.oppName} folds!`, 'good');
      this.endByFold(HUMAN);
      return;
    }
    this.ui.toast(res.result === 'allIn'
      ? `${this.oppName} goes all in with ${res.paid}. ${res.refunded} comes back to you.`
      : `${this.oppName} calls ${amt}.`);
    this.phase = 'aim';
    this.ui.setTurn('Your turn', HUMAN);
    this.refreshRaise();
  }

  setView(v) {
    if (v === 'overhead') this.rig.overhead();
    else if (v === 'bar') this.rig.bar();
    else if (v === 'player') {
      const b = this.world && this.world.getBall(terikId(HUMAN));
      if (!b || !b.active) { this.rig.bar(); return; }
      const angle = this.lastAimAngle ?? Math.atan2(HOLE.y - b.y, HOLE.x - b.x);
      this.rig.player(b, angle);
    }
  }

  // ---------- Display helpers ----------

  updateMoney() {
    this.ui.updateMoney({
      human: this.session.banks[HUMAN],
      computer: this.session.banks[COMPUTER],
      pot: this.roundMoney ? this.roundMoney.pot : 0,
      oppName: this.oppName,
    });
  }

  refreshBoard(announce = false) {
    const holeFor = holeOpenFor(this.bumpers);
    this.ui.setBoard({
      human: countOwned(this.bumpers, HUMAN),
      computer: countOwned(this.bumpers, COMPUTER),
      gate: this.bumpers[GATE_INDEX],
      holeFor,
    });
    if (holeFor !== this.hexOwner) {
      this.hexOwner = holeFor;
      this.table.setHexGlow(holeFor);
      if (announce && holeFor) {
        this.sound.holeOpen();
        if (holeFor === HUMAN) {
          this.ui.announce('HOLE OPEN', 'The hole in the center of the table now glows green: it is open for you. Bounce your terik off one of your lit bumpers into it to win.', 'good', 3000);
        } else {
          // Shown as a card once the balls stop, before the computer can shoot again.
          this.pendingHoleCard = true;
        }
      }
    }
  }

  refreshRaise() {
    const enabled = this.phase === 'aim' && this.roundMoney && canRaise(this.session, this.roundMoney, HUMAN);
    const max = this.roundMoney ? maxRaise(this.session, this.roundMoney, HUMAN) : 0;
    this.ui.setRaise({ enabled: !!enabled, pending: this.pendingRaise, max });
  }
}
