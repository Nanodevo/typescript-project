import { Tweet, Sentiment } from '../types/types';
import { TwitterManager } from '../core/twitterManager';

interface ErrorLog {
    timestamp: Date;
    type: string;
    message: string;
    stack?: string;
    context?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AnalyticsData {
    id: string;
    impressionCount: number;
    likeCount?: number;
    retweetCount?: number;
    replyCount?: number;
    quoteCount?: number;
    tweetCount?: number;
    engagementRate?: number;
    date?: string;
    engagement?: {
        likes?: number;
        retweets?: number;
        replies?: number;
        quotes?: number;
    };
    performance?: {
        impressions: number;
        clickRate?: number;
    };
}
// Comprehensive analytics data structure
export interface AccountMetrics {
    id?: string;
    followers?: number;
    impressionCount?: number;
    engagement: {
        likes?: number;
        retweets?: number;
        replies?: number;
        quotes?: number;
    };
    performance?: {
        impressions: number;
        clickRate?: number;
    };
    // Add other metrics as needed
}

export class Analytics {
    private data: AccountMetrics;
    private errorLogs: ErrorLog[] = [];
    private tweetAnalytics: Map<string, any> = new Map();

    constructor(private twitter: TwitterManager) {
        this.data = {
            id: '',
            followers: 0,
            impressionCount: 0,
            engagement: {
                likes: 0,
                retweets: 0,
                replies: 0,
                quotes: 0
            },
            performance: {
                impressions: 0,
                clickRate: 0
            }
        };
    }

    async update(): Promise<void> {
        const metrics = await this.twitter.getAccountMetrics();
        this.data = {
            ...this.data,
            ...metrics
        };
    }

    getMetrics(): AccountMetrics {
        return this.data;
    }

    analyzePerformance(): {
        trending: boolean;
        recommendations: string[];
    } {
        // Implement performance analysis logic
        const prevFollowers = this.data.followers || 0; // Default to 0 if undefined
        return {
            trending: (this.data.followers || 0) > prevFollowers,
            recommendations: this.generateRecommendations()
        };
    }

    private generateRecommendations(): string[] {
        // Implement AI-based recommendations
        return [];
    }

    async trackSuccess(tweet: Tweet): Promise<void> {
        try {
            // Get tweet metrics - ensure tweet has an ID
            if (!tweet.id) {
                console.warn('Cannot track tweet without ID');
                return;
            }
            
            const metrics = await this.twitter.getMetrics(tweet.id);
            
            // Store engagement data
            const engagementData = {
                timestamp: new Date(),
                tweetId: metrics.id,
                content: tweet.content,
                type: tweet.type,
                source: tweet.source,
                metrics: {
                    impressions: metrics.impressionCount || 0,
                    likes: metrics.likeCount || 0,  // Use likeCount from AnalyticsData
                    retweets: metrics.retweetCount || 0,  // Use retweetCount from AnalyticsData
                    replies: metrics.replyCount || 0,  // Use replyCount from AnalyticsData
                    quotes: metrics.quoteCount || 0   // Use quoteCount from AnalyticsData
                },
                performance: {
                    engagementRate: this.calculateEngagementRate(metrics),
                    successScore: this.calculateSuccessScore(metrics)
                }
            };

            // Store analytics data for future reference
            await this.storeAnalytics(engagementData);

        } catch (error) {
            this.trackError(error as Error, 'success_tracking');
        }
    }

    private calculateEngagementRate(metrics: AnalyticsData): number {
        const totalEngagements = 
            (metrics.likeCount || 0) + 
            (metrics.retweetCount || 0) + 
            (metrics.replyCount || 0);
        return metrics.impressionCount ? totalEngagements / metrics.impressionCount : 0;
    }

    private calculateSuccessScore(metrics: AnalyticsData): number {
        // Weight different engagement types
        const weights = {
            likes: 1,
            retweets: 2,
            replies: 3,
            quotes: 2
        };
        
        return (
            (metrics.likeCount || 0) * weights.likes +
            (metrics.retweetCount || 0) * weights.retweets +
            (metrics.replyCount || 0) * weights.replies +
            (metrics.quoteCount || 0) * weights.quotes
        );
    }

    private async storeAnalytics(data: any): Promise<void> {
        // Store analytics data for learning
        // Implementation depends on your storage solution
        console.log('Storing analytics:', data);
        this.tweetAnalytics.set(data.tweetId, data);
    }

    // Implementation for methods required by the bot
    async trackTweet(tweet: Tweet, sentiment: Sentiment, importance: number): Promise<void> {
        // Store initial data about the tweet
        const tweetData = {
            id: tweet.id || `tweet-${Date.now()}`,
            content: tweet.content,
            timestamp: new Date(),
            type: tweet.type,
            source: tweet.source,
            sentiment: {
                label: sentiment.label,
                score: sentiment.score
            },
            importance: importance,
            metrics: {
                impressions: 0,
                likes: 0,
                retweets: 0,
                replies: 0,
                quotes: 0
            }
        };
        
        // Store for later updates
        this.tweetAnalytics.set(tweetData.id, tweetData);
        console.log(`Tracking new tweet: ${tweetData.id}`);
        
        return Promise.resolve();
    }

    async updateTweetMetrics(tweetId: string, metrics: any): Promise<void> {
        // Get existing data
        const tweetData = this.tweetAnalytics.get(tweetId);
        
        if (!tweetData) {
            console.warn(`No tracking data found for tweet: ${tweetId}`);
            return Promise.resolve();
        }
        
        // Update with new metrics
        tweetData.metrics = {
            ...tweetData.metrics,
            ...metrics
        };
        
        tweetData.lastUpdated = new Date();
        tweetData.engagementRate = this.calculateEngagementRate(metrics);
        tweetData.successScore = this.calculateSuccessScore(metrics);
        
        // Store updated data
        this.tweetAnalytics.set(tweetId, tweetData);
        console.log(`Updated metrics for tweet: ${tweetId}`);
        
        return Promise.resolve();
    }

    async getDailySummary(date: Date): Promise<AnalyticsData> {
        // Find tweets from the specified date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Aggregate metrics for tweets from that day
        let totalImpressions = 0;
        let totalLikes = 0;
        let totalRetweets = 0;
        let totalReplies = 0;
        let totalQuotes = 0;
        let tweetCount = 0;
        
        // Iterate through tracked tweets
        for (const [_, tweetData] of this.tweetAnalytics) {
            const tweetTime = new Date(tweetData.timestamp);
            
            if (tweetTime >= startOfDay && tweetTime <= endOfDay) {
                totalImpressions += tweetData.metrics.impressions || 0;
                totalLikes += tweetData.metrics.likes || 0;
                totalRetweets += tweetData.metrics.retweets || 0;
                totalReplies += tweetData.metrics.replies || 0;
                totalQuotes += tweetData.metrics.quotes || 0;
                tweetCount++;
            }
        }
        
        // Create summary
        return {
            id: `summary-${date.toISOString().split('T')[0]}`,
            impressionCount: totalImpressions,
            engagement: {
                likes: totalLikes,
                retweets: totalRetweets,
                replies: totalReplies,
                quotes: totalQuotes
            },
            performance: {
                impressions: totalImpressions,
                clickRate: 0 // Would need click data to calculate
            },
            // Optional additional metrics
            tweetCount: tweetCount,
            engagementRate: totalImpressions > 0 ? 
                (totalLikes + totalRetweets + totalReplies + totalQuotes) / totalImpressions : 0,
            date: date.toISOString().split('T')[0]
        };
    }

    trackError(error: Error, context?: string): void {
        const errorLog: ErrorLog = {
            timestamp: new Date(),
            type: error.name,
            message: error.message,
            stack: error.stack,
            context: context,
            severity: this.calculateErrorSeverity(error)
        };

        // Store error log
        this.errorLogs.push(errorLog);

        // Log to console for development
        console.error('Error tracked:', errorLog);

        // If critical, trigger alert
        if (errorLog.severity === 'critical') {
            this.alertCriticalError(errorLog);
        }
    }

    private calculateErrorSeverity(error: Error): ErrorLog['severity'] {
        if (error instanceof TypeError || error instanceof ReferenceError) {
            return 'critical';
        }
        if (error.message.includes('rate limit') || error.message.includes('timeout')) {
            return 'medium';
        }
        return 'low';
    }

    private alertCriticalError(errorLog: ErrorLog): void {
        // Implement critical error notification
        console.error('CRITICAL ERROR:', errorLog);
    }

    getErrorLogs(): ErrorLog[] {
        return this.errorLogs;
    }
}


