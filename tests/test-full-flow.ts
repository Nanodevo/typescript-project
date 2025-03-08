import { TwitterManager } from '../src/core/twitterManager';
import { NewsManager, NewsArticle } from '../src/core/newsManager';
import { AiManager, TweetThread } from '../src/core/aiManager';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testFullFlow() {
  console.log('=== CryptoNewsBot Full Flow Test ===\n');
  
  try {
    // Step 1: Initialize components
    console.log('1. Initializing components...');
    
    const twitter = new TwitterManager();
    const news = new NewsManager();
    const ai = new AiManager();
    
    console.log('✅ All components initialized\n');
    
    // Step 2: Fetch crypto news
    console.log('2. Fetching crypto news...');
    const articles = await news.fetchLatestNews();
    console.log(`✅ Fetched ${articles.length} news articles`);
    
    // Print the first 3 headlines
    console.log('\nSample headlines:');
    articles.slice(0, 3).forEach((article: NewsArticle, i: number) => {
      console.log(`   ${i+1}. ${article.title}`);
    });
    
    // Step 3: Analyze and rank news
    console.log('\n3. Analyzing news importance...');
    const rankedArticles = await news.rankArticlesByImportance(articles);
    
    console.log('✅ News ranked by importance');
    console.log('\nTop 3 important articles:');
    rankedArticles.slice(0, 3).forEach((article: NewsArticle, i: number) => {
      console.log(`   ${i+1}. ${article.title} (Score: ${article.importanceScore || 'N/A'})`);
    });
    
    // Step 4: Select top article
    const topArticle = rankedArticles[0];
    console.log('\n4. Selected top article:');
    console.log(`   Title: ${topArticle.title}`);
    console.log(`   URL: ${topArticle.url}`);
    
    // Step 5: Generate tweet content
    console.log('\n5. Generating tweet content...');
    const tweetResult = await ai.generateTweet({
      title: topArticle.title,
      content: topArticle.content || topArticle.description || '',
      url: topArticle.url,
      source: topArticle.source?.name || 'Unknown Source'
    }, {
      standalone: true, 
      includeUrl: true,
      createThread: true,  // Enable thread creation
      maxTweets: 3         // Maximum of 3 tweets in a thread
    });
    
    // Check if we got a thread or single tweet
    if (typeof tweetResult === 'string') {
      console.log('✅ Tweet content generated:');
      console.log('---');
      console.log(tweetResult);
      console.log('---');
      
      // Step 6: Ask for confirmation to post
      console.log('\n6. Would you like to post this tweet? (y/n)');
      const response = await getUserInput();
      
      if (response.toLowerCase() === 'y') {
        console.log('\nPosting tweet...');
        const result = await twitter.postTweet(tweetResult);
        
        if (result.success) {
          console.log(`✅ Tweet posted successfully! Tweet ID: ${result.id}`);
        } else {
          console.log('❌ Failed to post tweet');
        }
      } else {
        console.log('\nSkipping tweet posting');
      }
    } else {
      // We got a thread
      console.log(`✅ Tweet thread generated with ${tweetResult.tweets.length} tweets:`);
      tweetResult.tweets.forEach((tweet, index) => {
        console.log(`\nTweet ${index + 1}:`);
        console.log('---');
        console.log(tweet);
        console.log('---');
      });
      
      // Step 6: Ask for confirmation to post thread
      console.log('\n6. Would you like to post this tweet thread? (y/n)');
      const response = await getUserInput();
      
      if (response.toLowerCase() === 'y') {
        console.log('\nPosting tweet thread...');
        const result = await twitter.postThread(tweetResult.tweets);
        
        if (result.success) {
          console.log(`✅ Tweet thread posted successfully!`);
          console.log(`Thread IDs: ${result.ids?.join(', ')}`);
        } else {
          if (result.ids && result.ids.length > 0) {
            console.log(`⚠️ Thread partially posted. Posted ${result.ids.length}/${tweetResult.tweets.length} tweets`);
            console.log(`Failed at tweet #${(result.failedAt || 0) + 1}`);
          } else {
            console.log('❌ Failed to post tweet thread');
          }
        }
      } else {
        console.log('\nSkipping thread posting');
      }
    }
    
    console.log('\nTest complete!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

function getUserInput(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

// Run the test
testFullFlow().catch(console.error);