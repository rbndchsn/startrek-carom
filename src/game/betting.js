// Latinum banks and betting. Pure JavaScript.
// Source: game_information/game_rules.md, section 7.
import { MONEY, HUMAN, COMPUTER, other } from '../data/config.js';

// One browser session. Lives only in page memory.
export function createSession() {
  return { banks: { [HUMAN]: MONEY.startingBank, [COMPUTER]: MONEY.startingBank }, opponentNumber: 1 };
}

export function canPlay(session, player) {
  return session.banks[player] >= MONEY.minBankToPlay;
}

export function newOpponent(session) {
  session.banks[COMPUTER] = MONEY.newOpponentBank;
  session.opponentNumber++;
}

// Opening bets. Returns the round's money state.
export function startRound(session) {
  if (!canPlay(session, HUMAN) || !canPlay(session, COMPUTER)) throw new Error('Not enough latinum');
  session.banks[HUMAN] -= MONEY.openingBet;
  session.banks[COMPUTER] -= MONEY.openingBet;
  return { pot: MONEY.openingBet * 2, raisedThisTurn: false };
}

// Largest raise allowed now: no bigger than the pot or the raiser's bank, in steps of 50.
export function maxRaise(session, round, player) {
  const cap = Math.min(round.pot, session.banks[player]);
  return Math.floor(cap / MONEY.raiseStep) * MONEY.raiseStep;
}

export function canRaise(session, round, player) {
  return !round.raisedThisTurn && maxRaise(session, round, player) >= MONEY.raiseStep;
}

// The responder calls or folds. Returns { result: 'called' | 'allIn' | 'fold', paid, refunded }.
// On a fold the raiser wins the pot; the caller should then end the round.
export function applyRaise(session, round, raiser, amount, responderCalls) {
  const responder = other(raiser);
  if (amount > maxRaise(session, round, raiser) || amount < MONEY.raiseStep) throw new Error('Invalid raise');
  round.raisedThisTurn = true;
  session.banks[raiser] -= amount;
  round.pot += amount;
  if (!responderCalls) {
    return { result: 'fold', paid: 0, refunded: 0 };
  }
  const paid = Math.min(amount, session.banks[responder]);
  session.banks[responder] -= paid;
  round.pot += paid;
  const refunded = amount - paid;
  if (refunded > 0) {
    session.banks[raiser] += refunded;
    round.pot -= refunded;
  }
  return { result: refunded > 0 ? 'allIn' : 'called', paid, refunded };
}

function transfer(session, from, to, amount) {
  const paid = Math.min(amount, session.banks[from]);
  session.banks[from] -= paid;
  session.banks[to] += paid;
  return paid;
}

// Scratch penalty, paid directly to the opponent. Pays what is left if short.
export function payScratchPenalty(session, shooter) {
  return transfer(session, shooter, other(shooter), MONEY.scratchPenalty);
}

export function awardPot(session, round, winner) {
  const won = round.pot;
  session.banks[winner] += won;
  round.pot = 0;
  return won;
}

export function payStraightNines(session, winner) {
  return transfer(session, other(winner), winner, MONEY.straightNinesBonus);
}

export function newTurn(round) {
  round.raisedThisTurn = false;
}
