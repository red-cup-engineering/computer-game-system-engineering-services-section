// Type declarations for @561-group/cartridge/seed.

export function utcDateString(date: Date): string;
export function dailySeed(gameId: string, date: Date | string, configId?: string): string;
export function clientSuppliedSeed(raw: string): string;
