import { TwitterApi } from 'twitter-api-v2';

export enum ContentType {
    NEWS = 'news',
    ALERT = 'alert',
    ANALYSIS = 'analysis',
    SUMMARY = 'summary'
}

export interface TwitterCredentials {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
}

export interface NewsSource {
    url: string;
    type: 'rss' | 'api';
    category: 'crypto' | 'ai' | 'tech';
}

export interface BlockchainConfig {
    provider: string;
    network: string;
    minTransactionValue: number;
}

export interface NewsItem {
    title: string;
    summary: string;
    content?: string;
    type: ContentType;
    source: string;
}

export interface Tweet {
    content: string;
    type: ContentType;
    source: string;
    id?: string;
    // Add other properties as needed
}

export interface AnalyticsData {
    id: string;
    impressionCount: number;
    likeCount: number;
    retweetCount: number;
    replyCount: number;
    quoteCount: number;
    
}

export interface AccountMetrics {
    followers: number;
    engagement: {
        likes: number;
        retweets: number;
        replies: number;
        quotes: number;
    };
    performance: {
        impressions: number;
        clickRate: number;
    };
}

export interface TwitterConfig {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
}

export interface BotConfig {
    thresholds?: {
        importanceThreshold: number;
    };
    rateLimits?: {
        tweetsPerHour: number;
    };
    twitter?: {
        username: string;
        apiKey: string;
        apiSecret: string;
        accessToken: string;
        accessTokenSecret: string;
    };
    newsSources?: Array<{
        url: string;
        type: 'rss' | 'api';
        category: string;
    }>;
    blockchain?: {
        networks: string[];
        apiKeys: Record<string, string>;
    };
}

export interface Sentiment {
    label: string;
    score: number;
}

export class TwitterManager {
    private client: TwitterApi;

    constructor(config: TwitterConfig) {
        this.client = new TwitterApi({
            appKey: config.apiKey,
            appSecret: config.apiSecret,
            accessToken: config.accessToken,
            accessSecret: config.accessTokenSecret,
        });
    }

    public async initialize(): Promise<void> {
        return Promise.resolve();
    }

    public async post(content: string): Promise<void> {
        await this.client.v2.tweet(content);
    }

    public async getMetrics(tweetId: string): Promise<AnalyticsData> {
        const tweet = await this.client.v2.singleTweet(tweetId, {
            'tweet.fields': ['public_metrics']
        });

        return {
            id: tweet.data.id,
            impressionCount: tweet.data.public_metrics?.impression_count || 0,
            likeCount: tweet.data.public_metrics?.like_count || 0,
            retweetCount: tweet.data.public_metrics?.retweet_count || 0,
            replyCount: tweet.data.public_metrics?.reply_count || 0,
            quoteCount: tweet.data.public_metrics?.quote_count || 0
        };
    }

    public async getAccountMetrics(): Promise<any> {
        const user = await this.client.v2.me({
            'user.fields': ['public_metrics']
        });
        return user;
    }

    public getClient(): TwitterApi {
        return this.client;
    }
}