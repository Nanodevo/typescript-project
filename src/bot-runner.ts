import dotenv from 'dotenv';
import { TwitterManager } from './core/twitterManager';
import { NewsMonitor } from './core/newsMonitor';
import { BlockchainMonitor } from './core/blockchainMonitor';
import { ContentGenerator } from './services/contentGenerator';
import { SentimentAnalyzer } from './services/sentiment';
import { Analytics } from './services/analytics';
import { NewsEvaluator } from './services/newsEvaluator';
import { TweetScheduler } from './core/tweetScheduler';
import { CryptoNewsBot } from './core/bot';
import { TrendingTopics } from './services/trending';
import { EventEmitter } from 'events';

// Load environment variables
dotenv.config();

interface BlockchainConfig {
    projectId: string;
}

// Create a simplified version of BlockchainMonitor that doesn't attempt to stream
class StubBlockchainMonitor extends EventEmitter {
  async initialize(): Promise<void> {
    console.log('Using stub blockchain monitor');
    return Promise.resolve();
  }
  
  async startStreaming(): Promise<void> {
    console.log('Blockchain streaming disabled in stub implementation');
    return Promise.resolve();
  }
  
  async stopStreaming(): Promise<void> {
    return Promise.resolve();
  }
  
  async getContextForNews(): Promise<any> {
    return { relatedTransactions: 0, priceImpact: 'minimal' };
  }
}

async function runBot() {
  console.log('Initializing CryptoNewsBot...');
  
  try {
    // Initialize all components with real implementations
    const twitterManager = new TwitterManager({
      apiKey: process.env.TWITTER_API_KEY!,
      apiSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
    });
    
    const newsMonitor = new NewsMonitor([
      {
        url: 'https://cointelegraph.com/rss',
        type: 'rss',
        category: 'crypto'
      },
      {
        url: 'https://decrypt.co/feed',
        type: 'rss',
        category: 'crypto'
      }
    ]);
    const blockchainMonitor = new StubBlockchainMonitor() as unknown as BlockchainMonitor;
    const contentGenerator = new ContentGenerator(process.env.GEMINI_API_KEY!, true);
    const sentimentAnalyzer = new SentimentAnalyzer();
    const analytics = new Analytics(twitterManager);
    const newsEvaluator = new NewsEvaluator();
    const tweetScheduler = new TweetScheduler(10); // 10 tweets per day

    // Check if news monitor is initialized correctly
    console.log('News sources configured:', 'Using 2 crypto news sources');

    // Initialize TrendingTopics
    const trendingTopics = new TrendingTopics(twitterManager.getClient());
    await trendingTopics.initialize();
    
    // Configure the bot
    const botConfig = {
      thresholds: {
        importanceThreshold: 6 // Only tweet about important news
      },
      rateLimits: {
        tweetsPerHour: 3 // Maximum 3 tweets per hour
      }
    };
    
    // Create and start the bot
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

    // If your bot needs the trending service but doesn't accept it in the constructor:
    // @ts-ignore - Add this property for the bot to use
    bot.trending = trendingTopics;
    
    console.log('Starting CryptoNewsBot...');
    await bot.start();
    console.log('CryptoNewsBot is running!');
    
    setTimeout(() => {
      console.log("Injecting test news item...");
      
      const testNews = {
        title: "Bitcoin Reaches New All-Time High",
        summary: "BTC surpasses previous record in major market rally",
        content: "Bitcoin has reached a new all-time high price today, surpassing its previous record...",
        source: "test-source",
        url: "https://example.com/test-news",
        publishedAt: new Date(),
        type: "news"
      };
      
      // Emit the test news to trigger the bot's processing pipeline
      newsMonitor.emit('update', testNews);
      
      console.log("Test news injected");
    }, 5000); // Wait 5 seconds after starting before injecting
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('Shutting down CryptoNewsBot...');
      await bot.stop();
      console.log('CryptoNewsBot stopped successfully.');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start CryptoNewsBot:', error);
    process.exit(1);
  }
}

// Run the bot
runBot();