export interface RoomMember {
  conn: unknown;
  [key: string]: unknown;
}

export interface InterestCorrelatedRoom {
  members(): Map<string, RoomMember>;
}

export function interestFor(
  getRoom: () => InterestCorrelatedRoom | null,
): (id: string, subscriberId: unknown) => boolean;
