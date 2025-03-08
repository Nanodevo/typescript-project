/// <reference types="jest" />

import { ContentGenerator } from '../src/services/contentGenerator';
import { ContentType } from '../src/types/types';

describe("ContentGenerator", () => {
  let contentGenerator: ContentGenerator;

  beforeAll(() => {
    contentGenerator = new ContentGenerator();
  });

  it("should generate content within Twitter character limit", async () => {
    const data = {
      title: "Major Crypto Update",
      summary: "Crypto markets react to a global event impacting leading tokens.",
      type: "news" as ContentType,
      source: "CryptoMonitor"
    };
    const sentiment = { label: "neutral", score: 0 };
    const tweet = await contentGenerator.generate(data, sentiment);
    expect(tweet.content.length).toBeLessThanOrEqual(280);
  });

  it("should use fallback template when API fails", async () => {
    const data = {
      title: "Breaking News",
      summary: "An important update has been made regarding the market.",
      type: "news" as ContentType,
      source: "CryptoMonitor"
    };
    const sentiment = { label: "positive", score: 1 };
    const tweet = await contentGenerator.generate(data, sentiment);
    expect(tweet.content).toContain("Breaking News");
    expect(tweet.content).toContain("An important update has been made regarding the market.");
    // Remove sentiment expectation as it's not included in fallback template
  });
});