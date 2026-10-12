---
title: Blackjack Overview
description: "Audience: readers familiar with basic [card game](../../../../../../../../card-games-services-section/content/text/glossary/topics/card-games.md) vocabulary and [gambling](../../../../../../../README.md) fundamentals."
date-created: 2026-03-09
tags: []
requires:
- /games/topics/gambling/curricula/gambling-basics.md
- /games/topics/card-games/curricula/card-games-overview.md
references:
  thorp1966:
    authors:
    - Thorp1966
    title: Thorp1966
  shackleford2025blackjackcalculator:
    authors:
    - Shackleford2025blackjackcalculator
    title: Shackleford2025blackjackcalculator
  baldwin1956:
    authors:
    - Baldwin1956
    title: Baldwin1956
  ref1:
    title: "Roger R. Baldwin, Wilbert E. Cantey, Herbert Maisel, and James P. McDermott, The Optimum Strategy in Blackjack"
  ref2:
    title: 'Edward O. Thorp, Beat the Dealer: A Winning Strategy for the Game of Twenty-One'
  ref3:
    title: Michael Shackleford, Blackjack House Edge Calculator
uses-mechanic:
- /games/topics/gambling/gambling-games/blackjack/terms/bust.md
- /games/topics/gambling/gambling-games/blackjack/terms/hard-hand.md
- /games/topics/gambling/gambling-games/blackjack/terms/soft-hand.md
- /games/topics/gambling/gambling-games/blackjack/terms/upcard.md
- /games/topics/gambling/gambling-games/blackjack/terms/double-down.md
- /games/topics/gambling/gambling-games/blackjack/terms/split.md
- /games/topics/gambling/gambling-games/blackjack/terms/surrender.md
- /games/topics/gambling/gambling-games/blackjack/terms/natural-blackjack.md
teaches:
- Blackjack Overview
date-updated: 2026-03-09
type: lesson
authors:
  - openai-chatgpt-5.4-fast
cites:
  - "Roger R. Baldwin, Wilbert E. Cantey, Herbert Maisel, and James P. McDermott, The Optimum Strategy in Blackjack"
  - "Edward O. Thorp, Beat the Dealer: A Winning Strategy for the Game of Twenty-One"
  - "Michael Shackleford, Blackjack House Edge Calculator"
---

Audience: readers familiar with basic [card game](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/card-games-services-section/content/text/glossary/topics/card-games.md) vocabulary and [gambling](../../../../../../../README.md) fundamentals.

Learning goal: explain blackjack's turn structure, the player's main decision points, and the rule changes that most affect expected value.

## Worked example: hard 16 against a dealer 10

Suppose your first two cards are 10 and 6. The dealer's [upcard](../../../glossary/terms/upcard.md) is a 10. You therefore hold a [hard hand](../../../glossary/terms/hard-hand.md) totaling 16 against one of the dealer's strongest visible starting positions.

This is a useful teaching case because almost every option feels bad. If you stand, 16 often loses to the dealer's completed hand. If you hit, many cards cause an immediate [bust](../../../glossary/terms/bust.md). If the table offers [surrender](../../../glossary/terms/surrender.md), basic strategy often prefers surrender here because losing half the wager is better than playing out a weak position with negative expectation. If surrender is not available, basic strategy usually recommends hitting rather than standing, because standing preserves a total that still loses too often [@thorp1966; @shackleford2025blackjackcalculator].

The point of the example is not to memorize one answer in isolation. It is to see how blackjack decisions are comparative. You are not asking "is 16 good?" You are asking "is 16 better than the likely dealer outcomes from a 10 upcard, and which legal action loses least or wins most from this exact state?"

Blackjack is a house-banked card game in which the player tries to beat the dealer without exceeding 21. Number cards count at face value. Face cards count as 10. An ace counts as 1 or 11 depending on which value keeps the hand strongest without causing a [bust](../../../glossary/terms/bust.md). A two-card 21 is a [natural blackjack](../../../glossary/terms/natural-blackjack.md) and is usually paid at a premium, though the size of that premium depends on the ruleset.

The basic hand structure is asymmetric. The player receives two cards face up. The dealer also receives two cards, but only one is exposed at first. That visible card is the dealer's [upcard](../../../glossary/terms/upcard.md). The player acts first and chooses whether to hit for another card, stand on the current total, [double down](../../../glossary/terms/double-down.md) by increasing the wager in exchange for one final card, or [split](../../../glossary/terms/split.md) a pair into two hands when the rules allow it. Some tables also allow [surrender](../../../glossary/terms/surrender.md), which lets the player abandon the hand and lose only part of the [wager](../../../../../../../content/text/glossary/terms/wager.md).

This action order creates blackjack's central tension. If the player busts, the hand ends immediately and the dealer wins without needing to complete their own hand. If the player stands, the dealer resolves the hand by a fixed rule, usually hitting until at least 17. Because the dealer follows procedure rather than strategy, blackjack is not a game of bluffing or opponent modeling in the poker sense. It is a game of repeated threshold decisions against a known policy and incomplete card information.

The most important strategic distinction is between [hard hands](../../../glossary/terms/hard-hand.md) and [soft hands](../../../glossary/terms/soft-hand.md). A soft hand contains an ace that can still count as 11, which makes the hand more flexible because it can absorb one more hit without immediate failure. This is why a soft 17 and a hard 17 are not the same strategic state even though both total 17.

Rule variation matters more in blackjack than many new players expect. A table that pays blackjack at 3:2 is materially different from one that pays 6:5. A dealer who hits soft 17 creates a stronger house position than a dealer who stands on all 17s. The number of decks, the availability of doubling after a split, whether aces can be resplit, and whether late surrender is offered all change the [house edge](../../../../../../gambling-games-services-section/content/text/glossary/terms/house-edge.md) [@shackleford2025blackjackcalculator]. For that reason, "basic strategy" is never one universal chart. It is a family of decision tables tied to specific rules, not a single timeless script [@baldwin1956; @thorp1966].

## Exercises

1. You hold ace-7 against a dealer 9. Is this a [soft hand](../../../glossary/terms/soft-hand.md) or a [hard hand](../../../glossary/terms/hard-hand.md)? What extra flexibility does that classification give you?

<details>
<summary>Answer</summary>

Ace-7 is a soft 18 because the ace can still count as 11 without causing a bust. That means one additional hit does not automatically kill the hand. If the next card is high, the ace can convert to 1 and the hand becomes hard instead of busting.
</details>

2. Why is blackjack strategy organized around the dealer's [upcard](../../../glossary/terms/upcard.md) instead of only around the player's own total?

<details>
<summary>Answer</summary>

The player's decision is always relative to the dealer's likely completion range. A player total that is strong against a dealer 6 can be weak against a dealer ace or 10. The upcard is the key public clue about which dealer outcomes are most likely.
</details>

Check for understanding: why does the dealer's upcard matter so much in blackjack, and why can two tables with the same visible gameplay still have different optimal strategies?

## What comes next

The next step is to compare blackjack with other [gambling games](../../../../../../../README.md), especially through [Gambling Games Overview](../../../../../../gambling-games-services-section/content/text/documents/articles/notes/gambling-games-overview.md), which places it among chance-dominant games with constrained decisions. For the mathematical side of rule variation, continue with [house edge](../../../../../../gambling-games-services-section/content/text/glossary/terms/house-edge.md).
