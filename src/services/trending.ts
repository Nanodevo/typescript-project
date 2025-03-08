import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import { ChromaClient } from 'chromadb';
import { NewsItem } from '../types/types';

// Use in-memory ChromaDB to avoid requiring a server
const chromaClient = new ChromaClient({
  path: 'in-memory'
});

interface TrendingTopic {
    name: string;
    volume: number;
    sentiment: number;
    source: 'twitter' | 'crypto';
}

interface TrendingConfig {
    useTwitter?: boolean;
    useCoinGecko?: boolean;
}

export class TrendingTopics {
    private twitterClient?: TwitterApi;
    private cryptoKeywords: Set<string>;
    private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
    private readonly config: TrendingConfig;
    private cachedTrends: TrendingTopic[] = [];
    private lastUpdate: Date = new Date(0);
    private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    constructor(twitterClient?: TwitterApi, config: TrendingConfig = {}) {
        this.twitterClient = twitterClient;
        this.config = {
            useTwitter: !!twitterClient,
            useCoinGecko: true,
            ...config
        };
        
        // Common crypto-related keywords to detect trending topics
        this.cryptoKeywords = new Set([
            'bitcoin', 'btc', 'eth', 'ethereum', 
            'crypto', 'cryptocurrency', 'blockchain',
            'nft', 'web3', 'defi', 'dao', 'token',
            'binance', 'coinbase', 'altcoin'
        ]);
    }

    async initialize(): Promise<void> {
        try {
            const tasks: Promise<any>[] = [];
            
            // Test Twitter API if enabled
            if (this.config.useTwitter && this.twitterClient) {
                tasks.push(
                    this.twitterClient.v2.tweets(['1'])
                    .catch(err => {
                        console.warn('Twitter API initialization failed, disabling:', err.message);
                        this.config.useTwitter = false;
                    })
                );
            }
            
            // Test CoinGecko API if enabled
            if (this.config.useCoinGecko) {
                tasks.push(
                    axios.get(`${this.COINGECKO_API}/ping`)
                    .catch(err => {
                        console.warn('CoinGecko API initialization failed, disabling:', err.message);
                        this.config.useCoinGecko = false;
                    })
                );
            }
            
            // Wait for all API tests to complete
            if (tasks.length > 0) {
                await Promise.all(tasks);
            }
            
            // Initialize the trend cache
            await this.refreshTrends();
            
            console.log('TrendingTopics initialized successfully with services:', {
                twitter: this.config.useTwitter,
                coinGecko: this.config.useCoinGecko
            });
            
            return Promise.resolve();
        } catch (error) {
            console.error('API initialization failed:', error);
            // Don't reject promise - allow the service to run in degraded mode
            return Promise.resolve();
        }
    }

    async getTrends(forceRefresh = false): Promise<TrendingTopic[]> {
        try {
            // Check if cache is expired or refresh is forced
            const now = new Date();
            if (forceRefresh || now.getTime() - this.lastUpdate.getTime() > this.CACHE_TTL) {
                await this.refreshTrends();
            }
            
            return this.cachedTrends;
        } catch (error) {
            console.error('Failed to fetch trends:', error);
            return this.cachedTrends; // Return cached data even if refresh fails
        }
    }

    async getRelevantTags(newsItem: NewsItem): Promise<string[]> {
        if (!newsItem.title && !newsItem.summary) {
            return ['crypto', 'news']; // Default tags
        }
        
        try {
            // Get trending topics to enhance tags
            const trends = await this.getTrends();
            const trendingNames = new Set(trends.map(t => t.name.toLowerCase()));
            
            // Extract content to analyze
            const content = [
                newsItem.title || '',
                newsItem.summary || ''
            ].join(' ').toLowerCase();
            
            // Basic set of tags
            const tags = new Set(['crypto']);
            
            // Check for common crypto terms
            for (const keyword of this.cryptoKeywords) {
                if (content.includes(keyword)) {
                    tags.add(keyword);
                }
            }
            
            // Extract cryptocurrency symbols (e.g., $BTC, $ETH)
            const symbolMatches = content.match(/\$[a-z]{2,5}/gi) || [];
            symbolMatches.forEach(match => {
                tags.add(match.substring(1).toLowerCase()); // Remove $ and add to tags
            });
            
            // Check if any trending topics are mentioned
            for (const trend of trends) {
                const trendName = trend.name.replace('#', '').toLowerCase();
                if (content.includes(trendName)) {
                    tags.add(trendName);
                }
            }
            
            // Prioritize trending tags
            const allTags = Array.from(tags);
            const trendingTags = allTags.filter(tag => trendingNames.has(tag));
            const regularTags = allTags.filter(tag => !trendingNames.has(tag));
            
            // Combine and limit to reasonable number
            return [...trendingTags, ...regularTags].slice(0, 5);
            
        } catch (error) {
            console.error('Error generating tags:', error);
            
            // Fallback to basic tag extraction
            const content = [
                newsItem.title || '',
                newsItem.summary || ''
            ].join(' ').toLowerCase();
            
            const basicTags = ['crypto'];
            
            // Add basic crypto tags
            if (content.includes('bitcoin') || content.includes('btc')) basicTags.push('bitcoin');
            if (content.includes('ethereum') || content.includes('eth')) basicTags.push('ethereum');
            if (content.includes('nft')) basicTags.push('nft');
            if (content.includes('defi')) basicTags.push('defi');
            
            return basicTags;
        }
    }

    private async refreshTrends(): Promise<void> {
        const trends: TrendingTopic[] = [];
        
        try {
            const tasks: Promise<TrendingTopic[]>[] = [];
            
            // Add Twitter trends task if enabled
            if (this.config.useTwitter && this.twitterClient) {
                tasks.push(this.getTwitterTrends());
            }
            
            // Add CoinGecko trends task if enabled
            if (this.config.useCoinGecko) {
                tasks.push(this.getCryptoTrends());
            }
            
            // Execute API calls in parallel
            const results = await Promise.allSettled(tasks);
            
            // Process successful results
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    trends.push(...result.value);
                }
            });
            
            // Update cache
            this.cachedTrends = trends;
            this.lastUpdate = new Date();
            
        } catch (error) {
            console.error('Failed to refresh trends:', error);
            // Don't update last update time if refresh failed completely
        }
    }

    private async getTwitterTrends(): Promise<TrendingTopic[]> {
        if (!this.twitterClient) {
            return [];
        }
        
        try {
            // Get worldwide (id: 1) trending topics
            const trends = await this.twitterClient.v1.trendsByPlace(1);
            
            return trends[0].trends
                .filter(trend => 
                    Array.from(this.cryptoKeywords)
                        .some(keyword => 
                            trend.name.toLowerCase().includes(keyword)
                        )
                )
                .map(trend => ({
                    name: trend.name.replace('#', ''),  // Remove # for consistency
                    volume: trend.tweet_volume || 0,
                    sentiment: 0,
                    source: 'twitter' as const
                }));
        } catch (error) {
            console.error('Twitter trends fetch failed:', error);
            return [];
        }
    }

    private async getCryptoTrends(): Promise<TrendingTopic[]> {
        try {
            const response = await axios.get(
                `${this.COINGECKO_API}/search/trending`
            );
            
            return response.data.coins.map((coin: any) => ({
                name: coin.item.name.toLowerCase(),
                volume: coin.item.market_cap_rank || 0,
                sentiment: 0,
                source: 'crypto' as const
            }));
        } catch (error) {
            console.error('Crypto trends fetch failed:', error);
            return [];
        }
    }

    // Helper methods for testing
    getTrendingKeywords(): string[] {
        return Array.from(this.cryptoKeywords);
    }
    
    // Allow manual configuration update
    updateConfig(config: Partial<TrendingConfig>): void {
        this.config.useTwitter = config.useTwitter ?? this.config.useTwitter;
        this.config.useCoinGecko = config.useCoinGecko ?? this.config.useCoinGecko;
    }
}