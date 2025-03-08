import axios from 'axios';
import dotenv from 'dotenv';
import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

export interface NewsArticle {
  source?: {
    id?: string;
    name?: string;
  };
  author?: string;
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  publishedAt?: string;
  content?: string;
  importanceScore?: number;
}

export class NewsManager {
  private apiKey: string;
  private sources: string[];
  private rssFeeds: string[];
  private rssParser: Parser;

  constructor() {
    // Check for API key
    this.apiKey = process.env.NEWS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('No NEWS_API_KEY found in environment variables. Using RSS feeds and mock data instead.');
    }

    // Default crypto news sources for News API
    this.sources = [
      'cointelegraph',
      'coindesk',
      'crypto-coins-news',
      'the-block',
      'wired',
      'the-verge'
    ];
    
    // RSS feeds for crypto news
    this.rssFeeds = [
      'https://cointelegraph.com/rss',
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://decrypt.co/feed',
      'https://cryptoslate.com/feed/',
      'https://bitcoinmagazine.com/feed'
    ];
    
    // Initialize RSS parser
    this.rssParser = new Parser();
  }

  /**
   * Fetches latest crypto news articles from multiple sources
   */
  async fetchLatestNews(maxResults = 20): Promise<NewsArticle[]> {
    try {
      let articles: NewsArticle[] = [];
      
      // Try fetching from RSS feeds first
      console.log('Fetching news from RSS feeds...');
      const rssArticles = await this.fetchFromRssFeeds(maxResults);
      articles.push(...rssArticles);
      
      // If we have enough articles, return them
      if (articles.length >= maxResults) {
        return articles.slice(0, maxResults);
      }
      
      // Otherwise, try News API if key available
      if (this.apiKey) {
        console.log('Fetching news from News API...');
        const newsApiArticles = await this.fetchFromNewsApi(maxResults - articles.length);
        articles.push(...newsApiArticles);
      }
      
      // If we still don't have enough articles, use mock data
      if (articles.length === 0) {
        console.log('Using mock news data as fallback');
        return this.getMockNewsData();
      }
      
      return articles;
    } catch (error) {
      console.error('Error fetching news:', error);
      return this.getMockNewsData();
    }
  }
  
  /**
   * Fetches news from RSS feeds
   */
  private async fetchFromRssFeeds(maxResults: number): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    
    for (const feedUrl of this.rssFeeds) {
      try {
        console.log(`  Fetching from RSS: ${feedUrl}`);
        const feed = await this.rssParser.parseURL(feedUrl);
        
        // Get the source name from feed title or URL
        const sourceName = feed.title || new URL(feedUrl).hostname.replace('www.', '');
        
        // Convert RSS items to NewsArticle format
        const feedArticles = await Promise.all(
          feed.items.slice(0, Math.ceil(maxResults / this.rssFeeds.length)).map(async item => {
            // Extract content from article if available
            let content = item.content || item.contentSnippet || '';
            let imageUrl;
            
            // Try to extract image and better content if we have the full HTML
            if (item.content && item.content.includes('<img')) {
              const dom = new JSDOM(item.content);
              const img = dom.window.document.querySelector('img');
              if (img && img.src) {
                imageUrl = img.src;
              }
            }
            
            // If we have a link, try to fetch the article to get more content
            if (item.link && content.length < 150) {
              try {
                const articleContent = await this.scrapeArticleContent(item.link);
                if (articleContent.content) content = articleContent.content;
                if (articleContent.image && !imageUrl) imageUrl = articleContent.image;
              } catch (e) {
                // Silently fail and use what we have
              }
            }
            
            return {
              source: {
                id: sourceName.toLowerCase().replace(/\s+/g, '-'),
                name: sourceName
              },
              author: item.creator || item.author || undefined,
              title: item.title || 'No Title',
              description: item.contentSnippet || '',
              url: item.link || '',
              urlToImage: imageUrl,
              publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
              content: content
            };
          })
        );
        
        articles.push(...feedArticles);
      } catch (error) {
        console.warn(`Error fetching RSS feed ${feedUrl}:`, error);
        // Continue with next feed
      }
    }
    
    return articles;
  }
  
  /**
   * Attempts to scrape article content from URL
   */
  private async scrapeArticleContent(url: string): Promise<{content?: string, image?: string}> {
    try {
      const response = await axios.get(url, { 
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CryptoNewsBot/1.0)' }
      });
      
      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      
      // Look for the main article content using common selectors
      const contentSelectors = [
        'article', '.post-content', '.article-body', '.entry-content', 
        '[itemprop="articleBody"]', '.story-body'
      ];
      
      let contentElement = null;
      for (const selector of contentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }
      
      // Extract text content
      let content = '';
      if (contentElement) {
        // Remove scripts, styles, and comments
        const scripts = contentElement.querySelectorAll('script, style');
        // Add explicit type for script parameter
        scripts.forEach((script: Element) => script.remove());
        
        content = contentElement.textContent || '';
        // Clean up whitespace
        content = content.replace(/\s+/g, ' ').trim();
      }
      
      // Get the main image
      let image: string | undefined;
      const metaImage = document.querySelector('meta[property="og:image"]');
      if (metaImage && metaImage.getAttribute('content')) {
        image = metaImage.getAttribute('content') || undefined;
      } else {
        const firstImage = document.querySelector('article img, .post-content img');
        if (firstImage && firstImage.getAttribute('src')) {
          image = firstImage.getAttribute('src') || undefined;
        }
      }
      
      return {
        content: content.length > 0 ? content : undefined,
        image
      };
    } catch (error) {
      console.warn(`Error scraping article content from ${url}:`, error);
      return {};
    }
  }
  
  /**
   * Fetches news from News API
   */
  private async fetchFromNewsApi(maxResults: number): Promise<NewsArticle[]> {
    try {
      const sourcesString = this.sources.join(',');
      const url = `https://newsapi.org/v2/everything?q=cryptocurrency+OR+bitcoin+OR+ethereum&sources=${sourcesString}&language=en&sortBy=publishedAt&pageSize=${maxResults}&apiKey=${this.apiKey}`;
      
      const response = await axios.get(url);
      
      if (response.data.status === 'ok') {
        return response.data.articles;
      } else {
        console.error('Error fetching from News API:', response.data.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching from News API:', error);
      return [];
    }
  }

  /**
   * Ranks articles by importance using various factors
   */
  async rankArticlesByImportance(articles: NewsArticle[]): Promise<NewsArticle[]> {
    // Add importance scoring logic here
    // For now, we'll use a simple algorithm based on keywords and recency
    const importantKeywords = [
      'bitcoin', 'ethereum', 'regulation', 'sec', 'etf', 'adoption',
      'major', 'breaking', 'surge', 'crash', 'record', 'milestone'
    ];

    const rankedArticles = articles.map(article => {
      let score = 0;
      const title = article.title.toLowerCase();
      const content = article.content?.toLowerCase() || '';
      const description = article.description?.toLowerCase() || '';
      
      // Check for important keywords
      importantKeywords.forEach(keyword => {
        if (title.includes(keyword.toLowerCase())) score += 10;
        if (content.includes(keyword.toLowerCase())) score += 5;
        if (description.includes(keyword.toLowerCase())) score += 3;
      });
      
      // Boost score for articles with images
      if (article.urlToImage) score += 5;
      
      // Boost score for articles from major sources
      if (article.source?.name?.toLowerCase().includes('coindesk') || 
          article.source?.name?.toLowerCase().includes('cointelegraph') ||
          article.source?.name?.toLowerCase().includes('decrypt')) {
        score += 8;
      }
      
      // Adjust for recency (if publishedAt exists)
      if (article.publishedAt) {
        const pubDate = new Date(article.publishedAt);
        const now = new Date();
        const hoursDifference = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
        
        // Newer articles get higher scores
        if (hoursDifference < 2) score += 15;
        else if (hoursDifference < 6) score += 10;
        else if (hoursDifference < 12) score += 5;
      }
      
      // Reduce score for articles with very short content
      const contentLength = (article.content?.length || 0) + (article.description?.length || 0);
      if (contentLength < 100) score -= 5;
      
      return {
        ...article,
        importanceScore: score
      };
    });
    
    // Sort by importance score (highest first)
    return rankedArticles.sort((a, b) => 
      (b.importanceScore || 0) - (a.importanceScore || 0)
    );
  }

  /**
   * Provides mock news data for testing
   */
  private getMockNewsData(): NewsArticle[] {
    return [
      {
        source: { name: "CoinDesk" },
        author: "Michael Casey",
        title: "Bitcoin Surges to New All-Time High Above $95,000",
        description: "Bitcoin has broken past $95,000 for the first time, extending its rally as institutional adoption continues to grow.",
        url: "https://www.coindesk.com/markets/2025/03/08/bitcoin-surges-to-new-all-time-high-above-95000/",
        urlToImage: "https://www.coindesk.com/resizer/bitcoin-image.jpg",
        publishedAt: new Date().toISOString(),
        content: "Bitcoin (BTC) climbed above $95,000 for the first time in history, marking a new all-time high as institutional buying continues. The cryptocurrency has gained over 25% in the past month, fueled by strong ETF inflows and decreasing supply after the 2024 halving event. Analysts point to increased institutional adoption and growing recognition of Bitcoin as a store of value in uncertain macroeconomic conditions."
      },
      {
        source: { name: "CoinTelegraph" },
        title: "Ethereum ETF Approval Expected by June, Says Bloomberg Analyst",
        description: "Bloomberg ETF analyst suggests that Ethereum ETF approval is likely in the next few months.",
        url: "https://cointelegraph.com/news/ethereum-etf-approval-expected-by-june",
        publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        content: "Ethereum ETFs could see approval as early as June, according to Bloomberg's senior ETF analyst. The SEC has been engaging with potential issuers in a manner that suggests preparations for approval, following the successful launch of Bitcoin spot ETFs earlier this year. If approved, these ETFs would open Ethereum to a new class of institutional investors."
      },
      {
        source: { name: "The Block" },
        title: "FTX Creditors to Receive 100% of Claims Value, Court Approves Final Distribution Plan",
        description: "Court approves final distribution plan ensuring full repayment to FTX creditors.",
        url: "https://www.theblock.co/ftx-creditors-full-repayment",
        publishedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        content: "In an unexpected turn of events, FTX creditors will receive 100% of their claims, according to the final distribution plan approved by the bankruptcy court. The estate's recovery of assets, combined with the appreciation of crypto holdings during bankruptcy proceedings, has created a surplus that will allow full repayment to creditors. This marks a rare positive outcome in crypto bankruptcy cases."
      },
      {
        source: { name: "Crypto News" },
        title: "Ripple Partners With Major Central Bank for CBDC Development",
        description: "Ripple announces strategic partnership with G20 nation for CBDC development.",
        url: "https://cryptonews.com/ripple-central-bank-partnership",
        publishedAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        content: "Ripple has announced a strategic partnership with a G20 nation's central bank to develop a central bank digital currency (CBDC) infrastructure. The partnership represents one of the most significant enterprise adoptions of blockchain technology to date and could serve as a model for other countries exploring digital currencies."
      },
      {
        source: { name: "Wired" },
        title: "NFT Renaissance: Digital Art Sales Reach New Heights in 2025",
        description: "NFT market sees unprecedented growth with focus on sustainability and artist royalties.",
        url: "https://www.wired.com/nft-renaissance-2025",
        publishedAt: new Date(Date.now() - 18000000).toISOString(), // 5 hours ago
        content: "After the crash of 2022, NFT markets are experiencing a renaissance with digital art sales reaching new heights. The resurgence is marked by more sustainable practices, improved infrastructure, and greater focus on artistic merit rather than speculation. New platforms emphasizing artist royalties and environmental sustainability are leading the charge."
      }
    ];
  }
}