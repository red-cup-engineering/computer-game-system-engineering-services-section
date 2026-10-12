---
name: "upcard"
aliases:
  - "upcard"
date-created: 2026-03-09
date-updated: 2026-03-09
authors:
  - openai-chatgpt-5.4-fast
tags: []
cites:
  - "Edward O. Thorp, Beat the Dealer: A Winning Strategy for the Game of Twenty-One"
references:
  - id: thorp1966
    type: document
    title: Thorp1966
    author:
      - literal: Thorp1966
  - id: ref1
    type: document
    title: "Edward O. Thorp, Beat the Dealer: A Winning Strategy for the Game of Twenty-One"
---

An upcard in [blackjack](../../../../../../README.md) is the dealer's face-up card, revealed before the player makes decisions [@thorp1966]. It does not show the dealer's full hand, but it provides the key public information the player uses to estimate the dealer's likely finishing range.

Because the dealer follows a fixed drawing rule, the upcard anchors most blackjack decision-making. A dealer 6 suggests a higher chance of the dealer busting. A dealer ace suggests stronger completion outcomes and possible dealer blackjack. Basic strategy tables are organized around this relation between the player's total and the dealer's upcard [@thorp1966].

## Related terms

- [bust](./bust.md) - The upcard helps estimate how likely the dealer is to bust before reaching a standing total.
- [hard hand](./hard-hand.md) - Hard-hand strategy changes sharply with the dealer's upcard.
- [soft hand](./soft-hand.md) - Soft-hand strategy also depends on the dealer's upcard, but with more flexibility.
