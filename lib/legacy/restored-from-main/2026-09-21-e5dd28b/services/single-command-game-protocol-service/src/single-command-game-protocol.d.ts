export const DEFAULT_MAX_COMMAND_LENGTH: 256;

export interface CommandIntent {
  kind: "command";
  args: { command: string };
}

export function createSingleCommandValidator(options?: {
  maxCommandLength?: number;
}): (raw: unknown, actorId: string) => CommandIntent | null;
