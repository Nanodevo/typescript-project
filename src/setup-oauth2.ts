import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Make sure you've set these in your .env file
const CLIENT_ID = process.env.TWITTER_OAUTH2_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_OAUTH2_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';

// Initialize Express app
const app = express();
const PORT = 3000;

// Create a new TwitterApi instance for OAuth 2.0
const twitterClient = new TwitterApi({
  clientId: CLIENT_ID as string,
  clientSecret: CLIENT_SECRET as string
});

app.get('/', (req: express.Request, res: express.Response) => {
  // Generate the authorization URL
  const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
    REDIRECT_URI,
    { scope: ['tweet.read', 'tweet.write', 'users.read'] }
  );

  // Store the code verifier in a file (in production, you'd use a secure session)
  fs.writeFileSync(
    path.join(__dirname, '..', 'oauth-state.json'),
    JSON.stringify({ codeVerifier, state })
  );

  // Redirect the user to the Twitter authorization page
  res.redirect(url);
});

app.get('/callback', async (req: express.Request, res: express.Response) => {
  // Extract the state and code from the callback
  const { state, code } = req.query;

  if (!state || !code) {
    return res.status(400).send('Missing required parameters');
  }

  try {
    // Retrieve the stored code verifier and state
    const storedData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'oauth-state.json'), 'utf-8')
    );

    // Verify the state
    if (state !== storedData.state) {
      return res.status(400).send('State mismatch, possible CSRF attack');
    }

    // Exchange the code for access token
    const { accessToken, refreshToken } = await twitterClient.loginWithOAuth2({
      code: code as string,
      codeVerifier: storedData.codeVerifier,
      redirectUri: REDIRECT_URI
    });

    console.log('Access token obtained successfully!');
    
    // Write the tokens to your .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Update or add the OAuth2 entries
    if (envContent.includes('TWITTER_OAUTH2_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /TWITTER_OAUTH2_ACCESS_TOKEN=.*/,
        `TWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}`
      );
    } else {
      envContent += `\nTWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}`;
    }
    
    if (refreshToken) {
      if (envContent.includes('TWITTER_OAUTH2_REFRESH_TOKEN=')) {
        envContent = envContent.replace(
          /TWITTER_OAUTH2_REFRESH_TOKEN=.*/,
          `TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken}`
        );
      } else {
        envContent += `\nTWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken}`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('.env file updated with new tokens');

    res.send(`
      <h1>Authentication successful!</h1>
      <p>Your Twitter OAuth 2.0 tokens have been saved.</p>
      <p>You can close this window and restart your bot.</p>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`OAuth2 setup server running at http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT} to start the OAuth2 flow`);
  console.log('Make sure you have set TWITTER_OAUTH2_CLIENT_ID and TWITTER_OAUTH2_CLIENT_SECRET in your .env file');
});