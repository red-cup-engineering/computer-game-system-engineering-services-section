import { buildBrowserKernel } from "@red-cup-engineering/weiqi-engine/build-browser";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const result = await buildBrowserKernel(fileURLToPath(new URL("../public/js/kernel", import.meta.url)));
// srs.mjs has no imports of its own (see its own provenance header), so
// projecting it for the browser is the same trim-and-copy the kernel
// modules above get — education-platform-service's one scheduler, not a
// second hand-maintained implementation vendored into this app.
const srsSource = fileURLToPath(await import.meta.resolve("@red-cup-engineering/education-platform-service/srs"));
const srsDestination = fileURLToPath(new URL("../public/js/srs.mjs", import.meta.url));
const srsModule = await readFile(srsSource, "utf8");
await writeFile(srsDestination, srsModule.replace(/[ \t]+$/gm, ""));
console.log(`Built and verified ${result.moduleCount} browser kernel modules in ${result.destination}; projected shared SRS to ${srsDestination}`);
