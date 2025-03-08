# CryptoNewsBot Framework

A simple, configurable framework for creating a Twitter bot that automatically posts high-quality cryptocurrency news.

## Features

- 🔍 Automatically fetches the latest crypto news
- 📊 Ranks articles by importance
- 🤖 Generates human-like tweets and threads
- 📅 Posts on a configurable schedule
- 📎 Creates threads for complex topics
- 🛠️ Highly customizable via .env or code

## Quick Start

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your API keys
3. Install dependencies: `npm install`
4. Run the basic example: `npx ts-node examples/basic-bot.ts`

## Configuration Options

All options can be set via environment variables or constructor parameters:

| Option                  | Env Variable              | Default     | Description                                |
|-------------------------|---------------------------|-----------------|-----------------------------|
| `autoPost`              | `BOT_AUTO_POST`           | `false`         | Whether to auto-post tweets |
| `postInterval`          | `BOT_POST_INTERVAL`       | `180`           | Minutes between posts |
| `importanceThreshold`   | `BOT_IMPORTANCE_THRESHOLD`| `15`            | Minimum importance score to post |
| `createThreads`         | `BOT_CREATE_THREADS`      | `true`          | Create threads for complex topics |
| `maxTweetsInThread`     | `BOT_MAX_TWEETS_IN_THREAD`| `3`            | Maximum tweets in a thread |
| `includeUrl`            | `BOT_INCLUDE_URL`         | `true`          | Include source URL in tweets |
| `tweetStyle`            | `BOT_TWEET_STYLE`         | `informative`   | Tweet style (informative, enthusiastic, analytical, balanced) |
| `newsMaxResults`        | `BOT_NEWS_MAX_RESULTS`    | `20`            | Maximum news articles to fetch |
| `newsSources`           | `BOT_NEWS_SOURCES`        | Various sources | Comma-separated list of news sources |
| `logToFile`             | `BOT_LOG_TO_FILE`         | `true`          | Whether to log to file |
| `logLevel`              | `BOT_LOG_LEVEL`           | `info`          | Log level (debug, info, warn, error) |

## API Reference

### CryptoNewsBot

The main class that handles the entire flow.

```typescript
import { CryptoNewsBot } from './src/cryptonewsbot';

// Create with default config
const bot = new CryptoNewsBot();

// Or with custom config
const bot = new CryptoNewsBot({
  autoPost: true,
  postInterval: 60, // 1 hour
});

// Start the scheduler
bot.start();

// Run once without scheduling
await bot.runOnce();

// Stop the scheduler
bot.stop();

// Get current stats
const stats = bot.getStats();

// Update configuration
bot.updateConfig({ 
  importanceThreshold: 20
});