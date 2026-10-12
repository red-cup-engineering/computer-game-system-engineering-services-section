# Single Command Game Protocol Service

The simplest possible game intent shape for a
[qwzspace](https://registry.561.group/@red-cup-engineering/qwzspace)-based
single-command text game: one free-text command string, capped in length,
riding qwzspace's own intent envelope (`{ kind: "command", args: { command }
}`). Several qwzspace text games need nothing more — verb parsing, affordance
checking, and effects all happen inside the game's own
execute()/capability handlers (feltos), which already refuse unknown verbs
and impossible actions back to the actor — so this layer only shapes the
envelope, it never interprets it.

```js
import { createSingleCommandValidator } from "@red-cup-engineering/single-command-game-protocol-service";
import { createIntentQueue } from "@red-cup-engineering/qwzspace/intent-queue";

const gameValidate = createSingleCommandValidator({ maxCommandLength: 256 });
const queue = createIntentQueue({ validate: gameValidate });
```

`createSingleCommandValidator` returns a `(raw, actorId) => CommandIntent |
null` matching qwzspace's own `intent-queue.mjs` `validate()` contract
directly.
