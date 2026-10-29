# charting

Dependency-free, themeable, isomorphic SVG chart rendering. Every export is
a pure function `(options) -> string`, an `<svg>...</svg>` document — no
DOM, no Canvas, no `node:fs`. Runs unmodified on Node 24 and Cloudflare
Workers (and in a browser, as a string inserted into `innerHTML`); the only
Web APIs it touches are string/number primitives, nothing runtime-specific.

## Why this exists

A small dashboard needs a handful of honest charts — a trend sparkline, a
line chart with real axes, a bar chart, a donut — and pulling in a
full charting library (with its own DOM dependency, its own theme system,
its own bundle weight) is a heavy answer to a light question. This module
is the light answer: four render functions, one shared theme shape, and a
small set of chart-craft mechanics (nice-numbered ticks, hue-rotated series
colors, collision-avoiding labels) implemented from first principles so the
output looks like it came from a real charting library without importing
one.

## API

### `THEME_DEFAULT`

```js
{
  ink: "#0A0A0A",
  surface: "#F2EAD8",
  accent: "#3D5588",
  alarm: "#FF4530",
  muted: "#8a8578",
  fontFamily: "'JetBrains Mono', monospace",
}
```

The 561 palette (bone/ink, from the network's shared visual identity). Used
whenever `theme` is omitted or `null`. Every render function accepts a
*partial* theme object — missing keys fall back to `THEME_DEFAULT`'s values,
and every present key is validated as a non-empty string (an empty string
or a non-string value throws `TypeError`, naming the offending key).

### `renderSparkline({ points, width = 160, height = 36, theme })`

A minimal single-series line with no axes — the "how's it trending" glance.
`points` must be an array of at least 2 finite numbers. The line (and its
trailing endpoint dot) is drawn in `theme.accent` if the series ends at or
above where it started, `theme.alarm` if it ends lower; a faint fill
(`theme.accent` at 12% opacity) sits under the line. A flat series (all
equal values) draws a straight midline instead of a divide-by-zero NaN.

### `renderLineChart({ series, width = 640, height = 280, theme, yLabel, xIsTime = false })`

Multi-series line chart with gridlines, y-axis tick labels (abbreviated —
`1250000` renders as `1.25M`), an x-axis, and — when there's more than one
series — a wrapped, overlap-free legend. `series` is
`[{ label, points: [{ x, y }] }]`; every `y` must be finite.

`x` handling has three modes, chosen automatically:

1. **`xIsTime: true`** — `x` may be a `Date`, an ISO string, or an epoch-ms
   number; each is coerced via `new Date(x)` and an invalid date throws
   `TypeError`. X-axis ticks are formatted as `YYYY-MM-DD` (civil-day
   granularity, matching this network's date convention).
2. **All-numeric `x` (and `xIsTime` false/omitted)** — a plain linear
   numeric scale.
3. **Otherwise** — an ordinal/categorical scale. Category order is taken
   from `series[0]`'s `x` values; every other series must use exactly that
   category set (a shared x-axis is the only coherent reading of a
   multi-series line chart) — an unrecognized category throws `TypeError`.

Tick count self-limits to `plotWidth / 90` (clamped 2–6) so labels don't
crowd at small widths; category labels beyond that count are thinned by a
stride rather than shrunk into illegibility.

### `renderBarChart({ categories, values, width, height, theme, horizontal = false })`

Single-series category bar chart. Unlike the other three render functions,
**`width` and `height` are required** (no default) — a bar chart's readable
size depends on how many categories it has, and this module doesn't guess
that for you; omitting either throws `TypeError`. The value axis always
includes zero (a bar's *length* encodes magnitude, so excluding zero would
make the lengths lie — unlike a line chart, which has no such rule and
scales tightly to its data). Category labels that are wider than the space
between bars rotate −40° automatically instead of overlapping their
neighbors. `horizontal: true` swaps to horizontal bars (value axis along
x, categories along y) for long category names.

### `renderDonut({ slices, width = 200, theme })`

Donut chart with a vertical legend (color swatch, label, percentage) below
the ring. `slices` is `[{ label, value }]`; every `value` must be a finite
number `>= 0`, and at least one must be positive (all-zero throws
`RangeError`). The returned SVG's actual height grows with the number of
slices (more slices, taller legend) — read the real size back out of the
returned string's `width`/`height` attributes rather than assuming a fixed
aspect ratio. A single 100%-share slice is clamped to a 359.999° sweep
internally so it never asks the SVG arc command for an exact 360° arc,
which most renderers draw as nothing (start point == end point is a
degenerate arc).

### `formatIsk(n) -> string`

`1250000 -> "1.25M ISK"`. **This is the one EVE-flavored export in an
otherwise fully generic module** — always 2 decimal places once
abbreviated, with the `" ISK"` unit suffix, matching how EVE's own client
and community tools present ISK amounts. A non-EVE consumer of this module
simply never imports it; nothing else here mentions ISK, ships, or any
other EVE vocabulary.

### `abbreviateNumber(n) -> string`

`formatIsk`'s generic sibling, used internally for axis labels:
`1250000 -> "1.25M"` — no unit suffix, trailing zeros trimmed
(`1000 -> "1K"`, not `"1.00K"`).

### Smaller exported utilities

Not part of the module's headline job, but independently useful and
independently tested, so they're exported rather than hidden:

- **`niceTicks(dataMin, dataMax, tickCount = 5) -> { min, max, step, ticks }`**
  — Heckbert's "nice numbers" algorithm: axis bounds and tick values snap
  to round numbers (1/2/5 × 10ⁿ) instead of ugly fractions of the raw data
  range. This is what makes the tick spacing look hand-designed rather than
  mechanically interpolated.
- **`seriesColor(theme, index) -> "#rrggbb"`** — see below.

## Series colors: the hue-rotation formula

`theme.accent` is the *only* color a caller has to supply to brand a
multi-series chart. `seriesColor(theme, index)` derives the rest:

- `index === 0` → `theme.accent`, unchanged.
- `index > 0` → `theme.accent` converted to HSL, its hue rotated by
  `index * 137.508°` (the golden angle), same saturation and lightness,
  converted back to hex.

The golden angle is the standard trick for "generate N maximally-spread
points around a circle without knowing N in advance": a plain `360 / n`
split *reshuffles every existing color* whenever `n` changes (add a 5th
series to a 4-series chart and every hue moves), because the step size
itself depends on the total count. Golden-angle stepping has no such
dependency — `seriesColor(theme, 2)` is the same color whether the chart
ends up with 3 series or 8. Holding saturation/lightness fixed at
`theme.accent`'s own values keeps every derived series color visibly "in
the same family" as the brand color, rather than drifting toward
unrelated-looking hues.

This is a lightweight, deterministic formula chosen for a small
dependency-free module — it does not run this network's full
CVD-accessibility categorical-palette validator (see the `dataviz` skill's
`color-formula.md` for that six-check standard, built for a fixed 8-hue
brand palette rather than an arbitrary rotation of one caller-supplied
accent). A caller with strict accessibility requirements and a known
maximum series count can bypass `seriesColor` entirely by passing distinct
`theme.accent` values across separate calls, or by pre-validating the
rotated set against that validator before rendering.

## Rebrand example

```js
import { renderLineChart } from "./charts.mjs";

// A different site's brand: warm terracotta accent, near-black ink, cream
// surface. Any subset of THEME_DEFAULT's keys may be overridden — omitted
// keys (here, `alarm`) still fall back to THEME_DEFAULT's values.
const terracottaTheme = {
  ink: "#1A1512",
  surface: "#FBF6EE",
  accent: "#C1552C",
  muted: "#9C8F7E",
  fontFamily: "'IBM Plex Mono', monospace",
};

const svg = renderLineChart({
  series: [{ label: "Signups", points: [{ x: 0, y: 12 }, { x: 1, y: 30 }, { x: 2, y: 24 }] }],
  theme: terracottaTheme,
});
```

Every stroke, fill, gridline, and text color in the output now comes from
`terracottaTheme` (and its one inherited default, `alarm`) instead of the
561 palette — no code in `charts.mjs` changes, no hardcoded color literal
appears anywhere in the emitted SVG outside what `theme` supplied.

## Design notes

- **No text overlap by construction, not by luck.** Margins are sized from
  measured label widths (y-axis: widest tick label; bar chart: widest
  category label), the legend wraps to as many rows as it needs, x-axis
  category labels rotate −40° once they'd be wider than their allotted
  band, and tick counts self-limit by available pixel width. Label-width
  measurement assumes a roughly monospace glyph (`0.6em` per character) —
  accurate for `THEME_DEFAULT.fontFamily` (JetBrains Mono) and a
  conservative overestimate for a caller's proportional font (proportional
  glyphs average narrower), which biases toward wrapping/rotating a touch
  early rather than ever overlapping — the safe direction to be wrong in.
- **Gridlines are recessive.** Horizontal gridlines use `theme.muted` at
  25% stroke opacity so they orient the eye without competing with the
  data marks drawn on top of them.
- **Every number that reaches the SVG string is validated finite first.**
  A `NaN`/`Infinity` anywhere in `points`/`series[].points[].y`/`values`/
  `slices[].value` throws `TypeError` before any string template runs —
  this module never silently emits the literal text `"NaN"` into an SVG
  attribute (which browsers would then either ignore or render as a
  zero-size/invisible mark, a much harder failure to notice than a thrown
  error at call time).
- **Accessibility baseline.** Every chart is `role="img"` with a `<title>`
  child summarizing what it shows (point count and range for a sparkline,
  series names for a line chart, slice count and total for a donut) — the
  minimum a screen reader needs to not skip the chart entirely. This module
  does not attempt full WCAG chart-accessibility (a `<table>` fallback,
  per-point ARIA) — that's a caller-side concern layered on top, e.g. in
  the page that embeds the returned SVG string.

## Extraction note

This module imports nothing from the rest of this package and nothing
EVE-specific except the one clearly-labeled `formatIsk` export (documented
above). It is written to be lifted out verbatim as a standalone
`@red-cup-engineering/charting` package: move `charts.mjs` (and this
README) into a new package directory, add a `package.json`, done — a
consumer that doesn't want the ISK formatter simply doesn't import it. No
other module in this package's `src/` imports `charting` at v1.
