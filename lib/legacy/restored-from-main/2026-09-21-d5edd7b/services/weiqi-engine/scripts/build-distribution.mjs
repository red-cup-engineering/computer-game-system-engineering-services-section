import { readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { buildBrowserKernel } from "./build-browser-kernel.mjs";

const distributionDirectory = fileURLToPath(new URL("../dist", import.meta.url));
const result = await buildBrowserKernel(distributionDirectory);

// The Cartridge adapters are intentionally absent from the browser projection:
// they have a package dependency and need a durable replay receiver. They are
// nevertheless public Node package contracts.
for (const name of ["match", "replay"]) {
  const source = await readFile(fileURLToPath(new URL(`../src/${name}.mts`, import.meta.url)), "utf8");
  const output = stripTypeScriptTypes(source, { mode: "strip" })
    .replace(/(from\s+["'](?:\.\.?\/)[^"']*)\.mts(["'])/g, "$1.mjs$2")
    .replace(/[^\S\r\n]+$/gmu, "");
  await writeFile(`${distributionDirectory}/${name}.mjs`, output, "utf8");
}

console.log(`Built and verified ${result.moduleCount} browser modules plus the Cartridge adapters in ${result.destination}`);
