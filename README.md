# @sigma/deno-compat

A comprehensive Deno compatibility layer that allows Deno code to run seamlessly
on Node.js and Bun runtimes.

Useful for running deno projects on other runtimes, or for library authors to
make their modules work cross runtimes.

## Installation

### Deno

```bash
deno add @sigma/deno-compat
```

### Node.js / Bun

```bash
npx jsr install @sigma/deno-compat
```

## Usage

Simply import the module at the top of your application, and the global `Deno`
object will be available in Node.js and Bun environments:

```typescript
import "@sigma/deno-compat";

// Now you can use Deno APIs in Node.js or Bun
const text = await Deno.readTextFile("./file.txt");
const fileInfo = await Deno.stat("./file.txt");

console.log(Deno.build.os); // "linux", "darwin", or "windows"
console.log(Deno.args); // Command line arguments
```

### Selective Imports

You can also import specific compatibility layers:

```typescript
// Node.js compatibility only
import "@sigma/deno-compat/node";

// Bun compatibility (includes Node.js + Bun FFI)
import "@sigma/deno-compat/bun";
```

## Features

- **Filesystem**: `readFile`, `readTextFile`, `writeFile`, `writeTextFile`,
  `stat`, `lstat`, `mkdir`, `remove`, `makeTempDir`, `readDir`, `copyFile`.
- **Process**: `Command`, `exit`, `cwd`, `args`, `env`, `stdin`, `stderr`,
  `build`.
- **FFI**: `dlopen`, `UnsafePointer`, `UnsafePointerView`, `UnsafeCallback`.
  - Node.js support powered by `koffi`.
  - Bun support powered by `bun:ffi`.
- **Testing**: `Deno.test` compatible with `node:test` and `bun:test`.

## How It Works

The compatibility layer automatically detects the JavaScript runtime at import
time and provides the appropriate implementation:

- **Deno**: No compatibility layer needed (native APIs).
- **Node.js**: Implements Deno APIs using Node.js built-in modules and `koffi`
  for FFI.
- **Bun**: Extends Node.js compatibility with Bun's native FFI support.

## Testing

```bash
deno task test
```

## License

MIT
