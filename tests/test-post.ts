import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

async function testTweet() {
  console.log('Testing Twitter API posting capabilities...');

  try {
    // First, let's check what authentication methods we have available
    let client;
    let authMethod = '';

    // Try OAuth 2.0
    if (process.env.TWITTER_OAUTH2_CLIENT_ID && 
        process.env.TWITTER_OAUTH2_CLIENT_SECRET && 
        process.env.TWITTER_OAUTH2_ACCESS_TOKEN) {
      try {
        console.log('Attempting to use OAuth 2.0...');
        client = new TwitterApi(process.env.TWITTER_OAUTH2_ACCESS_TOKEN);
        authMethod = 'OAuth 2.0';
        
        // Test if it works by getting the authenticated user
        const me = await client.v2.me();
        console.log(`✅ OAuth 2.0 authentication successful! Connected as: @${me.data.username}`);
      } catch (error: any) {
        console.log('❌ OAuth 2.0 authentication failed:', error.message);
        client = undefined; // Reset for next method
      }
    }

    // Fall back to OAuth 1.0a if OAuth 2.0 failed
    if (!client && process.env.TWITTER_API_KEY && 
        process.env.TWITTER_API_SECRET && 
        process.env.TWITTER_ACCESS_TOKEN && 
        process.env.TWITTER_ACCESS_TOKEN_SECRET) {
      try {
        console.log('Attempting to use OAuth 1.0a...');
        client = new TwitterApi({
          appKey: process.env.TWITTER_API_KEY,
          appSecret: process.env.TWITTER_API_SECRET,
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
        });
        authMethod = 'OAuth 1.0a';
        
        // Test if it works by getting the authenticated user
        const me = await client.v2.me();
        console.log(`✅ OAuth 1.0a authentication successful! Connected as: @${me.data.username}`);
      } catch (error: any) {
        console.log('❌ OAuth 1.0a authentication failed:', error.message);
        client = undefined; // Reset for next method
      }
    }

    // Fall back to Bearer Token if both OAuth methods failed
    if (!client && process.env.TWITTER_API_BEARER_TOKEN) {
      try {
        console.log('Attempting to use Bearer Token (read-only)...');
        client = new TwitterApi(process.env.TWITTER_API_BEARER_TOKEN);
        authMethod = 'Bearer Token';
        
        // Test if it works by getting a public user
        const user = await client.v2.userByUsername('Game_buzzz');
        console.log(`✅ Bearer Token authentication successful! Found user: @${user.data.username}`);
        console.log('⚠️ Note: Bearer Token is read-only and cannot post tweets.');
      } catch (error: any) {
        console.log('❌ Bearer Token authentication failed:', error.message);
      }
    }

    // If we have a client that can post (OAuth 2.0 or OAuth 1.0a), try posting a tweet
    if (client && authMethod !== 'Bearer Token') {
      console.log('\nAttempting to post a test tweet...');
      
      // Generate a unique test message
      const testMessage = `Test tweet from API using ${authMethod} - ${new Date().toISOString()}`;
      
      try {
        const tweet = await client.v2.tweet(testMessage);
        console.log(`✅ Tweet posted successfully! ID: ${tweet.data.id}`);
        console.log(`Tweet content: "${testMessage}"`);
        
        // Delete the test tweet to clean up
        console.log('Cleaning up by deleting the test tweet...');
        await client.v2.deleteTweet(tweet.data.id);
        console.log('✅ Test tweet deleted successfully');
      } catch (error: any) {
        console.error('❌ Error posting tweet:', error.message);
        
        if (error.data && error.data.errors) {
          console.log('Error details:');
          error.data.errors.forEach((err: any) => {
            console.log(`- ${err.title}: ${err.detail || err.message}`);
          });
        }
        
        console.log('\nPossible reasons for failure:');
        console.log('1. The API key lacks "Write" permissions');
        console.log('2. Account is on Free tier which has posting limitations');
        console.log('3. Token is expired or invalid');
      }
    } else {
      console.log('\n❌ No authentication method available that can post tweets.');
      console.log('Please check your Twitter API credentials in the .env file.');
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
  }
}

testTweet();