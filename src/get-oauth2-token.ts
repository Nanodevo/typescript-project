import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import url from 'url';
import open from 'open';

dotenv.config();

// Configuration
const PORT = 3000;
const CLIENT_ID = process.env.TWITTER_OAUTH2_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_OAUTH2_CLIENT_SECRET;
const CALLBACK_URL = `http://localhost:${PORT}/callback`;
const SCOPES = ['tweet.read', 'tweet.write', 'users.read'];

// Check if we have the required credentials
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: TWITTER_OAUTH2_CLIENT_ID and TWITTER_OAUTH2_CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

// Create Twitter client
const client = new TwitterApi({ 
  clientId: CLIENT_ID, 
  clientSecret: CLIENT_SECRET 
});

// Generate auth URL with PKCE flow
const { url: authURL, codeVerifier, state } = client.generateOAuth2AuthLink(
  CALLBACK_URL, 
  { scope: SCOPES }
);

console.log('Opening browser for Twitter authorization...');
console.log(`Auth URL: ${authURL}`);

// Create HTTP server for callback
const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '';
  
  if (reqUrl.startsWith('/callback')) {
    const parsedUrl = url.parse(reqUrl, true);
    const { code, state: callbackState } = parsedUrl.query;
    
    if (!code || !callbackState) {
      res.writeHead(400);
      res.end('Missing code or state parameter');
      return;
    }
    
    if (callbackState !== state) {
      res.writeHead(400);
      res.end('State mismatch, possible CSRF attack');
      return;
    }
    
    try {
      console.log('Exchanging code for tokens...');
      
      // Exchange code for tokens
      const { accessToken, refreshToken } = await client.loginWithOAuth2({
        code: code as string,
        codeVerifier,
        redirectUri: CALLBACK_URL
      });
      
      console.log('Success! Access token obtained');
      
      // Update .env file
      const envPath = './.env';
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update or add tokens
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
      console.log('.env file updated with access token');
      
      // Make a test API call
      const userClient = new TwitterApi(accessToken);
      const userInfo = await userClient.v2.me();
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>Authorization Successful!</h1>
        <p>You're now authenticated as: @${userInfo.data.username}</p>
        <p>Your OAuth 2.0 tokens have been saved to your .env file.</p>
        <p>You can close this window and restart your application.</p>
      `);
      
      console.log(`Connected as: @${userInfo.data.username}`);
      
      // Give time to read the success message
      setTimeout(() => {
        console.log('Server closing...');
        server.close();
        process.exit(0);
      }, 5000);
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      res.writeHead(500);
      res.end(`Authentication error: ${error}`);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start server and open browser
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  open(authURL).catch(() => {
    console.log(`Please open this URL in your browser: ${authURL}`);
  });
});