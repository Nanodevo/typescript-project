import { AiManager } from '../src/core/aiManager';
import dotenv from 'dotenv';

dotenv.config();

async function testTweetStyles() {
  console.log('=== Testing Improved Tweet Generation ===\n');
  
  try {
    const ai = new AiManager();
    
    const sampleArticle = {
      title: "The Future of Ethereum Scaling: Hardware Acceleration Is Key",
      content: `Ethereum's scaling solutions have primarily focused on software approaches like Layer 2 solutions, rollups, and sharding. However, a new study from researchers at Stanford University suggests that hardware acceleration might be the most promising path forward. The research indicates that custom ASIC implementations could increase Ethereum's transaction throughput by up to 20x while reducing energy consumption by 80%. Major companies including Nvidia and Intel are reportedly developing specialized chips for Ethereum computation. The Ethereum Foundation has announced a new grant program specifically for hardware acceleration research, with $5 million allocated. Vitalik Buterin commented that "the combination of software scaling solutions and hardware acceleration represents the most viable path to handling billions of users."`,
      url: "https://cointelegraph.com/news/the-future-of-ethereum-scaling",
      source: "CoinTelegraph"
    };
    
    // Test 1: Standard Tweet (includes URL)
    console.log('1. Standard Tweet (with URL):');
    const standardTweet = await ai.generateTweet(sampleArticle, { 
      standalone: true,
      includeUrl: true
    });
    console.log('---');
    console.log(standardTweet);
    console.log('---\n');
    
    // Test 2: Standalone Tweet (no URL)
    console.log('2. Standalone Tweet (no URL):');
    const standaloneTweet = await ai.generateTweet(sampleArticle, {
      standalone: true,
      includeUrl: false
    });
    console.log('---');
    console.log(standaloneTweet);
    console.log('---\n');
    
    // Test 3: Teaser Tweet (old style)
    console.log('3. Teaser Tweet (old style):');
    const teaserTweet = await ai.generateTweet(sampleArticle, {
      standalone: false,
      includeUrl: true
    });
    console.log('---');
    console.log(teaserTweet);
    console.log('---\n');
    
    console.log('Test complete!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testTweetStyles().catch(console.error);