import { NewsMonitor } from '../src/core/newsMonitor';
import { NewsSource, ContentType } from '../src/types/types';

async function testNewsMonitor() {
  // Configure test sources - using reliable tech news sources
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

  // Create monitor instance
  const newsMonitor = new NewsMonitor(sources);
  
  // Set up event listener
  newsMonitor.on('update', (newsItem) => {
    console.log('=== NEWS ITEM RECEIVED ===');
    console.log('Title:', newsItem.title);
    console.log('Summary:', newsItem.summary?.substring(0, 100) + '...');
    console.log('Source:', newsItem.source);
    console.log('Type:', newsItem.type);
    console.log('==========================\n');
  });

  // Initialize and start
  console.log('Initializing news monitor...');
  await newsMonitor.initialize();
  
  console.log('Starting feed check...');
  await newsMonitor.refreshFeeds();  // Use the public method to check feeds
  
  console.log('Starting streaming...');
  await newsMonitor.startStreaming();

  // Keep the process alive
  console.log('Monitoring for news...');
}

testNewsMonitor().catch(error => {
  console.error('Test failed:', error);
});