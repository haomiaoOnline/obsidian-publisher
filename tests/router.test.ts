import { describe, expect, it } from "vitest";
import { PublisherRouter } from "../src/services/publisher-router";
import type {
  NormalizedArticle,
  PlatformPublisher
} from "../src/types";

const article: NormalizedArticle = {
  title: "Test",
  filePath: "test.md",
  rawMarkdown: "# Test",
  normalizedMarkdown: "# Test",
  xMarkdown: "# Test",
  images: []
};

describe("PublisherRouter", () => {
  it("routes selected platforms and reports progress", async () => {
    const publisher: PlatformPublisher = {
      platform: "wechat",
      displayName: "WeChat",
      publish: async () => ({
        platform: "wechat",
        status: "success",
        message: "ok"
      })
    };

    const router = new PublisherRouter([publisher]);
    const events: string[] = [];

    const results = await router.publish(
      article,
      ["wechat"],
      true,
      (event) => {
        events.push(event.platform + ":" + event.status);
      }
    );

    expect(results[0]?.status).toBe("success");
    expect(events).toEqual([
      "wechat:running",
      "wechat:success"
    ]);
  });

  it("fails closed when an adapter is missing", async () => {
    const router = new PublisherRouter([]);
    const results = await router.publish(
      article,
      ["x-articles"],
      true
    );

    expect(results[0]?.status).toBe("failure");
    expect(results[0]?.message).toContain(
      "No publisher adapter"
    );
  });
});
