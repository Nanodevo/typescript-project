import { ContentGenerator } from '../src/services/contentGenerator';
import { NewsItem, ContentType, Sentiment } from '../src/types/types';
import dotenv from 'dotenv';

dotenv.config();

class MockTwitter {
  async post(content: string) {
    console.log('\n=== TWEET POSTED ===');
    console.log(content);
    console.log('====================\n');
    return { id: 'mock-id', success: true };
  }
}

async function directTweetTest() {
  console.log('Testing direct tweet generation and posting...');
  
  // Create components
  const contentGenerator = new ContentGenerator(process.env.GEMINI_API_KEY || "", false);
  const twitter = new MockTwitter();
  
  // Create a test news item
  const newsItem: NewsItem = {
    title: "Bitcoin reaches new all-time high of $100,000",
    summary: "BTC surpassed $100k for the first time, driven by ETF inflows and institutional demand",
    type: ContentType.NEWS,
    source: "cointelegraph.com"
  };
  
  const sentiment: Sentiment = {
    label: "positive",
    score: 0.8
  };
  
  try {
    // Generate the tweet
    console.log('Generating tweet from news...');
    const tweet = await contentGenerator.generate(newsItem, sentiment);
    
    console.log('Tweet content generated:');
    console.log(tweet.content);
    console.log('Characters:', tweet.content.length);
    
    // Directly post the tweet
    console.log('Posting tweet...');
    await twitter.post(tweet.content);
    
    console.log('Test completed successfully');
    return true;
  } catch (error) {
    console.error('Error in direct tweet test:', error);
    return false;
  }
}

// Run the test
directTweetTest()
  .then(success => {
    if (success) {
      console.log('✅ Test passed: Successfully generated and posted a tweet');
    } else {
      console.log('❌ Test failed: Could not generate or post tweet');
    }
    process.exit(0);
  });