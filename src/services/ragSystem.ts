import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { join } from 'path';

interface DocumentWithContent {
    pageContent: string;
    metadata?: Record<string, any>;
}

export class RAGSystem {
    private vectorStore!: Chroma;
    private embeddings: OpenAIEmbeddings;
    private dbPath: string;

    constructor() {
        this.embeddings = new OpenAIEmbeddings();
        this.dbPath = join(process.cwd(), 'data', 'vectordb');
        
        // Initialize Chroma client
        this.initializeStore();
    }

    private async initializeStore() {
        this.vectorStore = await Chroma.fromExistingCollection(
            this.embeddings,
            {
                collectionName: "news_memory",
                url: "http://localhost:8000", // ChromaDB default URL
                collectionMetadata: {
                    "hnsw:space": "cosine"
                }
            }
        );
    }

    async storeContext(content: string, metadata: any): Promise<void> {
        const doc = new Document({
            pageContent: content,
            metadata
        });
        await this.vectorStore.addDocuments([doc]);
    }

    async getRelevantContext(query: string): Promise<DocumentWithContent[]> {
        const results: DocumentWithContent[] = await this.vectorStore.similaritySearch(query, 5);
        return results;
    }

    async enhancePrompt(basePrompt: string): Promise<string> {
        try {
            // Get relevant past content
            const relevantDocs = await this.getRelevantContext(basePrompt);
            
            // Extract context
            const context = relevantDocs.map((doc: DocumentWithContent) => ({
                content: doc.pageContent,
                metadata: doc.metadata
            }));

            // Create enhanced prompt
            return `
Given the following context from previous news and tweets:

${context.map(doc => `
Content: ${doc.content}
Performance: ${doc.metadata?.engagement || 'N/A'}
Date: ${doc.metadata?.timestamp || 'N/A'}
`).join('\n')}

Current task: ${basePrompt}

Guidelines:
1. Maintain consistent tone with successful past tweets
2. Reference related past news if relevant
3. Use engaging language that has worked before
4. Stay within Twitter's character limit
5. Include trending topics if applicable

Generate a tweet that incorporates these insights while remaining fresh and engaging.`;
        } catch (error) {
            console.error('Error enhancing prompt:', error);
            // Fallback to basic prompt if RAG fails
            return basePrompt;
        }
    }
}