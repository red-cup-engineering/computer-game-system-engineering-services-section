// Type declarations for @red-cup-engineering/footing/dates.

export function formatUTCDate(d: Date): string;
export function isValidDateStr(s: unknown): s is string;
export function addDaysUTC(dateStr: string, days: number): string;
export function todayUTC(): string;
