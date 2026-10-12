---
name: "soft hand"
aliases:
  - "soft hand"
date-created: 2026-03-09
date-updated: 2026-03-09
authors:
  - openai-chatgpt-5.4-fast
tags: []
cites:
  - "Edward O. Thorp, Beat the Dealer: A Winning Strategy for the Game of Twenty-One"
  - "Michael Shackleford, Blackjack House Edge Calculator"
references:
  - id: thorp1966
    type: document
    title: Thorp1966
    author:
      - literal: Thorp1966
  - id: shackleford2025blackjackcalculator
    type: document
    title: Shackleford2025blackjackcalculator
    author:
      - literal: Shackleford2025blackjackcalculator
  - id: ref1
    type: document
    title: "Edward O. Thorp, Beat the Dealer: A Winning Strategy for the Game of Twenty-One"
  - id: ref2
    type: document
    title: Michael Shackleford, Blackjack House Edge Calculator
---

A soft hand in [blackjack](../../../../../../README.md) is a hand that contains an ace counted as 11 without causing a [bust](./bust.md) [@thorp1966]. For example, ace-six is a soft 17. If the player takes another card and would otherwise go over 21, the ace can convert from 11 to 1 and the hand becomes hard instead of busting.

Soft hands matter because they are more flexible than [hard hands](./hard-hand.md) with the same visible total. A soft 17 can take another card without immediate failure, while a hard 17 cannot. This flexibility changes optimal decisions about hitting, standing, and doubling, and it is one reason dealer rules about soft 17 affect the [house edge](../../../../../gambling-games-services-section/content/text/glossary/terms/house-edge.md) [@shackleford2025blackjackcalculator].

## Related terms

- [hard hand](./hard-hand.md) - A hard hand lacks the flexibility that defines a soft hand.
- [double down](./double-down.md) - Many blackjack doubling decisions depend on whether the player's total is soft or hard.
- [bust](./bust.md) - A soft hand postpones bust risk by letting the ace convert from 11 to 1.
