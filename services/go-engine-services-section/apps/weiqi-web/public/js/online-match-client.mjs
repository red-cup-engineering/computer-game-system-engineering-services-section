// Browser-side protocol binding: it never imports or evaluates game rules.
// Every displayed position comes from the match service's replay checkpoint.
export function onlineMatchUrl({ matchId, principal, capability, color }, base = location.href) {
  const url = new URL("online.html", base);
  url.hash = new URLSearchParams({ matchId, principal, capability, color }).toString();
  return url.href;
}

export function commandRequest({ principal, capability, version, command, idempotencyKey }) {
  return Object.freeze({
    headers: Object.freeze({ authorization: `Bearer ${capability}`, "content-type": "application/json" }),
    body: Object.freeze({ principal, expectedVersion: version, command, idempotencyKey }),
  });
}

export function serverView(response, color) {
  const session = response?.session;
  if (!response?.ok || !session || !["black", "white"].includes(color)) return null;
  const finished = session.state.mainPhaseEnded === true;
  return Object.freeze({
    session,
    finished,
    result: finished ? response.result ?? null : null,
    yourTurn: !finished && session.state.toMove === (color === "black" ? 1 : 2),
  });
}

/** One sentence for a finished match, from the server's count; never computed in the browser. */
export function describeResult(result) {
  if (!result) return "Game over: two consecutive passes ended the main phase.";
  return `Game over: ${result.margin}. ${result.mode === "territory" ? "Territory" : "Area"} count with every stone counted as alive: Black ${result.blackScore}, White ${result.whiteScore} (komi ${result.komi}); captures Black ${result.blackPrisoners}, White ${result.whitePrisoners}.`;
}
