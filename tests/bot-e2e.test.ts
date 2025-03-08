import { TwitterManager } from '../src/core/twitterManager';
import { NewsMonitor } from '../src/core/newsMonitor';
import { BlockchainMonitor } from '../src/core/blockchainMonitor';
import { ContentGenerator } from '../src/services/contentGenerator';
import { SentimentAnalyzer } from '../src/services/sentiment';
import { Analytics } from '../src/services/analytics';
import { NewsEvaluator } from '../src/services/newsEvaluator';
import { TweetScheduler } from '../src/core/tweetScheduler';
import { CryptoNewsBot } from '../src/core/bot';
import { NewsItem, ContentType, Sentiment } from '../src/types/types';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';

dotenv.config();

// Mock classes for testing
class MockTwitterManager {
  private tweets: string[] = [];
  
  async initialize(): Promise<void> {
    return Promise.resolve();
  }
  
  async post(content: string): Promise<any> {
    console.log('\n=== TWEET POSTED ===');
    console.log(content);
    console.log('====================\n');
    this.tweets.push(content);
    return { id: `mock-${Date.now()}`, success: true };
  }
  
  async getMetrics(tweetId: string): Promise<any> {
    return {
      id: tweetId,
      impressionCount: 100,
      likeCount: 10,
      retweetCount: 5,
      replyCount: 2
    };
  }
  
  async getAccountMetrics(): Promise<any> {
    return {
      followers: 1000,
      impressionCount: 5000,
    };
  }
  
  getClient() {
    return {};
  }
  
  getTweets(): string[] {
    return this.tweets;
  }
}

class MockNewsMonitor extends EventEmitter {
  async initialize(): Promise<void> {
    return Promise.resolve();
  }
  
  async startStreaming(): Promise<void> {
    return Promise.resolve();
  }
  
  async stopStreaming(): Promise<void> {
    return Promise.resolve();
  }
  
  async refreshFeeds(): Promise<void> {
    return Promise.resolve();
  }
  
  // Helper to simulate news updates
  emitNewsUpdate(newsItem: NewsItem): void {
    this.emit('update', newsItem);
  }
}

class MockBlockchainMonitor extends EventEmitter {
  async initialize(): Promise<void> {
    return Promise.resolve();
  }
  
  async startStreaming(): Promise<void> {
    return Promise.resolve();
  }
  
  async stopStreaming(): Promise<void> {
    return Promise.resolve();
  }
  
  async getContextForNews(newsItem: NewsItem): Promise<any> {
    return {
      relatedTransactions: 5,
      marketImpact: 'medium',
      priceChange: 2.5
    };
  }
  
  // Helper to simulate blockchain events
  emitBlockchainEvent(event: any): void {
    this.emit('significant-event', event);
  }
}

class MockTrendingTopics {
  constructor(private twitterClient?: any) {}
  
  async initialize(): Promise<void> {
    // Don't try to access any external services in the mock
    return Promise.resolve();
  }
  
  async getRelevantTags(newsItem: NewsItem): Promise<string[]> {
    return ['bitcoin', 'crypto', 'blockchain'];
  }
}

// Test the entire bot pipeline
async function testCryptoNewsBot() {
  console.log('Starting CryptoNewsBot end-to-end test...');
  
  // Create mock components
  const twitterManager = new MockTwitterManager() as unknown as TwitterManager;
  const newsMonitor = new MockNewsMonitor() as unknown as NewsMonitor;
  const blockchainMonitor = new MockBlockchainMonitor() as unknown as BlockchainMonitor;
  const contentGenerator = new ContentGenerator(process.env.GEMINI_API_KEY || "", false);
  const sentimentAnalyzer = new SentimentAnalyzer();
  const analytics = new Analytics(twitterManager);
  const newsEvaluator = new NewsEvaluator();
  const tweetScheduler = new TweetScheduler(10);
  const trending = new MockTrendingTopics(twitterManager);
  
  // Create bot configuration
  const botConfig = {
    thresholds: {
      importanceThreshold: 5
    },
    rateLimits: {
      tweetsPerHour: 10
    },
    twitter: {
      username: 'test_bot',
      apiKey: 'test_key',
      apiSecret: 'test_secret',
      accessToken: 'test_access_token',
      accessTokenSecret: 'test_access_token_secret'
    },
    newsSources: [{
      url: 'test_feed',
      type: 'rss' as 'rss' | 'api',
      category: 'crypto'
    }],
    blockchain: {
      networks: ['ethereum'],
      apiKeys: {}
    }
  };
  
  // Add this line to replace the internal TrendingTopics with your mock
  Object.defineProperty(CryptoNewsBot.prototype, 'trending', {
    value: trending,
    writable: true
  });

  // Create the bot
  const bot = new CryptoNewsBot(
    botConfig,
    twitterManager,
    newsMonitor,
    blockchainMonitor,
    contentGenerator,
    sentimentAnalyzer,
    analytics,
    newsEvaluator,
    tweetScheduler
  );
  
  try {
    // Start the bot
    await bot.start();
    console.log('Bot started successfully');
    
    // Wait a moment for all services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Emit a test news item with high importance
    const testNews: NewsItem = {
      title: 'Bitcoin reaches new all-time high of $100,000',
      summary: 'BTC surpassed $100k for the first time, driven by ETF inflows and institutional demand',
      source: 'cointelegraph.com',
      type: ContentType.NEWS,
    };
    
    // Manually set sentiment since we want to control the importance
    const sentiment: Sentiment = {
      label: 'positive',
      score: 0.8
    };
    
    console.log('Injecting test news item...');
    
    // Force the news analysis flow
    sentimentAnalyzer.analyze = async () => sentiment;
    newsEvaluator.evaluateImportance = () => 9; // High importance
    
    // Inject the news
    (newsMonitor as unknown as MockNewsMonitor).emitNewsUpdate(testNews);
    
    // Wait for processing
    console.log('Waiting for news processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if a tweet was posted
    const mockTwitter = twitterManager as unknown as MockTwitterManager;
    const tweetCount = mockTwitter.getTweets().length;
    
    console.log(`Tweets posted: ${tweetCount}`);
    
    if (tweetCount > 0) {
      console.log('\nTweets posted:');
      mockTwitter.getTweets().forEach((tweet, i) => {
        console.log(`Tweet ${i+1}: ${tweet}`);
      });
    }
    
    // Stop the bot
    await bot.stop();
    console.log('Bot stopped successfully');
    
    return tweetCount > 0;
  } catch (error) {
    console.error('Test failed with error:', error);
    return false;
  }
}

// Run the test
testCryptoNewsBot().then(success => {
  console.log(success ? 
    '✅ CryptoNewsBot test passed - the pipeline is working end-to-end!' : 
    '❌ CryptoNewsBot test failed - no tweets were posted');
  process.exit(0);
});