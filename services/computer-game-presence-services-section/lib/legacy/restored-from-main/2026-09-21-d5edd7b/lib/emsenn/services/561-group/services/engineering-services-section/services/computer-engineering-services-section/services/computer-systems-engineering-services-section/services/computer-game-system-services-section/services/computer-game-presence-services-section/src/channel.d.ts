export type ChannelRegistry = Record<string, string[]>;

export function createChannelRegistry(): ChannelRegistry;
export function subscribe(registry: ChannelRegistry, channelName: string, key: string): ChannelRegistry;
export function unsubscribeAll(registry: ChannelRegistry, key: string): ChannelRegistry;
export function unsubscribe(registry: ChannelRegistry, channelName: string, key: string): ChannelRegistry;
export function membersOf(registry: ChannelRegistry, channelName: string): string[];
