import { ContentGenerator } from '../src/services/contentGenerator';
import { ContentType, NewsItem, Sentiment } from '../src/types/types';

describe('ContentGenerator', () => {
    let contentGenerator: ContentGenerator;

    beforeEach(() => {
        contentGenerator = new ContentGenerator();
    });

    it('should generate content with sentiment', async () => {
        const newsItem: NewsItem = {
            title: "Bitcoin Reaches New ATH",
            summary: "Bitcoin price reaches $100,000 marking a new all-time high",
            type: ContentType.NEWS,
            source: "CryptoNews"
        };

        const sentiment: Sentiment = {
            label: "positive",
            score: 0.8
        };

        const tweet = await contentGenerator.generate(newsItem, sentiment);
        
        expect(tweet).toBeDefined();
        expect(tweet.content.length).toBeLessThanOrEqual(280);
        expect(tweet.type).toBe(ContentType.NEWS);
        expect(tweet.source).toBe("CryptoNews");
    });

    it('should use fallback template when API fails', async () => {
        const newsItem: NewsItem = {
            title: "Market Update",
            summary: "Crypto market shows strong recovery signals",
            type: ContentType.NEWS,
            source: "CryptoMonitor"
        };

        const sentiment: Sentiment = {
            label: "positive",
            score: 0.6
        };

        const tweet = await contentGenerator.generate(newsItem, sentiment);
        
        expect(tweet.content).toContain(newsItem.title);
        expect(tweet.content).toContain(newsItem.summary);
    });
});