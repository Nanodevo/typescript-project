//// filepath: /Users/emreacar/Documents/NewAgent/typescript-project/tests/real-tweet.test.ts
import { stringify } from 'querystring';
import { TwitterManager } from '../src/core/twitterManager';
import dotenv from 'dotenv';

dotenv.config();

async function postRealTweet() {
  // Instantiate your TwitterManager. It should be implemented to use your .env credentials.
const twitter = new TwitterManager({
    apiKey: process.env.TWITTER_API_KEY!,
    apiSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
});
  const tweetContent = "Real tweet test at " + new Date().toISOString() + ". Testing live tweet posting.";

  try {
    const result = await twitter.post(tweetContent) as unknown as { id: string };
    console.log("Real tweet posted successfully, tweet id:", result?.id || 'unknown');
    return true;
  } catch (error) {
    console.error("Error posting real tweet:", error);
    return false;
  }
}

postRealTweet().then(success => {
  console.log(success ? '✅ Real tweet test passed' : '❌ Real tweet test failed');
  process.exit(0);
});