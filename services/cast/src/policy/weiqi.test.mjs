import assert from "node:assert/strict";
import {test} from "node:test";
import * as go from "@red-cup-engineering/weiqi-engine";
import {WEIQI_CAST_TIERS,createWeiqiCastPolicy,toWeiqiIntent,createWeiqiCastReactions} from "./weiqi.mjs";

const persona={id:"wxwq:the-miser"},rng={next:()=>0.37};
const fresh=()=>({principal:persona.id,personaId:persona.id,color:go.BLACK,revision:0,
  session:go.createWeiqiGameSession({size:9,ruleset:"chinese"})});
test("five shared real Go policies are legal, repeatable Cast agent actions",()=>{
  assert.deepEqual(WEIQI_CAST_TIERS,["random","greedy","liberty","influence","montecarlo"]);
  for(const tierId of WEIQI_CAST_TIERS){
    const policy=createWeiqiCastPolicy(tierId==="montecarlo"?{tierId,playouts:5}:{tierId});
    const decision=policy(fresh(),persona,rng);
    assert.deepEqual(decision,policy(fresh(),persona,rng));
    assert.equal(decision.personaId,persona.id);
    assert.equal(decision.expectedRevision,0);
    assert.equal(decision.policy,tierId);
    assert.equal(go.admitWeiqiGameCommand(fresh().session,0,decision.command).ok,true);
    assert.equal(toWeiqiIntent(decision).principal,persona.id);
  }
});
test("no off-turn principal, invented identity or unmanaged compute is accepted",()=>{
  const policy=createWeiqiCastPolicy({tierId:"greedy"});
  assert.throws(()=>policy({...fresh(),color:go.WHITE},persona,rng),/out of turn/);
  assert.throws(()=>policy({...fresh(),personaId:"another"},persona,rng),/another character/);
  assert.throws(()=>policy({...fresh(),revision:undefined},persona,rng),/revision/);
  assert.throws(()=>createWeiqiCastPolicy({tierId:"greedy",playouts:5}),/Only/);
  assert.throws(()=>createWeiqiCastPolicy({tierId:"montecarlo",playouts:0}),/1-2000/);
});
test("two passes requires real count agreement, not an invented terminal result",()=>{
  let session=fresh().session;
  for(let i=0;i<2;i++){
    const r=go.admitWeiqiGameCommand(session,session.version,{kind:"pass"});
    assert.equal(r.ok,true);session=r.session;
  }
  const decision=createWeiqiCastPolicy({tierId:"random"})({...fresh(),revision:2,session},persona,rng);
  assert.deepEqual(decision,{action:"walk-away",reason:"requires-settlement-agreement"});
  assert.throws(()=>toWeiqiIntent(decision),/real accepted-shape/);
});

import {createWeiqiMatch,admitWeiqiMatchCommand} from "@red-cup-engineering/weiqi-engine/match";
import {createRunner} from "../runner.mjs";

function genuineGoCapture() {
  const black = "wxwq:the-miser", white = "player:123";
  let match = createWeiqiMatch({size:9,ruleset:"chinese"},{black,white});
  const moves = ["C3","C4","B4","A1","D4","A2","C5"];
  let lastDecision, lastResult;
  for (const [i,move] of moves.entries()) {
    lastDecision = Object.freeze({action:"play",personaId:black,
      principal:i%2===0?black:white,expectedRevision:match.revision,
      idempotencyKey:"capture:"+i,command:Object.freeze({kind:"play",move})});
    lastResult = admitWeiqiMatchCommand(match,lastDecision,i*1000);
    assert.equal(lastResult.ok,true, "all source moves are admitted by Go");
    match = lastResult.match;
  }
  assert.ok(lastResult.events.some(e=>e.type==="capture"));
  return {lastDecision,lastResult,match};
}

test("Cast only speaks authored Go semantics from an accepted, replay-verified match",()=>{
  const persona = {id:"wxwq:the-miser",name:"The Miser",
    temperament:{chattiness:0.5},
    lines:{capture:["{name}: {stonesCaptured} stones fell at {point}."]}};
  const {lastDecision,lastResult,match}=genuineGoCapture();
  const linked=createWeiqiCastReactions(persona);
  assert.equal(linked.classifyReaction(lastDecision,lastResult),"capture");
  const context=linked.dialogueContext(lastDecision,lastResult);
  assert.equal(context.stonesCaptured,1);
  assert.equal(context.point,"C5");
  assert.equal(context.sourceVersion,7);
  assert.equal(context.sourceRevision,7);
  assert.equal(context.stateHash,match.stateHash);
  const forged={...lastResult,events:[{type:"ko-started",termRef:"invented"}]};
  assert.equal(linked.classifyReaction(lastDecision,forged),"capture",
    "client-supplied event strings are not authority");
  assert.equal(linked.classifyReaction(lastDecision,{...lastResult,duplicate:true}),null);
  assert.equal(linked.classifyReaction({...lastDecision,expectedRevision:4},lastResult),null);
  assert.equal(linked.classifyReaction(lastDecision,{...lastResult,match:{...match,stateHash:"fake"}}),null);
  assert.equal(createWeiqiCastReactions({...persona,lines:{}}).classifyReaction(lastDecision,lastResult),null);
});

test("full Cast runner emits a real Go capture line, never casino idle chatter", async()=>{
  const {lastDecision,lastResult}=genuineGoCapture();
  const persona={id:"wxwq:the-miser",name:"The Miser",voiceTag:"stoic",
    temperament:{chattiness:0.5,patience:0.5,exuberance:0.5},
    lines:{capture:["I counted {stonesCaptured} captured at {point}."]}};
  const reactions=createWeiqiCastReactions(persona);
  let sent=0;
  const transport={
    async connect(){return {id:"authorized-go-seat"};},
    async observe(){return {ended:sent>0};},
    async sendIntent(_,intent) {
      sent++;
      assert.deepEqual(intent,toWeiqiIntent(lastDecision));
      return lastResult;
    },
    async disconnect(){},
  };
  const runner=createRunner({persona,transport,seed:"wxwq:e2e",
    policy:()=>lastDecision,toIntent:toWeiqiIntent,
    ...reactions,idleSituation:null,sleep:async()=>{},now:()=>0});
  const emitted=[];
  for await (const e of runner.events()) emitted.push(e);
  assert.equal(sent,1);
  const speech=emitted.find(e=>e.type==="utterance"&&e.situation==="capture");
  assert.ok(speech,"real engine's capture reaches the authored idol voice");
  assert.equal(speech.text,"I counted 1 captured at C5.");
  assert.equal(speech.context.sourceVersion,7);
  assert.equal(emitted.filter(e=>e.situation==="chat-idle").length,0);
});
