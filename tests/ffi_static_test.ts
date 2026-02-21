import "../mod.ts";
import { assertEquals, assertExists } from "@std/assert";

Deno.test("FFI - static symbol with type notation", () => {
  // Skip on Windows - no libc.so/dylib
  if (Deno.build.os === "windows") {
    console.warn("Skipping FFI static symbol test on Windows");
    return;
  }

  const libName = Deno.build.os === "darwin" ? "libc.dylib" : "libc.so.6";

  let lib;
  try {
    // `stderr` is a well-known global variable (FILE*) exported by libc on all POSIX systems.
    // Using { type: "pointer" } tells dlopen this is a static/global variable, not a function.
    lib = Deno.dlopen(libName, {
      "stderr": { type: "pointer" },
    });
  } catch (e) {
    if (
      (e as Error).message.includes("koffi") &&
      // deno-lint-ignore no-explicit-any
      typeof (globalThis as any).process !== "undefined"
    ) {
      console.warn(
        "Skipping FFI static symbol test: koffi not installed in Node.js",
      );
      return;
    }
    throw e;
  }

  try {
    // The symbol should be accessible and non-null (stderr is always initialized)
    const stderrPtr = lib.symbols.stderr;
    assertExists(stderrPtr, "stderr static symbol should exist");
  } finally {
    lib.close();
  }
});

Deno.test("FFI - static symbol with name alias", () => {
  // Skip on Windows
  if (Deno.build.os === "windows") {
    console.warn("Skipping FFI static symbol alias test on Windows");
    return;
  }

  const libName = Deno.build.os === "darwin" ? "libc.dylib" : "libc.so.6";

  let lib;
  try {
    // Use `name` to alias the symbol: the JS key is `my_stderr` but
    // the actual native symbol looked up is `stderr`.
    lib = Deno.dlopen(libName, {
      "my_stderr": { name: "stderr", type: "pointer" },
    });
  } catch (e) {
    if (
      (e as Error).message.includes("koffi") &&
      // deno-lint-ignore no-explicit-any
      typeof (globalThis as any).process !== "undefined"
    ) {
      console.warn(
        "Skipping FFI static symbol alias test: koffi not installed in Node.js",
      );
      return;
    }
    throw e;
  }

  try {
    const stderrPtr = lib.symbols.my_stderr;
    assertExists(stderrPtr, "aliased stderr static symbol should exist");
  } finally {
    lib.close();
  }
});

Deno.test("FFI - optional static symbol that does not exist", () => {
  // Skip on Windows
  if (Deno.build.os === "windows") {
    console.warn("Skipping FFI optional static symbol test on Windows");
    return;
  }

  const libName = Deno.build.os === "darwin" ? "libc.dylib" : "libc.so.6";

  let lib;
  try {
    lib = Deno.dlopen(libName, {
      "getpid": { parameters: [], result: "i32" },
      "nonexistent_global_var_xyz": {
        type: "pointer",
        optional: true,
      },
    });
  } catch (e) {
    if (
      (e as Error).message.includes("koffi") &&
      // deno-lint-ignore no-explicit-any
      typeof (globalThis as any).process !== "undefined"
    ) {
      console.warn(
        "Skipping FFI optional static symbol test: koffi not installed in Node.js",
      );
      return;
    }
    throw e;
  }

  try {
    // The real function should work
    const pid = lib.symbols.getpid();
    assertExists(pid);

    // The optional nonexistent static symbol should be null/undefined
    const val = lib.symbols.nonexistent_global_var_xyz;
    assertEquals(
      val == null,
      true,
      `Expected nonexistent static symbol to be null or undefined, got ${val}`,
    );
  } finally {
    lib.close();
  }
});

Deno.test("FFI - function symbol with name alias", () => {
  // Skip on Windows
  if (Deno.build.os === "windows") {
    console.warn("Skipping FFI function name alias test on Windows");
    return;
  }

  const libName = Deno.build.os === "darwin" ? "libc.dylib" : "libc.so.6";

  let lib;
  try {
    // Use `name` on a function symbol: JS key is `pid` but actual
    // native symbol is `getpid`.
    lib = Deno.dlopen(libName, {
      "pid": { name: "getpid", parameters: [], result: "i32" },
    });
  } catch (e) {
    if (
      (e as Error).message.includes("koffi") &&
      // deno-lint-ignore no-explicit-any
      typeof (globalThis as any).process !== "undefined"
    ) {
      console.warn(
        "Skipping FFI function name alias test: koffi not installed in Node.js",
      );
      return;
    }
    throw e;
  }

  try {
    // Should be callable via the alias name
    const result = lib.symbols.pid();
    assertExists(result);

    // deno-lint-ignore no-explicit-any
    if (typeof (globalThis as any).process !== "undefined") {
      // deno-lint-ignore no-explicit-any
      assertEquals(result, (globalThis as any).process.pid);
    }
  } finally {
    lib.close();
  }
});
