// Pure binding from the preserved Weiqi Learn foundation data to this
// receiver's trainer vocabulary.  Rules remain owned by weiqi-engine.
export const FOUNDATION_CATEGORY_FOR_SET = Object.freeze({
  capture: "capture-go-basics",
  "life-and-death": "life-and-death-fundamentals",
  endgame: "endgame-and-scoring",
});

export function foundationProblemForTrainer(problem) {
  const category = FOUNDATION_CATEGORY_FOR_SET[problem.set];
  if (!category) throw new Error(`Unknown foundation tsumego set: ${problem.set}`);
  return Object.freeze({
    ...problem,
    prompt: problem.goal,
    category,
    band: "introductory",
    source: "foundation-curriculum",
  });
}
