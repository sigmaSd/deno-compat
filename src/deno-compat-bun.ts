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
      // Separate symbols into function symbols vs static (type-notation) symbols.
      // Also track which function symbols need name aliasing.
      const bunSymbols: Record<string, any> = {};
      const aliasedSymbols: Record<
        string,
        { nativeName: string; bunSymbol: any; optional: boolean }
      > = {};
      const staticSymbols: Record<
        string,
        { nativeName: string; optional: boolean }
      > = {};

      for (const jsName in symbols) {
        const symbol = symbols[jsName];

        if ("type" in symbol) {
          // ForeignStatic: a global/static variable, not a function.
          // We register it with Bun as a dummy no-arg function so that
          // dlsym resolves the address. We then grab .ptr from the
          // resulting symbol object to get the raw dlsym pointer.
          const nativeName = symbol.name || jsName;
          staticSymbols[jsName] = {
            nativeName,
            optional: symbol.optional ?? false,
          };
          continue;
        }

        // ForeignFunction
        const nativeName = symbol.name || jsName;
        const bunSymbol = {
          args: symbol.parameters.map((type: string) =>
            this.transformFFIType(type)
          ),
          returns: this.transformFFIType(symbol.result),
        };

        if (nativeName !== jsName || symbol.optional) {
          // Must be loaded separately: Bun keys the symbol lookup by
          // the object key, so aliased names need their own dlopen call.
          aliasedSymbols[jsName] = {
            nativeName,
            bunSymbol,
            optional: symbol.optional ?? false,
          };
        } else {
          bunSymbols[jsName] = bunSymbol;
        }
      }

      // Open the library. If there are no direct function symbols we
      // still need a lib object, so open with one of the aliased or
      // static symbols as a dummy.
      let lib: any;
      const hasDirectSymbols = Object.keys(bunSymbols).length > 0;

      if (hasDirectSymbols) {
        lib = dlopen(path, bunSymbols);
      } else {
        // Pick the first aliased function or static symbol to bootstrap
        // the library handle with a single dummy lookup.
        const firstAliased = Object.values(aliasedSymbols)[0];
        const firstStatic = Object.values(staticSymbols)[0];
        const bootstrapName = firstAliased?.nativeName ??
          firstStatic?.nativeName;

        if (!bootstrapName) {
          throw new Error("dlopen requires at least one symbol");
        }

        // Open with a dummy symbol definition just to get a lib handle
        const dummyDef = firstAliased
          ? { [firstAliased.nativeName]: firstAliased.bunSymbol }
          : { [bootstrapName]: { args: [], returns: FFIType.ptr } };

        lib = dlopen(path, dummyDef);

        // If we bootstrapped with an aliased function, store its result
        if (firstAliased) {
          const firstJsName = Object.keys(aliasedSymbols)[0];
          (lib.symbols as any)[firstJsName] =
            lib.symbols[firstAliased.nativeName];
          delete aliasedSymbols[firstJsName];
        }
      }

      // Load aliased and optional function symbols one at a time
      for (const jsName in aliasedSymbols) {
        const { nativeName, bunSymbol, optional } = aliasedSymbols[jsName];
        try {
          const optLib = dlopen(path, {
            [nativeName]: bunSymbol,
          });
          (lib.symbols as any)[jsName] = optLib.symbols[nativeName];
        } catch (_e) {
          if (!optional) {
            throw _e;
          }
          // Optional symbol not found, skip it
        }
      }

      // Resolve static/global variable symbols.
      // We open the symbol as a dummy no-arg function returning ptr,
      // then use .ptr on the result to get the raw dlsym address.
      for (const jsName in staticSymbols) {
        const { nativeName, optional } = staticSymbols[jsName];
        try {
          const symLib = dlopen(path, {
            [nativeName]: { args: [], returns: FFIType.ptr },
          });
          const rawSym = symLib.symbols[nativeName] as any;
          // .ptr is the raw dlsym address of the symbol
          (lib.symbols as any)[jsName] = rawSym.ptr;
        } catch (_e) {
          if (!optional) {
            throw _e;
          }
          // Optional static symbol not found, skip it
        }
      }

      return lib;
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
        // Handle empty buffers - bun's FFI doesn't support empty ArrayBufferViews
        if (buffer.byteLength === 0) {
          // Allocate at least 8 bytes for pointer storage
          return ptr(new Uint8Array(8));
        }
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
