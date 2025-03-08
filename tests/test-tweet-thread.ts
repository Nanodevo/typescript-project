import { AiManager } from '../src/core/aiManager';
import dotenv from 'dotenv';

dotenv.config();

async function testTweetThread() {
  console.log('=== Testing Tweet Thread Generation ===\n');
  
  try {
    const ai = new AiManager();
    
    // Use a longer sample article that would benefit from being a thread
    const sampleArticle = {
      title: "Ethereum's Hardware Evolution: Beyond Software Scaling Solutions",
      content: `Ethereum's scaling solutions have predominantly focused on software approaches like Layer 2 solutions, rollups, and sharding. However, a groundbreaking study from researchers at Stanford University's Blockchain Research Center now suggests that hardware acceleration might represent the most promising path forward for Ethereum's long-term scalability.

The extensive research, published last week after a two-year study, indicates that custom ASIC (Application-Specific Integrated Circuit) implementations could increase Ethereum's transaction throughput by up to 20x while simultaneously reducing energy consumption by approximately 80%. The researchers tested prototype hardware accelerators specifically designed for Ethereum's cryptographic operations and state management.

"While software scaling solutions like rollups are crucial for Ethereum's immediate growth, the physics of computation ultimately dictates that hardware optimization represents the frontier of blockchain scalability," explained Dr. Sarah Chen, the lead researcher on the project. The paper outlines how specialized hardware could dramatically improve the performance of validator nodes and reduce the computational overhead for participating in the network.

Major technology companies are already taking note of this potential avenue for blockchain advancement. Sources familiar with the matter indicate that Nvidia, Intel, and several stealth startups are developing specialized chips for Ethereum computation. One anonymous industry insider revealed that a major semiconductor company is just months away from announcing a "blockchain processor" specifically optimized for Ethereum validators.

In response to these developments, the Ethereum Foundation has announced a new grant program specifically targeting hardware acceleration research, with $5 million allocated for the initiative. Vitalik Buterin, Ethereum's co-founder, commented on the findings during the latest ETH Research call: "The combination of software scaling solutions and hardware acceleration represents the most viable path to handling billions of users. We've always known that specialized hardware would eventually play a crucial role."

The implications for the Ethereum ecosystem are significant. Hardware acceleration could reduce the barrier to running validator nodes, potentially improving network decentralization. It could also allow for more complex on-chain operations, enabling new classes of applications that are currently constrained by computational limitations.

Critics, however, point out that specialized hardware could create new forms of centralization if not widely accessible. "If only well-funded operations can afford these accelerators, we might see centralization through a different mechanism," cautioned decentralization advocate Jamie Smith.

The Ethereum Foundation has emphasized that any hardware solutions must align with the network's ethos of accessibility and decentralization. "We're specifically looking for innovations that can scale down to consumer-grade hardware, not just data center deployments," noted the Foundation's announcement.

Industry analysts predict that this shift toward hardware optimization could spark a new competitive domain in the blockchain ecosystem, with potential implications extending beyond Ethereum to other smart contract platforms.`,
      url: "https://cointelegraph.com/news/ethereum-hardware-evolution-beyond-software-scaling",
      source: "CoinTelegraph"
    };
    
    console.log('Testing Thread Generation:');
    const result = await ai.generateTweet(sampleArticle, { 
      createThread: true,
      maxTweets: 3,
      includeUrl: true
    });
    
    if (typeof result === 'string') {
      console.log('Generated a single tweet (not a thread):');
      console.log('---');
      console.log(result);
      console.log('---\n');
    } else {
      console.log(`Generated a tweet thread with ${result.tweets.length} tweets:`);
      result.tweets.forEach((tweet, index) => {
        console.log(`\nTWEET ${index + 1}:`);
        console.log('---');
        console.log(tweet);
        console.log('---');
      });
    }
    
    console.log('\nTest complete!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testTweetThread().catch(console.error);