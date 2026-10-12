// adapters/ruinfold — turns a ruinfold-daily replay bundle into TUFTE tiles, by way of an
// independent, offline recomputation through adapters/vendor/ruinfold/engine (a verbatim, vendored
// copy of ruinfold-daily's own src/engine — see that directory's provenance headers). ruinfold's
// own replay contract (src/engine/run.mts) is "seed in, deterministic engine, intent log out,
// replay to verify" (the same shape @red-cup-engineering/cartridge's README names): this adapter's verify()
// is exactly that replay, run again, here, never trusting anything the bundle claims about its own
// outcome.
//
// replayBundle shape:
//   {
//     date: "YYYY-MM-DD",   // the daily's UTC calendar date — the ONLY thing that determines the
//                            // canonical seed (dailySeed(date)); a `seed` field on the log itself
//                            // is never consulted, mirroring run.mts's own anti-cheat contract
//                            // (see ruinfold's replay-tamper.test.mts: "a forged seed embedded in
//                            // the log is inert").
//     log: {                 // a RunLog, exactly ruinfold's own src/engine/run.mts#RunLog shape
//       schema: "ruinfold-run/1",
//       date: "YYYY-MM-DD",
//       seed: number | string,   // ignored by verify() — kept only because it's part of the
//                                  // real RunLog shape a ruinfold server would have stored
//       actor: string,
//       mode: "scored" | "practice",
//       moves: { tick: number, seq: number, intent: unknown }[],
//     },
//   }

import { dailySeed } from "./vendor/ruinfold/engine/daily.mts";
import { replay } from "./vendor/ruinfold/engine/run.mts";
import { archetype } from "./vendor/ruinfold/engine/archetypes.mts";
import { glyphOf } from "./vendor/ruinfold/engine/bilattice.mts";
import { escapeHtml } from "../src/escape-html.mjs";

const END_REASON_LABEL = {
  cleared: "Cleared the keep",
  "mortal-death": "Died",
  voided: "Voided (un-happened)",
  "tick-cap": "Ran out of ticks",
};

const REJECTION_LABEL = {
  "malformed-intent": "a malformed intent",
  "wrong-actor": "an intent naming a different actor",
  "bad-order": "moves out of tick/seq order",
  "tick-cap-exceeded": "a move past the tick cap",
};

// summarizeWorld — flatten the live World (Maps, entity graph) down to the plain, JSON-safe,
// display-relevant facts this adapter needs. Never serializes the whole world (zones, every
// monster) — only what the page shows.
function summarizeWorld(world, actorId) {
  const player = world.entities.get(actorId);
  const boss = world.entities.get(world.bossId);
  const inventory = (player?.inventory ?? []).map((itemId) => {
    const item = world.entities.get(itemId);
    const a = archetype(item?.archetypeId);
    return { id: itemId, name: a?.name ?? itemId, value: a?.value ?? 0 };
  });
  const equipped = Object.fromEntries(
    Object.entries(player?.equipped ?? {}).map(([slot, itemId]) => {
      if (!itemId) return [slot, null];
      const item = world.entities.get(itemId);
      const a = archetype(item?.archetypeId);
      return [slot, a?.name ?? itemId];
    }),
  );
  return {
    floorCount: world.floorCount,
    bossId: world.bossId,
    bossDefeated: boss?.status === "slain",
    player: player
      ? {
          id: player.id,
          level: player.level,
          xp: player.xp,
          health: player.health,
          maxHealth: player.maxHealth,
          gold: player.gold,
          status: player.status,
          aliveGlyph: glyphOf(player.alive),
          humanGlyph: player.human ? glyphOf(player.human) : "⊥",
          relicSpent: Boolean(player.relicSpent),
          equipped,
          inventory,
        }
      : null,
    stats: { ...world.stats },
  };
}

/** Recompute the run's outcome from (date, log) alone, through the vendored real engine. */
export function verify(replayBundle) {
  const { date, log } = replayBundle ?? {};
  const seed = dailySeed(String(date));
  const result = replay(seed, log);

  if (result.rejected) {
    return { valid: false, rejected: result.rejected, seed, date, movesSubmitted: log?.moves?.length ?? 0 };
  }

  const world = summarizeWorld(result.world, log.actor);
  return {
    valid: true,
    seed,
    date,
    actor: log.actor,
    mode: log.mode,
    movesSubmitted: log.moves.length,
    endedAt: result.endedAt,
    score: result.score,
    world,
  };
}

function movesTableHtml(moves) {
  const rows = moves
    .map((m) => {
      const intent = m.intent ?? {};
      const detail = Object.entries(intent)
        .filter(([k]) => k !== "kind" && k !== "actor")
        .map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(String(v))}`)
        .join(" ");
      return `<tr><td>${m.tick}</td><td>${m.seq}</td><td>${escapeHtml(intent.kind ?? "?")}</td><td>${detail}</td></tr>`;
    })
    .join("");
  return `<div style="max-height:16rem;overflow:auto"><table style="width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.85rem"><thead><tr><th style="text-align:left">tick</th><th style="text-align:left">seq</th><th style="text-align:left">intent</th><th style="text-align:left">detail</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Project a verified ruinfold replay onto TUFTE tiles. */
export function project(replayBundle, verification) {
  const { date, log } = replayBundle ?? {};

  if (!verification.valid) {
    return {
      title: `Ruinfold Daily — ${date}`,
      subtitle: "This replay was rejected on independent re-verification.",
      eyebrow: "RUINFOLD DAILY · REPLAY REJECTED",
      revision: `rejected:${verification.rejected}`,
      documentTitle: `Ruinfold Daily ${date} — rejected`,
      tiles: [
        {
          id: "now",
          role: "now",
          span: 12,
          lifecycle: "imminent",
          confidence: "low",
          eyebrow: "VERIFICATION",
          title: "Rejected",
          html: `<p>Re-running this move log against the canonical ${escapeHtml(date)} daily independently rejected it: <strong>${escapeHtml(REJECTION_LABEL[verification.rejected] ?? verification.rejected)}</strong>.</p><p>Seed: <code>${escapeHtml(String(verification.seed))}</code> · moves submitted: ${verification.movesSubmitted}.</p>`,
        },
      ],
    };
  }

  const { world, endedAt, score, actor, mode } = verification;
  const outcomeLabel = END_REASON_LABEL[endedAt.reason] ?? endedAt.reason;
  const invHtml = world.player.inventory.length
    ? `<ul>${world.player.inventory.map((i) => `<li>${escapeHtml(i.name)} <span style="opacity:.65">(value ${i.value})</span></li>`).join("")}</ul>`
    : "<p>Empty.</p>";
  const equippedEntries = Object.entries(world.player.equipped).filter(([, v]) => v);
  const equippedHtml = equippedEntries.length
    ? `<ul>${equippedEntries.map(([slot, name]) => `<li>${escapeHtml(slot)}: ${escapeHtml(name)}</li>`).join("")}</ul>`
    : "<p>Nothing equipped.</p>";
  const flags = [];
  if (world.player.humanGlyph === "⊤") flags.push("Lycanthrope — cursed once, held forever");
  if (world.player.relicSpent) flags.push("Risen on the Heart of the Hollow — undead continuation spent");

  return {
    title: `Ruinfold Daily — ${date}`,
    subtitle: `${outcomeLabel} on tick ${endedAt.tick} of ${6000}, verified independently from seed + move log.`,
    eyebrow: "RUINFOLD DAILY · VERIFIED REPLAY",
    documentTitle: `Ruinfold Daily ${date} — score ${score ?? "voided"}`,
    tiles: [
      {
        id: "now",
        role: "now",
        span: 8,
        lifecycle: endedAt.reason === "cleared" ? "present" : "past",
        confidence: "high",
        eyebrow: "OUTCOME",
        title: outcomeLabel,
        html: `<p style="font-size:2.2rem;font-family:ui-serif,Georgia,serif;margin:0 0 .3rem">${score === null ? "Voided — no score" : `Score ${score}`}</p><p>Actor <code>${escapeHtml(actor)}</code> · mode ${escapeHtml(mode)} · ended tick ${endedAt.tick}.</p>${flags.length ? `<p style="color:var(--tufte-warn)">${flags.map(escapeHtml).join(" · ")}</p>` : ""}`,
      },
      {
        id: "verification",
        role: "aside",
        span: 4,
        confidence: "high",
        eyebrow: "VERIFICATION",
        title: "Independently replayed",
        html: `<dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .6rem;font-size:.85rem"><dt>seed</dt><dd><code>${escapeHtml(String(verification.seed))}</code></dd><dt>date</dt><dd>${escapeHtml(date)}</dd><dt>moves</dt><dd>${verification.movesSubmitted}</dd><dt>engine</dt><dd>vendored ruinfold-daily, run offline</dd></dl>`,
      },
      {
        id: "depth",
        role: "standard",
        span: 4,
        title: "Depth & kills",
        html: `<dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .6rem"><dt>floor reached</dt><dd>${world.stats.maxFloorReached} / ${world.floorCount}</dd><dt>boss</dt><dd>${world.bossDefeated ? "defeated" : "not defeated"}</dd><dt>floors flawless</dt><dd>${world.stats.floorsFlawless}</dd><dt>kill xp</dt><dd>${world.stats.killXp}</dd></dl>`,
      },
      {
        id: "character",
        role: "standard",
        span: 4,
        title: "Character",
        html: `<dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .6rem"><dt>level</dt><dd>${world.player.level}</dd><dt>health</dt><dd>${world.player.health} / ${world.player.maxHealth}</dd><dt>gold</dt><dd>${world.player.gold}</dd><dt>status</dt><dd>${escapeHtml(world.player.status)}</dd></dl>`,
      },
      {
        id: "equipment",
        role: "standard",
        span: 4,
        title: "Equipped",
        html: equippedHtml,
      },
      {
        id: "inventory",
        role: "aside",
        span: 4,
        title: "Inventory",
        html: invHtml,
      },
      {
        id: "moves",
        role: "rail",
        span: 12,
        confidence: log.mode === "practice" ? "low" : "high",
        eyebrow: "MOVE LOG",
        title: `${log.moves.length} moves`,
        html: movesTableHtml(log.moves),
      },
    ],
  };
}

export const id = "ruinfold";
export const name = "Ruinfold Daily";
export default { id, name, verify, project };
