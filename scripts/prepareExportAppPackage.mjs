import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staging = path.join(root, "_build", "export-app", "staging");
/** @type {unknown} */
const sourcePackage = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
if (
  typeof sourcePackage !== "object" ||
  sourcePackage === null ||
  !("version" in sourcePackage) ||
  typeof sourcePackage.version !== "string"
) {
  throw new Error("Missing package version");
}

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
for (const directory of ["dist-electron", "dist-export-app"]) {
  fs.cpSync(path.join(root, directory), path.join(staging, directory), {
    recursive: true,
  });
}
fs.writeFileSync(
  path.join(staging, "package.json"),
  JSON.stringify({
    name: "cadernin-exportador",
    desktopName: "cadernin-exportador",
    version: sourcePackage.version,
    description: "Exportador de partituras do cadern.in",
    author: "Sopro de Carnaval",
    type: "module",
    main: "dist-electron/main.js",
  }),
);
