# Article Atlas art direction

- Projection: near-straight top-down. Never isometric.
- Outline: rounded dark brown, visually consistent across every asset.
- Shape language: simple, soft silhouettes with no photographic texture.
- Shading: two steps at most; short lower-right grounding shadows only.
- Core palette: leaf green `#75b82a`, yellow-green `#a9cf47`, cream `#f7df8a`,
  water `#59c5c5`, outline brown `#66382f`.
- Avoid straight cropped scenery edges, collage artifacts, conflicting
  perspectives, realistic texture, and excessive detail.

## Source and delivery

Raster sources were produced with the built-in ImageGen workflow. Opaque
objects were generated against a flat magenta chroma key, converted to alpha
with `remove_chroma_key.py`, inspected, and exported as lossless WebP. Original
generation sources remain in each region's `source/` directory; runtime files
live in its `tiles/`, `objects/`, and, where applicable, `animations/`
directory. Terrain sources are resized once to the region's complete tile-grid
extent and then split into unique 512px tiles. Do not repeat non-seamless
source crops across a region because that creates rectangular color
discontinuities.

## Reusable generation brief

Use this invariant prefix for every future region and object:

> Original top-down hand-drawn cartoon game art for yopa.page Article Atlas.
> Near-straight overhead projection, never isometric. Rounded dark-brown
> outlines of consistent thickness, simple soft silhouettes, no more than two
> shading steps, and short soft shadows falling lower-right. Warm yellow,
> green, teal, and cream palette. No text, photography, realistic texture,
> collage, straight cropped scenery edges, conflicting viewpoints, or excessive
> detail.

- Base tile suffix: `seamless 512 by 512 terrain tile; all four edges must
  continue naturally; no large object or shadow crossing an edge`.
- Top tile suffix: `matching 512 by 512 transparent occlusion tile for the exact
  same base coordinates; only canopy, railing, or other foreground pixels`.
- Object suffix: `one isolated [object] at the same projection and light
  direction, centered on a flat magenta background, generous clean margin,
  nothing touching the canvas edge`.
- Water fallback suffix: `calm turquoise top-down water, sparse cream edge
  highlights and long rounded ripples, seamless, no shoreline and no objects`.

Preserve generated PNGs as source. Runtime WebP exports must retain clean alpha,
have no magenta fringe, and be compared beside one approved base tile and the
Agent Grove house before acceptance.

## Transition chunks and navigation

The explorable world grows through active 2048px chunks, each containing a 4×4
grid of 512px transition tiles. Runtime bounds are derived from active chunks;
new regions must not move existing coordinates. Transition sources cover
meadow, shallow water, coast, mist, and rocky terrain. The rocky runtime tile
reuses an approved Engineering Ridge base tile because its dedicated built-in
ImageGen request repeatedly failed at the network boundary.

Signposts and the locked App Garden portal are manifest-only exploration
landmarks and are intentionally excluded from the home minimap. Signposts open
a proximity destination menu; they never draw a route on the ground. The
portal source uses the same built-in ImageGen plus local chroma-key removal
workflow as other transparent objects.

## Maker's Road visual spike

The first connected-world spike is an Explore-only Y-shaped road joining the
Agent Grove western trailhead, Codeworks gate, and Engineering Ridge pass. It
uses the existing manifest object grammar: the road is a `base` object and the
three border landmarks use the `makers-road` layer. The home minimap continues
to draw only `world` and `top` objects, so its graph and geography remain
unchanged.

The four source PNGs were generated with the built-in ImageGen workflow on a
flat magenta key, converted to alpha with `remove_chroma_key.py`, and exported
as lossless WebP. The road network is compressed vertically to a 3:1 runtime
overlay so its endpoints align with the existing region coordinates without
moving regions, signposts, article nodes, or world bounds. This spike remains
in a Draft PR until the 2026-09-06 growth measurement gate is reviewed.

## Region prompt deltas

Every region was generated with the invariant brief above. Only the terrain
motifs and secondary palette changed:

- Cloud Highlands: pale mint turf, cream paths, powder-blue flowers,
  observatory and windsock.
- Agent Grove: yellow-green forest floor, turquoise water, workshop house and
  leafy canopies.
- Codeworks: parchment ground, amber paths, cobbles, brass gears, workshop and
  crane.
- Salesforce Springs: aqua meadow, turquoise streamlets, cream paths,
  springhouse and fountain. No corporate logo or copied brand art.
- Python Meadow: yellow-green meadow, olive clover patches, cream paths,
  cottage and garden worktable. No snake or language-logo imagery.
- Engineering Ridge: lavender-gray highlands, slate shelves, survey lodge,
  lookout and tripod.
- Archive Harbor: seafoam coast, blue-green inlets, cream boardwalks, archive
  house, pier and harbor bell.

The generated source PNGs and derived WebPs are original yopa.page project
assets produced with built-in ImageGen; no Cursor Camp or paid third-party art
is included. The self-hosted Rive runtime retains its upstream MIT license and
notice under `static/vendor/rive-2.31.5/`.

Run `scripts/audit_article_atlas_assets.py` with a Python environment containing
Pillow before committing runtime assets. The audit rejects missing resources,
non-512px tiles, likely magenta spill, and any object whose nontransparent
pixels touch an image boundary. The script is intentionally read-only.

Rive runtime `@rive-app/canvas` is vendored at version 2.31.5 under its MIT
license. The custom `ocean.riv` artboard must be authored as
`AgentGroveWater` with a `WaterLoop` state machine. Until that editor export is
available, the renderer uses `ocean-fallback.webp`.

The signed-in free Rive Editor account was verified on 2026-07-30. The

## Ambient sprites and archipelago layout

The shared world uses the manifest bounds `7168×5120` at origin
`(-3584, -768)`. Region placement, tiles, objects, article nodes, water, and the
home minimap all use that one coordinate system. The home minimap renders the
explicit `connections` graph and intentionally omits persistent region labels.

Ambient artwork lives under `ambient/sprites/`. Its source sheets were created
with the built-in ImageGen path on a flat magenta key, then converted locally to
lossless transparent WebP. Canvas controls motion and opacity; the raster files
remain static. Each effect is seeded, clipped to its region, culled off-screen,
and reduced to one stationary representative when reduced motion is requested.

Generated prompt rules: top-down storybook game art, dark brown rounded outline,
simple silhouettes, no more than two shading tones, no cast shadow, no text,
and a flat `#ff00ff` removable background. Preserve the two PNG source sheets
in `ambient/source/` when regenerating or auditing the sprites.
`AgentGroveWater` artboard and a looping one-second, three-ripple water
animation are saved in the account file named `ocean`, but both **Export for
runtime** and **Export for backup** are upgrade-gated. Per the project plan,
the Rive integration remains explicitly disabled in the manifest until a
runtime `.riv` export is available; no alternate animation format is used.
