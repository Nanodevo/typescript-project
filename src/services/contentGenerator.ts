//takes the news from the news evaluator and uses 
// it for posting a compelling post on twitter 
// uses his knowledge and if its connected to a previous posts
// he will quote that post when posting or start a thread 
// if there are follow up news on a matter.
// could be cool if it starts a poll on twitter also

import { GeminiApi } from './geminiApi';
import { RAGSystem } from './ragSystem';
import { NewsItem, Tweet, Sentiment, ContentType } from '../types/types';
import { Logger } from '../utils/logger';

export interface BlockchainEvent {
  type: string;
  data: any;
  timestamp?: Date;
  source?: string;
}

export interface GenerateOptions {
  blockchainData?: any;
  trendingTags?: string[];
}

export class ContentGenerator {
    private gemini?: GeminiApi;
    private rag?: RAGSystem;
    private logger: Logger;

    constructor(apiKey?: string, useRag = true) {
        if (apiKey) {
            this.gemini = new GeminiApi(apiKey);
        }
        if (useRag) {
            this.rag = new RAGSystem();
        }
        this.logger = new Logger();
    }

    private templates: Map<ContentType, string> = new Map();

    private initializeTemplates() {
        this.templates = new Map<ContentType, string>([
            ['news' as ContentType, 'Breaking: {title}\n\n{summary}'],
            ['alert' as ContentType, 'Transaction Alert: {amount} {token}\nFrom: {from}\nTo: {to}'],
            ['analysis' as ContentType, 'Market Analysis\n\n{summary}\n\nMarket Sentiment: {sentiment}']
        ]);
    }

    async generate(
        newsItem: NewsItem, 
        sentiment: Sentiment, 
        options?: GenerateOptions
    ): Promise<Tweet> {
        try {
            let prompt = '';
            
            if (this.rag) {
                // Use RAG if available
                prompt = await this.rag.enhancePrompt(`
                    Create a formal news tweet about this event:
                    Title: ${newsItem.title}
                    Summary: ${newsItem.summary}
                    Sentiment: ${sentiment.label}
                    
                    Requirements:
                    - Professional tone matching ${sentiment.label} sentiment
                    - Clear and concise
                    - Max 280 characters
                    - No hastags or emojis are used unless its necessary
                `);
            } else {
                // Use simple prompt without RAG
                prompt = `
                    Create a formal news tweet about this event:
                    Title: ${newsItem.title}
                    Summary: ${newsItem.summary}
                    Sentiment: ${sentiment.label}
                    
                    Requirements:
                    - Professional tone matching ${sentiment.label} sentiment
                    - Clear and concise
                    - Max 280 characters
                    - No hastags or emojis are used unless its necessary
                `;
            }

            if (this.gemini) {
                const content = await this.gemini.generateContent(prompt);
                return {
                    content: this.truncateToTwitterLimit(content),
                    type: newsItem.type,
                    source: newsItem.source
                };
            }
            
            // Fall back if no Gemini
            return this.fallbackGeneration(newsItem, sentiment);
        } catch (error) {
            console.error('Content generation failed:', error);
            return this.fallbackGeneration(newsItem, sentiment);
        }
    }

    async generateFromBlockchainEvent(event: BlockchainEvent): Promise<Tweet> {
        // Implementation
        return {
            content: `Blockchain event: ${event.type}`,
            type: ContentType.NEWS,
            source: "blockchain",
            id: `event-${Date.now()}`
        };
    }

    async generateDailySummary(analyticsData: any): Promise<Tweet> {
        // Implementation
        return {
            content: `Daily crypto summary: ${new Date().toLocaleDateString()}`,
            type: ContentType.SUMMARY,
            source: "analytics",
            id: `summary-${Date.now()}`
        };
    }

    private createPrompt(data: any): string {
        return `Create a compelling crypto tweet about: 
                ${data.title || data.summary}
                Requirements:
                - Keep it under 280 characters
                - Make it engaging and informative
                - No hastags or emojis are used unless its necessary`;
    }

    private fallbackGeneration(data: any, sentiment: any): Tweet {
        const template = this.templates.get(data.type) || this.templates.get('news' as ContentType);
        const content = this.formatContent(template!, data, sentiment);
        
        return {
            content: this.truncateToTwitterLimit(content),
            type: data.type,
            source: data.source
        };
    }

    private formatContent(content: string, data: any, sentiment: any): string {
        return content
            .replace('{title}', data.title || '')
            .replace('{summary}', data.summary || '')
            .replace('{sentiment}', sentiment?.label || '');
    }

    private truncateToTwitterLimit(content: string): string {
        return content.length > 280 ? content.substring(0, 277) + '...' : content;
    }

    async generatePost(newsItem: NewsItem): Promise<string> {
        let context = `Create a Twitter post about: ${newsItem.title}`;
        if (this.rag) {
            context = await this.rag.enhancePrompt(context);
        }
        if (!this.gemini) {
            throw new Error('Gemini API is not initialized');
        }
        return this.gemini.generateContent(context);
    }

    async storeContext(content: string, metadata: { timestamp: Date; type: string }): Promise<void> {
        try {
            if (!this.rag) {
                this.logger.warn('RAG system is not initialized, cannot store context');
                return;
            }
            await this.rag.storeContext(content, {
                ...metadata,
                embedding_type: 'tweet',
                timestamp: metadata.timestamp.toISOString()
            });
        } catch (error) {
            this.logger.error('Failed to store context:', error);
            // Don't throw - storage failure shouldn't break the main flow
        }
    }
}