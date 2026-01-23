// deno-lint-ignore-file no-explicit-any
// deno-compat-bun.ts
/**
 * Deno compatibility layer for Bun
 * Extends Node.js compatibility with Bun-specific FFI features
 */

import { DenoCompat as NodeDenoCompat } from "./deno-compat-node.ts";

if (navigator.userAgent.startsWith("Bun")) {
  const { dlopen, FFIType, CString, ptr, JSCallback } = await import("bun:ffi");

  class BunDenoCompat extends NodeDenoCompat {
    static transformFFIType(denoType: string) {
      switch (denoType) {
        case "void":
          return FFIType.void;
        case "bool":
          return FFIType.bool;
        case "u8":
          return FFIType.u8;
        case "i8":
          return FFIType.i8;
        case "u16":
          return FFIType.u16;
        case "i16":
          return FFIType.i16;
        case "u32":
          return FFIType.u32;
        case "i32":
          return FFIType.i32;
        case "u64":
          return FFIType.u64;
        case "i64":
          return FFIType.i64;
        case "usize":
          return FFIType.u64;
        case "isize":
          return FFIType.i64;
        case "f32":
          return FFIType.f32;
        case "f64":
          return FFIType.f64;
        case "pointer":
        case "buffer":
          return FFIType.ptr;
        case "function":
          return FFIType.function;
        default:
          throw new Error(`FFI type not supported: ${denoType}`);
      }
    }

    static dlopen(path: string, symbols: Record<string, any>) {
      const bunSymbols: Record<string, any> = {};
      const optionalSymbols: Record<string, any> = {};

      for (const name in symbols) {
        const symbol = symbols[name];
        if ("type" in symbol) {
          throw new Error("Symbol type notation not supported");
        }

        const bunSymbol = {
          args: symbol.parameters.map((type: string) =>
            this.transformFFIType(type)
          ),
          returns: this.transformFFIType(symbol.result),
        };

        if (symbol.optional) {
          optionalSymbols[name] = bunSymbol;
        } else {
          bunSymbols[name] = bunSymbol;
        }
      }

      const lib = dlopen(path, bunSymbols);

      // Try to load optional symbols
      for (const name in optionalSymbols) {
        try {
          const optLib = dlopen(path, {
            [name]: optionalSymbols[name],
          });
          (lib.symbols as any)[name] = optLib.symbols[name];
        } catch (_e) {
          // Symbol not found or failed to load, skip it
        }
      }

      return lib;
    }

    static async test(
      nameOrDef: string | ((...args: any[]) => any) | {
        name?: string;
        fn: (...args: any[]) => any;
        ignore?: boolean;
        only?: boolean;
        [key: string]: any;
      },
      fnOrOptions?: ((...args: any[]) => any) | {
        ignore?: boolean;
        only?: boolean;
        [key: string]: any;
      },
      maybeFn?: (...args: any[]) => any,
    ) {
      let testName: string;
      let testFn: (...args: any[]) => any;
      let ignore = false;
      let only = false;

      if (typeof nameOrDef === "function") {
        // Deno.test(fn) - use function name as test name
        testName = nameOrDef.name || "anonymous";
        testFn = nameOrDef;
      } else if (typeof nameOrDef === "object") {
        // Deno.test({ name, fn, ignore, ... })
        testName = nameOrDef.name || "anonymous";
        testFn = nameOrDef.fn;
        ignore = nameOrDef.ignore ?? false;
        only = nameOrDef.only ?? false;
      } else if (typeof fnOrOptions === "function") {
        // Deno.test(name, fn)
        testName = nameOrDef;
        testFn = fnOrOptions;
      } else if (typeof fnOrOptions === "object" && maybeFn) {
        // Deno.test(name, options, fn)
        testName = nameOrDef;
        testFn = maybeFn;
        ignore = fnOrOptions.ignore ?? false;
        only = fnOrOptions.only ?? false;
      } else {
        throw new Error("Invalid Deno.test() arguments");
      }

      try {
        const { test } = await import("bun:test");
        if (ignore) {
          test.skip(testName, testFn as any);
        } else if (only) {
          test.only(testName, testFn as any);
        } else {
          test(testName, testFn as any);
        }
      } catch (e) {
        console.error("Failed to load bun:test", e);
      }
    }

    static UnsafeCallback = class UnsafeCallback {
      inner: any;
      pointer: any;

      constructor(def: any, fn: any) {
        this.inner = new JSCallback(fn, {
          args: def.parameters.map((type: string) =>
            BunDenoCompat.transformFFIType(type)
          ),
          returns: BunDenoCompat.transformFFIType(def.result),
        });
        this.pointer = this.inner.ptr;
      }

      close() {
        this.inner.close();
      }
    };

    static UnsafePointerView = class UnsafePointerView {
      static getCString(pointer: any) {
        return new CString(pointer).toString();
      }

      constructor(public ptr: any) {}

      getCString() {
        return new CString(this.ptr).toString();
      }
    };

    static UnsafePointer = class UnsafePointer {
      static equals(a: any, b: any) {
        return a === b;
      }

      static create(value: bigint | number) {
        return Number(value);
      }

      // @ts-ignore TypedArray exists in Bun
      static of(buffer: ArrayBuffer | TypedArray) {
        return ptr(buffer);
      }

      static value(pointer: any) {
        return pointer;
      }
    };
  }

  // only install if userAgent is Bun
  (globalThis as any).Deno = BunDenoCompat;
}

export {};
