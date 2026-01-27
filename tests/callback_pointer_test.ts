import "../mod.ts";
import { assertExists } from "@std/assert";

Deno.test("FFI - UnsafeCallback with pointer return type", () => {
  // This test verifies that callbacks can return pointer types
  // without throwing "You are not allowed to directly return <anonymous> values"

  try {
    // Create a callback that returns a pointer (common in GTK and other C libraries)
    const callback = new Deno.UnsafeCallback({
      parameters: ["i32"],
      result: "pointer",
    }, () => {
      // Return a null pointer or some pointer value
      return null;
    });

    // If we get here without throwing, the fix worked
    assertExists(callback.pointer);

    callback.close();
  } catch (e) {
    if (
      (e as Error).message.includes("koffi") &&
      // deno-lint-ignore no-explicit-any
      typeof (globalThis as any).process !== "undefined"
    ) {
      console.warn(
        "Skipping FFI callback test: koffi not installed in Node.js",
      );
      return;
    }
    throw e;
  }
});
