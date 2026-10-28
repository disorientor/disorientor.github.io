# Strung Along

`chord-grid.html` is generated. Never edit it directly.

- Make every change in `src/chordgrid.src.html`, then run `python3 build.py` to regenerate `chord-grid.html`.
- Commit both files together.
- The build overwrites `chord-grid.html` completely. Edits made only there were lost this way once (the Paths theory fixes, restored in 34383c6).
- `build.py` refuses to run if `chord-grid.html` was edited by hand since the last build. If it stops, move those edits into the source (`git diff chord-grid.html` shows them) rather than passing `--force`, which discards them.
