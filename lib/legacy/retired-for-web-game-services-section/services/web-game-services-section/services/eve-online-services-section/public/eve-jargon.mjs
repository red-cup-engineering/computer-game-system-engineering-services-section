// EVE Assist's own jargon, registered into the engine's shared abbr()
// glossary (public/app.js, now the engine's — @red-cup-engineering/
// personal-intelligence-systems-services-section) rather than carried by
// that generic module. Every EVE Assist page that calls abbr("ESI"),
// abbr("ISK"), etc. imports this module once (for its side effect) before
// using abbr().

import { registerJargon } from "/app.js";

registerJargon({
  ESI: "EVE Swagger Interface — CCP's read-only API for character and game data. This assistant never writes through it.",
  SSO: "EVE Online Single Sign-On — CCP's OAuth2 login. Logging in is how you grant this assistant read access.",
  ISK: "InterStellar Kredits — EVE Online's in-game currency.",
  "skill queue": "The ordered list of skills your character is currently training, one at a time.",
  "jump clone": "A stored backup body elsewhere in space. Podded near one, you wake up there instead of losing everything.",
  killmail: "CCP's public record of a ship's destruction: who died, who did it, and with what.",
  "sec status": "Security status — a per-character score that drops when you kill things CONCORD would rather you hadn't.",
});
