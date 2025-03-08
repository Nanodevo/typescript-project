import { GeminiApi } from '../src/utils/geminiApi';
import * as dotenv from 'dotenv';

describe('GeminiApi', () => {
    let geminiApi: GeminiApi;

    beforeAll(() => {
        dotenv.config();
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        geminiApi = new GeminiApi(apiKey);
    });

    it('should generate content', async () => {
        const prompt = 'Explain how AI works';
        const response = await geminiApi.generateContent(prompt);
        expect(response).toBeTruthy();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
    }, 30000);

    it('should reject empty prompts', async () => {
        await expect(async () => {
            await geminiApi.generateContent('');
        }).rejects.toThrow('Prompt cannot be empty');

        await expect(async () => {
            await geminiApi.generateContent('   ');
        }).rejects.toThrow('Prompt cannot be empty');
    }, 30000);

    it('should handle very long prompts', async () => {
        const longPrompt = 'test '.repeat(1000);
        const response = await geminiApi.generateContent(longPrompt);
        expect(response).toBeTruthy();
    }, 30000);

    afterAll(async () => {
        // Cleanup if needed
    });
});