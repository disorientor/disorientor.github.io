# Font cache

All fonts are SIL Open Font License 1.1 (texts in `licenses/`), downloaded 29 October 2026 from
`https://github.com/google/fonts/tree/main/ofl/<folder>`. `prepare_fonts.py` turns them into the woff2 files here:
variable fonts pinned to one weight, Japanese fonts subset to ASCII, kana, CJK punctuation, full-width forms and
JIS level-1 kanji. `build.py` copies them to `sleeve-press/fonts/`; the page loads each one only when it is chosen.
Departure Mono (`DepartureMono-Regular.otf`, OFL, Helena Zhang) is embedded in the page for the interface.

| File | Family | google/fonts folder | Source file |
|---|---|---|---|
| anton.woff2 | Anton | anton | Anton-Regular.ttf |
| bebas-neue.woff2 | Bebas Neue | bebasneue | BebasNeue-Regular.ttf |
| archivo-black.woff2 | Archivo Black | archivoblack | ArchivoBlack-Regular.ttf |
| rubik-mono-one.woff2 | Rubik Mono One | rubikmonoone | RubikMonoOne-Regular.ttf |
| rubik-glitch.woff2 | Rubik Glitch | rubikglitch | RubikGlitch-Regular.ttf |
| monoton.woff2 | Monoton | monoton | Monoton-Regular.ttf |
| bungee.woff2 | Bungee | bungee | Bungee-Regular.ttf |
| six-caps.woff2 | Six Caps | sixcaps | SixCaps.ttf |
| big-shoulders-display.woff2 | Big Shoulders Display (900) | bigshouldersdisplay | BigShouldersDisplay[wght].ttf |
| unbounded.woff2 | Unbounded (900) | unbounded | Unbounded[wght].ttf |
| syne.woff2 | Syne (800) | syne | Syne[wght].ttf |
| major-mono-display.woff2 | Major Mono Display | majormonodisplay | MajorMonoDisplay-Regular.ttf |
| playfair-display.woff2 | Playfair Display (900) | playfairdisplay | PlayfairDisplay[wght].ttf |
| libre-caslon-display.woff2 | Libre Caslon Display | librecaslondisplay | LibreCaslonDisplay-Regular.ttf |
| unifraktur-maguntia.woff2 | UnifrakturMaguntia | unifrakturmaguntia | UnifrakturMaguntia-Book.ttf |
| pirata-one.woff2 | Pirata One | pirataone | PirataOne-Regular.ttf |
| space-mono.woff2 | Space Mono Bold | spacemono | SpaceMono-Bold.ttf |
| vt323.woff2 | VT323 | vt323 | VT323-Regular.ttf |
| ibm-plex-mono.woff2 | IBM Plex Mono Medium | ibmplexmono | IBMPlexMono-Medium.ttf |
| dela-gothic-one.woff2 | Dela Gothic One | delagothicone | DelaGothicOne-Regular.ttf |
| reggae-one.woff2 | Reggae One | reggaeone | ReggaeOne-Regular.ttf |
| rocknroll-one.woff2 | RocknRoll One | rocknrollone | RocknRollOne-Regular.ttf |
| rampart-one.woff2 | Rampart One | rampartone | RampartOne-Regular.ttf |
| dotgothic16.woff2 | DotGothic16 | dotgothic16 | DotGothic16-Regular.ttf |
| zen-antique.woff2 | Zen Antique | zenantique | ZenAntique-Regular.ttf |
| shippori-mincho-b1.woff2 | Shippori Mincho B1 ExtraBold | shipporiminchob1 | ShipporiMinchoB1-ExtraBold.ttf |
| noto-sans-jp.woff2 | Noto Sans JP (900) | notosansjp | NotoSansJP[wght].ttf |
| press-start-2p.woff2 | Press Start 2P | pressstart2p | PressStart2P-Regular.ttf |
| silkscreen.woff2 | Silkscreen | silkscreen | Silkscreen-Regular.ttf |
| orbitron.woff2 | Orbitron (800) | orbitron | Orbitron[wght].ttf |
| electrolize.woff2 | Electrolize | electrolize | Electrolize-Regular.ttf |
| audiowide.woff2 | Audiowide | audiowide | Audiowide-Regular.ttf |
| michroma.woff2 | Michroma | michroma | Michroma-Regular.ttf |
| righteous.woff2 | Righteous | righteous | Righteous-Regular.ttf |
| faster-one.woff2 | Faster One | fasterone | FasterOne-Regular.ttf |
| cinzel.woff2 | Cinzel (700) | cinzel | Cinzel[wght].ttf |
| cinzel-decorative.woff2 | Cinzel Decorative Bold | cinzeldecorative | CinzelDecorative-Bold.ttf |
| bodoni-moda.woff2 | Bodoni Moda (800) | bodonimoda | BodoniModa[opsz,wght].ttf |
| mr-dafoe.woff2 | Mr Dafoe | mrdafoe | MrDafoe-Regular.ttf |
| hachi-maru-pop.woff2 | Hachi Maru Pop | hachimarupop | HachiMaruPop-Regular.ttf |
| kaisei-tokumin.woff2 | Kaisei Tokumin Bold | kaiseitokumin | KaiseiTokumin-Bold.ttf |
| zen-maru-gothic.woff2 | Zen Maru Gothic Black | zenmarugothic | ZenMaruGothic-Black.ttf |
| potta-one.woff2 | Potta One | pottaone | PottaOne-Regular.ttf |
| klee-one.woff2 | Klee One SemiBold | kleeone | KleeOne-SemiBold.ttf |
