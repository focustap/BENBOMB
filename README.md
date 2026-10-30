# BENBOMB 💣

A fast, browser-based word bomb game and part of the BenGames collection.

## Rules

A prompt appears inside the bomb. Type an English word containing those letters **in exactly that order, consecutively, anywhere in the word**. For example, `SEC` matches `second`, `insect` does **not** match `SEC` unless the exact sequence appears, and `ZZ` matches `puzzle`, `pizza`, and `jazz`.

- A correct answer resets the fuse, changes the prompt, and passes the bomb.
- Invalid, repeated, or incorrectly matched words do **not** reset the fuse.
- Whoever holds the bomb when the timer reaches zero loses a life.
- Prompts are filtered against the dictionary to ensure playable answers remain.
- The final survivor wins. Solo mode is a score challenge.

## Game modes

- **Solo Practice** – score as many correct words as you can before losing all lives.
- **Pass & Play** – 2–8 people can play on one device.
- **Online Rooms** – create or join a six-character room code, once a Supabase project is configured.

## Setup

This is a static site. Publish the repository from the root of `main` with GitHub Pages. All game files remain in **BENBOMB**, not in **BenGames**.

For local development, use a static server (for example `python -m http.server 8000`) rather than opening `index.html` through `file://`, because the game loads `words.txt` through Fetch.

The persistent **← BenGames** button points to https://focustap.github.io/BenGames/.

### Online rooms

Set your project's public values in `config.js`. Never put a Supabase secret/service-role key in a GitHub Pages project.

This starter implementation uses **Supabase Realtime Broadcast** with a *host-authoritative* browser session, no database tables. The browser hosting the room validates all words and moves turns; the host must stay connected. A 6-character code is for convenience, **not** strong authorization. Channels are public and the prototype is intended for private, friendly games only; before public competitive play, use anonymous auth, private channels with Realtime policies, and server-side answer validation with an Edge Function.

It intentionally does not bind to the unrelated existing Supabase projects automatically. Without `config.js` credentials, online actions show a setup message and Solo/Pass & Play still work.

## Dictionary and licensing

`words.txt` is derived from the 20k list in [first20hours/google-10000-english](https://github.com/first20hours/google-10000-english), with non-alphabetic and very short/long tokens filtered. See [DICTIONARY-LICENSE.md](DICTIONARY-LICENSE.md) for the source notice. The upstream source cautions that it is intended for **personal / educational use** and does not recommend commercial use without LDC licensing. Replace the list with appropriately licensed content before commercial launch.

No code or assets from the original Word Bomb or BombParty are used.
