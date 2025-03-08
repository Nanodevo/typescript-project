import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';

export class MemorySystem {
    private vectorStore: SupabaseVectorStore;
    
    constructor(supabaseClient: any) {
        this.vectorStore = new SupabaseVectorStore(
            new OpenAIEmbeddings(),
            { client: supabaseClient, tableName: 'documents' }
        );
    }
    
    async storeMemory(content: string, metadata: any) {
        const doc = new Document({ 
            pageContent: content,
            metadata 
        });
        await this.vectorStore.addDocuments([doc]);
    }

    async queryMemory(query: string): Promise<Document[]> {
        return this.vectorStore.similaritySearch(query);
    }
}