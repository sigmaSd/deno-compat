import "../mod.ts";
import { assertEquals, assertExists } from "@std/assert";

Deno.test("FFI - getpid and hostname", () => {
  const libName = Deno.build.os === "darwin" ? "libc.dylib" : "libc.so.6";

  let lib;
  try {
    lib = Deno.dlopen(libName, {
      "getpid": { parameters: [], result: "i32" },
      "gethostname": { parameters: ["buffer", "u32"], result: "i32" },
    });
  } catch (e) {
    if (
      (e as Error).message.includes("koffi") &&
      // deno-lint-ignore no-explicit-any
      typeof (globalThis as any).process !== "undefined"
    ) {
      console.warn("Skipping FFI test: koffi not installed in Node.js");
      return;
    }
    throw e;
  }

  try {
    const pid = lib.symbols.getpid();
    assertExists(pid);

    // deno-lint-ignore no-explicit-any
    if (typeof (globalThis as any).process !== "undefined") {
      // deno-lint-ignore no-explicit-any
      assertEquals(pid, (globalThis as any).process.pid);
    }

    const buffer = new Uint8Array(64);
    const res = lib.symbols.gethostname(buffer, buffer.length);
    assertEquals(res, 0);

    const view = new Deno.UnsafePointerView(Deno.UnsafePointer.of(buffer));
    const hostname = view.getCString();
    assertExists(hostname);
  } finally {
    lib.close();
  }
});
