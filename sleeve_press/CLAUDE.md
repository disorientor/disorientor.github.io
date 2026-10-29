# sleeve+press

`../sleeve-press/index.html` is generated. Never edit it directly.

- Make every change in `src/sleeve.src.html` or `src/engine.js`, then run `python3 build.py` to regenerate it. Commit sources and output together.
- The shaders are not copied by hand: `shaders.py` ports every `.gdshader` in `/Users/disorientor/Desktop/haecceity/Haecceity/standalone/demo` (glitch, backgrounds, mesh surfaces, composition, stage) at build time. After shaders change in the app, rebuild and run `node test/shaders.cjs`, which compiles and draws each one in headless Chrome.
- `build.py` refuses to run if the built page was edited by hand since the last build. Move those edits into the sources rather than passing `--force`.
- Fonts: see `fonts/SOURCES.md`. `fonts/prepare_fonts.py` regenerates the woff2 files from the google/fonts downloads.
