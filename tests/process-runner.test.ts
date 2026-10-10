import { describe, expect, it } from "vitest";
import { NodeProcessRunner } from "../src/services/process-runner";

describe("process runner", () => {
  it("terminates and reports a child which exceeds its timeout", async () => {
    const runner = new NodeProcessRunner();
    const result = await runner.run({
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
      timeoutMs: 300
    });
    expect(result.code).toBe(124);
    expect(result.stderr).toContain("Process timed out after 300ms");
  });

  it("runs under Electron renderer-style numeric global timers", async () => {
    const oldSetTimeout = globalThis.setTimeout;
    try {
      // Electron renderer exposes numeric DOM timers, unlike NodeJS.Timeout.
      globalThis.setTimeout = (() => 7) as unknown as typeof setTimeout;
      const runner = new NodeProcessRunner();
      const result = await runner.run({
        command: process.execPath,
        args: ["-e", "console.log('RENDERER_TIMER_OK')"],
        timeoutMs: 5000
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("RENDERER_TIMER_OK");
    } finally {
      globalThis.setTimeout = oldSetTimeout;
    }
  });
});
