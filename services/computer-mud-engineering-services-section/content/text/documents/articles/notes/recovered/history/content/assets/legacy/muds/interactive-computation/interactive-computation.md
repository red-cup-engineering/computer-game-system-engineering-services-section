---
name: interactive-computation
description: The CLL fragment of CGS — classical linear logic as game semantics. Interactive computation modeled as two-player strategies (Player = program, Opponent = environment); composition is cut elimination. Session-typed π-calculus embeds here via the Caires-Pfenning correspondence.
component-of: computing
---

# Interactive Computation

The classical linear logic (CLL) fragment of $\mathbf{CGS}$ (Castellan-Clairambault-Winskel). Where ILL recovers Cartesian closed structure (programs that copy and discard), CLL retains the full symmetric monoidal duality of linear logic: every type $A$ has a dual $A^\perp$ (swap Player and Opponent), and computation proceeds by interaction between a program and its environment.

The Hyland-Ong innocent game semantics (sequential strategies) embeds as a full sub-$*$-autonomous subcategory of $\mathbf{CGS}$. The PCF full abstraction theorem (Hyland-Ong 1996) is the tight morphism from the operational semantics of PCF into this fragment. Session-typed π-calculus processes embed via the Caires-Pfenning (2010) propositions-as-sessions correspondence: session type $S$ on a channel corresponds to a CLL proposition; the cut rule (channel communication) corresponds to cut elimination.

The relationship to the typed and untyped theories: typed λ-calculi live in ILL's Kleisli fragment; interactive programs live in CLL directly. Both are substructures of $\mathbf{CGS}$, meeting at the PCF fragment (simultaneously Hyland-Ong fully abstract and Dialectica-realizable).
