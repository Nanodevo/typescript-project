import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import { TwitterConfig, AnalyticsData } from '../types/types';
import fs from 'fs';

dotenv.config();

interface TwitterManagerOptions {
  useOAuth2?: boolean;
  useBearerToken?: boolean;
  useOAuth1?: boolean;
  mockMode?: boolean;
}

export class TwitterManager {
  private client: TwitterApi;
  private options: TwitterManagerOptions;
  private tweetCount = 0;
  private readonly monthlyLimit = 1500;
  private lastResetDate = new Date();
  private postCount: number = 0;
  private readonly postLimit: number = 1500;
  private readonly postLimitResetDate: Date = new Date();

  constructor(options?: TwitterManagerOptions) {
    // Initialize with default options
    this.options = {
      useOAuth2: true,  // Prioritize OAuth 2.0
      useBearerToken: true,
      useOAuth1: true,
      mockMode: false,
      ...options
    };

    // Try OAuth 2.0 first
    if (this.options.useOAuth2 && process.env.TWITTER_OAUTH2_ACCESS_TOKEN) {
      console.log('Using OAuth 2.0 authentication');
      this.client = new TwitterApi(process.env.TWITTER_OAUTH2_ACCESS_TOKEN);
      return;
    }

    // Try OAuth 1.0a next
    if (this.options.useOAuth1 && 
        process.env.TWITTER_API_KEY && 
        process.env.TWITTER_API_SECRET && 
        process.env.TWITTER_ACCESS_TOKEN && 
        process.env.TWITTER_ACCESS_TOKEN_SECRET) {
      console.log('Using OAuth 1.0a authentication');
      this.client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
      });
      return;
    }

    // Fall back to Bearer token (read-only)
    if (this.options.useBearerToken && process.env.TWITTER_API_BEARER_TOKEN) {
      console.log('Using Bearer Token authentication (read-only)');
      this.client = new TwitterApi(process.env.TWITTER_API_BEARER_TOKEN);
      return;
    }

    // If we get here, we have no valid authentication
    console.warn('No valid Twitter authentication method found in environment variables');
    this.client = new TwitterApi(''); // Empty client as fallback
  }

  public async initialize(): Promise<void> {
    return Promise.resolve();
  }

  public async post(content: string): Promise<{ id: string }> {
    try {
      if (this.options.useBearerToken) {
        console.warn('Cannot post tweets with Bearer Token. Tweet content would have been:');
        console.log(content);
        return { id: `mock-${Date.now()}` };
      }

      const tweet = await this.client.v2.tweet(content);
      console.log(`Tweet posted successfully with ID: ${tweet.data.id}`);
      return { id: tweet.data.id };
    } catch (error: any) {
      console.error('Error posting tweet:', error?.message || error);
      
      // Check for specific error types
      if (error?.code === 403) {
        console.warn('Rate limit exceeded or insufficient permissions');
      } else if (error?.code === 401) {
        console.warn('Authentication failed. Check your API credentials.');
      }
      
      console.log('Tweet content (not posted):', content);
      return { id: `failed-${Date.now()}` };
    }
  }

  public async getMetrics(tweetId: string): Promise<AnalyticsData> {
    try {
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
    } catch (error: any) {
      console.warn('Unable to get tweet metrics:', error?.message);
      console.log('This is expected with Free tier access');
      
      // Return mock data for development/testing
      return {
        id: tweetId,
        impressionCount: 0,
        likeCount: 0,
        retweetCount: 0,
        replyCount: 0,
        quoteCount: 0
      };
    }
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

  public getV2Client(): TwitterApi {
    return this.client;
  }

  public async getUser(username: string): Promise<any> {
    try {
      return await this.client.v2.userByUsername(username);
    } catch (error) {
      console.error('Error looking up user:', error);
      throw error;
    }
  }

  public trackPostLimit(): { remaining: number, resetDate: Date } {
    return {
      remaining: this.postLimit - this.postCount,
      resetDate: this.postLimitResetDate
    };
  }

  public async postTweet(text: string): Promise<{ success: boolean; id?: string }> {
    try {
      // Check for mock mode
      if (this.options.mockMode) {
        console.log('MOCK MODE: Would have posted tweet:');
        console.log(text);
        return { success: true, id: `mock-${Date.now()}` };
      }
      
      // Check rate limits
      if (this.isApproachingRateLimit(0.9)) {
        console.warn(`Approaching monthly tweet limit: ${this.tweetCount}/${this.monthlyLimit}`);
      }
      
      // Post the tweet
      const result = await this.client.v2.tweet(text);
      this.tweetCount++;
      
      return { success: true, id: result.data.id };
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      
      // Check for rate limiting
      if (error?.data?.errors?.some((e: any) => e.code === 88)) {
        console.warn('Rate limit exceeded. Waiting before retrying.');
      }
      
      // If error is related to token expiration, try refreshing
      if (error?.code === 401) {
        const refreshed = await this.refreshOAuth2Token();
        if (refreshed) {
          // Try again with refreshed token
          return this.postTweet(text);
        }
      }
      
      return { success: false };
    }
  }

  // Add this method to your TwitterManager class
  async refreshOAuth2Token(): Promise<boolean> {
    if (!process.env.TWITTER_OAUTH2_REFRESH_TOKEN || 
        !process.env.TWITTER_OAUTH2_CLIENT_ID || 
        !process.env.TWITTER_OAUTH2_CLIENT_SECRET) {
      console.warn('Missing OAuth 2.0 refresh credentials');
      return false;
    }
  
    try {
      const refreshClient = new TwitterApi({
        clientId: process.env.TWITTER_OAUTH2_CLIENT_ID,
        clientSecret: process.env.TWITTER_OAUTH2_CLIENT_SECRET
      });
  
      const { accessToken, refreshToken: newRefreshToken } = 
        await refreshClient.refreshOAuth2Token(process.env.TWITTER_OAUTH2_REFRESH_TOKEN);
  
      // Update client with new token
      this.client = new TwitterApi(accessToken);
      
      // Update tokens in .env file
      // (In production, you'd use a more secure storage method)
      const envPath = './.env';
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      envContent = envContent.replace(
        /TWITTER_OAUTH2_ACCESS_TOKEN=.*/,
        `TWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}`
      );
      
      if (newRefreshToken) {
        envContent = envContent.replace(
          /TWITTER_OAUTH2_REFRESH_TOKEN=.*/,
          `TWITTER_OAUTH2_REFRESH_TOKEN=${newRefreshToken}`
        );
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('OAuth 2.0 tokens refreshed successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to refresh OAuth 2.0 token:', error);
      return false;
    }
  }

  // Method to check if you're approaching limits
  isApproachingRateLimit(threshold = 0.9): boolean {
    // Check if we're approaching the monthly limit
    return this.tweetCount >= (this.monthlyLimit * threshold);
  }

  /**
   * Posts a thread of tweets
   */
  public async postThread(tweets: string[]): Promise<{ 
    success: boolean; 
    ids?: string[];
    failedAt?: number;
  }> {
    if (!tweets || tweets.length === 0) {
      return { success: false, failedAt: 0 };
    }
    
    try {
      const ids: string[] = [];
      let replyToId: string | undefined = undefined;
      
      // Post each tweet in the thread
      for (let i = 0; i < tweets.length; i++) {
        const tweetText = tweets[i];
        
        // For all tweets after the first one, reply to the previous tweet
        const tweetOptions: { reply?: { in_reply_to_tweet_id: string } } = replyToId 
          ? { reply: { in_reply_to_tweet_id: replyToId } } 
          : {};
        
        try {
          const result: { data: { id: string } } = await this.client.v2.tweet(tweetText, tweetOptions);
          
          if (result.data.id) {
            ids.push(result.data.id);
            replyToId = result.data.id; // Set the current tweet as the one to reply to next
            this.tweetCount++;
          } else {
            return { success: false, ids, failedAt: i };
          }
        } catch (error) {
          console.error(`Error posting tweet ${i+1} in thread:`, error);
          return { success: false, ids, failedAt: i };
        }
      }
      
      return { success: true, ids };
    } catch (error) {
      console.error('Error posting thread:', error);
      return { success: false, failedAt: 0 };
    }
  }
}