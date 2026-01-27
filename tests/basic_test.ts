import "../mod.ts";
import { assertEquals, assertExists } from "@std/assert";

Deno.test("Basic - env", () => {
  Deno.env.set("TEST_VAR", "hello");
  assertEquals(Deno.env.get("TEST_VAR"), "hello");
  assertEquals(Deno.env.has("TEST_VAR"), true);
  Deno.env.delete("TEST_VAR");
  assertEquals(Deno.env.has("TEST_VAR"), false);
});

Deno.test("Basic - build and args", () => {
  assertExists(Deno.build.os);
  assertExists(Deno.args);
  assertEquals(Array.isArray(Deno.args), true);
});

Deno.test("Basic - filesystem", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "deno_compat_test" });
  assertExists(tempDir);

  const testFile = `${tempDir}/test.txt`;
  await Deno.writeTextFile(testFile, "hello world");

  const content = await Deno.readTextFile(testFile);
  assertEquals(content, "hello world");

  const stat = await Deno.stat(testFile);
  assertEquals(stat.isFile, true);

  await Deno.remove(tempDir, { recursive: true });
});
