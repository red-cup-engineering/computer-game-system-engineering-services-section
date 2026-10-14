// The bot's thinking thread. play-app.mjs posts { id, session, tierId };
// this worker rebuilds the engine's game from the versioned session, runs
// the tier's chooser against the same generated kernel the page uses, and
// posts { id, ok, move } back. A longer think (the Monte Carlo tier) never
// freezes the board this way. No rules live here.

import * as kernel from "./kernel/index.mjs";
import { BOT_TIERS } from "./bot.mjs";

self.addEventListener("message", ({ data }) => {
  const { id, session, tierId } = data ?? {};
  try {
    const tier = BOT_TIERS.find((candidate) => candidate.id === tierId) ?? BOT_TIERS[0];
    const move = tier.chooser(kernel.materializeWeiqiGame(session), kernel, Math.random, {
      onProgress: (progress) => self.postMessage({ id, type: "progress", progress }),
    });
    self.postMessage({ id, ok: true, move });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
});
