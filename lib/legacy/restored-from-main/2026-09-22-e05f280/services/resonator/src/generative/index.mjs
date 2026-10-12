// index.mjs
//
// Barrel for this package's `./generative` export. Not forked: this
// package depends on @red-cup-engineering/music-engineering-services-section
// and re-exports its src/generative/*.mjs modules here, namespaced (several
// share generic names like `generate`/`render` that would collide flat).
// See README's "Absorption note".

export * as random from '@red-cup-engineering/music-engineering-services-section/src/generative/random.mjs';
export * as scale from '@red-cup-engineering/music-engineering-services-section/src/generative/scale.mjs';
export * as melody from '@red-cup-engineering/music-engineering-services-section/src/generative/melody.mjs';
export * as motifGrammar from '@red-cup-engineering/music-engineering-services-section/src/generative/motif-grammar.mjs';
export * as compose from '@red-cup-engineering/music-engineering-services-section/src/generative/compose.mjs';
export * as composeThroat from '@red-cup-engineering/music-engineering-services-section/src/generative/compose-throat.mjs';
export * as cover from '@red-cup-engineering/music-engineering-services-section/src/generative/cover.mjs';
export * as flow from '@red-cup-engineering/music-engineering-services-section/src/generative/flow.mjs';
export * as improvDuo from '@red-cup-engineering/music-engineering-services-section/src/generative/improv-duo.mjs';
export * as instrument from '@red-cup-engineering/music-engineering-services-section/src/generative/instrument.mjs';
export * as lambek from '@red-cup-engineering/music-engineering-services-section/src/generative/lambek.mjs';
export * as regime from '@red-cup-engineering/music-engineering-services-section/src/generative/regime.mjs';
export * as thermo from '@red-cup-engineering/music-engineering-services-section/src/generative/thermo.mjs';
