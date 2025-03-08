//Must obey the rate limits of twitter.
//Must integrate the rateLimiter.ts file. 
//Must have a logic that makes him not labeled as a bot.
//Must have a logic for checking notification and replying them on twitter: 
//    starting from the first reply till the last but not each one of them ,
//    only the important onces , which he will use all the tools he has, 
//    web-search + blockchain + rag.
//Can employ a differnt AI for doing all these, maybe a reasoning one , search on this matter!
//
import { Tweet } from '../types/types';

export class TweetScheduler {
  private lastTweetTime: Date = new Date();
  private tweetQueue: Array<{tweet: Tweet, score: number}> = [];
  private tweetsPerDay: number = 8; // It should be whenever a flashnews comes in 
                                    //and whenever there is a reply worth answering.
  
  constructor(tweetsPerDay: number = 8) {
    this.tweetsPerDay = tweetsPerDay;
  }

  addToQueue(tweet: Tweet, score: number): void {
    this.tweetQueue.push({ tweet, score });
    this.tweetQueue.sort((a, b) => b.score - a.score); // Keep sorted by importance
    
    // Limit queue size to avoid memory bloat
    if (this.tweetQueue.length > 50) {
      this.tweetQueue = this.tweetQueue.slice(0, 50);
    }
  }
  
  shouldTweetNow(): boolean {
    const now = new Date();
    const hoursBetweenTweets = 24 / this.tweetsPerDay;
    const hoursSinceLastTweet = (now.getTime() - this.lastTweetTime.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastTweet >= hoursBetweenTweets;
  }
  
  getNextTweetToPost(): Tweet | null {
    if (this.tweetQueue.length === 0) return null;
    
    const { tweet } = this.tweetQueue.shift()!;
    this.lastTweetTime = new Date();
    return tweet;
  }
}