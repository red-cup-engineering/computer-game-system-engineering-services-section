import assert from "node:assert/strict";
import {test} from "node:test";
import * as go from "@red-cup-engineering/weiqi-engine";
import {WEIQI_CAST_TIERS,createWeiqiCastPolicy,toWeiqiIntent} from "./weiqi.mjs";

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
