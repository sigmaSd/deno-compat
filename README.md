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

Note that the dynamic detection of node/bun uses dynamic import which might not
be triggered first depending on the runtime, so its best to import the specific
import `/node` or `/bun`.

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

## Runtime Detection

The library includes runtime detection utilities:

```typescript
import { isBun, isDeno, isNode, runtime } from "@sigma/deno-compat/runtime";

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
