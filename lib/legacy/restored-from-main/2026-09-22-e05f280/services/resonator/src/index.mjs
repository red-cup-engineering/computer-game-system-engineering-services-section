// index.mjs
//
// Root barrel for @red-cup-engineering/resonator: the house audio synthesis
// engine. Namespaced re-exports of every published fiber — consumers wanting
// a single fiber should prefer the subpath exports (`resonator/dsp`,
// `resonator/voice`, `resonator/game`, `resonator/web`, `resonator/generative`)
// which this barrel mirrors one-to-one. Importing this root is safe headless:
// the web fiber's engine is lazy (no AudioContext is constructed until
// ensureStarted/first play) and degrades to a silent no-op without one.

export * as dsp from './dsp/index.mjs';
export * as voice from './voice/voice.mjs';
export * as voicePresets from './voice/presets.mjs';
export * as generative from './generative/index.mjs';
export * as game from './game/index.mjs';
export * as web from './web/webaudio-adapter.mjs';
