import { NewsItem } from '../types/types';
import natural from 'natural';

export class SentimentAnalyzer {
    private analyzer: natural.SentimentAnalyzer;

    constructor() {
        this.analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    }

    async analyze(item: NewsItem): Promise<{ label: string; score: number }> {
        const text = item.content || item.title;
        const tokens = new natural.WordTokenizer().tokenize(text);
        const score = this.analyzer.getSentiment(tokens);

        return {
            label: this.getLabel(score),
            score
        };
    }

    private getLabel(score: number): string {
        if (score > 0.2) return 'positive';
        if (score < -0.2) return 'negative';
        return 'neutral';
    }
}