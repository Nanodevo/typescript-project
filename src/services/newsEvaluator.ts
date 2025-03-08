// Add to src/services/newsEvaluator.ts
//It should search the news not only known websites but also 
//  twitter account, all around the world with different languages.
//  It will evaluate all the news around the world and make a sence out of it 
//  project short-mid-long term effects of the recent developements.
import { NewsItem, Sentiment } from '../types/types';

export class NewsEvaluator {
  evaluateImportance(newsItem: NewsItem, sentiment: Sentiment): number {
    let score = 0;
    
    // Score based on keywords in title/summary
    const highValueKeywords = ['bitcoin', 'btc', 'eth', 'ethereum', 'ripple', 'xrp', 'regulation', 'sec'];
    const mediumValueKeywords = ['crypto', 'blockchain', 'defi', 'nft', 'web3', 'wallet', 'exchange'];
    
    // Check title
    highValueKeywords.forEach(keyword => {
      if (newsItem.title.toLowerCase().includes(keyword)) score += 3;
    });
    
    mediumValueKeywords.forEach(keyword => {
      if (newsItem.title.toLowerCase().includes(keyword)) score += 1.5;
    });
    
    // Check summary
    highValueKeywords.forEach(keyword => {
      if ((newsItem.summary?.toLowerCase() || '').includes(keyword)) score += 1;
    });
    
    // Strong sentiment (positive or negative) is more engaging than neutral
    const sentimentIntensity = Math.abs(sentiment.score);
    if (sentimentIntensity > 0.5) score += 4;
    else if (sentimentIntensity > 0.2) score += 2;
    
    // Prefer more detailed news
    if ((newsItem.summary?.length || 0) > 150) score += 1;
    
    // Prefer certain sources
    const premiumSources = ['coindesk.com', 'cointelegraph.com', 'bloomberg.com'];
    if (premiumSources.some(source => newsItem.source.includes(source))) score += 2;
    
    return score;
  }

  isSimilarToRecent(newsItem: NewsItem, recentItems: NewsItem[]): boolean {
    for (const recent of recentItems) {
      if (this.calculateSimilarity(newsItem.title, recent.title) > 0.7) {
        return true;
      }
    }
    return false;
  }
    // To-do : add a logic for quoting the previous tweet when there is an update on the news for the same matter. 
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}