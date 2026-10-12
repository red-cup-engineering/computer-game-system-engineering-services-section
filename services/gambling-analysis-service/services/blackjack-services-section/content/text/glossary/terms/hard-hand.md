---
name: "hard hand"
aliases:
  - "hard hand"
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

A hard hand in [blackjack](../../../../../../README.md) is a hand whose total does not include an ace counted as 11 [@thorp1966]. Either the hand has no ace at all, or any ace it contains must count as 1 to avoid a [bust](./bust.md). A 10-6 is a hard 16. Ace-6-10 is also a hard 17, because the ace can no longer remain 11.

Hard hands matter because they have less flexibility than [soft hands](./soft-hand.md). A hard 16 cannot absorb another high card without busting, while a soft 16 can. This is why blackjack strategy distinguishes sharply between hard and soft totals even when the visible number is the same [@thorp1966].

## Related terms

- [soft hand](./soft-hand.md) - Soft hands contrast with hard hands by retaining ace flexibility.
- [bust](./bust.md) - Hard hands face immediate bust risk when they take another card.
- [upcard](./upcard.md) - The dealer's upcard determines whether a hard total should usually hit, stand, or surrender.
