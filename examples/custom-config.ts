import { CryptoNewsBot } from '../src/cryptonewsbot';

// Create bot with custom configuration
const bot = new CryptoNewsBot({
  // Post every hour
  postInterval: 60,
  // Only post very important news
  importanceThreshold: 25,
  // Always create threads for more detail
  createThreads: true,
  maxTweetsInThread: 4,
  // Use enthusiastic style
  tweetStyle: 'enthusiastic',
  // Focus on specific sources
  newsSources: ['cointelegraph', 'coindesk']
});

// Start the bot
bot.start();

console.log('CryptoNewsBot started with custom configuration');
console.log(`Next post in approximately ${bot.getConfig().postInterval} minutes`);

// Keep process running
process.stdin.resume();