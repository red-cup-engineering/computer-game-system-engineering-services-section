// souls — the MUD "soul": a table of social emotes (smile, bow, hug <who>, glare at <who>) and
// the morphism that enacts one. A soul is the BODY-LANGUAGE sibling of saying: where `say` files
// an utterance entity into the speaker's room, `soul` files an AMBIENT EMOTE entity into the
// actor's room, so it falls inside the SENSORY FRONTIER of every co-located actor — perceived
// with zero query and zero routing, exactly like a heard utterance. An emote is attributed to no
// agent (ambient); its cells fully describe the act on the trace.
//
// The emote carries cells:  kind=emote, emoting-by=<actor>, emote-text=<the fully-resolved
// third-person sentence others see>, optionally emote-target=<target id>, located-in=<actor's
// room>. Emote ids are content-addressed (`emote:<rowId-ish>`) so replay is deterministic — the
// same social by the same actor at the same tick mints the identical entity.
//
// SOULS                                  -> the table { name: { self, others, targeted... } }
// listSouls()                            -> sorted array of soul names
// hasSoul(name)                          -> boolean
// resolve(name, meName, themName?)       -> { self, others } fully-substituted (pure, no world)
// soul({ root, actor, name, target?, t, opts? })
//   -> { emote, self, others, heardBy }

import doing from "#doing";
import { rowId } from "#eavt-row";
import { locationOf, containedBy, rowsFor } from "#substrate";

// SOULS — the social table. Each entry uses `{me}` (the actor) and `{them}` (the target) as
// placeholders. `self` / `others` are the UNTARGETED forms; `targetedSelf` / `targetedOthers`
// the TARGETED forms. Targeted-only socials (poke, slap, hug ...) provide only the targeted
// pair; resolve falls back to appending " at {them}" for any social lacking a targeted form.
export const SOULS = {
  // — faces & smiles —
  smile:    { self: "You smile.",        others: "{me} smiles.",        targetedSelf: "You smile at {them}.",      targetedOthers: "{me} smiles at {them}." },
  grin:     { self: "You grin.",         others: "{me} grins.",         targetedSelf: "You grin at {them}.",       targetedOthers: "{me} grins at {them}." },
  beam:     { self: "You beam.",         others: "{me} beams.",         targetedSelf: "You beam at {them}.",       targetedOthers: "{me} beams at {them}." },
  smirk:    { self: "You smirk.",        others: "{me} smirks.",        targetedSelf: "You smirk at {them}.",      targetedOthers: "{me} smirks at {them}." },
  frown:    { self: "You frown.",        others: "{me} frowns.",        targetedSelf: "You frown at {them}.",      targetedOthers: "{me} frowns at {them}." },
  scowl:    { self: "You scowl.",        others: "{me} scowls.",        targetedSelf: "You scowl at {them}.",      targetedOthers: "{me} scowl at {them}." },
  glare:    { self: "You glare.",        others: "{me} glares.",        targetedSelf: "You glare at {them}.",      targetedOthers: "{me} glares at {them}." },
  sneer:    { self: "You sneer.",        others: "{me} sneers.",        targetedSelf: "You sneer at {them}.",      targetedOthers: "{me} sneers at {them}." },
  pout:     { self: "You pout.",         others: "{me} pouts.",         targetedSelf: "You pout at {them}.",       targetedOthers: "{me} pouts at {them}." },
  leer:     { self: "You leer.",         others: "{me} leers.",         targetedSelf: "You leer at {them}.",       targetedOthers: "{me} leers at {them}." },
  glower:   { self: "You glower.",       others: "{me} glowers.",       targetedSelf: "You glower at {them}.",     targetedOthers: "{me} glowers at {them}." },
  grimace:  { self: "You grimace.",      others: "{me} grimaces.",      targetedSelf: "You grimace at {them}.",    targetedOthers: "{me} grimaces at {them}." },

  // — laughter & sound —
  laugh:    { self: "You laugh.",        others: "{me} laughs.",        targetedSelf: "You laugh at {them}.",      targetedOthers: "{me} laughs at {them}." },
  giggle:   { self: "You giggle.",       others: "{me} giggles.",       targetedSelf: "You giggle at {them}.",     targetedOthers: "{me} giggles at {them}." },
  chuckle:  { self: "You chuckle.",      others: "{me} chuckles.",      targetedSelf: "You chuckle at {them}.",    targetedOthers: "{me} chuckles at {them}." },
  cackle:   { self: "You cackle.",       others: "{me} cackles.",       targetedSelf: "You cackle at {them}.",     targetedOthers: "{me} cackles at {them}." },
  snicker:  { self: "You snicker.",      others: "{me} snickers.",      targetedSelf: "You snicker at {them}.",    targetedOthers: "{me} snickers at {them}." },
  snigger:  { self: "You snigger.",      others: "{me} sniggers.",      targetedSelf: "You snigger at {them}.",    targetedOthers: "{me} sniggers at {them}." },
  guffaw:   { self: "You guffaw.",       others: "{me} guffaws.",       targetedSelf: "You guffaw at {them}.",     targetedOthers: "{me} guffaws at {them}." },
  titter:   { self: "You titter.",       others: "{me} titters.",       targetedSelf: "You titter at {them}.",     targetedOthers: "{me} titters at {them}." },
  chortle:  { self: "You chortle.",      others: "{me} chortles.",      targetedSelf: "You chortle at {them}.",    targetedOthers: "{me} chortles at {them}." },
  hum:      { self: "You hum a tune.",   others: "{me} hums a tune.",   targetedSelf: "You hum at {them}.",        targetedOthers: "{me} hums at {them}." },
  whistle:  { self: "You whistle.",      others: "{me} whistles.",      targetedSelf: "You whistle at {them}.",    targetedOthers: "{me} whistles at {them}." },
  sing:     { self: "You sing.",         others: "{me} sings.",         targetedSelf: "You sing to {them}.",       targetedOthers: "{me} sings to {them}." },

  // — grief & weariness —
  cry:      { self: "You cry.",          others: "{me} cries.",         targetedSelf: "You cry on {them}.",        targetedOthers: "{me} cries on {them}." },
  sob:      { self: "You sob.",          others: "{me} sobs.",          targetedSelf: "You sob on {them}.",        targetedOthers: "{me} sobs on {them}." },
  weep:     { self: "You weep.",         others: "{me} weeps.",         targetedSelf: "You weep on {them}.",       targetedOthers: "{me} weeps on {them}." },
  whimper:  { self: "You whimper.",      others: "{me} whimpers.",      targetedSelf: "You whimper at {them}.",    targetedOthers: "{me} whimpers at {them}." },
  sniffle:  { self: "You sniffle.",      others: "{me} sniffles." },
  sigh:     { self: "You sigh.",         others: "{me} sighs.",         targetedSelf: "You sigh at {them}.",       targetedOthers: "{me} sighs at {them}." },
  groan:    { self: "You groan.",        others: "{me} groans.",        targetedSelf: "You groan at {them}.",      targetedOthers: "{me} groans at {them}." },
  moan:     { self: "You moan.",         others: "{me} moans.",         targetedSelf: "You moan at {them}.",       targetedOthers: "{me} moans at {them}." },
  whine:    { self: "You whine.",        others: "{me} whines.",        targetedSelf: "You whine at {them}.",      targetedOthers: "{me} whines at {them}." },
  yawn:     { self: "You yawn.",         others: "{me} yawns.",         targetedSelf: "You yawn at {them}.",       targetedOthers: "{me} yawns at {them}." },
  stretch:  { self: "You stretch.",      others: "{me} stretches." },
  snore:    { self: "You snore.",        others: "{me} snores." },
  drool:    { self: "You drool.",        others: "{me} drools.",        targetedSelf: "You drool over {them}.",    targetedOthers: "{me} drools over {them}." },
  yawnwide: { self: "You yawn widely.",  others: "{me} yawns widely." },

  // — head & eyes —
  blink:    { self: "You blink.",        others: "{me} blinks.",        targetedSelf: "You blink at {them}.",      targetedOthers: "{me} blinks at {them}." },
  wink:     { self: "You wink.",         others: "{me} wink.",          targetedSelf: "You wink at {them}.",       targetedOthers: "{me} winks at {them}." },
  nod:      { self: "You nod.",          others: "{me} nods.",          targetedSelf: "You nod at {them}.",        targetedOthers: "{me} nods at {them}." },
  shake:    { self: "You shake your head.", others: "{me} shakes their head.", targetedSelf: "You shake your head at {them}.", targetedOthers: "{me} shakes their head at {them}." },
  stare:    { self: "You stare.",        others: "{me} stares.",        targetedSelf: "You stare at {them}.",       targetedOthers: "{me} stares at {them}." },
  gaze:     { self: "You gaze.",         others: "{me} gazes.",         targetedSelf: "You gaze at {them}.",        targetedOthers: "{me} gazes at {them}." },
  peer:     { self: "You peer about.",   others: "{me} peers about.",   targetedSelf: "You peer at {them}.",        targetedOthers: "{me} peers at {them}." },
  squint:   { self: "You squint.",       others: "{me} squints.",       targetedSelf: "You squint at {them}.",      targetedOthers: "{me} squints at {them}." },
  glance:   { self: "You glance about.", others: "{me} glances about.", targetedSelf: "You glance at {them}.",      targetedOthers: "{me} glances at {them}." },
  ogle:     { self: "You ogle.",         others: "{me} ogles.",         targetedSelf: "You ogle {them}.",           targetedOthers: "{me} ogles {them}." },
  eye:      { self: "You eye the scene.", others: "{me} eyes the scene.", targetedSelf: "You eye {them}.",          targetedOthers: "{me} eyes {them}." },
  roll:     { self: "You roll your eyes.", others: "{me} rolls their eyes.", targetedSelf: "You roll your eyes at {them}.", targetedOthers: "{me} rolls their eyes at {them}." },
  blush:    { self: "You blush.",        others: "{me} blushes.",       targetedSelf: "You blush at {them}.",       targetedOthers: "{me} blushes at {them}." },

  // — greetings & gestures —
  wave:     { self: "You wave.",         others: "{me} waves.",         targetedSelf: "You wave at {them}.",        targetedOthers: "{me} waves at {them}." },
  greet:    { self: "You greet everyone.", others: "{me} greets everyone.", targetedSelf: "You greet {them}.",      targetedOthers: "{me} greets {them}." },
  farewell: { self: "You wave farewell.", others: "{me} waves farewell.", targetedSelf: "You wave farewell to {them}.", targetedOthers: "{me} waves farewell to {them}." },
  bow:      { self: "You bow.",          others: "{me} bows.",          targetedSelf: "You bow to {them}.",         targetedOthers: "{me} bows to {them}." },
  curtsey:  { self: "You curtsey.",      others: "{me} curtseys.",      targetedSelf: "You curtsey to {them}.",     targetedOthers: "{me} curtseys to {them}." },
  salute:   { self: "You salute.",       others: "{me} salutes.",       targetedSelf: "You salute {them}.",         targetedOthers: "{me} salutes {them}." },
  shrug:    { self: "You shrug.",        others: "{me} shrugs.",        targetedSelf: "You shrug at {them}.",        targetedOthers: "{me} shrugs at {them}." },
  beckon:   { self: "You beckon.",       others: "{me} beckons.",       targetedSelf: "You beckon to {them}.",      targetedOthers: "{me} beckons to {them}." },
  point:    { self: "You point.",        others: "{me} points.",        targetedSelf: "You point at {them}.",        targetedOthers: "{me} points at {them}." },
  thumbsup: { self: "You give a thumbs up.", others: "{me} gives a thumbs up.", targetedSelf: "You give {them} a thumbs up.", targetedOthers: "{me} gives {them} a thumbs up." },

  // — contact (targeted-only) —
  nudge:    { targeted: true, targetedSelf: "You nudge {them}.",        targetedOthers: "{me} nudges {them}." },
  poke:     { targeted: true, targetedSelf: "You poke {them}.",         targetedOthers: "{me} pokes {them}." },
  prod:     { targeted: true, targetedSelf: "You prod {them}.",         targetedOthers: "{me} prods {them}." },
  slap:     { targeted: true, targetedSelf: "You slap {them}.",         targetedOthers: "{me} slaps {them}." },
  punch:    { targeted: true, targetedSelf: "You punch {them}.",        targetedOthers: "{me} punches {them}." },
  hug:      { targeted: true, targetedSelf: "You hug {them}.",          targetedOthers: "{me} hugs {them}." },
  cuddle:   { targeted: true, targetedSelf: "You cuddle {them}.",       targetedOthers: "{me} cuddles {them}." },
  kiss:     { targeted: true, targetedSelf: "You kiss {them}.",         targetedOthers: "{me} kisses {them}." },
  pat:      { targeted: true, targetedSelf: "You pat {them}.",          targetedOthers: "{me} pats {them}." },
  tickle:   { targeted: true, targetedSelf: "You tickle {them}.",       targetedOthers: "{me} tickles {them}." },
  pet:      { targeted: true, targetedSelf: "You pet {them}.",          targetedOthers: "{me} pets {them}." },
  comfort:  { targeted: true, targetedSelf: "You comfort {them}.",      targetedOthers: "{me} comforts {them}." },
  console:  { targeted: true, targetedSelf: "You console {them}.",      targetedOthers: "{me} consoles {them}." },
  headbutt: { targeted: true, targetedSelf: "You headbutt {them}.",     targetedOthers: "{me} headbutts {them}." },
  highfive: { targeted: true, targetedSelf: "You high-five {them}.",    targetedOthers: "{me} high-fives {them}." },
  fistbump: { targeted: true, targetedSelf: "You fist-bump {them}.",    targetedOthers: "{me} fist-bumps {them}." },
  shove:    { targeted: true, targetedSelf: "You shove {them}.",        targetedOthers: "{me} shoves {them}." },
  pinch:    { targeted: true, targetedSelf: "You pinch {them}.",        targetedOthers: "{me} pinches {them}." },
  squeeze:  { targeted: true, targetedSelf: "You squeeze {them}.",      targetedOthers: "{me} squeezes {them}." },
  tackle:   { targeted: true, targetedSelf: "You tackle {them}.",       targetedOthers: "{me} tackles {them}." },
  embrace:  { targeted: true, targetedSelf: "You embrace {them}.",      targetedOthers: "{me} embraces {them}." },
  smooch:   { targeted: true, targetedSelf: "You smooch {them}.",       targetedOthers: "{me} smooches {them}." },
  ruffle:   { targeted: true, targetedSelf: "You ruffle {them}'s hair.", targetedOthers: "{me} ruffles {them}'s hair." },
  noogie:   { targeted: true, targetedSelf: "You give {them} a noogie.", targetedOthers: "{me} gives {them} a noogie." },
  whap:     { targeted: true, targetedSelf: "You whap {them}.",         targetedOthers: "{me} whaps {them}." },
  bonk:     { targeted: true, targetedSelf: "You bonk {them}.",         targetedOthers: "{me} bonks {them}." },
  boop:     { targeted: true, targetedSelf: "You boop {them}'s nose.",  targetedOthers: "{me} boops {them}'s nose." },
  glomp:    { targeted: true, targetedSelf: "You glomp {them}.",        targetedOthers: "{me} glomps {them}." },

  // — celebration & motion —
  cheer:    { self: "You cheer.",        others: "{me} cheers.",        targetedSelf: "You cheer for {them}.",      targetedOthers: "{me} cheers for {them}." },
  applaud:  { self: "You applaud.",      others: "{me} applauds.",      targetedSelf: "You applaud {them}.",        targetedOthers: "{me} applauds {them}." },
  clap:     { self: "You clap.",         others: "{me} claps.",         targetedSelf: "You clap for {them}.",       targetedOthers: "{me} claps for {them}." },
  dance:    { self: "You dance.",        others: "{me} dances.",        targetedSelf: "You dance with {them}.",     targetedOthers: "{me} dances with {them}." },
  bounce:   { self: "You bounce.",       others: "{me} bounces.",       targetedSelf: "You bounce around {them}.",  targetedOthers: "{me} bounces around {them}." },
  skip:     { self: "You skip about.",   others: "{me} skips about.",   targetedSelf: "You skip up to {them}.",     targetedOthers: "{me} skips up to {them}." },
  twirl:    { self: "You twirl.",        others: "{me} twirls." },
  jump:     { self: "You jump.",         others: "{me} jumps." },
  hop:      { self: "You hop.",          others: "{me} hops." },
  spin:     { self: "You spin around.",  others: "{me} spins around." },
  flail:    { self: "You flail about.",  others: "{me} flails about." },
  flex:     { self: "You flex.",         others: "{me} flexes.",        targetedSelf: "You flex at {them}.",        targetedOthers: "{me} flexes at {them}." },
  strut:    { self: "You strut.",        others: "{me} struts." },
  swagger:  { self: "You swagger.",      others: "{me} swaggers." },
  stagger:  { self: "You stagger.",      others: "{me} staggers." },
  sway:     { self: "You sway.",         others: "{me} sways." },
  stomp:    { self: "You stomp.",        others: "{me} stomps.",        targetedSelf: "You stomp toward {them}.",   targetedOthers: "{me} stomps toward {them}." },
  pace:     { self: "You pace.",         others: "{me} paces." },

  // — fear & reaction —
  gasp:     { self: "You gasp.",         others: "{me} gasps.",         targetedSelf: "You gasp at {them}.",        targetedOthers: "{me} gasps at {them}." },
  shiver:   { self: "You shiver.",       others: "{me} shivers." },
  shudder:  { self: "You shudder.",      others: "{me} shudders." },
  tremble:  { self: "You tremble.",      others: "{me} trembles." },
  flinch:   { self: "You flinch.",       others: "{me} flinches.",      targetedSelf: "You flinch from {them}.",    targetedOthers: "{me} flinches from {them}." },
  cringe:   { self: "You cringe.",       others: "{me} cringes.",       targetedSelf: "You cringe at {them}.",      targetedOthers: "{me} cringes at {them}." },
  cower:    { self: "You cower.",        others: "{me} cowers.",        targetedSelf: "You cower before {them}.",   targetedOthers: "{me} cowers before {them}." },
  recoil:   { self: "You recoil.",       others: "{me} recoils.",       targetedSelf: "You recoil from {them}.",    targetedOthers: "{me} recoils from {them}." },
  jolt:     { self: "You jolt.",         others: "{me} jolts." },
  startle:  { self: "You startle.",      others: "{me} startles." },

  // — thought —
  ponder:   { self: "You ponder.",       others: "{me} ponders.",       targetedSelf: "You ponder {them}.",         targetedOthers: "{me} ponders {them}." },
  think:    { self: "You think.",        others: "{me} thinks.",        targetedSelf: "You think about {them}.",    targetedOthers: "{me} thinks about {them}." },
  muse:     { self: "You muse.",         others: "{me} muses." },
  nodknow:  { self: "You nod knowingly.", others: "{me} nods knowingly." },
  facepalm: { self: "You facepalm.",     others: "{me} facepalms.",     targetedSelf: "You facepalm at {them}.",    targetedOthers: "{me} facepalms at {them}." },
  headscratch: { self: "You scratch your head.", others: "{me} scratches their head." },
  contemplate: { self: "You contemplate.", others: "{me} contemplates." },
  daydream: { self: "You daydream.",     others: "{me} daydreams." },

  // — humility & deference —
  grovel:   { self: "You grovel.",       others: "{me} grovels.",       targetedSelf: "You grovel before {them}.",  targetedOthers: "{me} grovels before {them}." },
  kneel:    { self: "You kneel.",        others: "{me} kneels.",        targetedSelf: "You kneel before {them}.",   targetedOthers: "{me} kneels before {them}." },
  bow2:     { self: "You bow low.",      others: "{me} bows low.",      targetedSelf: "You bow low to {them}.",     targetedOthers: "{me} bows low to {them}." },
  cringe2:  { self: "You cringe meekly.", others: "{me} cringes meekly." },
  apologize: { self: "You apologize.",   others: "{me} apologizes.",    targetedSelf: "You apologize to {them}.",   targetedOthers: "{me} apologizes to {them}." },
  thank:    { self: "You give thanks.",  others: "{me} gives thanks.",  targetedSelf: "You thank {them}.",          targetedOthers: "{me} thanks {them}." },
  praise:   { self: "You offer praise.", others: "{me} offers praise.", targetedSelf: "You praise {them}.",         targetedOthers: "{me} praises {them}." },

  // — misc —
  sulk:     { self: "You sulk.",         others: "{me} sulks." },
  brood:    { self: "You brood.",        others: "{me} broods." },
  fidget:   { self: "You fidget.",       others: "{me} fidgets." },
  fume:     { self: "You fume.",         others: "{me} fumes.",         targetedSelf: "You fume at {them}.",        targetedOthers: "{me} fumes at {them}." },
  scoff:    { self: "You scoff.",        others: "{me} scoffs.",        targetedSelf: "You scoff at {them}.",       targetedOthers: "{me} scoffs at {them}." },
  snort:    { self: "You snort.",        others: "{me} snorts.",        targetedSelf: "You snort at {them}.",       targetedOthers: "{me} snorts at {them}." },
  huff:     { self: "You huff.",         others: "{me} huffs.",         targetedSelf: "You huff at {them}.",        targetedOthers: "{me} huffs at {them}." },
  growl:    { self: "You growl.",        others: "{me} growls.",        targetedSelf: "You growl at {them}.",       targetedOthers: "{me} growls at {them}." },
  hiss:     { self: "You hiss.",         others: "{me} hisses.",        targetedSelf: "You hiss at {them}.",        targetedOthers: "{me} hisses at {them}." },
  grumble:  { self: "You grumble.",      others: "{me} grumbles." },
  mutter:   { self: "You mutter.",       others: "{me} mutters.",       targetedSelf: "You mutter at {them}.",      targetedOthers: "{me} mutters at {them}." },
  cough:    { self: "You cough.",        others: "{me} coughs." },
  sneeze:   { self: "You sneeze.",       others: "{me} sneezes." },
  hiccup:   { self: "You hiccup.",       others: "{me} hiccups." },
  burp:     { self: "You burp.",         others: "{me} burps." },
  spit:     { self: "You spit.",         others: "{me} spits." },
  raisebrow:{ self: "You raise an eyebrow.", others: "{me} raises an eyebrow.", targetedSelf: "You raise an eyebrow at {them}.", targetedOthers: "{me} raises an eyebrow at {them}." },
  wave2:    { self: "You wave cheerily.", others: "{me} waves cheerily." },
  nodoff:   { self: "You nod off.",      others: "{me} nods off." },
};

// substitute — fill {me}/{them} placeholders in a template. Pure string work.
function substitute(template, meName, themName) {
  return template.replaceAll("{me}", meName).replaceAll("{them}", themName ?? "");
}

// listSouls — every soul name, sorted, for a deterministic catalogue.
export function listSouls() {
  return Object.keys(SOULS).sort();
}

// hasSoul — is `name` a known social?
export function hasSoul(name) {
  return Object.prototype.hasOwnProperty.call(SOULS, name);
}

// resolve — the pure render of a social into { self, others } sentences. Untargeted use (no
// themName) → self/others. Targeted use (themName given) → the targeted templates if present,
// else fall back by appending " at {them}" to the untargeted forms. A targeted-only social used
// untargeted throws (there is nothing to render without a target).
export function resolve(name, meName, themName = null) {
  const s = SOULS[name];
  if (!s) throw new Error(`soul: unknown social "${name}"`);
  if (themName == null) {
    if (s.self == null || s.others == null) {
      throw new Error(`soul: "${name}" requires a target`);
    }
    return { self: substitute(s.self, meName), others: substitute(s.others, meName) };
  }
  const selfT = s.targetedSelf ?? (s.self ? s.self.replace(/\.$/, "") + " at {them}." : null);
  const othersT = s.targetedOthers ?? (s.others ? s.others.replace(/\.$/, "") + " at {them}." : null);
  if (selfT == null || othersT == null) throw new Error(`soul: "${name}" cannot be targeted`);
  return { self: substitute(selfT, meName, themName), others: substitute(othersT, meName, themName) };
}

// emoteId — a deterministic, content-addressed id for an emote. Built from the SAME fields that
// define the social act (actor, soul name, target, tick), so a replay of the identical act mints
// the identical entity. `emote:` prefix marks it an emote entity.
function emoteId({ actor, name, target, t }) {
  const id = rowId({ e: actor, a: `souling:${name}:${target ?? ""}`, v: name, t });
  return `emote:${id.slice("row:".length)}`;
}

// nameOf — a display name for an id: its latest functional `naming` value, else the id itself.
async function nameOf(root, id) {
  let best = null;
  for (const r of await rowsFor(root, id)) {
    if (r.e !== id || r.a !== "naming" || r.v === null) continue;
    if (best === null || r.t > best.t) best = r;
  }
  return best ? best.v : id;
}

// emit — append the cells that constitute an emote entity. AMBIENT: no `agent`, so the rows are
// un-attributed and land in every co-located frontier. `located-in` is relational, so the
// substrate dual-files it at the room — making the emote a LOCAL read of the room, perceived
// like an utterance.
async function emit({ root, emote, actor, text, target, room, t }) {
  await doing({ root, subject: emote, predicate: "kind", object: "emote", t });
  await doing({ root, subject: emote, predicate: "emoting-by", object: actor, t });
  await doing({ root, subject: emote, predicate: "emote-text", object: text, t });
  if (target != null) await doing({ root, subject: emote, predicate: "emote-target", object: target, t });
  await doing({ root, subject: emote, predicate: "located-in", object: room, t });
}

// soul — enact a social. Files the ambient emote entity into the actor's room (so co-located
// actors perceive it) and returns the rendered self/others sentences plus heardBy.
export default async function soul({ root, actor, name, target = null, t, opts = {} } = {}) {
  if (!root || !actor || name == null || t == null) {
    throw new TypeError("soul: root, actor, name, t are required");
  }
  if (!hasSoul(name)) throw new Error(`soul: unknown social "${name}"`);
  const room = await locationOf(root, actor);
  if (room == null) throw new Error(`soul: ${actor} is nowhere — has no room to emote into`);

  const meName = opts.actorName ?? (await nameOf(root, actor));
  const themName = target == null ? null : (opts.targetName ?? (await nameOf(root, target)));
  const { self, others } = resolve(name, meName, themName);

  const emote = emoteId({ actor, name, target, t });
  await emit({ root, emote, actor, text: others, target, room, t });

  // heardBy: every actor co-located in the room, minus the actor (who already knows) and the
  // emote entity itself — exactly the say.mjs heardBy shape.
  const heardBy = (await containedBy(root, room)).filter((s) => s !== actor && s !== emote);
  return { emote, self, others, heardBy };
}

// CLI guard — `node soul.mjs <root> <actor> <name> [target]` emotes into the actor's room.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, actor, name, target] = process.argv.slice(2);
  if (!root || !actor || !name) {
    console.error("usage: node soul.mjs <root> <actor> <name> [target]");
    process.exit(1);
  }
  const t = `cli:${Date.now().toString(36)}`;
  soul({ root, actor, name, target: target ?? null, t }).then(({ emote, self, others, heardBy }) => {
    console.log(JSON.stringify({ emote, self, others, heardBy }, null, 2));
  });
}
