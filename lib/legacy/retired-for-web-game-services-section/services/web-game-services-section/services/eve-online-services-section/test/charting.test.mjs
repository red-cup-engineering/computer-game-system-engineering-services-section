// test/charting.test.mjs
//
// Exercises src/charting/charts.mjs. These are isomorphic SVG *strings*, not
// a DOM, so assertions are regex-based structural checks (element counts,
// presence of viewBox/title/role, a themed color literal appearing in the
// output) rather than a real render -- matching this module's own "no DOM"
// design. This module is generic (dataviz, not EVE-specific), so sample
// data below is invented, not EVE data, except where exercising `formatIsk`
// itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEME_DEFAULT,
  renderSparkline,
  renderLineChart,
  renderBarChart,
  renderDonut,
  formatIsk,
  abbreviateNumber,
  niceTicks,
  seriesColor,
} from "../src/charting/charts.mjs";

function countMatches(svg, tag) {
  return (svg.match(new RegExp(`<${tag}[ >]`, "g")) || []).length;
}

function titleText(svg) {
  const m = svg.match(/<title>(.*?)<\/title>/);
  return m ? m[1] : null;
}

// --- shared SVG shape, across every render function -------------------------

test("every render function returns an SVG with viewBox, role=img, and a <title>", () => {
  const outputs = [
    renderSparkline({ points: [1, 2, 3] }),
    renderLineChart({ series: [{ label: "A", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }] }),
    renderBarChart({ categories: ["A", "B"], values: [1, 2], width: 300, height: 200 }),
    renderDonut({ slices: [{ label: "A", value: 1 }, { label: "B", value: 2 }] }),
  ];
  for (const svg of outputs) {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 [\d.]+ [\d.]+"/);
    assert.match(svg, /role="img"/);
    assert.match(svg, /<title>[^<]+<\/title>/);
    assert.match(svg, /<\/svg>$/);
  }
});

// --- renderSparkline ---------------------------------------------------------

test("renderSparkline draws exactly one polyline for the series", () => {
  const svg = renderSparkline({ points: [1, 5, 2, 8, 3] });
  assert.equal(countMatches(svg, "polyline"), 1);
});

test("renderSparkline title names the point count and range", () => {
  const svg = renderSparkline({ points: [10, 20, 5] });
  const title = titleText(svg);
  assert.match(title, /3 points/);
  assert.match(title, /5/); // min
  assert.match(title, /20/); // max
});

test("renderSparkline uses theme.alarm when the series ends lower than it starts", () => {
  const down = renderSparkline({ points: [10, 5, 1] });
  const up = renderSparkline({ points: [1, 5, 10] });
  assert.ok(down.includes(THEME_DEFAULT.alarm));
  assert.ok(up.includes(THEME_DEFAULT.accent));
  assert.ok(!up.includes(THEME_DEFAULT.alarm));
});

test("renderSparkline throws on empty points", () => {
  assert.throws(() => renderSparkline({ points: [] }), TypeError);
});

test("renderSparkline throws on a single point (needs >= 2)", () => {
  assert.throws(() => renderSparkline({ points: [1] }), TypeError);
});

test("renderSparkline throws on NaN/non-finite points", () => {
  assert.throws(() => renderSparkline({ points: [1, NaN, 3] }), TypeError);
  assert.throws(() => renderSparkline({ points: [1, Infinity, 3] }), TypeError);
});

test("renderSparkline throws on missing points entirely", () => {
  assert.throws(() => renderSparkline({}), TypeError);
  assert.throws(() => renderSparkline(), TypeError);
});

test("renderSparkline handles a flat series without dividing by zero", () => {
  const svg = renderSparkline({ points: [5, 5, 5, 5] });
  assert.doesNotMatch(svg, /NaN/);
});

// --- renderLineChart ----------------------------------------------------------

test("renderLineChart draws one polyline per series", () => {
  const svg = renderLineChart({
    series: [
      { label: "Wallet", points: [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 2 }] },
      { label: "Assets", points: [{ x: 0, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 6 }] },
      { label: "Bounty", points: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] },
    ],
  });
  assert.equal(countMatches(svg, "polyline"), 3);
});

test("renderLineChart draws a legend swatch per series when there's more than one", () => {
  const svg = renderLineChart({
    series: [
      { label: "Wallet", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] },
      { label: "Assets", points: [{ x: 0, y: 3 }, { x: 1, y: 4 }] },
    ],
  });
  assert.ok(svg.includes("Wallet"));
  assert.ok(svg.includes("Assets"));
});

test("renderLineChart with xIsTime accepts Date/string/epoch x values and formats time ticks", () => {
  const svg = renderLineChart({
    series: [
      {
        label: "S1",
        points: [
          { x: "2026-01-01T00:00:00Z", y: 1 },
          { x: new Date("2026-06-01T00:00:00Z"), y: 5 },
          { x: new Date("2026-12-01T00:00:00Z").getTime(), y: 3 },
        ],
      },
    ],
    xIsTime: true,
  });
  assert.equal(countMatches(svg, "polyline"), 1);
  assert.match(svg, /202\d-\d\d-\d\d/); // an ISO-date-shaped x tick label appears
});

test("renderLineChart rejects an invalid date when xIsTime is true", () => {
  assert.throws(
    () => renderLineChart({ series: [{ label: "S1", points: [{ x: "not-a-date", y: 1 }] }], xIsTime: true }),
    TypeError,
  );
});

test("renderLineChart supports categorical (ordinal) x values shared across series", () => {
  const svg = renderLineChart({
    series: [
      { label: "S1", points: [{ x: "Mon", y: 1 }, { x: "Tue", y: 2 }, { x: "Wed", y: 1 }] },
      { label: "S2", points: [{ x: "Mon", y: 3 }, { x: "Tue", y: 1 }, { x: "Wed", y: 4 }] },
    ],
  });
  assert.equal(countMatches(svg, "polyline"), 2);
  assert.ok(svg.includes("Mon"));
});

test("renderLineChart rejects an ordinal x value absent from series[0]'s categories", () => {
  assert.throws(
    () =>
      renderLineChart({
        series: [
          { label: "S1", points: [{ x: "Mon", y: 1 }, { x: "Tue", y: 2 }] },
          { label: "S2", points: [{ x: "Mon", y: 1 }, { x: "NotAValidDay", y: 2 }] },
        ],
      }),
    TypeError,
  );
});

test("renderLineChart throws on an empty series array", () => {
  assert.throws(() => renderLineChart({ series: [] }), TypeError);
  assert.throws(() => renderLineChart({}), TypeError);
});

test("renderLineChart throws on a series with no points", () => {
  assert.throws(() => renderLineChart({ series: [{ label: "Empty", points: [] }] }), TypeError);
});

test("renderLineChart throws on a NaN y value", () => {
  assert.throws(
    () => renderLineChart({ series: [{ label: "S1", points: [{ x: 0, y: NaN }] }] }),
    TypeError,
  );
});

test("renderLineChart throws on a series missing a label", () => {
  assert.throws(
    () => renderLineChart({ series: [{ points: [{ x: 0, y: 1 }] }] }),
    TypeError,
  );
});

test("renderLineChart never emits literal NaN into the SVG", () => {
  const svg = renderLineChart({
    series: [{ label: "Flat", points: [{ x: 0, y: 7 }, { x: 1, y: 7 }] }],
  });
  assert.doesNotMatch(svg, /NaN/);
});

// --- renderBarChart -----------------------------------------------------------

test("renderBarChart draws one rect per category (vertical)", () => {
  const svg = renderBarChart({ categories: ["Mining", "Missions", "Trading"], values: [10, -5, 20], width: 400, height: 260 });
  assert.equal(countMatches(svg, "rect"), 3);
  assert.doesNotMatch(svg, /NaN/);
});

test("renderBarChart draws one rect per category (horizontal)", () => {
  const svg = renderBarChart({
    categories: ["Mining", "Missions"],
    values: [10, 20],
    width: 300,
    height: 150,
    horizontal: true,
  });
  assert.equal(countMatches(svg, "rect"), 2);
});

test("renderBarChart requires width and height (no default)", () => {
  assert.throws(() => renderBarChart({ categories: ["A"], values: [1] }), TypeError);
});

test("renderBarChart throws when categories and values lengths differ", () => {
  assert.throws(
    () => renderBarChart({ categories: ["A", "B"], values: [1], width: 300, height: 200 }),
    TypeError,
  );
});

test("renderBarChart throws on empty categories/values", () => {
  assert.throws(() => renderBarChart({ categories: [], values: [], width: 300, height: 200 }), TypeError);
});

test("renderBarChart throws on a NaN value", () => {
  assert.throws(
    () => renderBarChart({ categories: ["A"], values: [NaN], width: 300, height: 200 }),
    TypeError,
  );
});

// --- renderDonut ----------------------------------------------------------------

test("renderDonut draws one path per slice", () => {
  const svg = renderDonut({
    slices: [
      { label: "Mining", value: 40 },
      { label: "Missions", value: 35 },
      { label: "Trading", value: 25 },
    ],
  });
  assert.equal(countMatches(svg, "path"), 3);
});

test("renderDonut legend lists every label with a percentage", () => {
  const svg = renderDonut({ slices: [{ label: "Mining", value: 1 }, { label: "Missions", value: 3 }] });
  assert.match(svg, /Mining \(25%\)/);
  assert.match(svg, /Missions \(75%\)/);
});

test("renderDonut handles a single 100% slice without a degenerate (invisible) arc", () => {
  const svg = renderDonut({ slices: [{ label: "Everything", value: 5 }] });
  assert.equal(countMatches(svg, "path"), 1);
  assert.doesNotMatch(svg, /NaN/);
});

test("renderDonut throws on an empty slices array", () => {
  assert.throws(() => renderDonut({ slices: [] }), TypeError);
});

test("renderDonut throws when every slice value is zero", () => {
  assert.throws(() => renderDonut({ slices: [{ label: "A", value: 0 }] }), RangeError);
});

test("renderDonut throws on a negative slice value", () => {
  assert.throws(() => renderDonut({ slices: [{ label: "A", value: -1 }] }), TypeError);
});

// --- theming ------------------------------------------------------------------

test("a custom theme.accent color literal appears in sparkline/line/bar/donut output", () => {
  const theme = { accent: "#123456" };
  assert.ok(renderSparkline({ points: [1, 2, 3], theme }).includes("#123456"));
  assert.ok(
    renderLineChart({ series: [{ label: "S1", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }], theme }).includes(
      "#123456",
    ),
  );
  assert.ok(
    renderBarChart({ categories: ["A"], values: [1], width: 200, height: 150, theme }).includes("#123456"),
  );
  assert.ok(renderDonut({ slices: [{ label: "A", value: 1 }], theme }).includes("#123456"));
});

test("a custom theme.fontFamily appears as the font-family attribute", () => {
  const themedSvg = renderBarChart({
    categories: ["A"],
    values: [1],
    width: 200,
    height: 150,
    theme: { fontFamily: "Comic Sans MS, sans-serif" },
  });
  assert.ok(themedSvg.includes("Comic Sans MS"));

  // renderSparkline itself draws no text (it's axis-free); check the
  // default font-family lands on a chart that does draw labels.
  const defaultSvg = renderBarChart({ categories: ["A"], values: [1], width: 200, height: 150 });
  assert.match(defaultSvg, /font-family="[^"]*JetBrains Mono[^"]*"/);
});

test("theme object is validated: non-string / empty slots throw", () => {
  assert.throws(() => renderSparkline({ points: [1, 2], theme: { accent: 42 } }), TypeError);
  assert.throws(() => renderSparkline({ points: [1, 2], theme: { accent: "" } }), TypeError);
  assert.throws(() => renderSparkline({ points: [1, 2], theme: "not-an-object" }), TypeError);
});

test("an omitted theme defaults to THEME_DEFAULT (accent color present)", () => {
  const svg = renderSparkline({ points: [1, 5, 2] });
  assert.ok(svg.includes(THEME_DEFAULT.accent) || svg.includes(THEME_DEFAULT.alarm));
});

// --- seriesColor (hue-rotation formula) ----------------------------------------

test("seriesColor(theme, 0) is theme.accent itself, unrotated", () => {
  assert.equal(seriesColor(THEME_DEFAULT, 0), THEME_DEFAULT.accent);
});

test("seriesColor produces distinct colors for successive indices", () => {
  const colors = [0, 1, 2, 3, 4].map((i) => seriesColor(THEME_DEFAULT, i));
  assert.equal(new Set(colors).size, colors.length);
  for (const c of colors) assert.match(c, /^#[0-9a-f]{6}$/i);
});

test("seriesColor is deterministic (pure function of theme + index)", () => {
  assert.equal(seriesColor(THEME_DEFAULT, 3), seriesColor(THEME_DEFAULT, 3));
});

test("seriesColor rejects a negative or non-integer index", () => {
  assert.throws(() => seriesColor(THEME_DEFAULT, -1), TypeError);
  assert.throws(() => seriesColor(THEME_DEFAULT, 1.5), TypeError);
});

// --- formatIsk / abbreviateNumber / niceTicks ------------------------------------

test("formatIsk abbreviates with the EVE-flavored unit suffix", () => {
  assert.equal(formatIsk(1250000), "1.25M ISK");
  assert.equal(formatIsk(2500000000), "2.50B ISK");
  assert.equal(formatIsk(999), "999 ISK");
  assert.equal(formatIsk(-1500), "-1.50K ISK");
});

test("formatIsk throws on non-finite input", () => {
  assert.throws(() => formatIsk(NaN), TypeError);
  assert.throws(() => formatIsk("1000000"), TypeError);
});

test("abbreviateNumber trims trailing zeros and has no unit suffix", () => {
  assert.equal(abbreviateNumber(1000), "1K");
  assert.equal(abbreviateNumber(1500), "1.5K");
  assert.equal(abbreviateNumber(999), "999");
  assert.doesNotMatch(abbreviateNumber(1000000), /ISK/);
});

test("niceTicks covers the data range with round-numbered ticks", () => {
  const { min, max, ticks } = niceTicks(3, 97);
  assert.ok(min <= 3);
  assert.ok(max >= 97);
  assert.ok(ticks.length >= 2);
  assert.equal(ticks[0], min);
  assert.equal(ticks[ticks.length - 1], max);
});

test("niceTicks handles a flat (min === max) range without a zero step", () => {
  const { min, max, step } = niceTicks(50, 50);
  assert.ok(min < 50);
  assert.ok(max > 50);
  assert.ok(step > 0);
});

test("niceTicks rejects dataMax < dataMin", () => {
  assert.throws(() => niceTicks(10, 5), RangeError);
});
