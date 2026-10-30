import { describe, expect, it } from "bun:test";
import Handlebars from "handlebars";
import { z } from "zod";
import { extractParams } from "../params";
import { createMockRuntime, createTestState } from "./test-utils";

describe("installed dependency security regressions", () => {
  // These exercise the installed package. ElizaOS 1.7.2 embeds its own older
  // Handlebars copy; passing these tests does not clear that SDK bundle.
  it("does not expose the Function constructor through an own property", () => {
    const render = Handlebars.compile('{{lookup value "constructor"}}');
    expect(render({ value: Function.prototype })).toBe("");
  });

  it("escapes HTML script boundaries in precompiled templates", () => {
    const source = Handlebars.precompile(
      "safe</script><script>example</script>",
    );
    expect(source).not.toContain("</script>");
  });

  it("rejects oversized collections before visiting their elements", () => {
    let visits = 0;
    const element = z.string().transform((value) => {
      visits++;
      return value;
    });
    expect(z.array(element).max(1).safeParse(["a", "b"]).success).toBe(false);
    expect(visits).toBe(0);
    expect(z.array(element).max(1).parse(["a"])).toEqual(["a"]);
  });
});

describe("real ElizaOS prompt compatibility", () => {
  it("keeps conversation content as data and extracts the model XML response", async () => {
    const state = createTestState();
    state.values.recentMessages =
      'User: {{lookup value "constructor"}} <hello>';
    let prompt = "";
    const runtime = createMockRuntime({
      useModel: (async (_type: unknown, options: { prompt: string }) => {
        prompt = options.prompt;
        return "<response><recipient>Alice</recipient></response>";
      }) as any,
    });
    const result = await extractParams(
      runtime,
      state,
      "Extract recipient as XML.",
    );
    expect(prompt).toContain(state.values.recentMessages);
    expect(prompt).toContain("Extract recipient as XML.");
    expect(result?.recipient).toBe("Alice");
  });
});
