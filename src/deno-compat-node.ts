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

  static env: { get(name: string): string | undefined } = {
    get(name: string) {
      return process.env[name];
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
