import type {
  NormalizedArticle,
  PlatformId,
  PlatformProgress,
  PlatformPublisher,
  PublishResult
} from "../types";

export type ProgressListener = (progress: PlatformProgress) => void;

export class PublisherRouter {
  private readonly publishers = new Map<PlatformId, PlatformPublisher>();

  constructor(publishers: PlatformPublisher[]) {
    for (const publisher of publishers) {
      this.publishers.set(publisher.platform, publisher);
    }
  }

  async publish(
    article: NormalizedArticle,
    platforms: PlatformId[],
    dryRun: boolean,
    onProgress?: ProgressListener
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const platform of platforms) {
      const publisher = this.publishers.get(platform);
      if (!publisher) {
        const result: PublishResult = {
          platform,
          status: "failure",
          message: "No publisher adapter is registered for this platform."
        };
        results.push(result);
        onProgress?.({
          platform,
          status: "failure",
          message: result.message
        });
        continue;
      }

      onProgress?.({
        platform,
        status: "running",
        message: "Preparing draft..."
      });

      try {
        const result = await publisher.publish(article, { dryRun });
        results.push(result);
        onProgress?.({
          platform,
          status: result.status,
          message: result.message
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        const result: PublishResult = {
          platform,
          status: "failure",
          message: "Unexpected publisher error.",
          details: message
        };
        results.push(result);
        onProgress?.({
          platform,
          status: "failure",
          message
        });
      }
    }

    return results;
  }
}
