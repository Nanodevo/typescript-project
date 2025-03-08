import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fs from 'fs';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to post a tweet using best practices from the sample code
async function postTweet(text: string) {
  console.log(`\nAttempting to post: "${text}"`);
  
  try {
    // Try OAuth 1.0a first (this is what most of the samples use for posting)
    if (process.env.TWITTER_API_KEY && 
        process.env.TWITTER_API_SECRET && 
        process.env.TWITTER_ACCESS_TOKEN && 
        process.env.TWITTER_ACCESS_TOKEN_SECRET) {
      try {
        console.log('Using OAuth 1.0a...');
        // Create the client exactly as in the sample code
        const client = new TwitterApi({
          appKey: process.env.TWITTER_API_KEY,
          appSecret: process.env.TWITTER_API_SECRET,
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
        });
        
        // Get the v2 client
        const v2Client = client.v2;
        
        // Post tweet using the exact method from the sample code
        const tweet = await v2Client.tweet(text);
        return { success: true, id: tweet.data.id, client };
      } catch (error: any) {
        console.log('OAuth 1.0a failed:', error.message);
        console.log('Error details:', JSON.stringify(error.data || {}, null, 2));
      }
    }
    
    // Try OAuth 2.0 next
    if (process.env.TWITTER_OAUTH2_CLIENT_ID && 
        process.env.TWITTER_OAUTH2_CLIENT_SECRET && 
        process.env.TWITTER_OAUTH2_ACCESS_TOKEN) {
      try {
        console.log('Using OAuth 2.0...');
        
        // Create client as in the OAuth 2.0 PKCE sample
        const client = new TwitterApi(process.env.TWITTER_OAUTH2_ACCESS_TOKEN);
        
        // Post tweet
        const tweet = await client.v2.tweet(text);
        return { success: true, id: tweet.data.id, client };
      } catch (error: any) {
        console.log('OAuth 2.0 failed:', error.message);
        console.log('Error details:', JSON.stringify(error.data || {}, null, 2));
      }
    }
    
    // Try username/password approach (for sample purposes only)
    console.log('\n❌ API posting failed. Would you like to:');
    console.log('1. Save this tweet for manual posting');
    console.log('2. Try one more approach (reduced rate limits)');
    
    const choice = await askQuestion('Enter choice (1 or 2): ');
    
    if (choice === '2') {
      console.log('\nAttempting to post using alternative API endpoint...');
      console.log('Note: This is implemented for educational purposes only.');
      console.log('In production, use the proper API endpoints.');
      
      try {
        // This is a placeholder to show what would go here
        // In reality, we wouldn't implement this as direct password usage is against Twitter TOS
        console.log('This would be the implementation of an alternative approach.');
        console.log('However, Twitter only supports OAuth for API access.');
        
        return { success: false };
      } catch (error) {
        console.log('Alternative method failed.');
      }
    }
    
    // All methods failed, save for manual posting
    console.log('\nWould you like to save this tweet for manual posting? (yes/no)');
    
    const answer = await askQuestion('');
    if (answer.toLowerCase() === 'yes') {
      const tweets = loadSavedTweets();
      tweets.push({
        text,
        timestamp: new Date().toISOString()
      });
      saveTweets(tweets);
      console.log('Tweet saved for manual posting.');
    }
    
    return { success: false };
  } catch (error: any) {
    console.error('Error posting tweet:', error);
    return { success: false };
  }
}

// Add option to open the Twitter web interface
async function openTwitterPost() {
  const text = await askQuestion('Enter your tweet (280 chars max): ');
  
  if (text.length > 280) {
    console.log('Tweet too long! Maximum is 280 characters.');
    return;
  }
  
  // Encode the text for a URL
  const encodedText = encodeURIComponent(text);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
  
  console.log('\nOpen this URL in your browser to post the tweet:');
  console.log(twitterUrl);
  
  // Save to draft as well
  const tweets = loadSavedTweets();
  tweets.push({
    text,
    timestamp: new Date().toISOString(),
    url: twitterUrl
  });
  saveTweets(tweets);
  console.log('Tweet also saved to drafts.');
}

// Function to export tweets to a file that can be easily copy-pasted
async function exportTweets() {
  const tweets = loadSavedTweets();
  if (tweets.length === 0) {
    console.log('No saved tweets to export.');
    return;
  }
  
  let exportText = '=== TWITTER DRAFTS ===\n\n';
  tweets.forEach((tweet, i) => {
    exportText += `--- TWEET ${i+1} (${tweet.timestamp}) ---\n`;
    exportText += `${tweet.text}\n\n`;
  });
  
  const filename = `twitter-drafts-${new Date().toISOString().split('T')[0]}.txt`;
  fs.writeFileSync(filename, exportText);
  console.log(`Tweets exported to ${filename}`);
}

// Function to load saved tweets
function loadSavedTweets(): Array<{text: string, timestamp: string, url?: string}> {
  try {
    const data = fs.readFileSync('./saved-tweets.json', 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Function to save tweets
function saveTweets(tweets: Array<{text: string, timestamp: string, url?: string}>) {
  fs.writeFileSync('./saved-tweets.json', JSON.stringify(tweets, null, 2));
}

// Function to ask a question
function askQuestion(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Main function
async function main() {
  console.log('=== Twitter CLI Poster ===');
  console.log('This tool lets you post tweets or save them for manual posting.\n');
  
  while (true) {
    console.log('\nOptions:');
    console.log('1. Try to post a tweet via API');
    console.log('2. Create tweet URL for manual posting');
    console.log('3. View saved tweets');
    console.log('4. Export tweets to text file');
    console.log('5. Exit');
    
    const choice = await askQuestion('Enter your choice (1-5): ');
    
    switch (choice) {
      case '1':
        const text = await askQuestion('Enter your tweet (280 chars max): ');
        if (text.length > 280) {
          console.log('Tweet too long! Maximum is 280 characters.');
        } else {
          const result = await postTweet(text);
          if (result.success) {
            console.log(`✅ Tweet posted successfully! ID: ${result.id}`);
          }
        }
        break;
      
      case '2':
        await openTwitterPost();
        break;
      
      case '3':
        const tweets = loadSavedTweets();
        if (tweets.length === 0) {
          console.log('No saved tweets.');
        } else {
          console.log('\n=== Saved Tweets ===');
          tweets.forEach((tweet, i) => {
            console.log(`\n[${i+1}] ${tweet.timestamp}`);
            console.log(tweet.text);
            if (tweet.url) {
              console.log(`URL: ${tweet.url}`);
            }
          });
        }
        break;
      
      case '4':
        await exportTweets();
        break;
      
      case '5':
        console.log('Exiting...');
        rl.close();
        return;
      
      default:
        console.log('Invalid choice. Please enter a number between 1 and 5.');
    }
  }
}

// Run the program
main().catch(console.error);