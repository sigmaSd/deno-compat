// deno-lint-ignore-file no-explicit-any
// deno-compat-node.ts
/**
 * Deno compatibility layer for Node.js
 * This module provides Deno APIs implemented using Node.js built-in modules
 * Works in both Node.js and Bun
 */

import process from "node:process";
import { type as osType } from "node:os";
import { spawn as nodeSpawn } from "node:child_process";
import { Buffer } from "node:buffer";

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
      const fs = await import("node:fs/promises");
      const fh = await fs.open(path, mode);
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
    const fs = await import("node:fs/promises");
    return await fs.readFile(path, "utf8");
  }

  static async readFile(path: string): Promise<Uint8Array> {
    const fs = await import("node:fs/promises");
    const data = await fs.readFile(path);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  static async *readDir(path: string): AsyncGenerator<DirEntry, void, unknown> {
    const fs = await import("node:fs/promises");
    const entries = await fs.readdir(path, { withFileTypes: true });

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
    const fs = await import("node:fs/promises");
    const s = await fs.stat(path);

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
      const os = osType().toLowerCase();
      if (os === "linux") return "linux";
      if (os === "darwin") return "darwin";
      if (os === "windows_nt") return "windows";
      return os;
    })(),
  };

  static exit(code?: number): void {
    process.exit(code);
  }

  static cwd(): string {
    return process.cwd();
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
}

// Auto-install for Node.js
if (typeof Deno === "undefined") {
  (globalThis as any).Deno = DenoCompat;
}

export {};
