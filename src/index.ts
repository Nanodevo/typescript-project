import { CryptoNewsBot } from './core/bot';
import { config } from './config/config';

async function main() {
    const bot = new CryptoNewsBot(
        config.apiKey,
        config.apiSecret,
        config.newsApiKey,
        config.telegramToken,
        config.chatId,
        config.baseUrl,
        config.wsUrl,
        config.newsEndpoint
    );
    await bot.start();
}

main().catch(console.error);