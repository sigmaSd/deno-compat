import { isBun, isNode } from "./src/runtime.ts";

if (isNode) {
  await import("./src/deno-compat-node.ts");
} else if (isBun) {
  await import("./src/deno-compat-bun.ts");
}
