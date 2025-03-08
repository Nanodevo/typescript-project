import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

interface TweetArticle {
  title: string;
  content: string;
  url: string;
  source: string;
}

interface TweetOptions {
  style?: 'informative' | 'enthusiastic' | 'analytical' | 'balanced';
  includeUrl?: boolean;
  maxLength?: number;
  standalone?: boolean;
  createThread?: boolean; // New option for thread creation
  maxTweets?: number; // Maximum number of tweets in a thread
}

export interface TweetThread {
  tweets: string[];
  isThread: boolean;
}

export class AiManager {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  /**
   * Generates a tweet based on a news article
   * Can return either a single tweet or a thread
   */
  async generateTweet(
    article: TweetArticle, 
    options: TweetOptions = {}
  ): Promise<string | TweetThread> {
    const {
      style = 'balanced',
      includeUrl = true,
      maxLength = 280,
      standalone = true,
      createThread = true, // Default to allowing threads
      maxTweets = 3 // Default to max 3 tweets in a thread
    } = options;

    try {
      // If we allow threads, try generating one first
      if (createThread && article.content.length > 400) {
        const thread = await this.generateTwitterThread(article, {
          style,
          includeUrl,
          maxLength,
          maxTweets
        });
        
        // If successful and we have multiple tweets, return the thread
        if (thread.tweets.length > 1) {
          return thread;
        }
        // Otherwise fall through to single tweet generation
      }
      
      // Generate a single tweet
      const prompt = this.createTweetPrompt(article, style, includeUrl, maxLength, standalone);
      const result = await this.model.generateContent(prompt);
      const tweet = result.response.text().trim();
      
      // Ensure the tweet isn't too long
      const urlLength = includeUrl ? article.url.length + 1 : 0; // +1 for space
      const maxContentLength = maxLength - urlLength;
      
      let finalTweet = tweet;
      if (tweet.length > maxContentLength) {
        finalTweet = tweet.substring(0, maxContentLength - 3) + '...';
      }
      
      // Add URL if needed
      if (includeUrl) {
        finalTweet = finalTweet + ' ' + article.url;
      }
      
      return finalTweet;
    } catch (error) {
      console.error('Error generating tweet:', error);
      
      // Fallback to a simple tweet format
      return `${article.title.substring(0, 100)}... ${includeUrl ? article.url : ''}`.trim();
    }
  }

  /**
   * Generates a Twitter thread based on article content
   */
  async generateTwitterThread(
    article: TweetArticle,
    options: {
      style?: string;
      includeUrl?: boolean;
      maxLength?: number;
      maxTweets?: number;
    }
  ): Promise<TweetThread> {
    const {
      style = 'balanced',
      includeUrl = true,
      maxLength = 280,
      maxTweets = 3
    } = options;

    try {
      const prompt = `
You are a cryptocurrency and blockchain news expert managing a popular Twitter account.
Create a Twitter THREAD (${maxTweets} tweets max) that summarizes the following crypto article in detail.

ARTICLE TITLE: ${article.title}
ARTICLE CONTENT: ${article.content}
SOURCE: ${article.source}
URL: ${article.url}

THREAD STYLE: ${style}
MAXIMUM TWEETS: ${maxTweets}
TWEET LENGTH LIMIT: ${maxLength - 5} characters per tweet (I'll add "1/X", "2/X" etc.)

Guidelines for the Twitter thread:
- First tweet should hook the reader with the most important information
- Break down complex information into digestible tweets
- Each tweet should be self-contained but clearly part of a sequence
- Be specific with facts, figures, and key points from the article
- Include the URL only in the last tweet of the thread
- DO NOT include "1/X" numbering - I will add that later
- Do NOT repeat information across tweets
- Ensure the thread flows naturally from one tweet to the next

Format your response exactly like this, with one tweet per line:
TWEET1: [First tweet content]
TWEET2: [Second tweet content]
TWEET3: [Third tweet content]
...and so on (up to ${maxTweets} tweets maximum)

Do not include any explanation or introduction - just the tweet content with the TWEET1:, TWEET2: etc. prefixes.
`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Parse the tweets from the response
      const tweetLines = response.split('\n');
      const tweets: string[] = [];
      
      for (const line of tweetLines) {
        if (line.startsWith('TWEET')) {
          const tweetContent = line.substring(line.indexOf(':') + 1).trim();
          
          if (tweetContent) {
            // Only add non-empty tweets
            tweets.push(tweetContent);
          }
        }
      }
      
      // If we only got one tweet or none, this isn't a thread
      if (tweets.length <= 1) {
        return {
          tweets: tweets.length === 0 ? [`${article.title} ${includeUrl ? article.url : ''}`] : tweets,
          isThread: false
        };
      }
      
      // Process the tweets to add numbering and the URL to the last tweet
      const processedTweets = tweets.map((tweet, index) => {
        const isLastTweet = index === tweets.length - 1;
        
        // Add numbering
        const numberedTweet = `${index + 1}/${tweets.length} ${tweet}`;
        
        // Add URL to last tweet if requested
        if (isLastTweet && includeUrl) {
          return `${numberedTweet} ${article.url}`;
        }
        
        return numberedTweet;
      });
      
      return {
        tweets: processedTweets,
        isThread: true
      };
    } catch (error) {
      console.error('Error generating tweet thread:', error);
      
      // Fallback to a simple tweet
      return {
        tweets: [`${article.title} ${includeUrl ? article.url : ''}`],
        isThread: false
      };
    }
  }

  /**
   * Creates a prompt for the AI to generate a tweet
   */
  private createTweetPrompt(
    article: TweetArticle,
    style: string,
    includeUrl: boolean,
    maxLength: number,
    standalone: boolean
  ): string {
    // Calculate available length
    const availableLength = includeUrl ? maxLength - article.url.length - 1 : maxLength;
    
    const standaloneInstructions = standalone 
      ? `Important: Create a STANDALONE tweet that provides the complete key information from the article. Readers should understand the main points WITHOUT needing to click the link. Synthesize and explain the most important information in a concise way.`
      : `Create a tweet that teases the article content and encourages readers to click the link.`;
    
    return `
You are a cryptocurrency and blockchain news expert managing a popular Twitter account.
${standaloneInstructions}

ARTICLE TITLE: ${article.title}
ARTICLE CONTENT: ${article.content}
SOURCE: ${article.source}
URL: ${article.url}

TWEET STYLE: ${style}
TWEET SHOULD BE: ${standalone ? 'STANDALONE (complete information)' : 'TEASER (encourage clicking)'}
${includeUrl ? 'Include URL at the end.' : 'Do not include the URL.'}
Maximum content length: ${availableLength} characters ${includeUrl ? '(URL will be added separately)' : ''}

Guidelines for STANDALONE tweets:
- Extract and clearly explain the MOST important information from the article
- Include specific details, numbers, and key points that matter
- Focus on providing VALUE and INFORMATION, not just teasing the content
- Make the tweet comprehensible without needing to read the full article
- Use 1-2 hashtags only if truly relevant
- Do NOT mention "according to the article" or similar phrases
- Do NOT end with "Read more:" or similar phrases

The tweet should be ready to post without any modifications.
DO NOT INCLUDE THE URL in your response - it will be added automatically if needed.
`;
  }
  
  /**
   * Summarizes article content for better tweet generation
   */
  async summarizeArticle(content: string, maxWords = 100): Promise<string> {
    try {
      const prompt = `
Summarize the following cryptocurrency news article in about ${maxWords} words.
Focus on the key points and implications for the crypto market.

ARTICLE: ${content}
      `;
      
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error summarizing article:', error);
      
      // Return truncated content as fallback
      const words = content.split(' ');
      if (words.length > maxWords) {
        return words.slice(0, maxWords).join(' ') + '...';
      }
      return content;
    }
  }
}