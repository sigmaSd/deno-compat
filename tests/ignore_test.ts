import "../mod.ts";
import { assertEquals } from "@std/assert";

Deno.test({
  name: "ignored test - options",
  ignore: true,
  fn() {
    throw new Error("This test should be ignored");
  },
});

Deno.test("ignored test - name and options", { ignore: true }, () => {
  throw new Error("This test should also be ignored");
});

Deno.test("ignored test - name and fn", () => {
  assertEquals(true, true);
});

// Use valid Deno.test overloads for type safety
Deno.test("ignored test - name, options and fn", {
  ignore: true,
}, () => {
  throw new Error("This test should also be ignored (3 args)");
});

Deno.test({
  name: "ignored test - options with fn",
  fn() {
    throw new Error("This test should also be ignored (options with fn)");
  },
  ignore: true,
});

Deno.test("not ignored test", () => {
  assertEquals(1, 1);
});
