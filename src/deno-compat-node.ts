// deno-lint-ignore-file no-explicit-any
// deno-compat-node.ts
/**
 * Deno compatibility layer for Node.js
 * This module provides Deno APIs implemented using Node.js built-in modules
 * Works in both Node.js and Bun
 */

import process from "node:process";
import os from "node:os";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { spawn as nodeSpawn } from "node:child_process";
import { Buffer } from "node:buffer";
import * as nodeTest from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// keep it as a dynmaic import, so bun doesn't import it
let koffi: any = null;
if (typeof process !== "undefined" && !(process as any).versions?.bun) {
  try {
    // NOTE: this import needs to be synchronus thats why we use requrie
    // it needs to be synchrous because in nodejs and nodejs only the await import can
    // be hoisted after the other static imports which breaks the compat (it needs to be the first import)
    const koffiModule = require("koffi");
    koffi = koffiModule.default || koffiModule;
  } catch (_e) {
    // koffi not available
  }
}

interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

interface FileInfo {
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: Date | null;
  atime: Date | null;
  birthtime: Date | null;
  ctime: Date | null;
}

interface CommandStatus {
  success: boolean;
  code: number;
  signal: string | null;
}

interface CommandOutput {
  success: boolean;
  code: number;
  signal: string | null;
  stdout: Uint8Array;
  stderr: Uint8Array;
}

interface StdinWriter {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  releaseLock(): void;
}

interface StdinWrapper {
  getWriter(): StdinWriter;
}

interface SpawnedProcess {
  stdin: StdinWrapper | null;
  stdout: any;
  stderr: any;
  status: Promise<CommandStatus>;
  output: () => Promise<Uint8Array>;
}

export class DenoCompat {
  // ---------------------
  // Deno.remove compat
  // ---------------------
  static async remove(path: string, options: any = {}) {
    const { recursive = false } = options;

    try {
      await fsPromises.rm(path, { recursive, force: true });
    } catch (err) {
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      if (err.code === "EACCES") throw new DenoCompat.errors.PermissionDenied();
      throw err;
    }
  }

  static removeSync(path: string, options: any = {}) {
    const { recursive = false } = options;

    try {
      fs.rmSync(path, { recursive, force: true });
    } catch (err) {
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      if (err.code === "EACCES") throw new DenoCompat.errors.PermissionDenied();
      throw err;
    }
  }

  // ---------------------
  // Deno.copyFile compat
  // ---------------------
  static async copyFile(fromPath: string, toPath: string) {
    try {
      await fsPromises.copyFile(fromPath, toPath);
    } catch (err) {
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      if (err.code === "EACCES") throw new DenoCompat.errors.PermissionDenied();
      throw err;
    }
  }

  static copyFileSync(fromPath: string, toPath: string) {
    try {
      fs.copyFileSync(fromPath, toPath);
    } catch (err) {
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      if (err.code === "EACCES") throw new DenoCompat.errors.PermissionDenied();
      throw err;
    }
  }

  // ---------------------
  // Deno.lstat compat
  // ---------------------
  static async lstat(path: string): Promise<FileInfo> {
    try {
      const s = await fsPromises.lstat(path);
      return {
        isFile: s.isFile(),
        isDirectory: s.isDirectory(),
        isSymlink: s.isSymbolicLink(),
        size: s.size,
        mtime: s.mtime,
        atime: s.atime,
        birthtime: s.birthtime,
        ctime: s.ctime,
      };
    } catch (err) {
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      if (err.code === "EACCES") throw new DenoCompat.errors.PermissionDenied();
      throw err;
    }
  }

  static lstatSync(path: string): FileInfo {
    try {
      const s = fs.lstatSync(path);
      return {
        isFile: s.isFile(),
        isDirectory: s.isDirectory(),
        isSymlink: s.isSymbolicLink(),
        size: s.size,
        mtime: s.mtime,
        atime: s.atime,
        birthtime: s.birthtime,
        ctime: s.ctime,
      };
    } catch (err) {
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      if (err.code === "EACCES") throw new DenoCompat.errors.PermissionDenied();
      throw err;
    }
  }

  // ---------------------
  // Deno.mkdir compat
  // ---------------------
  static async mkdir(path: string, options: any = {}) {
    const { recursive = false, mode } = options;

    try {
      await fsPromises.mkdir(path, { recursive, mode });
    } catch (err) {
      // Map to Deno-style errors
      if (err.code === "EEXIST") throw new DenoCompat.errors.AlreadyExists();
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      throw err;
    }
  }

  static mkdirSync(path: string, options: any = {}) {
    const { recursive = false, mode } = options;

    try {
      fs.mkdirSync(path, { recursive, mode });
    } catch (err) {
      if (err.code === "EEXIST") throw new DenoCompat.errors.AlreadyExists();
      if (err.code === "ENOENT") throw new DenoCompat.errors.NotFound();
      throw err;
    }
  }

  // ---------------------
  // Deno.makeTempDir compat
  // ---------------------
  static async makeTempDir(options: any = {}): Promise<string> {
    const dir = options.dir ?? os.tmpdir();
    const prefix = options.prefix ?? "";
    const suffix = options.suffix ?? "";

    // Node.js mkdtemp automatically appends 6 random characters to the prefix.
    const tempPath = await fsPromises.mkdtemp(path.join(dir, prefix));

    if (suffix) {
      const finalPath = tempPath + suffix;
      await fsPromises.rename(tempPath, finalPath);
      return finalPath;
    }
    return tempPath;
  }

  static makeTempDirSync(options: any = {}): string {
    const dir = options.dir ?? os.tmpdir();
    const prefix = options.prefix ?? "";
    const suffix = options.suffix ?? "";

    const tempPath = fs.mkdtempSync(path.join(dir, prefix));

    if (suffix) {
      const finalPath = tempPath + suffix;
      fs.renameSync(tempPath, finalPath);
      return finalPath;
    }
    return tempPath;
  }

  // ---------------------
  // Deno.errors compat
  // ---------------------
  static errors: any = {
    PermissionDenied: class PermissionDenied extends Error {
      constructor(msg = "Permission denied") {
        super(msg);
        this.name = "PermissionDenied";
      }
    },
    NotFound: class NotFound extends Error {
      constructor(msg = "Not found") {
        super(msg);
        this.name = "NotFound";
      }
    },
    AlreadyExists: class AlreadyExists extends Error {
      constructor(msg = "Already exists") {
        super(msg);
        this.name = "AlreadyExists";
      }
    },
    InvalidData: class InvalidData extends Error {
      constructor(msg = "Invalid data") {
        super(msg);
        this.name = "InvalidData";
      }
    },
    ConnectionRefused: class ConnectionRefused extends Error {
      constructor(msg = "Connection refused") {
        super(msg);
        this.name = "ConnectionRefused";
      }
    },
    ConnectionReset: class ConnectionReset extends Error {
      constructor(msg = "Connection reset") {
        super(msg);
        this.name = "ConnectionReset";
      }
    },
    BrokenPipe: class BrokenPipe extends Error {
      constructor(msg = "Broken pipe") {
        super(msg);
        this.name = "BrokenPipe";
      }
    },
    NotConnected: class NotConnected extends Error {
      constructor(msg = "Not connected") {
        super(msg);
        this.name = "NotConnected";
      }
    },
    AddrInUse: class AddrInUse extends Error {
      constructor(msg = "Address in use") {
        super(msg);
        this.name = "AddrInUse";
      }
    },
    AddrNotAvailable: class AddrNotAvailable extends Error {
      constructor(msg = "Address not available") {
        super(msg);
        this.name = "AddrNotAvailable";
      }
    },
    TimedOut: class TimedOut extends Error {
      constructor(msg = "Timed out") {
        super(msg);
        this.name = "TimedOut";
      }
    },
    Interrupted: class Interrupted extends Error {
      constructor(msg = "Interrupted") {
        super(msg);
        this.name = "Interrupted";
      }
    },
    BadResource: class BadResource extends Error {
      constructor(msg = "Bad resource") {
        super(msg);
        this.name = "BadResource";
      }
    },
    Http: class Http extends Error {
      constructor(msg = "HTTP error") {
        super(msg);
        this.name = "Http";
      }
    },
  };

  // ---------------------
  // Deno.FsFile compat
  // ---------------------
  static FsFile: any = class {
    #fh;
    constructor(fileHandle) {
      this.#fh = fileHandle;
    }

    static async fromPath(path, mode = "r") {
      const fh = await fsPromises.open(path, mode);
      return new DenoCompat.FsFile(fh);
    }

    async read(p) {
      const { bytesRead } = await this.#fh.read(p, 0, p.length, null);
      return bytesRead === 0 ? null : bytesRead;
    }

    async write(p) {
      const { bytesWritten } = await this.#fh.write(p);
      return bytesWritten;
    }

    async seek(offset, whence) {
      // whence: 0 = start, 1 = current, 2 = end
      if (whence === 0) {
        await this.#fh.seek(offset, 0);
        return offset;
      }
      if (whence === 1) {
        const { offset: cur } = await this.#fh.seek(0, 1);
        const pos = cur + offset;
        await this.#fh.seek(pos, 0);
        return pos;
      }
      if (whence === 2) {
        const stat = await this.#fh.stat();
        const pos = stat.size + offset;
        await this.#fh.seek(pos, 0);
        return pos;
      }
      throw new Error("Invalid whence");
    }

    close() {
      return this.#fh.close();
    }
  };

  static stdin: any = {
    read(buffer: Uint8Array): Promise<number | null> {
      return new Promise<number | null>((resolve) => {
        // Don't use raw mode - let the terminal handle line buffering
        // Resume stdin to make it readable
        process.stdin.resume();

        let bytesRead = 0;

        const onData = (chunk) => {
          const bytesToCopy = Math.min(chunk.length, buffer.length - bytesRead);
          buffer.set(chunk.slice(0, bytesToCopy), bytesRead);
          bytesRead += bytesToCopy;

          // Clean up and resolve
          cleanup();
          resolve(bytesRead);
        };

        const onEnd = () => {
          cleanup();
          resolve(null);
        };

        const cleanup = () => {
          process.stdin.removeListener("data", onData);
          process.stdin.removeListener("end", onEnd);
          process.stdin.pause();
        };

        process.stdin.once("data", onData);
        process.stdin.once("end", onEnd);
      });
    },
  };

  static stderr: any = {
    write(data: Uint8Array): Promise<number> {
      return new Promise<number>((resolve, reject) => {
        process.stderr.write(data, (err) => {
          if (err) reject(err);
          else resolve(data.length);
        });
      });
    },
    writeSync(data: Uint8Array): number {
      process.stderr.write(data);
      return data.length;
    },
  };

  static async readTextFile(path: string): Promise<string> {
    return await fsPromises.readFile(path, "utf8");
  }

  static async writeTextFile(path: string, data: string): Promise<void> {
    await fsPromises.writeFile(path, data, "utf8");
  }

  static async readFile(path: string): Promise<Uint8Array> {
    const data = await fsPromises.readFile(path);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  static async writeFile(path: string, data: Uint8Array): Promise<void> {
    await fsPromises.writeFile(path, data);
  }

  static async *readDir(path: string): AsyncGenerator<DirEntry, void, unknown> {
    const entries = await fsPromises.readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      yield {
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        isSymlink: entry.isSymbolicLink(),
      };
    }
  }

  static async stat(path: string): Promise<FileInfo> {
    const s = await fsPromises.stat(path);

    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      isSymlink: s.isSymbolicLink(),
      size: s.size,
      mtime: s.mtime,
      atime: s.atime,
      birthtime: s.birthtime,
      ctime: s.ctime,
    };
  }

  static args: string[] = process.argv.slice(2);

  static env: any = {
    get(name) {
      return process.env[name];
    },
    set(name, value) {
      process.env[name] = value;
    },
    delete(name) {
      delete process.env[name];
    },
    has(name) {
      return Object.prototype.hasOwnProperty.call(process.env, name);
    },
    toObject() {
      // Return a shallow copy like Deno does
      return { ...process.env };
    },
  };

  static build: { os: string } = {
    os: (() => {
      const osT = os.type().toLowerCase();
      if (osT === "linux") return "linux";
      if (osT === "darwin") return "darwin";
      if (osT === "windows_nt") return "windows";
      return osT;
    })(),
  };

  static exit(code?: number): void {
    process.exit(code);
  }

  static cwd(): string {
    return process.cwd();
  }

  static test(
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

    if (ignore) {
      nodeTest.test(testName, { skip: true }, testFn as any);
    } else if (only) {
      nodeTest.test(testName, { only: true }, testFn as any);
    } else {
      nodeTest.test(testName, testFn as any);
    }
  }

  static Command: any = class Command {
    private cmd: string;
    private options: any;

    constructor(command: string, options?: any) {
      this.cmd = command;
      this.options = options || {};
    }

    spawn(): SpawnedProcess {
      const args = this.options.args || [];

      const spawnOptions: any = {
        stdio: [
          this.options.stdin === "piped"
            ? "pipe"
            : this.options.stdin || "inherit",
          this.options.stdout === "piped"
            ? "pipe"
            : this.options.stdout === "null"
            ? "ignore"
            : this.options.stdout || "inherit",
          this.options.stderr === "piped"
            ? "pipe"
            : this.options.stderr === "null"
            ? "ignore"
            : this.options.stderr || "inherit",
        ],
      };

      if (this.options.cwd) {
        spawnOptions.cwd = this.options.cwd;
      }

      if (this.options.env) {
        spawnOptions.env = { ...process.env, ...this.options.env };
      }

      const child = nodeSpawn(this.cmd, args, spawnOptions);

      // Wrap stdin in a WritableStream-like interface
      const stdinWrapper: StdinWrapper | null = child.stdin
        ? {
          getWriter(): StdinWriter {
            return {
              write(chunk: Uint8Array): Promise<void> {
                return new Promise<void>((resolve, reject) => {
                  child.stdin.write(chunk, (err: any) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });
              },
              close(): Promise<void> {
                return new Promise<void>((resolve) => {
                  child.stdin.end(() => resolve());
                });
              },
              releaseLock() {},
            };
          },
        }
        : null;

      return {
        stdin: stdinWrapper,
        stdout: child.stdout,
        stderr: child.stderr,
        status: new Promise((resolve) => {
          child.on("exit", (code, signal) => {
            resolve({
              success: code === 0,
              code: code || 0,
              signal: signal || null,
            });
          });
        }),
        output: async (): Promise<Uint8Array> => {
          const chunks: Buffer[] = [];
          if (child.stdout) {
            for await (const chunk of child.stdout) {
              chunks.push(chunk);
            }
          }
          return new Uint8Array(Buffer.concat(chunks));
        },
      };
    }

    async output(): Promise<CommandOutput> {
      const process = this.spawn();
      const [status, stdout]: any = await Promise.all([
        process.status,
        process.output(),
      ]);
      return {
        success: status.success,
        code: status.code,
        signal: status.signal,
        stdout,
        stderr: new Uint8Array(0),
      };
    }
  };

  static transformFFIType(denoType: string): any {
    switch (denoType) {
      case "void":
        return "void";
      case "bool":
        return "bool";
      case "u8":
        return "uint8";
      case "i8":
        return "int8";
      case "u16":
        return "uint16";
      case "i16":
        return "int16";
      case "u32":
        return "uint32";
      case "i32":
        return "int32";
      case "u64":
        return "uint64";
      case "i64":
        return "int64";
      case "usize":
        return "uintptr_t";
      case "isize":
        return "intptr_t";
      case "f32":
        return "float";
      case "f64":
        return "double";
      case "pointer":
      case "buffer":
      case "function":
        return "void *";
      default:
        throw new Error(`FFI type not supported: ${denoType}`);
    }
  }

  static dlopen(path: string, symbols: Record<string, any>): any {
    if (!koffi) {
      throw new Error(
        "koffi is required for Deno.dlopen compatibility in Node.js. Please install it with 'npm install koffi'.",
      );
    }

    const lib = koffi.load(path);
    const resultSymbols: Record<string, any> = {};

    for (const [name, desc] of Object.entries(symbols)) {
      const { parameters, result } = desc as any;
      const koffiParams = (parameters || []).map((p: string) =>
        this.transformFFIType(p)
      );
      const koffiResult = this.transformFFIType(result || "void");

      const fn = lib.func(name, koffiResult, koffiParams);
      resultSymbols[name] = fn;
    }

    return {
      symbols: resultSymbols,
      close() {
        lib.unload();
      },
    };
  }

  static #callbackCounter = 0;

  static UnsafeCallback: any = class UnsafeCallback {
    #cb: any;
    pointer: any;

    constructor(def: any, fn: any) {
      if (!koffi) {
        throw new Error(
          "koffi is required for Deno.UnsafeCallback compatibility in Node.js.",
        );
      }

      // Build parameter types for koffi
      const params = (def.parameters || []).map((p: string) =>
        DenoCompat.transformFFIType(p)
      ).join(", ");

      // Build result type
      let resultType = def.result || "void";
      resultType = DenoCompat.transformFFIType(resultType);

      // Create callback proto using C function signature syntax (Koffi 2.x)
      // Each callback needs a unique type name to avoid "Duplicate type name" errors
      // Format: "returnType CallbackName(param1, param2, ...)"
      const callbackName = `Callback_${DenoCompat.#callbackCounter++}`;
      const protoStr = `${resultType} ${callbackName}(${params})`;
      const proto = koffi.proto(protoStr);

      // Use koffi.register to create a persistent callback pointer
      // This returns an External pointer that can be passed to C functions as void *
      this.#cb = koffi.register(fn, koffi.pointer(proto));
      this.pointer = this.#cb;
    }

    close() {
      // Koffi callbacks are usually cleaned up when the library is unloaded.
    }
  };

  static UnsafePointer: any = class UnsafePointer {
    static equals(a: any, b: any) {
      return a === b;
    }

    static create(value: bigint | number) {
      return value;
    }

    static of(buffer: ArrayBuffer | Uint8Array) {
      if (koffi) {
        try {
          // Koffi's address() expects a Buffer or ArrayBuffer
          if (buffer instanceof Uint8Array) {
            return koffi.address(buffer);
          }
          if (buffer instanceof ArrayBuffer) {
            return koffi.address(buffer);
          }
        } catch (_e) {
          // Fallback if address() fails
          return buffer;
        }
      }
      return buffer;
    }

    static value(pointer: any) {
      // For koffi External objects, we need to extract the numeric address
      if (koffi && typeof pointer === "object" && pointer !== null) {
        try {
          // koffi.address() converts External objects to BigInt addresses
          return koffi.address(pointer);
        } catch (_e) {
          // If address() fails, return as-is
          return pointer;
        }
      }
      return pointer;
    }
  };

  static UnsafePointerView: any = class UnsafePointerView {
    pointer: any;

    static getCString(pointer: any, offset = 0) {
      if (!koffi) {
        throw new Error(
          "koffi is required for Deno.UnsafePointerView compatibility in Node.js.",
        );
      }

      // If pointer is already a string (koffi auto-converted), return it
      if (typeof pointer === "string") {
        return pointer;
      }

      // If pointer is a Buffer or Uint8Array, read directly
      if (Buffer.isBuffer(pointer) || pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(pointer)
          ? pointer
          : Buffer.from(pointer);
        const str = buffer.toString("utf8", offset);
        // Find null terminator
        const nullIndex = str.indexOf("\0");
        return nullIndex >= 0 ? str.substring(0, nullIndex) : str;
      }

      // Handle koffi External pointer objects
      if (typeof pointer === "object" && pointer !== null) {
        try {
          // Use koffi.view() directly with the External pointer object
          // koffi.view() expects the pointer object, not the numeric address
          const MAX_STRING_LENGTH = 65536; // 64KB max
          const view = koffi.view(pointer, MAX_STRING_LENGTH);
          const bytes = new Uint8Array(view);

          // Apply offset if needed
          const startIndex = offset;

          // Find null terminator starting from offset
          let nullIndex = -1;
          for (let i = startIndex; i < bytes.length; i++) {
            if (bytes[i] === 0) {
              nullIndex = i;
              break;
            }
          }

          if (nullIndex === -1) nullIndex = bytes.length;

          // Convert to string from offset to null terminator
          return Buffer.from(bytes.subarray(startIndex, nullIndex)).toString(
            "utf8",
          );
        } catch (e) {
          // If koffi.view() is not available (e.g., in Electron) or fails,
          // we cannot read the memory. This is a limitation of the runtime.
          throw new Error(
            `Cannot read string from External pointer: ${e.message}. ` +
              `Consider declaring the function with 'char *' return type instead of 'pointer' ` +
              `so koffi can auto-convert the string.`,
          );
        }
      }

      return "";
    }

    constructor(pointer: any) {
      this.pointer = pointer;
    }

    getCString(offset = 0) {
      return DenoCompat.UnsafePointerView.getCString(this.pointer, offset);
    }

    getUint8(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readUInt8(offset);
      }
      return 0;
    }
    getInt8(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readInt8(offset);
      }
      return 0;
    }
    getUint16(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readUInt16LE(offset);
      }
      return 0;
    }
    getInt16(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readInt16LE(offset);
      }
      return 0;
    }
    getUint32(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readUInt32LE(offset);
      }
      return 0;
    }
    getInt32(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readInt32LE(offset);
      }
      return 0;
    }
    getBigUint64(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readBigUInt64LE(offset);
      }
      return 0n;
    }
    getBigInt64(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readBigInt64LE(offset);
      }
      return 0n;
    }
    getFloat32(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readFloatLE(offset);
      }
      return 0;
    }
    getFloat64(offset = 0) {
      if (Buffer.isBuffer(this.pointer) || this.pointer instanceof Uint8Array) {
        const buffer = Buffer.isBuffer(this.pointer)
          ? this.pointer
          : Buffer.from(this.pointer);
        return buffer.readDoubleLE(offset);
      }
      return 0;
    }
  };
}

// Auto-install for Node.js
if (typeof Deno === "undefined") {
  (globalThis as any).Deno = DenoCompat;
}

export {};
