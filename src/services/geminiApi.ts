import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiApi {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Use correct model name from API
        this.model = this.genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: {
                maxOutputTokens: 280,
                temperature: 0.7
            }
        });
    }

    async generateContent(prompt: string): Promise<string> {
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
}