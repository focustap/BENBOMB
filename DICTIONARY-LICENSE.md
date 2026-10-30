# Dictionary source and rights

BENBOMB uses the larger `words.txt` uploaded to this repository on October 30, 2026. The committed blob matches the word list hosted by [dwyl/english-words](https://github.com/dwyl/english-words/blob/master/words.txt), SHA-1 `9c0caf414279f2ad7a6fb2cb2f11b02f9389960c`.

The dwyl repository's [LICENSE.md](https://github.com/dwyl/english-words/blob/master/LICENSE.md) describes its repository contents as released under the Unlicense/public-domain dedication. **However**, its [README](https://github.com/dwyl/english-words/blob/master/README.md) says that the underlying word list came from an Infochimps dataset and that copyright still belongs to the source. The repo also includes material referencing Moby Word II and Project Gutenberg. Therefore, the repository license alone should not be treated as conclusive permission for redistributing every underlying word.

For a public/commercial release, verify the underlying dictionary redistribution rights, or replace the file with a vetted appropriately licensed dictionary.

BENBOMB reads this file at runtime, normalizes case and retains only distinct alphabetic entries of 3–20 characters. After normalization it has approximately 415,400 accepted words, including entries whose source list capitalization differs (`Itch`, `Poop`, `Scratch`). This is a *word list*, not an audited lexicographic dictionary; it can contain names, rare inflections, and spelling variants.
