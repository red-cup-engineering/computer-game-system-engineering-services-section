/**
 * Process transport for FizzOS package-bin scripts.
 *
 * The script law lives in pure document morphisms (`./documents.mjs`): one decoded
 * boundary document in, one decoded boundary document out. This module only binds
 * such a morphism to Node's stdin/stdout process boundary — the bin executable IS the
 * process boundary the host's `servePackageBins` projects over HTTP. No domain logic
 * lives here.
 */
export type BoundaryDocument = string;
export type DocumentMorphism = (document: BoundaryDocument) => BoundaryDocument;

/** Read all of stdin as UTF-8: one complete boundary document. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Run one script document morphism against stdin and write its output. */
export async function runDocumentScript(morphism: DocumentMorphism): Promise<number> {
  process.stdout.write(morphism(await readStdin()));
  return 0;
}
