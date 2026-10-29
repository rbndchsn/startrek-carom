// Game settings, from game_information/game_rules.md.

// Bump this and version.json together on every release. A browser holding an older copy
// notices the difference on load and refreshes itself (see src/update.js).
export const VERSION = '1.6.0';

export const HUMAN = 'human';
export const COMPUTER = 'computer';

export const other = (player) => (player === HUMAN ? COMPUTER : HUMAN);

export const MONEY = {
  startingBank: 500,
  openingBet: 100,
  raiseStep: 50,
  minBankToPlay: 100,
  scratchPenalty: 100,
  straightNinesBonus: 100,
  newOpponentBank: 500,
};

export const RULES = {
  bumperCount: 10,
  minOwnedToOpen: 6,
};

export const COLORS = {
  human: 0x3fd07a,    // green terik
  computer: 0x4a8dff, // blue terik
  obstacle: 0xeef2f4,
  amber: 0xffb547,
};

export const PLAYER_NAMES = {
  human: 'You',
};

export const DIFFICULTIES = {
  easy: { label: 'Easy', opponent: 'Nervous tourist' },
  medium: { label: 'Medium', opponent: 'Station hustler' },
  hard: { label: 'Hard', opponent: 'Nausicaan' },
};
