// tests/integration.test.ts
import { NewsMonitor } from '../src/core/newsMonitor';
import { ContentGenerator } from '../src/services/contentGenerator';
import { SentimentAnalyzer } from '../src/services/sentiment';
import { NewsSource, ContentType } from '../src/types/types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testNewsToTweet() {
  try {
    // Set up components
    const sources: NewsSource[] = [
      {
        url: 'https://cointelegraph.com/rss',
        type: 'rss',
        category: 'crypto'
      },
      {
        url: 'https://feeds.feedburner.com/TheHackersNews',
        type: 'rss',
        category: 'tech'
      }
    ];

    const newsMonitor = new NewsMonitor(sources);
    const contentGenerator = new ContentGenerator(process.env.GEMINI_API_KEY || "", false);
    const sentimentAnalyzer = new SentimentAnalyzer();
    
    console.log('Setting up test environment...');
    
    // Set up news listener
    newsMonitor.on('update', async (newsItem) => {
      console.log('=== NEWS ITEM RECEIVED ===');
      console.log('Title:', newsItem.title);
      console.log('Summary:', newsItem.summary?.substring(0, 100) + '...');
      
      try {
        // Process the item
        console.log('Analyzing sentiment...');
        const sentiment = await sentimentAnalyzer.analyze(newsItem);
        console.log('Sentiment:', sentiment.label, '(score:', sentiment.score, ')');
        
        console.log('Generating tweet...');
        const tweet = await contentGenerator.generate(newsItem, sentiment);
        
        console.log('=== GENERATED TWEET ===');
        console.log(tweet.content);
        console.log('Characters:', tweet.content.length);
        console.log('=======================');
      } catch (error) {
        console.error('Error processing news item:', error);
      }
    });

    // Initialize and start news monitoring
    console.log('Initializing news monitor...');
    await newsMonitor.initialize();
    
    // Override timestamp to retrieve all news
    console.log('Setting timestamp to retrieve all news...');
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // 1 day ago
    sources.forEach(source => {
      newsMonitor.setLastChecked(source.url, pastDate);
    });
    
    console.log('Checking for news...');
    await newsMonitor.refreshFeeds();
    
    console.log('Test complete.');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testNewsToTweet().then(() => {
  console.log('Integration test finished');
});