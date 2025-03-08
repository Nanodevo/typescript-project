import axios from 'axios';
import Parser from 'rss-parser';
import { NewsSource, NewsItem, ContentType } from '../types/types';
import { EventEmitter } from 'events';

export class NewsMonitor extends EventEmitter {
    private parser: Parser;
    private sources: NewsSource[];
    private lastChecked: Map<string, Date>;
    private interval: NodeJS.Timeout | null = null;

    constructor(sources: NewsSource[]) {
        super(); // Initialize EventEmitter
        this.parser = new Parser();
        this.sources = sources;
        this.lastChecked = new Map();
    }

    async initialize(): Promise<void> {
        // Initialize RSS feeds
        for (const source of this.sources) {
            this.lastChecked.set(source.url, new Date());
        }
    }

    private async checkFeeds(): Promise<void> {
        for (const source of this.sources) {
            try {
                console.log(`Checking feed: ${source.url}`);
                
                // First check if the URL is accessible
                try {
                    const response = await axios.head(source.url);
                    console.log(`Feed URL status: ${response.status}`);
                } catch (error) {
                    const err = error as Error;
                    console.error(`Cannot access URL ${source.url}:`, err.message);
                    continue; // Skip to next source
                }
                
                // Try parsing the feed
                let feed;
                try {
                    feed = await this.parser.parseURL(source.url);
                } catch (parseError) {
                    const error = parseError as Error;
                    console.error(`Failed to parse feed ${source.url}:`, error.message);
                    
                    // Try fetching raw content and inspect it
                    try {
                        const rawResponse = await axios.get(source.url);
                        console.log(`Raw content from ${source.url} (first 200 chars):`);
                        console.log(rawResponse.data.substring(0, 200));
                    } catch (fetchError) {
                        const error = fetchError as Error;
                        console.error(`Failed to fetch raw content:`, error.message);
                    }
                    
                    continue; // Skip to next source
                }
                
                console.log(`Successfully parsed feed from ${source.url}`);
                console.log(`Feed title: ${feed.title}`);
                console.log(`Found ${feed.items?.length || 0} items in feed`);
                
                if (!feed.items || feed.items.length === 0) {
                    console.log(`No items found in feed ${source.url}`);
                    continue;
                }
                
                // Process feed items
                const lastCheck = this.lastChecked.get(source.url) || new Date(0);
                console.log(`Last check time: ${lastCheck.toISOString()}`);
                
                let newItemCount = 0;
                for (const item of feed.items) {
                    // Debug first item
                    if (feed.items.indexOf(item) === 0) {
                        console.log('First item in feed:');
                        console.log('- Title:', item.title);
                        console.log('- Date:', item.pubDate);
                        console.log('- Link:', item.link);
                    }
                    
                    // Parse date safely
                    let pubDate: Date;
                    try {
                        pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                        // Check if date parsing worked properly
                        if (isNaN(pubDate.getTime())) {
                            console.log(`Invalid date format: ${item.pubDate}`);
                            pubDate = new Date(); // Use current date as fallback
                        }
                    } catch (dateError) {
                        console.log(`Error parsing date: ${item.pubDate}`);
                        pubDate = new Date();
                    }
                    
                    if (pubDate > lastCheck) {
                        newItemCount++;
                        const newsItem: NewsItem = {
                            title: item.title || 'No Title',
                            summary: item.contentSnippet || item.content || 'No summary available',
                            source: source.url,
                            type: ContentType.NEWS,
                            content: item.content || item.contentSnippet || ''
                        };
                        this.emit('update', newsItem);
                    }
                }
                
                console.log(`Found ${newItemCount} new items since last check`);
                this.lastChecked.set(source.url, new Date());
            } catch (error) {
                console.error(`Error processing feed ${source.url}:`, error);
            }
        }
    }

    public async refreshFeeds(): Promise<void> {
        return this.checkFeeds();
    }

    async startStreaming(): Promise<void> {
        if (this.interval) {
            return; // Already streaming
        }
        
        this.interval = setInterval(async () => {
            try {
                await this.checkFeeds();
            } catch (error) {
                console.error('Error checking feeds:', error);
            }
        }, 60000); // Check every minute
        
        // Initial check
        await this.checkFeeds();
    }

    async stopStreaming(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    public setLastChecked(url: string, date: Date): void {
        this.lastChecked.set(url, date);
    }
}