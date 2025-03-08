import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fs from 'fs';
import open from 'open'; // You may need to install this: npm install open

dotenv.config();

// Settings
const PORT = 3000;
const CLIENT_ID = process.env.TWITTER_OAUTH2_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_OAUTH2_CLIENT_SECRET;
const CALLBACK_URL = `http://localhost:${PORT}/callback`;
const SCOPES = ['tweet.read', 'tweet.write', 'users.read'];

const app = express();

// Store state and code verifier
let stateInfo = {
  codeVerifier: '',
  state: ''
};

app.get('/', (req, res) => {
  try {
    // Create OAuth 2.0 client
    const client = new TwitterApi({ 
      clientId: CLIENT_ID as string, 
      clientSecret: CLIENT_SECRET as string
    });
    
    // Generate auth link
    const authLink = client.generateOAuth2AuthLink(CALLBACK_URL, { 
      scope: SCOPES 
    });
    
    // Store values for later
    stateInfo.codeVerifier = authLink.codeVerifier;
    stateInfo.state = authLink.state;
    
    console.log('Opening authorization page in browser...');
    open(authLink.url);
    
    res.send(`
      <h1>Twitter OAuth 2.0 Setup</h1>
      <p>You should be redirected to Twitter's authorization page.</p>
      <p>If not, <a href="${authLink.url}">click here</a>.</p>
    `);
  } catch (error) {
    console.error('Error generating auth link:', error);
    res.status(500).send('Error setting up OAuth 2.0');
  }
});

app.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }
    
    if (state !== stateInfo.state) {
      return res.status(400).send('State mismatch, possible CSRF attack');
    }
    
    // Create OAuth 2.0 client
    const client = new TwitterApi({ 
      clientId: CLIENT_ID as string, 
      clientSecret: CLIENT_SECRET as string
    });
    
    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const result = await client.loginWithOAuth2({
      code: code as string,
      codeVerifier: stateInfo.codeVerifier,
      redirectUri: CALLBACK_URL
    });
    
    console.log('Access token obtained!');
    
    // Update .env file with new tokens
    const envPath = './.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace or add OAuth 2.0 tokens
    const tokenLine = `TWITTER_OAUTH2_ACCESS_TOKEN=${result.accessToken}`;
    if (envContent.includes('TWITTER_OAUTH2_ACCESS_TOKEN=')) {
      envContent = envContent.replace(/TWITTER_OAUTH2_ACCESS_TOKEN=.*/, tokenLine);
    } else {
      envContent += `\n${tokenLine}`;
    }
    
    if (result.refreshToken) {
      const refreshLine = `TWITTER_OAUTH2_REFRESH_TOKEN=${result.refreshToken}`;
      if (envContent.includes('TWITTER_OAUTH2_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/TWITTER_OAUTH2_REFRESH_TOKEN=.*/, refreshLine);
      } else {
        envContent += `\n${refreshLine}`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // Try a simple API call
    const userClient = new TwitterApi(result.accessToken);
    const myUser = await userClient.v2.me();
    
    res.send(`
      <h1>Success!</h1>
      <p>OAuth 2.0 setup is complete. Your tokens have been saved to the .env file.</p>
      <p>Connected as: @${myUser.data.username}</p>
      <p>You can close this window and restart your application.</p>
    `);
    
    // Wait a moment before shutting down
    setTimeout(() => {
      console.log('OAuth 2.0 setup complete. You can close this tab and restart your application.');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('Error in callback:', error);
    res.status(500).send(`Error completing OAuth 2.0 flow: ${error}`);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`OAuth 2.0 server running on http://localhost:${PORT}`);
  console.log('Opening browser to start authentication...');
  open(`http://localhost:${PORT}`);
});