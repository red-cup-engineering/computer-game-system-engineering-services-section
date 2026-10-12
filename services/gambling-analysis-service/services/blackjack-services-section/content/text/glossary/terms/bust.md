---
name: "bust"
aliases:
  - "bust"
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

A bust in [blackjack](../../../../../../README.md) is a hand total above 21, which causes that hand to lose immediately under the standard rules [@thorp1966]. If the player busts, the dealer does not need to finish drawing. If the dealer busts after the player has stood, all remaining player hands that have not already busted win.

The immediacy of bust resolution shapes blackjack strategy. A player deciding whether to hit is not only asking how likely a better total becomes but also how likely the hand ends at once. That makes blackjack a threshold game: each added card is judged against the risk of crossing a hard upper limit, which is why blackjack strategy is organized around thresholds rather than long action sequences [@thorp1966].

## Related terms

- [hard hand](./hard-hand.md) - Hard hands are the most vulnerable to busting because they lack an ace counted as 11.
- [soft hand](./soft-hand.md) - Soft hands can sometimes avoid busting by converting an ace from 11 to 1.
- [upcard](./upcard.md) - The dealer's upcard helps the player decide whether taking bust risk is justified.
