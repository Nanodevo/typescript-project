import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function checkConfiguration() {
  console.log('\n=== Twitter (X) API Configuration Checker ===\n');
  
  console.log('This tool will help you verify your Twitter Developer Portal setup.');
  
  // Check if using Free vs Basic vs Pro access
  console.log('\n1. What access level does your Twitter developer account have?');
  console.log('   a) Free (Write-only tier)');
  console.log('   b) Basic');
  console.log('   c) Pro');
  console.log('   d) Enterprise');
  
  const accessLevel = await askQuestion('   Enter your choice (a/b/c/d): ');
  
  if (accessLevel.toLowerCase() === 'a') {
    console.log('\n✅ You are using the Free tier.');
    console.log('The Free tier capabilities:');
    console.log('- CAN use POST endpoints to create tweets');
    console.log('- Limited to 1,500 tweets per month at the app level');
    console.log('- Limited read functionality');
    console.log('- Good for posting bots and testing');
    
    console.log('\nThis is sufficient for your CryptoNewsBot\'s core posting functionality.');
    console.log('For more advanced features, consider Basic or Pro tier.');
  }
  
  // Check app settings
  console.log('\n2. Please verify these settings in your Twitter Developer Portal:');
  console.log('   a) App type is set to "Automated App or Bot"');
  console.log('   b) OAuth 2.0 is enabled (preferred) or OAuth 1.0a is enabled');
  console.log('   c) App permissions include "Read and Write"');
  console.log('   d) Callback URL is set (even if it\'s just http://localhost:3000)');
  console.log('   e) Website URL is provided');
  
  const settingsChecked = await askQuestion('   Have you checked all these settings? (yes/no): ');
  
  if (settingsChecked.toLowerCase() !== 'yes') {
    console.log('\n⚠️ Please check all the app settings before continuing.');
  }
  
  // Check OAuth 2.0 vs OAuth 1.0a
  console.log('\n3. Which authentication method are you using?');
  console.log('   a) OAuth 2.0 (recommended)');
  console.log('   b) OAuth 1.0a (legacy)');
  
  const authMethod = await askQuestion('   Enter your choice (a/b): ');
  
  if (authMethod.toLowerCase() === 'a') {
    // OAuth 2.0 configuration checks
    console.log('\n=== OAuth 2.0 Setup ===');
    console.log('For OAuth 2.0, you need:');
    console.log('- Client ID (TWITTER_OAUTH2_CLIENT_ID)');
    console.log('- Client Secret (TWITTER_OAUTH2_CLIENT_SECRET)');
    console.log('- Access Token (TWITTER_OAUTH2_ACCESS_TOKEN)');
    
    console.log('\nChecking OAuth 2.0 credentials in your .env file:');
    const oauth2Check = {
      'TWITTER_OAUTH2_CLIENT_ID': process.env.TWITTER_OAUTH2_CLIENT_ID,
      'TWITTER_OAUTH2_CLIENT_SECRET': process.env.TWITTER_OAUTH2_CLIENT_SECRET,
      'TWITTER_OAUTH2_ACCESS_TOKEN': process.env.TWITTER_OAUTH2_ACCESS_TOKEN,
    };
    
    let missingOAuth2 = false;
    Object.entries(oauth2Check).forEach(([key, value]) => {
      if (!value) {
        console.log(`   ❌ ${key}: Missing`);
        missingOAuth2 = true;
      } else {
        console.log(`   ✓ ${key}: Present`);
      }
    });
    
    if (missingOAuth2) {
      console.log('\n⚠️ Some OAuth 2.0 credentials are missing. Your app will fall back to other methods.');
    } else {
      console.log('\n✅ All OAuth 2.0 credentials are present.');
    }
    
  } else {
    // OAuth 1.0a configuration checks
    console.log('\n=== OAuth 1.0a Setup ===');
    console.log('For OAuth 1.0a, generate tokens with appropriate permissions:');
    console.log('   a) Go to "Keys and tokens" tab');
    console.log('   b) Ensure API Key and API Key Secret are generated');
    console.log('   c) Generate Access Token and Access Token Secret');
    console.log('   d) Copy all tokens to your .env file');
    
    const tokensRegenerated = await askQuestion('   Have you generated these tokens? (yes/no): ');
    
    if (tokensRegenerated.toLowerCase() !== 'yes') {
      console.log('\n⚠️ Please generate the required tokens before continuing.');
    }
    
    // Check token format
    console.log('\nChecking OAuth 1.0a credentials in your .env file:');
    
    const tokenCheck = {
      'TWITTER_API_KEY': process.env.TWITTER_API_KEY,
      'TWITTER_API_SECRET': process.env.TWITTER_API_SECRET,
      'TWITTER_ACCESS_TOKEN': process.env.TWITTER_ACCESS_TOKEN,
      'TWITTER_ACCESS_TOKEN_SECRET': process.env.TWITTER_ACCESS_TOKEN_SECRET
    };
    
    let invalidFormat = false;
    Object.entries(tokenCheck).forEach(([key, value]) => {
      if (!value) {
        console.log(`   ❌ ${key}: Missing`);
        invalidFormat = true;
      } else if (value.includes(' ') || value.includes('\n') || value.includes('\r')) {
        console.log(`   ❌ ${key}: Contains whitespace or newlines`);
        invalidFormat = true;
      } else {
        console.log(`   ✓ ${key}: Present and formatted correctly`);
      }
    });
    
    if (invalidFormat) {
      console.log('\n⚠️ Some OAuth 1.0a credentials are missing or contain whitespace.');
    } else {
      console.log('\n✅ All OAuth 1.0a credentials are present and formatted correctly.');
    }
  }
  
  // Check Bearer Token regardless (useful for read operations)
  console.log('\n=== Bearer Token ===');
  console.log('A Bearer Token is useful for read-only operations:');
  
  if (process.env.TWITTER_API_BEARER_TOKEN) {
    console.log('   ✓ TWITTER_API_BEARER_TOKEN: Present');
  } else {
    console.log('   ❌ TWITTER_API_BEARER_TOKEN: Missing');
    console.log('   ⚠️ Read operations might be limited without a Bearer Token.');
  }
  
  // Final check - run a test
  console.log('\n4. Would you like to run a simple API test to verify your credentials?');
  const runTest = await askQuestion('   Run test? (yes/no): ');
  
  if (runTest.toLowerCase() === 'yes') {
    await runApiTest();
  }
  
  console.log('\n=== Summary ===');
  console.log('If your authentication is still failing:');
  console.log('1. Check for typos in your credentials');
  console.log('2. Ensure your app is properly configured in the Twitter Developer Portal');
  console.log('3. Verify your developer account is in good standing');
  console.log('4. Try creating a new project and app if all else fails');
  console.log('5. Remember that Free tier has limitations, but should support posting tweets');
  
  rl.close();
}

async function runApiTest() {
  console.log('\n--- Running API Test ---');
  
  // Try with OAuth 2.0 if available
  if (process.env.TWITTER_OAUTH2_ACCESS_TOKEN) {
    try {
      console.log('Testing OAuth 2.0...');
      const oauth2Client = new TwitterApi(process.env.TWITTER_OAUTH2_ACCESS_TOKEN);
      
      // Test user lookup - should work
      const publicUser = await oauth2Client.v2.userByUsername('Game_buzzz');
      console.log('✅ OAuth 2.0 user lookup successful:', publicUser.data?.username || publicUser.data?.id);
      
      // Test posting - this would count against your monthly limit, so we'll skip it
      console.log('Skipping tweet post test to preserve your monthly quota');
    } catch (error: any) {
      console.log('❌ OAuth 2.0 test failed:', error.message);
    }
  }
  
  // Try with OAuth 1.0a if available
  if (process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN) {
    try {
      console.log('\nTesting OAuth 1.0a...');
      const oauth1Client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
      });
      
      // Test user lookup
      const me = await oauth1Client.v2.me();
      console.log('✅ OAuth 1.0a authenticated user lookup successful:', me.data?.username || me.data?.id);
      
      // Skip posting test
      console.log('Skipping tweet post test to preserve your monthly quota');
    } catch (error: any) {
      console.log('❌ OAuth 1.0a test failed:', error.message);
    }
  }
  
  // Try with Bearer Token if available
  if (process.env.TWITTER_API_BEARER_TOKEN) {
    try {
      console.log('\nTesting Bearer Token...');
      const bearerClient = new TwitterApi(process.env.TWITTER_API_BEARER_TOKEN);
      
      // Test user lookup
      const publicUser = await bearerClient.v2.userByUsername('Game_buzzz');
      console.log('✅ Bearer Token user lookup successful:', publicUser.data?.username || publicUser.data?.id);
    } catch (error: any) {
      console.log('❌ Bearer Token test failed:', error.message);
    }
  }
}

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Run the configuration checker
checkConfiguration();