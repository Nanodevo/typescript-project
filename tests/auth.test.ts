import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// STEP 1: Check and log environment variables (masked)
function checkEnvVars() {
  console.log('Environment variables check:');
  const envVars = {
    'TWITTER_API_KEY': process.env.TWITTER_API_KEY,
    'TWITTER_API_SECRET': process.env.TWITTER_API_SECRET,
    'TWITTER_ACCESS_TOKEN': process.env.TWITTER_ACCESS_TOKEN,
    'TWITTER_ACCESS_TOKEN_SECRET': process.env.TWITTER_ACCESS_TOKEN_SECRET,
    'TWITTER_API_BEARER_TOKEN': process.env.TWITTER_API_BEARER_TOKEN
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    if (!value) {
      console.log(`❌ ${key}: Missing or empty`);
    } else {
      // Show first 4 and last 4 chars only
      const maskedValue = value.length > 8 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : '[too short to display safely]';
      console.log(`✓ ${key}: ${maskedValue} (${value.length} chars)`);
    }
  });
}

// STEP 2: Test OAuth 2.0 with the bearer token
async function testOAuth2() {
  console.log('\n--- OAuth 2.0 Test ---');
  try {
    if (!process.env.TWITTER_API_BEARER_TOKEN) {
      console.log('❌ Bearer token is missing');
      return false;
    }
    
    const oauth2Client = new TwitterApi(process.env.TWITTER_API_BEARER_TOKEN);
    
    // Use your username instead of 'twitter'
    console.log('Attempting to fetch a public user...');
    const publicUser = await oauth2Client.v2.userByUsername('Game_buzzz');
    
    // Debug the response structure
    console.log('Response structure:', JSON.stringify(publicUser, null, 2));
    
    // Check if the data exists before accessing properties
    if (publicUser && publicUser.data) {
      console.log('✓ Public user lookup successful: ', publicUser.data.name || publicUser.data.username);
      return true;
    } else {
      console.log('❌ User data not found in response');
      return false;
    }
  } catch (error: any) {
    console.error('❌ OAuth 2.0 error:', error.message);
    
    if (error.data && error.data.errors) {
      console.log('Error details:', error.data.errors);
    }
    
    if (error.headers) {
      console.log('Response headers:', error.headers);
    }
    
    return false;
  }
}

// STEP 3: Test OAuth 1.0a with app and user tokens
async function testOAuth1() {
  console.log('\n--- OAuth 1.0a Test ---');
  try {
    // Check for required variables
    const requiredVars = [
      'TWITTER_API_KEY', 
      'TWITTER_API_SECRET', 
      'TWITTER_ACCESS_TOKEN', 
      'TWITTER_ACCESS_TOKEN_SECRET'
    ];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        console.log(`❌ ${varName} is missing`);
        return false;
      }
    }
    
    const oauth1Client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
    });
    
    // Try to get authenticated user info
    console.log('Attempting to fetch authenticated user info...');
    const me = await oauth1Client.v2.me();
    console.log('✓ Authenticated user lookup successful: ', me.data.name);
    
    // Try to post a test tweet (only if explicitly enabled)
    const testTweeting = false; // Set to true to test tweet posting
    if (testTweeting) {
      console.log('Attempting to post a test tweet...');
      const tweetText = `Test tweet from API ${new Date().toISOString()}`;
      const tweetResult = await oauth1Client.v2.tweet(tweetText);
      console.log('✓ Tweet posted successfully: ', tweetResult.data.id);
      
      // Delete the test tweet
      await oauth1Client.v2.deleteTweet(tweetResult.data.id);
      console.log('✓ Test tweet deleted');
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ OAuth 1.0a error:', error.message);
    
    if (error.data && error.data.errors) {
      console.log('Error details:', error.data.errors);
    }
    
    if (error.headers) {
      console.log('Response headers:', error.headers);
    }
    
    return false;
  }
}

// Main function to run all tests
async function runAllTests() {
  console.log('==== Twitter API Authentication Debugging ====');
  
  // Check environment variables
  checkEnvVars();
  
  // Run authentication tests
  const oauth2Result = await testOAuth2();
  const oauth1Result = await testOAuth1();
  
  console.log('\n==== Test Results ====');
  console.log('OAuth 2.0 (Bearer Token):', oauth2Result ? '✅ PASSED' : '❌ FAILED');
  console.log('OAuth 1.0a (User Auth):', oauth1Result ? '✅ PASSED' : '❌ FAILED');
  
  // Final recommendation
  console.log('\n==== Recommendations ====');
  if (!oauth2Result && !oauth1Result) {
    console.log(`
1. Double check your API keys and tokens in the .env file 
2. Regenerate all keys and tokens in the Twitter Developer Portal
3. Ensure your app has "Read and Write" permissions
4. Check if your Twitter Developer account is in good standing
5. Try creating a new project and app in the Developer Portal
    `);
  } else if (oauth2Result && !oauth1Result) {
    console.log(`
OAuth 2.0 works but OAuth 1.0a fails. This suggests:
1. Your app has the correct Bearer Token but incorrect user tokens
2. Your app might not have user authentication enabled
3. Your Access Token/Secret might be expired or invalid

Try regenerating the Access Token and Secret in the Twitter Developer Portal.
    `);
  } else if (!oauth2Result && oauth1Result) {
    console.log(`
OAuth 1.0a works but OAuth 2.0 fails. This suggests:
1. Your Bearer Token is invalid or expired
2. Your project might not have the correct scopes for OAuth 2.0

Try regenerating the Bearer Token in the Twitter Developer Portal.
    `);
  } else {
    console.log(`
Both authentication methods are working! Your setup is correct.
    `);
  }
  
  process.exit(0);
}

// Start the tests
runAllTests();