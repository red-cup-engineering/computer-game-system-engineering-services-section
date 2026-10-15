/**
 * Shared Cast Go-policy port. Go legality comes from Weiqi's original engine,
 * while identity, current match revision and real event authority must come
 * from an independently authenticated, committed effect host at the consumer.
 * A source-consistent JS match supplied to this pure adapter is not itself
 * proof of the principal's authority. Cast runner owns decision pacing.
 */
import * as go from "@red-cup-engineering/weiqi-engine";
import { verifyWeiqiMatch } from "@red-cup-engineering/weiqi-engine/match";

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

/**
 * Bind a locally replay-verified Go match result to Cast's optional dialogue.
 * The performer writes its *own* lines keyed by a real engine event type;
 * Cast never invents an event, declares a result, or implements Go legality.
 * The match verifier checks internal history/checkpoint consistency;
 * only the independently authenticated host can attest who really played.
 * The transport must return admitWeiqiMatchCommand's match+log result,
 * not only client-supplied event strings. A duplicate never speaks twice.
 */
export function createWeiqiCastReactions(persona) {
  if (typeof persona?.id !== "string" || persona.id.length === 0)
    throw new TypeError("Named Cast persona required");
  let cachedDecision = null;
  let cachedResult = null;
  let cachedObservation = null;
  function observed(decision, result) {
    if (decision === cachedDecision && result === cachedResult) return cachedObservation;
    let found = null;
    if (decision?.personaId === persona.id && decision?.action === "play" &&
        result?.ok === true && !result.duplicate && !result.proposed && result.match &&
        Number.isSafeInteger(decision.expectedRevision) && decision.expectedRevision >= 0 &&
        result.match.revision === decision.expectedRevision + 1) {
      const last = result.match.log?.at(-1)?.intent;
      if (last?.kind === "weiqi-command" && last.principal === decision.principal &&
          last.idempotencyKey === decision.idempotencyKey &&
          last.expectedRevision === decision.expectedRevision &&
          last.command?.kind === "play" && last.command.move === decision.command?.move) {
        const verified = verifyWeiqiMatch(result.match);
        if (verified.valid && verified.session.version > 0) {
          const previous = go.createWeiqiGameSession(result.match.config,
            verified.session.commands.slice(0, -1));
          const admitted = go.admitWeiqiGameCommand(previous, previous.version, decision.command);
          if (admitted.ok && admitted.session.version === verified.session.version) {
            const event = admitted.events.find(e => {
              const lines = persona.lines?.[e.type];
              return !e.detail?.selfCapture && Object.hasOwn(persona.lines ?? {}, e.type) &&
                Array.isArray(lines) && lines.length > 0 &&
                lines.every(line => typeof line === "string" && line.trim().length > 0);
            });
            if (event) found = Object.freeze({
              event, stateHash: result.match.stateHash,
              sourceRevision: result.match.revision, sourceVersion: verified.session.version,
              principal: decision.principal,
            });
          }
        }
      }
    }
    cachedDecision = decision;
    cachedResult = result;
    cachedObservation = found;
    return found;
  }
  return Object.freeze({
    classifyReaction: (decision, result) => observed(decision, result)?.event.type ?? null,
    dialogueContext: (decision, result) => {
      const source = observed(decision, result);
      if (!source) return Object.freeze({});
      return Object.freeze({
        termRef: source.event.termRef ?? null,
        eventType: source.event.type,
        point: source.event.detail?.point ?? decision.command.move,
        stonesCaptured: source.event.detail?.stonesCaptured ?? 0,
        sourceVersion: source.sourceVersion, sourceRevision: source.sourceRevision,
        stateHash: source.stateHash, principal: source.principal,
      });
    },
  });
}
