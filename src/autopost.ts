import { TwitterManager } from './core/twitterManager';
import { NewsManager, NewsArticle } from './core/newsManager';
import { AiManager, TweetThread } from './core/aiManager';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

interface AutopostConfig {
  enabled: boolean;
  interval: number; // in minutes
  importanceThreshold: number; // minimum score to post
  createThreads: boolean;
  maxTweetsInThread: number;
}

// Default configuration
const config: AutopostConfig = {
  enabled: false, // Default to disabled for safety
  interval: 180, // 3 hours
  importanceThreshold: 15,
  createThreads: true,
  maxTweetsInThread: 3
};

// Load configuration from env vars if available
if (process.env.AUTOPOST_ENABLED === 'true') config.enabled = true;
if (process.env.AUTOPOST_INTERVAL) config.interval = parseInt(process.env.AUTOPOST_INTERVAL);
if (process.env.AUTOPOST_IMPORTANCE_THRESHOLD) config.importanceThreshold = parseInt(process.env.AUTOPOST_IMPORTANCE_THRESHOLD);
if (process.env.AUTOPOST_CREATE_THREADS === 'false') config.createThreads = false;
if (process.env.AUTOPOST_MAX_TWEETS_IN_THREAD) config.maxTweetsInThread = parseInt(process.env.AUTOPOST_MAX_TWEETS_IN_THREAD);

// Simple logging
function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Runs the news fetching and posting process once
 */
export async function postLatestNews(): Promise<boolean> {
  log('=== Starting automated news post ===');
  
  try {
    // Initialize components
    log('Initializing components...');
    const twitter = new TwitterManager();
    const news = new NewsManager();
    const ai = new AiManager();
    
    // Fetch and rank news
    log('Fetching crypto news...');
    const articles = await news.fetchLatestNews();
    log(`Fetched ${articles.length} news articles`);
    
    if (articles.length === 0) {
      log('No news articles found');
      return false;
    }
    
    log('Ranking articles by importance...');
    const rankedArticles = await news.rankArticlesByImportance(articles);
    
    // Select top article
    const topArticle = rankedArticles[0];
    
    // Check if important enough
    if ((topArticle.importanceScore || 0) < config.importanceThreshold) {
      log(`Top article score (${topArticle.importanceScore}) is below threshold (${config.importanceThreshold}). Skipping.`);
      return false;
    }
    
    log(`Selected article: "${topArticle.title}" (Score: ${topArticle.importanceScore})`);
    
    // Generate tweet content
    log('Generating tweet content...');
    const tweetResult = await ai.generateTweet({
      title: topArticle.title,
      content: topArticle.content || topArticle.description || '',
      url: topArticle.url,
      source: topArticle.source?.name || 'Unknown Source'
    }, {
      standalone: true, 
      includeUrl: true,
      createThread: config.createThreads,
      maxTweets: config.maxTweetsInThread
    });
    
    // Post the tweet or thread
    if (typeof tweetResult === 'string') {
      log('Posting single tweet');
      const result = await twitter.postTweet(tweetResult);
      
      if (result.success) {
        log(`Tweet posted successfully! Tweet ID: ${result.id}`);
        return true;
      } else {
        log('Failed to post tweet');
        return false;
      }
    } else {
      // We got a thread
      log(`Posting tweet thread with ${tweetResult.tweets.length} tweets`);
      const result = await twitter.postThread(tweetResult.tweets);
      
      if (result.success) {
        log(`Tweet thread posted successfully!`);
        return true;
      } else {
        if (result.ids && result.ids.length > 0) {
          log(`Thread partially posted. Posted ${result.ids.length}/${tweetResult.tweets.length} tweets`);
        } else {
          log('Failed to post tweet thread');
        }
        return false;
      }
    }
  } catch (error) {
    log(`Error: ${error}`);
    return false;
  }
}

/**
 * Simple scheduler function
 */
export function startAutopostScheduler() {
  if (!config.enabled) {
    log('Autoposting is disabled. Set AUTOPOST_ENABLED=true to enable.');
    return;
  }
  
  log(`Starting autopost scheduler. Will post every ${config.interval} minutes.`);
  
  // Run immediately
  postLatestNews().catch(e => log(`Error in initial post: ${e}`));
  
  // Then schedule future posts
  setInterval(() => {
    log(`Scheduled post time reached`);
    postLatestNews().catch(e => log(`Error in scheduled post: ${e}`));
  }, config.interval * 60 * 1000);
}

// If run directly, start the scheduler
if (require.main === module) {
  startAutopostScheduler();
}