import { CryptoNewsBot } from '../src/cryptonewsbot';

// Create bot without auto-posting
const bot = new CryptoNewsBot({
  autoPost: false
});

async function run() {
  console.log('Finding top crypto news...');
  
  // Run the bot once to find the top news
  const success = await bot.runOnce();
  
  if (success) {
    console.log('Top news article found and processed!');
    console.log('To auto-post, change BOT_AUTO_POST=true in .env');
  } else {
    console.log('No suitable news found or error occurred.');
  }
  
  process.exit(0);
}

run().catch(console.error);