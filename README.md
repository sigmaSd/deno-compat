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

// Bun compatibility (includes Node.js + FFI features)
import "@sigma/deno-compat/bun";
```

## Supported APIs

### File System

- `Deno.readTextFile(path)` - Read file as UTF-8 string
- `Deno.readFile(path)` - Read file as Uint8Array
- `Deno.readDir(path)` - Iterate through directory entries
- `Deno.stat(path)` - Get file/directory information

### Process & Environment

- `Deno.args` - Command line arguments
- `Deno.env.get(name)` - Get environment variable
- `Deno.exit(code)` - Exit the process
- `Deno.cwd()` - Get current working directory
- `Deno.build.os` - Operating system ("linux", "darwin", "windows")

### Command Execution

```typescript
// Spawn a command
const command = new Deno.Command("ls", {
  args: ["-la"],
  stdout: "piped",
  stderr: "piped",
});

const child = command.spawn();
const status = await child.status;

// Or get output directly
const { stdout, stderr, success } = await command.output();
```

### FFI (Bun Only)

Bun includes extended support for Foreign Function Interface with automatic type
conversion from Deno FFI types:

```typescript
// Automatically converts Deno FFI types to Bun FFI types
const lib = Deno.dlopen("./libexample.so", {
  add: {
    parameters: ["i32", "i32"],
    result: "i32",
  },
});

// Callbacks
const callback = new Deno.UnsafeCallback(
  {
    parameters: ["i32"],
    result: "void",
  },
  (value) => {
    console.log("Callback called with:", value);
  },
);

// Pointer operations
const ptr = Deno.UnsafePointer.of(buffer);
const cString = Deno.UnsafePointerView.getCString(ptr);
```

## Examples

### Reading Configuration Files

```typescript
import "@sigma/deno-compat";

const config = await Deno.readTextFile("./config.json");
const settings = JSON.parse(config);
```

### Directory Traversal

```typescript
import "@sigma/deno-compat";

for await (const entry of Deno.readDir("./src")) {
  if (entry.isFile) {
    console.log(`File: ${entry.name}`);
  } else if (entry.isDirectory) {
    console.log(`Directory: ${entry.name}`);
  }
}
```

### Running Shell Commands

```typescript
import "@sigma/deno-compat";

const command = new Deno.Command("git", {
  args: ["status"],
  stdout: "piped",
});

const { stdout, success } = await command.output();
if (success) {
  console.log(new TextDecoder().decode(stdout));
}
```

## Runtime Detection

The library includes runtime detection utilities:

```typescript
import {
  isBun,
  isDeno,
  isNode,
  runtime,
} from "@sigma/deno-compat/src/runtime.ts";

console.log(runtime); // "deno", "node", or "bun"

if (isNode) {
  console.log("Running on Node.js");
}
```

## How It Works

The compatibility layer automatically detects the JavaScript runtime at import
time and provides the appropriate implementation:

- **Deno**: No compatibility layer needed (native APIs)
- **Node.js**: Implements Deno APIs using Node.js built-in modules (`fs`,
  `child_process`, `process`, etc.)
- **Bun**: Extends Node.js compatibility with additional FFI support using
  `bun:ffi`

## Limitations

- Not all Deno APIs are implemented (focused on most commonly used APIs)
- FFI support is only available in Bun
- Some advanced Deno features may not have exact equivalents

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT
