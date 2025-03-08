import { CryptoNewsBot } from '../src/cryptonewsbot';

// Create a new bot with default configuration
const bot = new CryptoNewsBot();

// Listen for events (optional)
bot.on('tweet-posted', ({ id, content }) => {
  console.log(`Tweet posted: ${content}`);
});

bot.on('thread-posted', ({ ids, tweets }) => {
  console.log(`Thread with ${tweets.length} tweets posted`);
});

bot.on('run-complete', ({ success, reason }) => {
  console.log(`Run completed: ${success ? 'success' : 'failed'} (${reason})`);
});

bot.on('post-error', ({ type, error }) => {
  console.log(`Error posting ${type}: ${error}`);
});

// Start the bot scheduler
bot.start();

// Keep process running
process.stdin.resume();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down bot...');
  bot.stop();
  setTimeout(() => process.exit(0), 1000);
});