// Type declarations for @red-cup-engineering/footing/gcs-client.

import type { GcsRetryOptions } from './gcs-retry.d.ts';

export interface GoogleApiToken {
  readonly access_token: string;
  readonly expires_in: number;
  readonly token_type?: string;
}

export interface GoogleApiRequestOptions {
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly metadataUrl?: string;
}

export type GcsRequestFn = (url: string, init?: RequestInit) => Promise<Response>;

export function createGoogleApiRequest(opts?: GoogleApiRequestOptions): GcsRequestFn;

export interface GcsClientOptions {
  readonly bucket: string;
  readonly apiBase?: string;
  readonly request?: GcsRequestFn;
  readonly googleApiRequestOptions?: GoogleApiRequestOptions;
  readonly retry?: false | true | GcsRetryOptions;
}

export interface StoredObject {
  readonly text: string;
  readonly generation: string;
}

export type PutObjectResult = { readonly ok: true; readonly generation: string } | { readonly ok: false; readonly status: number };

export interface GcsClient {
  getObject(name: string): Promise<StoredObject | null>;
  putObject(name: string, text: string, ifGenerationMatch: string): Promise<PutObjectResult>;
  objectExists(name: string): Promise<boolean>;
  listObjectNames(prefix: string): Promise<string[]>;
  appendJsonlLine(name: string, line: string): Promise<void>;
  createOnly(name: string, text: string): Promise<boolean>;
}

export function createGcsClient(opts: GcsClientOptions): GcsClient;
