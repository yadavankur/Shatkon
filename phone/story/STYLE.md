# STYLE: Shatkon story pack

Use this to add new portraits, stages, ships or lines that match the existing ones.

## Tone

The tone is hopeful and PG-13. People are scared, tired and funny, and they keep showing up for
each other. There is peril but no gore. Losses happen off-screen and are carried with dignity.

The Weave is alien, not evil. It talks in pulses of five, and the translator gets better chapter
by chapter. Dialogue is short: a line fits two lines of the box on a 360-pixel-wide phone, at
most about 140 characters. Each scene has one joke at most, usually from Moss or Teo.

* **The captain is never gendered.** Do not use he, she, sir, ma'am or similar. Address the
  captain as "Captain" or "Vey". `tools/verify.mjs` enforces this.
* **Li uses they/them.**
* **Running motifs:** "See you at Meridian", fives, cold versus heat, "room for you" (said only by the mimic), and (v2) "Permission to panic?" / "Denied." (Nanda in ch1, echoed by Teo in ch3_despair).
* **Losses (v2):** Nanda, Sefa and Dov die in chapter 1. Keep it quick and off-screen: a flash, `hide_ship`, and one plain line such as "No pod." Later chapters remember them by name and never bring them back.
* **Cast looks (v2):**
  * Sefa Lowe is a late-40s Samoan veteran with a grey-streaked low braid, laugh lines, a small chin scar and a tan shoulder stripe.
  * Dov Ancell is mid-30s with a shaved head, a short dark beard, a silver earring and a violet shoulder stripe.
  * Both wear the standard navy jacket with a sleeve patch: a wren or a kite.

## Palette

| role | hex |
|---|---|
| deep space / ui background | `#070b16` |
| panel | `#101830` |
| line / border | `#25325a` |
| human gold (captain, Kestrel trim, primary buttons) | `#e8c15a` |
| human blue (sensors, comms, Sparrow) | `#5cc8ff` |
| Weave crimson | `#dc2850` |
| Weave violet | `#9646e6` |
| alert red / Weave text | `#ff5a8a` |

Speaker accent colours are in `characters.json` (`color`): Li `#6fd3c8`, Moss `#f08a4b`, Teo
`#5cc8ff`, Nanda `#9fb4ff`, Sefa (Wren) `#d4a373`, Dov (Kite) `#c7a0f0`, Hollis `#8fd18b`, Abara `#c9d3e8` and the mimic `#d9a7a0`.

## Lighting and rendering

* **Look:** painted, semi-realistic sci-fi concept art with clean edges and moderate detail.
  No photo look, no anime.
* **Light:** a cool blue rim light from the left (`#5cc8ff`-ish) and a warm gold key from the
  right. Human interiors are navy and brass. Weave spaces are crimson and violet, organic and hex-celled.
* **Uniforms:** a navy jacket with gold piping and a hex-cell badge on the chest.
* **Line weight:** UI strokes are 1 px borders, with a 4 px accent bar on the dialogue box.
  Programmatic hex art uses a 3–4 px outline at 1024 px wide plus a soft outer glow.

## Portraits (768×1024 WebP, transparent, under 150 KB)

* **Framing:** chest up, the head in the upper 45%, the subject facing slightly toward the
  screen centre. The player mirrors the right-hand slot.
* **Expressions** (all six are required): `neutral`, `determined`, `worried`, `smile`, `shock`, `hurt`.
* **Generation template:**
  > Semi-realistic painted sci-fi character portrait, chest-up, {character description},
  > {outfit}, {expression} expression, cool blue rim light from the left, warm gold key light
  > from the right, plain flat pure green (#00ff00) background, no text, no badge lettering,
  > no props crossing the frame edge.
* **Expressions:** generate them from the character's `neutral` image as the reference image,
  with a prompt like "same person, same outfit and framing, now {expression}".
* **Chroma key** (`tools/process_art.py`):
  * greenness d = g − max(r, b);
  * alpha ramps from 1 to 0 as d goes from 35 to 90;
  * despill clamps g to max(r, b) where it is green-tinted;
  * the alpha edge is shrunk by a 3×3 min-filter and a 0.8 px blur;
  * the source is first resized to 768×1024 with Lanczos;
  * the result is saved as WebP at quality 90 (alpha quality 80), with the quality stepped down if it would exceed 150 KB.

## Stages (1920×1080 WebP, under 350 KB)

* **Composition:** keep key content within the middle 56% of the width
  (x 0.22–0.78). On phones the sides are cropped, and portraits cover the lower-left and
  lower-right thirds. The horizon or detail line sits near y 0.4–0.55. There are no characters
  in the stages.
* **`focus` in `stages.json`:** the [x, y] point (0–1) that has to stay visible under cropping.
* **Template:**
  > Wide cinematic sci-fi environment concept painting, {place}, no people, no text, key
  > subject centred, navy and brass human tech / crimson-violet organic hex Weave growth,
  > cool blue rim light, warm gold accents, 16:9.
* The images were generated at 1280×720, then upscaled with Lanczos and an unsharp mask
  (radius 1.2, 40%, threshold 2) and saved at WebP quality 86, with the quality stepped down if it would exceed 350 KB.

## Ships and Weave portraits (programmatic, `tools/make_programmatic_art.py`)

* **Hex geometry:** pointy-top axial [q, r], with x = S·√3·(q + r/2) and y = 1.5·S·r.
  The layout is centred on the cell bounding box. The canvas is 1024 wide and transparent.
* **Human hulls:** navy plates, a gold trim line, and a blue glow on engines and sensors.
  Each hex carries a small role icon: core, engine, sensor, launcher, shield, cockpit or (v2) gun, a twin-barrel escort laser.
* **Weave hulls:** crimson and violet cells with vein noise and a pink core light. Husks are
  darker and cracked. Seams are a red glowing line along the shared edges.
* **Shapes:** the segments in `ships.json` are the truth. A new ship needs its image rendered
  from the same list, so the art can never drift from the data.

## Writing lines (data format)

```json
{ "speaker": "engineer", "expression": "smile", "text": "…" }
{ "speaker": "sparrow_pilot", "expression": "worried", "text": "…", "via": "comms" }
{ "speaker": "weave", "expression": "pulse", "text": "[partial translation] …", "glyphs": true }
{ "speaker": "narrator", "text": "…" }
{ "stage": "vista_bloom" }   { "effect": "shake" }   { "show_ship": "kestrel_refit" }   { "hide_ship": true }
```

* Mid-battle scenes: 3–8 lines. Defeat scenes: 2–3 lines, ending with a push to try again.
* Edit `tools/build_story.py`, re-run it, then run `node tools/verify.mjs`.
