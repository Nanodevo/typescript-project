import { GoogleGenerativeAI } from '@google/generative-ai';

class EmptyPromptError extends Error {
    constructor() {
        super('Prompt cannot be empty');
        this.name = 'EmptyPromptError';
    }
}

export class GeminiApi {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }

    async generateContent(prompt: string): Promise<string> {
        if (!prompt || !prompt.trim()) {
            throw new EmptyPromptError();
        }

        try {
            const result = await this.model.generateContent({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            });
            return result.response.text();
        } catch (error) {
            console.error('Error generating content:', error);
            throw error;
        }
    }

    async listAvailableModels(): Promise<string[]> {
        try {
            // List available models if needed
            return ['gemini-2.0-flash'];
        } catch (error) {
            console.error('Error listing models:', error);
            throw error;
        }
    }
}