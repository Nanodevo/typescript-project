import { TwitterManager } from './core/twitterManager';
import { NewsManager, NewsArticle } from './core/newsManager';
import { AiManager, TweetThread } from './core/aiManager';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Load environment variables
dotenv.config();

/**
 * Configuration for CryptoNewsBot
 */
export interface CryptoNewsBotConfig {
  // Posting settings
  autoPost: boolean;
  postInterval: number; // in minutes
  importanceThreshold: number; // minimum score for posting
  
  // Content settings
  createThreads: boolean;
  maxTweetsInThread: number;
  includeUrl: boolean;
  tweetStyle: 'informative' | 'enthusiastic' | 'analytical' | 'balanced';
  
  // News settings
  newsMaxResults: number;
  newsSources: string[];
  
  // Operational settings
  logToFile: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: CryptoNewsBotConfig = {
  // Posting settings
  autoPost: false, // Safety first - require explicit opt-in
  postInterval: 180, // Post every 3 hours by default
  importanceThreshold: 15, // Only post if importance score is above this
  
  // Content settings
  createThreads: true,
  maxTweetsInThread: 3,
  includeUrl: true,
  tweetStyle: 'informative',
  
  // News settings
  newsMaxResults: 20,
  newsSources: ['cointelegraph', 'coindesk', 'crypto-coins-news', 'the-block'],
  
  // Operational settings
  logToFile: true,
  logLevel: 'info'
};

/**
 * CryptoNewsBot main class - handles the entire flow from news fetching to tweet posting
 */
export class CryptoNewsBot extends EventEmitter {
  private config: CryptoNewsBotConfig;
  private twitter: TwitterManager;
  private news: NewsManager;
  private ai: AiManager;
  private schedulerInterval?: NodeJS.Timeout;
  private logStream?: fs.WriteStream;
  private isRunning: boolean = false;
  
  private stats = {
    newsArticlesFetched: 0,
    tweetsPosted: 0,
    threadsPosted: 0,
    skippedPosts: 0,
    errors: 0,
    lastRun: null as Date | null,
    lastPost: null as Date | null
  };
  
  /**
   * Create a new CryptoNewsBot instance
   */
  constructor(config?: Partial<CryptoNewsBotConfig>) {
    super();
    
    // Merge provided config with defaults and environment variables
    this.config = this.loadConfig(config);
    
    // Initialize components
    this.twitter = new TwitterManager();
    this.news = new NewsManager();
    this.ai = new AiManager();
    
    // Setup logging
    this.setupLogging();
    
    this.log('info', 'CryptoNewsBot initialized with configuration:', this.config);
  }
  
  /**
   * Load configuration from environment variables and merge with defaults
   */
  private loadConfig(overrides?: Partial<CryptoNewsBotConfig>): CryptoNewsBotConfig {
    const config = { ...DEFAULT_CONFIG };
    
    // Load from environment variables
    if (process.env.BOT_AUTO_POST === 'true') config.autoPost = true;
    if (process.env.BOT_POST_INTERVAL) config.postInterval = parseInt(process.env.BOT_POST_INTERVAL);
    if (process.env.BOT_IMPORTANCE_THRESHOLD) config.importanceThreshold = parseInt(process.env.BOT_IMPORTANCE_THRESHOLD);
    if (process.env.BOT_CREATE_THREADS === 'false') config.createThreads = false;
    if (process.env.BOT_MAX_TWEETS_IN_THREAD) config.maxTweetsInThread = parseInt(process.env.BOT_MAX_TWEETS_IN_THREAD);
    if (process.env.BOT_INCLUDE_URL === 'false') config.includeUrl = false;
    if (process.env.BOT_TWEET_STYLE) config.tweetStyle = process.env.BOT_TWEET_STYLE as any;
    if (process.env.BOT_NEWS_MAX_RESULTS) config.newsMaxResults = parseInt(process.env.BOT_NEWS_MAX_RESULTS);
    if (process.env.BOT_LOG_TO_FILE === 'false') config.logToFile = false;
    if (process.env.BOT_LOG_LEVEL) config.logLevel = process.env.BOT_LOG_LEVEL as any;
    if (process.env.BOT_NEWS_SOURCES) {
      config.newsSources = process.env.BOT_NEWS_SOURCES.split(',').map(s => s.trim());
    }
    
    // Override with any passed config options
    return { ...config, ...overrides };
  }
  
  /**
   * Setup logging based on configuration
   */
  private setupLogging(): void {
    if (this.config.logToFile) {
      const logDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logPath = path.join(logDir, `cryptonewsbot-${new Date().toISOString().split('T')[0]}.log`);
      this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    }
  }
  
  /**
   * Log a message with timestamp and level
   */
  private log(level: string, message: string, data?: any): void {
    // Skip logging if below configured level
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex < configLevelIndex) return;
    
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      logMessage += ` ${JSON.stringify(data)}`;
    }
    
    console.log(logMessage);
    
    if (this.logStream) {
      this.logStream.write(logMessage + '\n');
    }
    
    // Emit log event for external monitoring
    this.emit('log', { timestamp, level, message, data });
  }
  
  /**
   * Start the bot with automatic scheduling
   */
  public start(): void {
    if (this.isRunning) {
      this.log('warn', 'Bot is already running');
      return;
    }
    
    this.isRunning = true;
    this.log('info', `Starting CryptoNewsBot scheduler with ${this.config.postInterval} minute interval`);
    
    // Run immediately once
    this.runOnce().catch(error => {
      this.log('error', 'Error in initial run', error);
    });
    
    // Then schedule according to interval
    this.schedulerInterval = setInterval(() => {
      this.log('info', 'Scheduled run starting');
      this.runOnce().catch(error => {
        this.log('error', 'Error in scheduled run', error);
      });
    }, this.config.postInterval * 60 * 1000);
    
    this.emit('started');
  }
  
  /**
   * Stop the bot scheduler
   */
  public stop(): void {
    if (!this.isRunning) {
      this.log('warn', 'Bot is not running');
      return;
    }
    
    this.isRunning = false;
    this.log('info', 'Stopping CryptoNewsBot scheduler');
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
    
    if (this.logStream) {
      this.logStream.end();
      this.logStream = undefined;
    }
    
    this.emit('stopped');
  }
  
  /**
   * Execute one complete run of the bot (fetch, analyze, generate, post)
   * Can be used for immediate posting without starting the scheduler
   */
  public async runOnce(): Promise<boolean> {
    this.log('info', '=== Starting CryptoNewsBot run ===');
    this.stats.lastRun = new Date();
    
    try {
      // Step 1: Fetch crypto news
      this.log('info', 'Fetching crypto news...');
      const articles = await this.news.fetchLatestNews(this.config.newsMaxResults);
      this.stats.newsArticlesFetched += articles.length;
      this.log('info', `Fetched ${articles.length} news articles`);
      
      if (articles.length === 0) {
        this.log('warn', 'No news articles found. Ending run.');
        this.emit('run-complete', { success: false, reason: 'no-articles' });
        return false;
      }
      
      // Step 2: Analyze and rank news
      this.log('info', 'Analyzing news importance...');
      const rankedArticles = await this.news.rankArticlesByImportance(articles);
      
      // Step 3: Select top article
      const topArticle = rankedArticles[0];
      
      // Check if the article meets the importance threshold
      if ((topArticle.importanceScore || 0) < this.config.importanceThreshold) {
        this.log('info', `Top article score (${topArticle.importanceScore}) is below threshold (${this.config.importanceThreshold}). Skipping post.`);
        this.stats.skippedPosts++;
        this.emit('run-complete', { success: false, reason: 'below-threshold' });
        return false;
      }
      
      this.log('info', `Selected top article: "${topArticle.title}" with score ${topArticle.importanceScore}`);
      
      // Step 4: Generate tweet content
      this.log('info', 'Generating tweet content...');
      const tweetResult = await this.ai.generateTweet({
        title: topArticle.title,
        content: topArticle.content || topArticle.description || '',
        url: topArticle.url,
        source: topArticle.source?.name || 'Unknown Source'
      }, {
        standalone: true, 
        includeUrl: this.config.includeUrl,
        createThread: this.config.createThreads,
        maxTweets: this.config.maxTweetsInThread,
        style: this.config.tweetStyle,
      });
      
      // Check if we got a thread or single tweet
      if (typeof tweetResult === 'string') {
        this.log('info', 'Generated single tweet:', { tweet: tweetResult });
        
        // Step 5: Post tweet if autoPost is enabled
        if (this.config.autoPost) {
          this.log('info', 'Auto-posting tweet...');
          const result = await this.twitter.postTweet(tweetResult);
          
          if (result.success) {
            this.log('info', `Tweet posted successfully! Tweet ID: ${result.id}`);
            this.stats.tweetsPosted++;
            this.stats.lastPost = new Date();
            this.emit('tweet-posted', { id: result.id, content: tweetResult });
            return true;
          } else {
            this.log('error', 'Failed to post tweet');
            this.stats.errors++;
            this.emit('post-error', { type: 'tweet', error: 'Failed to post tweet' });
            return false;
          }
        } else {
          this.log('info', 'Auto-posting disabled. Tweet not posted.');
          this.emit('run-complete', { success: true, reason: 'auto-post-disabled' });
          return true;
        }
      } else {
        // We got a thread
        this.log('info', `Generated tweet thread with ${tweetResult.tweets.length} tweets:`, { 
          tweets: tweetResult.tweets 
        });
        
        if (this.config.autoPost) {
          this.log('info', 'Auto-posting tweet thread...');
          const result = await this.twitter.postThread(tweetResult.tweets);
          
          if (result.success) {
            this.log('info', `Tweet thread posted successfully!`, { ids: result.ids });
            this.stats.threadsPosted++;
            this.stats.lastPost = new Date();
            this.emit('thread-posted', { ids: result.ids, tweets: tweetResult.tweets });
            return true;
          } else {
            if (result.ids && result.ids.length > 0) {
              this.log('warn', `Thread partially posted. Posted ${result.ids.length}/${tweetResult.tweets.length} tweets`, {
                postedIds: result.ids,
                failedAt: result.failedAt
              });
              this.stats.errors++;
              this.emit('post-error', { 
                type: 'thread-partial', 
                error: `Thread partially posted (${result.ids.length}/${tweetResult.tweets.length})`,
                ids: result.ids,
                failedAt: result.failedAt
              });
              return true; // Still count as partial success
            } else {
              this.log('error', 'Failed to post tweet thread');
              this.stats.errors++;
              this.emit('post-error', { type: 'thread', error: 'Failed to post thread' });
              return false;
            }
          }
        } else {
          this.log('info', 'Auto-posting disabled. Thread not posted.');
          this.emit('run-complete', { success: true, reason: 'auto-post-disabled' });
          return true;
        }
      }
    } catch (error) {
      this.log('error', `Error running bot: ${error}`);
      this.stats.errors++;
      this.emit('run-error', { error });
      return false;
    }
  }
  
  /**
   * Get current bot statistics
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Get current bot configuration
   */
  public getConfig(): CryptoNewsBotConfig {
    return { ...this.config };
  }
  
  /**
   * Update bot configuration
   */
  public updateConfig(config: Partial<CryptoNewsBotConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('info', 'Configuration updated', this.config);
    this.emit('config-updated', this.config);
    
    // If running and interval changed, restart scheduler
    if (this.isRunning && config.postInterval && this.schedulerInterval) {
      this.stop();
      this.start();
    }
  }
}