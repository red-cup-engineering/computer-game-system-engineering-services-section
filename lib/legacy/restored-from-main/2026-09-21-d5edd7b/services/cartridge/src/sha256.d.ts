// Type declarations for @561-group/cartridge's internal sha256.mjs.

/** SHA-256 hex digest of the UTF-8 encoding of `str`. Byte-identical to
 *  `createHash('sha256').update(str, 'utf8').digest('hex')` for every input — see
 *  sha256.test.mts. */
export function sha256Hex(str: string): string;
