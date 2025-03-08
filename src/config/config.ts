import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
    twitter: {
        apiKey: process.env.TWITTER_API_KEY!,
        apiSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY!
    },
    blockchain: {
        provider: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
        network: 'mainnet',
        minTransactionValue: 1
    },
    newsSources: [
        {
            url: 'https://cointelegraph.com/rss',
            type: 'rss' as const,
            category: 'crypto' as const
        },
        {
            url: 'https://decrypt.co/feed',
            type: 'rss' as const,
            category: 'crypto' as const
        }
    ]
};