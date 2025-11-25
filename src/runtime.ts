export const runtime: "deno" | "node" | "bun" =
  typeof navigator !== "undefined" && navigator.userAgent
    ? /deno/i.test(navigator.userAgent)
      ? "deno"
      : /bun/i.test(navigator.userAgent)
      ? "bun"
      : "node"
    : "node";

export const isDeno = runtime === "deno";
export const isNode = runtime === "node";
export const isBun = runtime === "bun";
