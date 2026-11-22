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

Deno.test("FFI - optional symbols", () => {
  const libName = Deno.build.os === "darwin" ? "libc.dylib" : "libc.so.6";

  let lib;
  try {
    lib = Deno.dlopen(libName, {
      "getpid": { parameters: [], result: "i32" },
      "non_existent_symbol": { parameters: [], result: "void", optional: true },
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
    assertExists(lib.symbols.getpid);
    const optionalSymbol = lib.symbols.non_existent_symbol;
    if (optionalSymbol !== undefined && optionalSymbol !== null) {
      throw new Error(
        `Expected non_existent_symbol to be null or undefined, got ${optionalSymbol}`,
      );
    }
  } finally {
    lib.close();
  }
});

Deno.test("FFI - read strings and numbers from native memory", () => {
  const libName = Deno.build.os === "darwin" ? "libc.dylib" : "libc.so.6";

  let lib;
  try {
    lib = Deno.dlopen(libName, {
      "malloc": { parameters: ["usize"], result: "pointer" },
      "memcpy": {
        parameters: ["pointer", "buffer", "usize"],
        result: "pointer",
      },
      "free": { parameters: ["pointer"], result: "void" },
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

  // "héllo\0", then u16, i32, f32, f64, u64 and i64 values.
  const bytes = new Uint8Array(40);
  const data = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("héllo\0"));
  data.setUint16(8, 0xbeef, true);
  data.setInt32(12, -123456, true);
  data.setFloat32(16, 1.5, true);
  data.setFloat64(24, -2.25, true);

  const memory = lib.symbols.malloc(BigInt(bytes.length));
  try {
    lib.symbols.memcpy(memory, bytes, BigInt(bytes.length));
    const view = new Deno.UnsafePointerView(memory!);
    assertEquals(view.getCString(), "héllo");
    assertEquals(view.getCString(1), "éllo");
    assertEquals(Deno.UnsafePointerView.getCString(memory!), "héllo");
    assertEquals(view.getUint8(0), 0x68);
    assertEquals(view.getUint16(8), 0xbeef);
    assertEquals(view.getInt32(12), -123456);
    assertEquals(view.getFloat32(16), 1.5);
    assertEquals(view.getFloat64(24), -2.25);
    assertEquals(view.getBigUint64(32), 0n);
  } finally {
    lib.symbols.free(memory);
    lib.close();
  }
});
