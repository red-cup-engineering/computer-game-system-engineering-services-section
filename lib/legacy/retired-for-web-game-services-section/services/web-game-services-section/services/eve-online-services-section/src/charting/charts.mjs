// src/charting/charts.mjs
//
// Dependency-free, isomorphic SVG chart rendering: every export here is a
// pure function `(options) -> string` (an `<svg>...</svg>` document). No
// DOM, no Canvas, no node:fs -- these run identically in a Cloudflare
// Worker response, a Node script writing a file, or a browser inlining the
// string into innerHTML. Zero dependencies; the only "libraries" used are
// string templates and arithmetic.
//
// Themeable: every color that appears in a rendered chart comes from the
// `theme` object (or THEME_DEFAULT, the 561 palette). A caller rebranding
// this module for another site passes their own theme; nothing here
// hardcodes a color literal outside THEME_DEFAULT itself. See README.md for
// a full rebrand example.

/** The 561 palette. Every chart below defaults to this when `theme` is omitted. */
export const THEME_DEFAULT = Object.freeze({
  ink: "#0A0A0A",
  surface: "#F2EAD8",
  accent: "#3D5588",
  alarm: "#FF4530",
  muted: "#8a8578",
  fontFamily: "'JetBrains Mono', monospace",
});

const THEME_KEYS = Object.keys(THEME_DEFAULT);

// ---------------------------------------------------------------------------
// Validation helpers -- every exported function validates its inputs and
// throws a specific, greppable error naming the offending field, per this
// package's network conventions (no silent coercion, no NaN slipping into
// SVG output as literal "NaN" text).
// ---------------------------------------------------------------------------

function assertFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`charts: ${label} must be a finite number, got ${JSON.stringify(value)}`);
  }
}

function assertPositiveNumber(value, label) {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new TypeError(`charts: ${label} must be a positive number, got ${value}`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`charts: ${label} must be a non-empty string, got ${JSON.stringify(value)}`);
  }
}

function assertNonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`charts: ${label} must be a non-empty array, got ${JSON.stringify(value)}`);
  }
}

/**
 * Merge a partial theme over THEME_DEFAULT and validate every resulting
 * slot is a non-empty string. Missing/omitted `theme` (undefined or null)
 * yields THEME_DEFAULT itself -- callers never have to pass a theme.
 */
function mergeTheme(theme) {
  if (theme === undefined || theme === null) return THEME_DEFAULT;
  if (typeof theme !== "object" || Array.isArray(theme)) {
    throw new TypeError(`charts: theme must be an object, got ${JSON.stringify(theme)}`);
  }
  const merged = { ...THEME_DEFAULT, ...theme };
  for (const key of THEME_KEYS) {
    assertNonEmptyString(merged[key], `theme.${key}`);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Small generic formatting helpers
// ---------------------------------------------------------------------------

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Escape text for safe placement inside SVG element content or attribute values. */
function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]
  ));
}

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * Abbreviate a number for compact axis/legend display: 1500 -> "1.5K",
 * 2500000 -> "2.5M". Generic (no unit suffix) -- see `formatIsk` below for
 * the EVE-flavored, unit-suffixed sibling.
 */
export function abbreviateNumber(n) {
  assertFiniteNumber(n, "abbreviateNumber: n");
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const tiers = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [threshold, suffix] of tiers) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
      return `${sign}${trimTrailingZeros(scaled.toFixed(decimals))}${suffix}`;
    }
  }
  const decimals = Number.isInteger(abs) ? 0 : 1;
  return `${sign}${trimTrailingZeros(abs.toFixed(decimals))}`;
}

function withThousands(n) {
  // Manual grouping instead of Number.prototype.toLocaleString: Workers'
  // stock ICU data is not guaranteed present for every locale, and this
  // module promises to run unmodified on both runtimes -- so it doesn't
  // lean on Intl for something three lines of regex does deterministically.
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * EVE-flavored ISK formatting: "1.25M ISK" style, always 2dp once
 * abbreviated. This is the one export in this module that is EVE-specific
 * by design -- everything else here is genre-agnostic. A non-EVE consumer
 * of this module simply never imports `formatIsk`.
 */
export function formatIsk(n) {
  assertFiniteNumber(n, "formatIsk: n");
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T ISK`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B ISK`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M ISK`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K ISK`;
  return `${sign}${withThousands(abs)} ISK`;
}

// ---------------------------------------------------------------------------
// "Nice numbers" axis tick computation (Heckbert's algorithm) -- ticks land
// on round values (1/2/5 x 10^n) instead of ugly fractions of the data
// range, which is what makes a hand-rolled chart look like a real one.
// ---------------------------------------------------------------------------

function niceNum(range, round) {
  if (range === 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }
  return niceFraction * 10 ** exponent;
}

/**
 * Compute nice axis bounds and tick values covering [dataMin, dataMax].
 * Exported because it's independently useful and independently testable;
 * not part of the pinned contract but harmless to expose.
 */
export function niceTicks(dataMin, dataMax, tickCount = 5) {
  assertFiniteNumber(dataMin, "niceTicks: dataMin");
  assertFiniteNumber(dataMax, "niceTicks: dataMax");
  if (dataMax < dataMin) {
    throw new RangeError(`charts: niceTicks requires dataMax >= dataMin, got ${dataMin}..${dataMax}`);
  }
  let min = dataMin;
  let max = dataMax;
  if (min === max) {
    // A flat series (or a single value) still needs a non-zero span to draw
    // an axis; open up a small window centered on the value.
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(1, tickCount - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  // Use a count-driven loop rather than accumulating by +=step: repeated
  // float addition drifts (0.1 + 0.1 + 0.1 !== 0.3), which would eventually
  // misplace a tick or run one short/long.
  const n = Math.round((niceMax - niceMin) / step);
  for (let i = 0; i <= n; i++) {
    ticks.push(round2(niceMin + i * step));
  }
  return { min: niceMin, max: niceMax, step, ticks };
}

// ---------------------------------------------------------------------------
// Color: hex <-> HSL, and the series-color rotation formula.
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new TypeError(`charts: expected a "#rrggbb" hex color, got ${JSON.stringify(hex)}`);
  }
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  const hn = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = l - c / 2;
  let rp;
  let gp;
  let bp;
  if (hn < 60) [rp, gp, bp] = [c, x, 0];
  else if (hn < 120) [rp, gp, bp] = [x, c, 0];
  else if (hn < 180) [rp, gp, bp] = [0, c, x];
  else if (hn < 240) [rp, gp, bp] = [0, x, c];
  else if (hn < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function rgbToHex({ r, g, b }) {
  const h = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Successive hues stepped by the golden angle (~137.508deg) stay maximally
// spread around the color wheel for *any* number of series, which a plain
// 360/n split does not: with 360/n, adding one more series to a chart
// reshuffles every previously-assigned hue (n changes, so every slot's
// angle changes). Golden-angle stepping is append-only -- series[i]'s color
// never changes when series[i+1] is added. Saturation and lightness are
// held at theme.accent's own values, so the rotation only changes hue,
// keeping every series color visually "in the same family" as the theme.
const GOLDEN_ANGLE_DEG = 137.508;

/**
 * The color for the `index`-th series/slice in a chart, derived from
 * `theme.accent`. index 0 is theme.accent itself, unrotated; index i>0 is
 * theme.accent's hue rotated by `i * 137.508deg` (the golden angle), same
 * saturation/lightness. Exported as an independently useful/testable unit;
 * not part of the pinned per-chart contract.
 */
export function seriesColor(theme, index) {
  const t = mergeTheme(theme);
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError(`charts: seriesColor index must be a non-negative integer, got ${JSON.stringify(index)}`);
  }
  if (index === 0) return t.accent;
  const hsl = rgbToHsl(hexToRgb(t.accent));
  const rotated = { ...hsl, h: (hsl.h + GOLDEN_ANGLE_DEG * index) % 360 };
  return rgbToHex(hslToRgb(rotated));
}

// ---------------------------------------------------------------------------
// SVG document assembly
// ---------------------------------------------------------------------------

function svgDocument({ width, height, title, body }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round2(width)} ${round2(height)}" ` +
    `width="${round2(width)}" height="${round2(height)}" role="img">` +
    `<title>${escapeXml(title)}</title>${body}</svg>`
  );
}

function textEl({ x, y, text, theme, size = 11, anchor = "start", weight, fill, transform }) {
  const attrs = [
    `x="${round2(x)}"`,
    `y="${round2(y)}"`,
    `font-family="${escapeXml(theme.fontFamily)}"`,
    `font-size="${size}"`,
    `fill="${escapeXml(fill || theme.ink)}"`,
    `text-anchor="${anchor}"`,
  ];
  if (weight) attrs.push(`font-weight="${weight}"`);
  if (transform) attrs.push(`transform="${transform}"`);
  return `<text ${attrs.join(" ")}>${escapeXml(text)}</text>`;
}

// Approximate glyph width for legend/label wrapping decisions. THEME_DEFAULT
// (and this module's whole visual identity) is set in a monospace face
// (JetBrains Mono), where ~0.6em per character is an accurate estimate;
// callers who swap in a proportional font get a conservative
// over-estimate (proportional glyphs are on average narrower), which biases
// toward wrapping/truncating a little early rather than overlapping text --
// the safe direction to be wrong in.
function textWidth(text, size) {
  return String(text).length * size * 0.6;
}

// ---------------------------------------------------------------------------
// renderSparkline
// ---------------------------------------------------------------------------

/**
 * A minimal single-series line, no axes: `points` (>=2 finite numbers) ->
 * an SVG string of size `width`x`height`. Trend color: theme.accent if the
 * series ends at or above where it started, theme.alarm if it ends lower.
 */
export function renderSparkline({ points, width = 160, height = 36, theme } = {}) {
  const t = mergeTheme(theme);
  assertNonEmptyArray(points, "renderSparkline: points");
  if (points.length < 2) {
    throw new TypeError(`charts: renderSparkline requires at least 2 points, got ${points.length}`);
  }
  points.forEach((p, i) => assertFiniteNumber(p, `renderSparkline: points[${i}]`));
  assertPositiveNumber(width, "renderSparkline: width");
  assertPositiveNumber(height, "renderSparkline: height");

  const padY = Math.min(4, height / 4);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1; // flat series draws a straight midline instead of dividing by zero
  const stepX = width / (points.length - 1);
  const coords = points.map((v, i) => [
    round2(i * stepX),
    round2(padY + (1 - (v - min) / span) * (height - padY * 2)),
  ]);
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPoints = `0,${round2(height)} ${linePoints} ${round2(width)},${round2(height)}`;
  const [lastX, lastY] = coords[coords.length - 1];
  const trendColor = points[points.length - 1] >= points[0] ? t.accent : t.alarm;
  const title = `Sparkline of ${points.length} points, ranging from ${abbreviateNumber(min)} to ${abbreviateNumber(max)}`;

  const body = [
    `<polygon points="${areaPoints}" fill="${t.accent}" fill-opacity="0.12" stroke="none"/>`,
    `<polyline points="${linePoints}" fill="none" stroke="${trendColor}" stroke-width="1.75" ` +
      `stroke-linejoin="round" stroke-linecap="round"/>`,
    `<circle cx="${lastX}" cy="${lastY}" r="2.25" fill="${trendColor}"/>`,
  ].join("");

  return svgDocument({ width, height, title, body });
}

// ---------------------------------------------------------------------------
// Shared x-scale builder for renderLineChart
// ---------------------------------------------------------------------------

function toEpochMs(x, label) {
  const d = x instanceof Date ? x : new Date(x);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`charts: ${label} is not a valid date (xIsTime is true): ${JSON.stringify(x)}`);
  }
  return d.getTime();
}

function buildXScale(series, xIsTime) {
  if (xIsTime) {
    const times = [];
    series.forEach((s, si) => {
      s.points.forEach((p, pi) => times.push(toEpochMs(p.x, `renderLineChart series[${si}].points[${pi}].x`)));
    });
    const domainMin = Math.min(...times);
    const domainMax = Math.max(...times);
    const span = domainMax - domainMin || 1;
    return {
      kind: "time",
      domainMin,
      domainMax,
      toFraction: (x) => (toEpochMs(x, "x") - domainMin) / span,
    };
  }

  const allNumeric = series.every((s) => s.points.every((p) => typeof p.x === "number" && Number.isFinite(p.x)));
  if (allNumeric) {
    const allX = series.flatMap((s) => s.points.map((p) => p.x));
    const domainMin = Math.min(...allX);
    const domainMax = Math.max(...allX);
    const span = domainMax - domainMin || 1;
    return {
      kind: "linear",
      domainMin,
      domainMax,
      toFraction: (x) => (x - domainMin) / span,
    };
  }

  // Ordinal (categorical) x: category order is taken from series[0]; every
  // other series must plot against that same category set, since a shared
  // x-axis is the only coherent reading of a multi-series line chart.
  const categories = series[0].points.map((p) => String(p.x));
  const index = new Map(categories.map((c, i) => [c, i]));
  return {
    kind: "ordinal",
    categories,
    toFraction: (x) => {
      const key = String(x);
      if (!index.has(key)) {
        throw new TypeError(
          `charts: renderLineChart ordinal x value ${JSON.stringify(x)} is not in series[0]'s category set`,
        );
      }
      return categories.length === 1 ? 0.5 : index.get(key) / (categories.length - 1);
    },
  };
}

function formatDateTick(epochMs) {
  return new Date(epochMs).toISOString().slice(0, 10); // civil-day granularity, matches this network's date convention
}

// ---------------------------------------------------------------------------
// renderLineChart
// ---------------------------------------------------------------------------

/**
 * Multi-series line chart with axes, gridlines, and a legend.
 * `series`: [{label, points: [{x, y}]}]. `xIsTime`: treat x as a Date /
 * epoch ms / ISO string on a time scale (else numeric-linear if every x is
 * a finite number, else ordinal/categorical using series[0]'s x order).
 */
export function renderLineChart({ series, width = 640, height = 280, theme, yLabel, xIsTime = false } = {}) {
  const t = mergeTheme(theme);
  assertNonEmptyArray(series, "renderLineChart: series");
  series.forEach((s, i) => {
    if (typeof s !== "object" || s === null) {
      throw new TypeError(`charts: renderLineChart series[${i}] must be an object`);
    }
    assertNonEmptyString(s.label, `renderLineChart: series[${i}].label`);
    assertNonEmptyArray(s.points, `renderLineChart: series[${i}] (${s.label}).points`);
    s.points.forEach((p, j) => {
      if (typeof p !== "object" || p === null || p.x === undefined) {
        throw new TypeError(`charts: renderLineChart series[${i}] (${s.label}).points[${j}] must be {x, y}`);
      }
      assertFiniteNumber(p.y, `renderLineChart series[${i}] (${s.label}).points[${j}].y`);
    });
  });
  assertPositiveNumber(width, "renderLineChart: width");
  assertPositiveNumber(height, "renderLineChart: height");

  const xScale = buildXScale(series, xIsTime);
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const { min: yMin, max: yMax, ticks: yTicks } = niceTicks(Math.min(...allY), Math.max(...allY), 5);
  const ySpan = yMax - yMin || 1;

  const fontSize = 11;
  const yLabelWidths = yTicks.map((v) => textWidth(abbreviateNumber(v), fontSize));
  const leftMargin = Math.ceil(Math.max(...yLabelWidths)) + 14 + (yLabel ? 14 : 0);
  const rightMargin = 16;

  // Legend: horizontal flow, wrapped to as many rows as needed so it never
  // overlaps the plot; only drawn when there's more than one series (a
  // single series is already named by its own title text, per this
  // network's dataviz convention of not spending a legend box on identity
  // that isn't ambiguous).
  const legendGap = 16;
  const legendRows = series.length > 1 ? layoutLegendRows(series, width, fontSize, legendGap, t) : [];
  const legendHeight = legendRows.length > 0 ? legendRows.length * 18 + 8 : 0;
  const topMargin = 16 + legendHeight;

  const xTickLabelHeight = xScale.kind === "ordinal" ? 14 : 16;
  const bottomMargin = 24 + xTickLabelHeight;

  const plotWidth = width - leftMargin - rightMargin;
  const plotHeight = height - topMargin - bottomMargin;
  if (plotWidth <= 0 || plotHeight <= 0) {
    throw new RangeError(
      `charts: renderLineChart width/height too small for its axes/legend (got ${width}x${height}, ` +
        `need > ${leftMargin + rightMargin}x${topMargin + bottomMargin})`,
    );
  }

  const plotX = (frac) => leftMargin + frac * plotWidth;
  const plotY = (v) => topMargin + (1 - (v - yMin) / ySpan) * plotHeight;

  const parts = [];

  // Gridlines + y-axis labels, one per nice tick.
  for (const v of yTicks) {
    const y = round2(plotY(v));
    parts.push(
      `<line x1="${round2(leftMargin)}" y1="${y}" x2="${round2(leftMargin + plotWidth)}" y2="${y}" ` +
        `stroke="${t.muted}" stroke-opacity="0.25" stroke-width="1"/>`,
    );
    parts.push(textEl({ x: leftMargin - 8, y: y + 3.5, text: abbreviateNumber(v), theme: t, size: fontSize, anchor: "end", fill: t.muted }));
  }

  // Axis lines.
  parts.push(
    `<line x1="${round2(leftMargin)}" y1="${round2(topMargin)}" x2="${round2(leftMargin)}" ` +
      `y2="${round2(topMargin + plotHeight)}" stroke="${t.muted}" stroke-width="1"/>`,
  );
  parts.push(
    `<line x1="${round2(leftMargin)}" y1="${round2(topMargin + plotHeight)}" ` +
      `x2="${round2(leftMargin + plotWidth)}" y2="${round2(topMargin + plotHeight)}" stroke="${t.muted}" stroke-width="1"/>`,
  );

  if (yLabel) {
    parts.push(
      textEl({
        x: -(topMargin + plotHeight / 2),
        y: 12,
        text: yLabel,
        theme: t,
        size: fontSize,
        anchor: "middle",
        fill: t.muted,
        transform: "rotate(-90)",
      }),
    );
  }

  // x-axis ticks + labels.
  const xTicks = buildXTicks(xScale, plotWidth);
  for (const tick of xTicks) {
    const x = round2(plotX(tick.frac));
    parts.push(
      `<line x1="${x}" y1="${round2(topMargin + plotHeight)}" x2="${x}" ` +
        `y2="${round2(topMargin + plotHeight + 4)}" stroke="${t.muted}" stroke-width="1"/>`,
    );
    parts.push(
      textEl({ x, y: topMargin + plotHeight + 16, text: tick.label, theme: t, size: fontSize - 1, anchor: "middle", fill: t.muted }),
    );
  }

  // Legend swatches.
  legendRows.forEach((row, ri) => {
    let x = leftMargin;
    const y = 16 + ri * 18;
    for (const item of row) {
      parts.push(`<rect x="${round2(x)}" y="${round2(y - 9)}" width="10" height="10" rx="2" fill="${item.color}"/>`);
      parts.push(textEl({ x: x + 14, y, text: item.label, theme: t, size: fontSize, fill: t.ink }));
      x += item.width;
    }
  });

  // Data series, drawn last so they sit above gridlines.
  series.forEach((s, i) => {
    const color = seriesColor(t, i);
    const linePoints = s.points
      .map((p) => `${round2(plotX(xScale.toFraction(p.x)))},${round2(plotY(p.y))}`)
      .join(" ");
    parts.push(
      `<polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2" ` +
        `stroke-linejoin="round" stroke-linecap="round"/>`,
    );
  });

  const title = `Line chart: ${series.map((s) => s.label).join(", ")}${yLabel ? ` (${yLabel})` : ""}`;
  return svgDocument({ width, height, title, body: parts.join("") });
}

function layoutLegendRows(series, width, fontSize, gap, theme) {
  const items = series.map((s, i) => ({
    label: s.label,
    color: seriesColor(theme, i),
    width: 14 + textWidth(s.label, fontSize) + gap,
  }));
  const rows = [];
  let row = [];
  let used = 0;
  for (const item of items) {
    if (used + item.width > width && row.length > 0) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(item);
    used += item.width;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function buildXTicks(xScale, plotWidth) {
  const maxTicks = Math.max(2, Math.min(6, Math.floor(plotWidth / 90)));
  if (xScale.kind === "ordinal") {
    const n = xScale.categories.length;
    const stride = Math.max(1, Math.ceil(n / maxTicks));
    const ticks = [];
    for (let i = 0; i < n; i += stride) {
      ticks.push({ frac: n === 1 ? 0.5 : i / (n - 1), label: xScale.categories[i] });
    }
    return ticks;
  }
  const { domainMin, domainMax } = xScale;
  const ticks = [];
  for (let i = 0; i < maxTicks; i++) {
    const frac = maxTicks === 1 ? 0.5 : i / (maxTicks - 1);
    const value = domainMin + frac * (domainMax - domainMin);
    ticks.push({ frac, label: xScale.kind === "time" ? formatDateTick(value) : abbreviateNumber(value) });
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// renderBarChart
// ---------------------------------------------------------------------------

/**
 * Single-series category bar chart (vertical by default, `horizontal:
 * true` for a horizontal bar chart). `width`/`height` are required (no
 * default) since a bar chart's readable size depends on how many
 * categories there are -- callers size it, this module doesn't guess.
 */
export function renderBarChart({ categories, values, width, height, theme, horizontal = false } = {}) {
  const t = mergeTheme(theme);
  assertNonEmptyArray(categories, "renderBarChart: categories");
  assertNonEmptyArray(values, "renderBarChart: values");
  if (categories.length !== values.length) {
    throw new TypeError(
      `charts: renderBarChart categories and values must be the same length ` +
        `(got ${categories.length} and ${values.length})`,
    );
  }
  categories.forEach((c, i) => assertNonEmptyString(c, `renderBarChart: categories[${i}]`));
  values.forEach((v, i) => assertFiniteNumber(v, `renderBarChart: values[${i}]`));
  assertPositiveNumber(width, "renderBarChart: width");
  assertPositiveNumber(height, "renderBarChart: height");

  // A bar's length encodes magnitude, so the value axis always includes
  // zero -- omitting it (unlike a line chart, which has no such rule) would
  // make bar-length ratios lie.
  const { min: vMin, max: vMax, ticks: vTicks } = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 5);
  const vSpan = vMax - vMin || 1;
  const fontSize = 11;
  const barGapFrac = 0.3;

  const parts = [];
  let margin;
  let title;

  if (horizontal) {
    const catLabelWidths = categories.map((c) => textWidth(c, fontSize));
    margin = {
      left: Math.ceil(Math.max(...catLabelWidths)) + 12,
      right: 16,
      top: 12,
      bottom: 20 + fontSize,
    };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    if (plotWidth <= 0 || plotHeight <= 0) {
      throw new RangeError(`charts: renderBarChart width/height too small for its labels (got ${width}x${height})`);
    }
    const valueToX = (v) => margin.left + ((v - vMin) / vSpan) * plotWidth;
    const zeroX = round2(valueToX(0));

    for (const v of vTicks) {
      const x = round2(valueToX(v));
      parts.push(
        `<line x1="${x}" y1="${round2(margin.top)}" x2="${x}" y2="${round2(margin.top + plotHeight)}" ` +
          `stroke="${t.muted}" stroke-opacity="0.25" stroke-width="1"/>`,
      );
      parts.push(
        textEl({ x, y: margin.top + plotHeight + 14, text: abbreviateNumber(v), theme: t, size: fontSize - 1, anchor: "middle", fill: t.muted }),
      );
    }

    const bandHeight = plotHeight / categories.length;
    const barHeight = bandHeight * (1 - barGapFrac);
    categories.forEach((c, i) => {
      const yTop = margin.top + i * bandHeight + (bandHeight - barHeight) / 2;
      const x = round2(valueToX(values[i]));
      const barX = Math.min(zeroX, x);
      const barW = Math.abs(x - zeroX);
      parts.push(`<rect x="${round2(barX)}" y="${round2(yTop)}" width="${round2(barW)}" height="${round2(barHeight)}" fill="${t.accent}"/>`);
      parts.push(
        textEl({ x: margin.left - 8, y: yTop + barHeight / 2 + 3.5, text: c, theme: t, size: fontSize, anchor: "end", fill: t.ink }),
      );
    });
    parts.push(`<line x1="${zeroX}" y1="${round2(margin.top)}" x2="${zeroX}" y2="${round2(margin.top + plotHeight)}" stroke="${t.muted}" stroke-width="1"/>`);
    title = `Horizontal bar chart of ${categories.length} categories`;
  } else {
    const vLabelWidths = vTicks.map((v) => textWidth(abbreviateNumber(v), fontSize));
    margin = {
      left: Math.ceil(Math.max(...vLabelWidths)) + 12,
      right: 16,
      top: 12,
      bottom: 24 + fontSize,
    };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    if (plotWidth <= 0 || plotHeight <= 0) {
      throw new RangeError(`charts: renderBarChart width/height too small for its labels (got ${width}x${height})`);
    }
    const valueToY = (v) => margin.top + (1 - (v - vMin) / vSpan) * plotHeight;
    const zeroY = round2(valueToY(0));

    for (const v of vTicks) {
      const y = round2(valueToY(v));
      parts.push(
        `<line x1="${round2(margin.left)}" y1="${y}" x2="${round2(margin.left + plotWidth)}" y2="${y}" ` +
          `stroke="${t.muted}" stroke-opacity="0.25" stroke-width="1"/>`,
      );
      parts.push(textEl({ x: margin.left - 8, y: y + 3.5, text: abbreviateNumber(v), theme: t, size: fontSize, anchor: "end", fill: t.muted }));
    }

    const bandWidth = plotWidth / categories.length;
    const barWidth = bandWidth * (1 - barGapFrac);
    // If category labels are wider than the band they sit under, rotate
    // them -40deg (anchored at their end) so they read diagonally instead
    // of overlapping their neighbors -- the standard escape hatch for
    // dense categorical axes.
    const widestLabel = Math.max(...categories.map((c) => textWidth(c, fontSize)));
    const rotateLabels = widestLabel > bandWidth * 0.9;

    categories.forEach((c, i) => {
      const xLeft = margin.left + i * bandWidth + (bandWidth - barWidth) / 2;
      const y = round2(valueToY(values[i]));
      const barY = Math.min(zeroY, y);
      const barH = Math.abs(zeroY - y);
      parts.push(`<rect x="${round2(xLeft)}" y="${round2(barY)}" width="${round2(barWidth)}" height="${round2(barH)}" fill="${t.accent}"/>`);
      const labelX = xLeft + barWidth / 2;
      const labelY = margin.top + plotHeight + (rotateLabels ? 14 : 16);
      const transform = rotateLabels ? `rotate(-40 ${round2(labelX)} ${round2(labelY)})` : undefined;
      parts.push(
        textEl({
          x: labelX,
          y: labelY,
          text: c,
          theme: t,
          size: fontSize - 1,
          anchor: rotateLabels ? "end" : "middle",
          fill: t.ink,
          transform,
        }),
      );
    });
    parts.push(
      `<line x1="${round2(margin.left)}" y1="${zeroY}" x2="${round2(margin.left + plotWidth)}" y2="${zeroY}" stroke="${t.muted}" stroke-width="1"/>`,
    );
    title = `Bar chart of ${categories.length} categories`;
  }

  return svgDocument({ width, height, title, body: parts.join("") });
}

// ---------------------------------------------------------------------------
// renderDonut
// ---------------------------------------------------------------------------

function polarPoint(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [round2(cx + r * Math.cos(rad)), round2(cy + r * Math.sin(rad))];
}

/**
 * Donut chart with a vertical legend (swatch, label, percentage) below the
 * ring. `width` sizes the ring (default 200); the returned SVG's actual
 * height grows with the legend, so it is always tall enough to fit without
 * overlap -- callers read the real size back out of the returned string's
 * `viewBox`/`height` attributes rather than assuming a fixed aspect ratio.
 */
export function renderDonut({ slices, width = 200, theme } = {}) {
  const t = mergeTheme(theme);
  assertNonEmptyArray(slices, "renderDonut: slices");
  slices.forEach((s, i) => {
    if (typeof s !== "object" || s === null) {
      throw new TypeError(`charts: renderDonut slices[${i}] must be an object`);
    }
    assertNonEmptyString(s.label, `renderDonut: slices[${i}].label`);
    assertFiniteNumber(s.value, `renderDonut: slices[${i}] (${s.label}).value`);
    if (s.value < 0) {
      throw new TypeError(`charts: renderDonut slices[${i}] (${s.label}).value must be >= 0, got ${s.value}`);
    }
  });
  assertPositiveNumber(width, "renderDonut: width");
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    throw new RangeError("charts: renderDonut requires at least one slice with a positive value");
  }

  const ringSize = width;
  const cx = ringSize / 2;
  const cy = ringSize / 2;
  const outerR = ringSize / 2 - 4;
  const innerR = outerR * 0.55;
  const fontSize = 11;
  const legendRowHeight = 18;
  const legendTop = ringSize + 12;
  const height = legendTop + slices.length * legendRowHeight + 4;

  const parts = [];
  let startAngle = 0;
  slices.forEach((s, i) => {
    const color = seriesColor(t, i);
    const fraction = s.value / total;
    // Clamp so a slice that is (numerically, or by being the only nonzero
    // one) the full 100% never asks the SVG arc command for an exact
    // 360deg sweep, which is a degenerate arc (start point == end point)
    // that most SVG renderers draw as nothing at all.
    const sweep = Math.min(fraction * 360, 359.999);
    const endAngle = startAngle + sweep;
    const [ox1, oy1] = polarPoint(cx, cy, outerR, startAngle);
    const [ox2, oy2] = polarPoint(cx, cy, outerR, endAngle);
    const [ix2, iy2] = polarPoint(cx, cy, innerR, endAngle);
    const [ix1, iy1] = polarPoint(cx, cy, innerR, startAngle);
    const largeArc = sweep > 180 ? 1 : 0;
    const d = [
      `M ${ox1} ${oy1}`,
      `A ${round2(outerR)} ${round2(outerR)} 0 ${largeArc} 1 ${ox2} ${oy2}`,
      `L ${ix2} ${iy2}`,
      `A ${round2(innerR)} ${round2(innerR)} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");
    parts.push(`<path d="${d}" fill="${color}"/>`);
    startAngle = endAngle;

    const pct = round2((fraction * 100 + Number.EPSILON) * 100) / 100;
    const legendY = legendTop + i * legendRowHeight + 12;
    parts.push(`<rect x="0" y="${round2(legendY - 10)}" width="10" height="10" rx="2" fill="${color}"/>`);
    parts.push(textEl({ x: 14, y: legendY - 1, text: `${s.label} (${pct}%)`, theme: t, size: fontSize, fill: t.ink }));
  });

  const title = `Donut chart of ${slices.length} slices totaling ${abbreviateNumber(total)}`;
  return svgDocument({ width: ringSize, height, title, body: parts.join("") });
}
