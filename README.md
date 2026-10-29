# Dom-jot

A fan-made 3D version of **dom-jot**, the bar table game from *Star Trek: The Next Generation*,
episode "Tapestry." You play against the computer at easy, medium or hard.

Star Trek never published real rules for dom-jot, so this game uses its own rules, built from the
episode, the production design drawing and the props.

**Status:** playable. Human against the computer at three levels, with betting, in 3D.

## Play

When published, the game runs at:

**https://rbndchsn.github.io/startrek-carom/**

It runs entirely in the browser. There is no server, no account and no database.
Your latinum bank lasts until you close the browser.

## How the game works, in short

- Each player strikes their own glowing ball, called a **terik**. Yours is green and the
  computer's is blue. Thirteen whitish obstacle balls are scattered at random to block your path.
- When your terik hits a bumper, it lights in your color. Hitting your opponent's lit bumper steals it.
  Obstacle balls never light or steal bumpers.
- The hole opens for you when all 10 bumpers are lit, you own at least 6, and you own the gate
  bumper beside the hole. Bank your terik off one of your lit bumpers into the hole to win.
- Any ball dropping in the hole too early is a **scratch**. The shooter's own bumpers go dark and the
  shooter pays a penalty. The opponent keeps their bumpers.
- Each player starts with 500 latinum. A round costs 100, and **Raise +50** ups the stakes.

The full rules are in the game: click the **?** button.

## Controls

| Action | How |
|---|---|
| Shoot | Press on your green terik, drag back away from where you want it to go, release. A longer pull gives more power. |
| Fine aim | While holding a shot, the left and right arrow keys turn the aim by 0.25 degrees. Escape cancels. |
| Rotate the view | Drag on empty space |
| Zoom | Mouse wheel |
| Slide the view | Right-drag |
| Camera presets | **Overhead**, **Player** and **Bar** buttons |
| Guide line | **Guide** button. Shows the path to the first thing your shot will hit. |
| Raise | **Raise +50** once or more, then **Place raise**. Once per turn, up to the size of the pot. |
| Sound | **Sound** button. Turns the background music (`media/sounds/game.mp3`) and the sound effects on or off. |
| Rules | **?** button |

## Project layout

| Folder | Contents |
|---|---|
| `index.html` | The game page. GitHub Pages serves it as the site's home page. |
| `css/` | Page and on-screen panel styles. |
| `src/main.js` | Entry point. Checks for 3D support and starts the game. |
| `src/controller.js` | Runs the game: rounds, coin toss, turns, shots, betting and the computer turns. |
| `src/game/` | Rules, game state, turns and betting. Pure JavaScript, unit tested. |
| `src/physics/` | Ball movement and collisions. |
| `src/render/` | The 3D table, balls, lights and camera, using three.js. |
| `src/input/` | Mouse and keyboard: camera and shot controls. |
| `src/ai/` | The computer opponent's three levels. |
| `src/ui/` | Screens, buttons, coin toss, banks and messages. |
| `src/audio/` | Sound playback. |
| `src/data/` | Table layout coordinates and game settings. |
| `vendor/three/` | A pinned copy of the three.js library. |
| `media/` | Textures, sounds, fonts and icons. |

## Run it locally

The game uses JavaScript modules, which browsers will not load from a `file://` address. Start a
small local web server from the repo root:

```
python -m http.server 8080
```

Then open http://localhost:8080 in a browser.

## Publish on GitHub Pages

1. Push the `main` branch to GitHub.
2. In the repository, open **Settings**, then **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then branch `main` and folder
   `/ (root)`.
4. After a minute or two, the game is live at the address above.

The empty `.nojekyll` file tells GitHub Pages to serve the files as they are, without processing
them.

### Constraints this project follows

- **Static files only.** GitHub Pages cannot run server code, so everything runs in the browser.
- **No build step.** The files in the repo are the files that are served.
- **Relative paths only.** The site lives at `/startrek-carom/`, not at the domain root.
- **No outside CDN.** three.js is kept in `vendor/` so the game works even if a CDN is down.
- **Small files.** GitHub rejects files over 100 MB and recommends a repository under 1 GB.
  Keep textures and sounds compressed.

## Credits and disclaimer

This is an unofficial, non-commercial fan project. Star Trek and related names are trademarks of
Paramount. The original dom-jot table was designed by Rick Sternbach for "Tapestry" (1993).
