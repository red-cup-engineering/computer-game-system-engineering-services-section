function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Render an already-acquired session play position and work count as one HUD line. */
export function projectGameStatusLine(play, openWork = 0) {
  const open = nonnegativeInteger(openWork);
  if (play === null || typeof play !== "object" || Array.isArray(play)) return `⛬ ops-manifold · work ${open} open`;
  const level = nonnegativeInteger(play.level);
  const experience = nonnegativeInteger(play.experience);
  const toNext = nonnegativeInteger(play.toNext);
  const mode = typeof play.mode === "string" && play.mode.length > 0 ? play.mode : "unmeasured";
  const flow = typeof play.flow === "string" && play.flow.length > 0 ? play.flow : "unmeasured";
  const badges = Array.isArray(play.badges) ? play.badges.length : 0;
  return [`⛬ L${level} · ${experience}xp (${toNext}→)`, `${mode}/${flow}`, `${badges}🏅`, `work ${open} open`].join(" · ");
}
