import { NewsEvaluator } from '../src/services/newsEvaluator';
import { TweetScheduler } from '../src/core/tweetScheduler';
import { NewsItem, ContentType, Sentiment, Tweet } from '../src/types/types';

describe('News Prioritization System', () => {
  let evaluator: NewsEvaluator;
  let scheduler: TweetScheduler;
  
  beforeEach(() => {
    evaluator = new NewsEvaluator();
    scheduler = new TweetScheduler(8); // 8 tweets per day
  });
  
  it('should score news items based on importance', () => {
    const items: NewsItem[] = [
      {
        title: "Bitcoin reaches new all-time high of $100,000",
        summary: "BTC surpassed $100k for the first time, driven by ETF inflows and institutional demand",
        type: ContentType.NEWS,
        source: "cointelegraph.com"
      },
      {
        title: "Minor update to crypto wallet software released",
        summary: "Bug fixes and performance improvements in the latest release",
        type: ContentType.NEWS,
        source: "cryptonews.com"
      },
      {
        title: "SEC announces new cryptocurrency regulations",
        summary: "The Securities and Exchange Commission unveiled sweeping new regulations for crypto assets",
        type: ContentType.NEWS,
        source: "coindesk.com"
      }
    ];
    
    const sentiment: Sentiment = {
      label: "positive",
      score: 0.8
    };
    
    const scores = items.map(item => evaluator.evaluateImportance(item, sentiment));
    
    // Bitcoin ATH should score highest
    expect(scores[0]).toBeGreaterThan(scores[1]);
    // SEC regulation should score higher than wallet update
    expect(scores[2]).toBeGreaterThan(scores[1]);
  });
  
  it('should schedule tweets based on importance and timing', () => {
    const tweet1: Tweet = {
      content: "High importance tweet",
      type: ContentType.NEWS,
      source: "source1"
    };
    
    const tweet2: Tweet = {
      content: "Medium importance tweet",
      type: ContentType.NEWS,
      source: "source2"
    };
    
    const tweet3: Tweet = {
      content: "Low importance tweet",
      type: ContentType.NEWS,
      source: "source3"
    };
    
    // Add tweets with different importance scores
    scheduler.addToQueue(tweet1, 9.5);
    scheduler.addToQueue(tweet2, 6.2);
    scheduler.addToQueue(tweet3, 3.8);
    
    // Initial state - shouldn't tweet yet (too soon)
    expect(scheduler.shouldTweetNow()).toBe(false);
    
    // Force the last tweet time to be 4 hours ago
    // @ts-ignore - Accessing private property for testing
    scheduler.lastTweetTime = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    // Now it should be time to tweet
    expect(scheduler.shouldTweetNow()).toBe(true);
    
    // Should get highest importance tweet first
    const nextTweet = scheduler.getNextTweetToPost();
    expect(nextTweet).toBe(tweet1);
    
    // Right after tweeting, should not be time to tweet again
    expect(scheduler.shouldTweetNow()).toBe(false);
  });
});