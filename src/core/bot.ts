import { TwitterManager } from './twitterManager';
import { BotConfig, Tweet, Sentiment, NewsItem } from '../types/types';
import { NewsMonitor as NewsMonitorImpl } from './newsMonitor';
import { NewsEvaluator } from '../services/newsEvaluator';
import { TweetScheduler } from './tweetScheduler';
import { BlockchainMonitor } from './blockchainMonitor';
import { SentimentAnalyzer } from '../services/sentiment';
import { ContentGenerator } from '../services/contentGenerator';
import { Analytics } from '../services/analytics';
import { Logger } from '../utils/logger';
import { Queue } from '../utils/queue';
import { EventEmitter } from 'events';
import { RateLimiter } from '../utils/rateLimiter';
import { TrendingTopics } from '../services/trending';

export interface NewsMonitor extends EventEmitter {
    startStreaming(): Promise<void>;
    stopStreaming(): Promise<void>;
    initialize(): Promise<void>;
}

import { ContentType } from '../types/types';

interface NewsSource {
    url: string;
    type: 'rss' | 'api';
    category: 'crypto' | 'ai' | 'tech';
}

export interface LocalNewsItem {
    content: string;
    type: ContentType;
    title: string;
    summary: string;
    source: string;
}

export class LocalNewsMonitor extends EventEmitter {
    private intervalId?: NodeJS.Timeout;

    async startStreaming(): Promise<void> {
        try {
            // Simulating periodic news updates
            this.intervalId = setInterval(() => {
                const newsItem: LocalNewsItem = {
                    content: 'Sample news content',
                    type: ContentType.NEWS,
                    title: 'Sample Title',
                    summary: 'Sample Summary',
                    source: 'Sample Source'
                };
                this.emit('update', newsItem);
            }, 60000); // Check every minute
        } catch (error) {
            throw error;
        }
    }

    async stopStreaming(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }
}

// Using the imported TwitterManager from './twitterManager'

export class CryptoNewsBot {
    private eventEmitter: EventEmitter;
    private queue: Queue<NewsItem>;
    private logger: Logger;
    private isRunning: boolean = false;
    private evaluator: NewsEvaluator; 
    private scheduler: TweetScheduler;
    private rateLimiter: RateLimiter;
    private trending: TrendingTopics;
    
    // Track statistics
    private stats = {
        newsProcessed: 0,
        tweetsPosted: 0,
        lowImportanceSkipped: 0,
        highImportanceProcessed: 0,
        errors: 0
    };

    constructor(
        private config: BotConfig,
        private twitter: TwitterManager,
        private news: NewsMonitorImpl,
        private blockchain: BlockchainMonitor,
        private content: ContentGenerator,
        private sentiment: SentimentAnalyzer,
        private analytics: Analytics,
        evaluator: NewsEvaluator,
        scheduler: TweetScheduler
    ) {
        this.evaluator = evaluator;
        this.scheduler = scheduler;
        this.eventEmitter = new EventEmitter();
        this.queue = new Queue();
        this.logger = new Logger();
        this.rateLimiter = new RateLimiter();
        this.rateLimiter.setLimits(config.rateLimits?.tweetsPerHour || 5, 60 * 60 * 1000);
        this.trending = new TrendingTopics(this.twitter.getClient());
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.news.on('update', async (newsItem: NewsItem) => {
            this.logger.info(`News received: ${newsItem.title}`);
            this.stats.newsProcessed++;
            
            try {
                // Analyze sentiment
                const sentiment = await this.sentiment.analyze(newsItem);
                
                // Score the news importance
                const importance = this.evaluator.evaluateImportance(newsItem, sentiment);
                
                // Check if similar to recent content
                const isRedundant = this.queue.items().some(item => 
                    this.evaluator.isSimilarToRecent(newsItem, [item])
                );
                
                if (isRedundant) {
                    this.logger.info(`Skipping similar content: ${newsItem.title}`);
                    return;
                }
                
                // Only process important news
                if (importance > (this.config.thresholds?.importanceThreshold ?? 5)) {
                    this.stats.highImportanceProcessed++;
                    
                    // Check blockchain data for enhanced context if available
                    const blockchainContext = await this.blockchain.getContextForNews(newsItem)
                        .catch(err => {
                            this.logger.warn(`Failed to get blockchain context: ${err.message}`);
                            return null;
                        });
                    
                    // Get trending topics for better hashtags
                    const trendingTags = await this.trending.getRelevantTags(newsItem)
                        .catch(err => {
                            this.logger.warn(`Failed to get trending tags: ${err.message}`);
                            return [];
                        });
                    
                    // Generate tweet with additional context
                    const tweet = await this.content.generate(
                        newsItem, 
                        sentiment,
                        { blockchainData: blockchainContext, trendingTags }
                    );
                    
                    // Add to scheduler with importance score
                    this.scheduler.addToQueue(tweet, importance);
                    
                    // Check if we can post now (respect rate limits)
                    if (this.scheduler.shouldTweetNow() && this.rateLimiter.canMakeRequest()) {
                        const nextTweet = this.scheduler.getNextTweetToPost();
                        if (nextTweet) {
                            await this.twitter.post(nextTweet.content);
                            this.stats.tweetsPosted++;
                            
                            // Track analytics
                            await this.analytics.trackTweet(nextTweet, sentiment, importance);
                            
                            this.logger.info('Tweet posted successfully');
                            
                            // Optionally wait for tweet metrics after some time
                            setTimeout(async () => {
                                try {
                                    // Assume post() returns an object with the tweet ID
                                    const tweetId = nextTweet.id;
                                    if (tweetId) {
                                        const metrics = await this.twitter.getMetrics(tweetId);
                                        await this.analytics.updateTweetMetrics(tweetId, metrics);
                                    }
                                } catch (err) {
                                    const error = err as Error;
                                    this.logger.warn(`Failed to get tweet metrics: ${error.message}`);
                                }
                            }, 30 * 60 * 1000); // Check after 30 minutes
                        }
                    }
                } else {
                    this.stats.lowImportanceSkipped++;
                    this.logger.info(`Skipping low importance news (score: ${importance}): ${newsItem.title}`);
                }
            } catch (error) {
                this.stats.errors++;
                this.logger.error('Processing failed:', error);
            }
        });
        
        // Listen for blockchain events
        this.blockchain.on('significant-event', async (event) => {
            this.logger.info(`Significant blockchain event detected: ${event.type}`);
            
            try {
                // Generate tweet about important blockchain event
                const tweet = await this.content.generateFromBlockchainEvent(event);
                
                // High importance for blockchain events
                const importance = 9;
                
                // Add to scheduler with high priority
                this.scheduler.addToQueue(tweet, importance);
                
                // Try to post immediately if important enough
                if (this.rateLimiter.canMakeRequest()) {
                    await this.twitter.post(tweet.content);
                    this.stats.tweetsPosted++;
                    this.logger.info('Blockchain event tweet posted');
                }
            } catch (error) {
                this.stats.errors++;
                this.logger.error('Failed to process blockchain event:', error);
            }
        });
    }

    async start(): Promise<void> {
        try {
            await this.initializeServices();
            this.isRunning = true;
            await Promise.all([
                this.news.startStreaming(),
                this.blockchain.startStreaming()
            ]);
            this.startPeriodicTasks();
            this.logger.info('CryptoNewsBot started successfully');
        } catch (error) {
            this.logger.error('Failed to start CryptoNewsBot:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        try {
            this.isRunning = false;
            this.eventEmitter.removeAllListeners();
            await Promise.all([
                this.news.stopStreaming(),
                this.blockchain.stopStreaming()
            ]);
            this.logger.info('CryptoNewsBot stopped successfully');
        } catch (error) {
            this.logger.error('Failed to stop CryptoNewsBot:', error);
            throw error;
        }
    }

    private async initializeServices(): Promise<void> {
        try {
            await Promise.all([
                this.twitter.initialize(),
                this.news.initialize(),
                this.blockchain.initialize(),
                this.trending.initialize()
            ]);
            this.logger.info('Services initialized successfully');
        } catch (error) {
            this.logger.error('Service initialization failed:', error);
            throw error;
        }
    }
    
    private startPeriodicTasks(): void {
        // Check and post from queue periodically
        setInterval(() => {
            if (!this.isRunning) return;
            
            this.processQueue();
        }, 15 * 60 * 1000); // Every 15 minutes
        
        // Generate daily summary
        setInterval(() => {
            if (!this.isRunning) return;
            
            this.generateDailySummary();
        }, 24 * 60 * 60 * 1000); // Once a day
    }
    
    private async processQueue(): Promise<void> {
        if (!this.rateLimiter.canMakeRequest()) {
            this.logger.info('Rate limit reached, skipping queue processing');
            return;
        }
        
        if (this.scheduler.shouldTweetNow()) {
            const nextTweet = this.scheduler.getNextTweetToPost();
            if (nextTweet) {
                try {
                    await this.twitter.post(nextTweet.content);
                    this.stats.tweetsPosted++;
                    this.logger.info('Queued tweet posted successfully');
                } catch (error) {
                    this.stats.errors++;
                    this.logger.error('Failed to post queued tweet:', error);
                }
            }
        }
    }
    
    private async generateDailySummary(): Promise<void> {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const analyticsData = await this.analytics.getDailySummary(yesterday);
            
            const summaryTweet = await this.content.generateDailySummary(analyticsData);
            
            if (this.rateLimiter.canMakeRequest()) {
                await this.twitter.post(summaryTweet.content);
                this.logger.info('Daily summary tweet posted');
            } else {
                this.scheduler.addToQueue(summaryTweet, 7); // Relatively high importance
                this.logger.info('Daily summary added to queue');
            }
        } catch (error) {
            this.logger.error('Failed to generate daily summary:', error);
        }
    }
    
    // Public method to get bot statistics
    getStats(): typeof this.stats {
        return { ...this.stats };
    }
}




