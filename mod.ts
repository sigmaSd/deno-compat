import "./src/deno-compat-node.ts";

import { isBun } from "./src/runtime.ts";
if (isBun) {
  await import("./src/deno-compat-bun.ts");
}
