/**
 * The shared Cast agent's Go policy port. Characters are stable actor data;
 * actual legal moves are selected by the source-owned Weiqi engine, never a
 * duplicate Game or browser-supplied fake board. Identity and CAS revision
 * come from an authenticated match observer; timing is owned by Cast runner.
 */
import * as go from "@red-cup-engineering/weiqi-engine";

export const WEIQI_CAST_TIERS = Object.freeze(go.BOT_TIERS.map(t=>t.id));

export function createWeiqiCastPolicy({tierId,playouts}={}) {
  const tier=go.BOT_TIERS.find(t=>t.id===tierId);
  if(!tier)throw new RangeError("Unknown Go opponent policy: "+String(tierId));
  if(playouts!==undefined && (!Number.isSafeInteger(playouts)||playouts<1||playouts>2000))
    throw new RangeError("Go search playouts must be an integer 1-2000");
  if(playouts!==undefined&&tierId!=="montecarlo")
    throw new TypeError("Only the Monte Carlo policy accepts a search budget");
  return (state,persona,rng)=>{
    if(typeof persona?.id!=="string"||persona.id.length===0)throw new TypeError("Cast agent identity required");
    if(state?.personaId!==undefined&&state.personaId!==persona.id)
      throw new TypeError("Cast observer belongs to another character");
    const match=state?.match;
    const session=match?.session??state?.session;
    const principal=state?.principal;
    const revision=match?.revision??state?.revision;
    if(!session?.commands||!session?.state)throw new TypeError("Accepted Go session required");
    if(!Number.isSafeInteger(revision)||revision<0)throw new TypeError("Current accepted match revision required");
    if(typeof principal!=="string"||principal.length===0)throw new TypeError("Authenticated actor principal required");
    if(match&&principal!==match.players?.black&&principal!==match.players?.white)
      throw new TypeError("Principal does not own a seat in the accepted match");
    if(session.state.result!==null)return Object.freeze({action:"walk-away",reason:"game-ended"});
    if(session.state.passStreak>=2)return Object.freeze({action:"walk-away",reason:"requires-settlement-agreement"});
    const game=go.materializeWeiqiGame(session);
    const color=match?(principal===match.players.black?go.BLACK:go.WHITE):state.color;
    if(color!==go.BLACK&&color!==go.WHITE)throw new TypeError("Accepted actor color required");
    if(color!==game.current.toMove)throw new TypeError("Cast cannot move out of turn");
    if(typeof rng?.next!=="function")throw new TypeError("Cast seeded RNG required");
    const move=tier.chooser(game,go,()=>rng.next(),playouts===undefined?{}:{playouts});
    if(move!=="pass"&&!game.isLegal(move))throw new TypeError("Go policy returned an illegal move");
    const command=Object.freeze(move==="pass"?{kind:"pass"}:{kind:"play",move});
    return Object.freeze({action:command.kind,command,principal,expectedRevision:revision,
      idempotencyKey:persona.id+":"+principal+":"+revision,personaId:persona.id,policy:tier.id});
  };
}
export function toWeiqiIntent(decision) {
  if(!["play","pass"].includes(decision?.action)||decision?.command?.kind!==decision.action)
    throw new TypeError("Only real accepted-shape play/pass commands can be sent");
  return Object.freeze({principal:decision.principal,idempotencyKey:decision.idempotencyKey,
    expectedRevision:decision.expectedRevision,command:decision.command});
}
