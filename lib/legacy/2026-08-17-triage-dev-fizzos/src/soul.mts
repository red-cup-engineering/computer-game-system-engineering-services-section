/**
 * `@emsenn/fizzos/soul` — the soul: parameterized social emotes (Discworld's signature).
 *
 * Each soul verb renders three ways — to the actor, to the room, and (when aimed) to the
 * target — so `smile`, `wave at the harbormaster`, `bow` read naturally for everyone who
 * sees them. Communication is the social layer made expressive; like speech, soul emotes
 * are room-scoped and so respect the perception fiber.
 *
 * Templates interpolate `{actor}` and `{target}` (already display-named by the scene).
 */
export interface Soul {
  /** Shown to the actor with no target. */
  readonly self: string;
  /** Shown to others in the room with no target. */
  readonly room: string;
  /** Shown to the actor, aimed at a target. */
  readonly selfAt: string;
  /** Shown to others in the room, aimed at a target. */
  readonly roomAt: string;
  /** Shown to the target. */
  readonly targetAt: string;
}

const soul = (verb: string, past: string): Soul => ({
  self: `You ${verb}.`,
  room: `{actor} ${past}.`,
  selfAt: `You ${verb} at {target}.`,
  roomAt: `{actor} ${past} at {target}.`,
  targetAt: `{actor} ${past} at you.`,
});

export const SOULS: Readonly<Record<string, Soul>> = Object.freeze({
  smile: soul("smile", "smiles"),
  grin: soul("grin", "grins"),
  laugh: soul("laugh", "laughs"),
  wave: soul("wave", "waves"),
  bow: soul("bow", "bows"),
  nod: soul("nod", "nods"),
  wink: soul("wink", "winks"),
  frown: soul("frown", "frowns"),
  glare: soul("glare", "glares"),
  cheer: soul("cheer", "cheers"),
  shrug: soul("shrug", "shrugs"),
  dance: soul("dance", "dances"),
  bounce: soul("bounce", "bounces"),
  ponder: soul("ponder", "ponders"),
  sigh: soul("sigh", "sighs"),
  cackle: soul("cackle", "cackles"),
});

/** Fill an emote template with the actor's and target's display names. */
export const fillSoul = (template: string, actorName: string, targetName = ""): string =>
  template.replace(/\{actor\}/g, actorName).replace(/\{target\}/g, targetName);
