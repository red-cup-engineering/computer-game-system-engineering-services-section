// telnet.d.ts — hand-written types for src/telnet.mjs, the CLIENT-perspective telnet codec.

export * from "./tab-wire.mjs";

export interface Supports {
  gmcp: boolean;
  msdp: boolean;
  mxp: boolean;
  sga: boolean;
  eor: boolean;
  echo: boolean;
  compress2: boolean;
  localEcho: boolean;
  naws?: boolean;
  ttype?: boolean;
}

export interface ClientTelnetOpts {
  write: (bytes: Buffer) => void;
  naws?: { width: number; height: number };
  ttype?: string;
  accept?: { serverWill?: number[]; serverDo?: number[] };
}

export type Unsubscribe = () => void;

export interface ClientTelnet {
  feed(chunk: Buffer | Uint8Array | string): void;
  onLine(cb: (line: string) => void): Unsubscribe;
  onPrompt(cb: (text: string) => void): Unsubscribe;
  onGMCP(cb: (pkg: string, data: unknown) => void): Unsubscribe;
  onMSDP(cb: (obj: Record<string, unknown>) => void): Unsubscribe;
  onNegotiate(cb: (supports: Supports) => void): Unsubscribe;
  send(text: string): void;
  sendLine(text: string): void;
  sendGMCP(pkg: string, data?: unknown): void;
  sendNAWS(w?: number, h?: number): void;
  supports: Supports;
}

export function clientTelnet(opts: ClientTelnetOpts): ClientTelnet;
export default clientTelnet;
