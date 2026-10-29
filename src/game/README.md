# Game rules and state

- Pure JavaScript with no 3D or browser code, so it can be unit tested in Node.
- Game state: balls, bumper owners, whose turn, banks and pot.
- Rule checks: lighting and stealing bumpers, when the hole is open, win, scratch.
- Turn flow: coin toss result, turn continues or passes, round end.
- Betting: opening bet, Raise +50, call or fold, all in, penalties and bonuses.
- Rules source: `game_information/game_rules.md`.
