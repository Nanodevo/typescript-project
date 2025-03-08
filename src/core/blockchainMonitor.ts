import { EventEmitter } from 'events';
import Web3 from 'web3';
import { BlockchainConfig, NewsItem } from '../types/types';
import { Transaction } from 'web3-types';

export interface BlockchainEvent {
  type: string;
  data: any;
  // Add other properties as needed
}

export class BlockchainMonitor extends EventEmitter {
    private web3: Web3;
    private isStreaming: boolean = false;
    private subscription: any;
    private pollInterval: NodeJS.Timeout | null = null;
    private lastBlockNumber: number = 0;

    constructor(private config: BlockchainConfig) {
        super();
        this.web3 = new Web3(config.provider);
    }

    async initialize(): Promise<void> {
        try {
            await this.web3.eth.net.isListening();
        } catch (error) {
            throw new Error('Failed to connect to blockchain network');
        }
    }

    async getSignificantTransactions(): Promise<Transaction[]> {
        const block = await this.web3.eth.getBlock('latest', true);
        if (!block || !block.transactions) {
            return [];
        }
        
        return (block.transactions as Transaction[]).filter(tx => 
            tx.value && Number(this.web3.utils.fromWei(tx.value, 'ether')) > this.config.minTransactionValue
        );
    }

    async watchAddress(address: string, callback: (transaction: Transaction) => void): Promise<void> {
        // Now address parameter has a proper callback function
        // Implementation can use the callback parameter
    }

    async startStreaming(): Promise<void> {
        if (this.isStreaming) return;

        try {
            // Try to use subscription if available
            this.subscription = await this.web3.eth.subscribe('pendingTransactions');
            
            this.subscription.on('data', async (txHash: string) => {
                try {
                    const tx = await this.web3.eth.getTransaction(txHash);
                    if (!tx) return;

                    const valueInEth: string = this.web3.utils.fromWei(tx.value, 'ether');
                    if (Number(valueInEth) >= this.config.minTransactionValue) {
                        this.emit('transaction', {
                            hash: tx.hash,
                            from: tx.from,
                            to: tx.to,
                            value: valueInEth,
                            timestamp: new Date()
                        });
                    }
                } catch (error: unknown) {
                    console.error('Error processing transaction:', error);
                }
            });
            
            this.isStreaming = true;
        } catch (error) {
            // If subscription not supported, use polling as fallback
            console.log('WebSocket subscription not supported by provider. Using polling mechanism instead.');
            
            this.isStreaming = true;
            this.startPolling();
        }
    }

    private async startPolling(): Promise<void> {
        if (this.pollInterval) return;
        
        // Poll every 15 seconds
        this.pollInterval = setInterval(async () => {
            try {
                const latestBlock = await this.web3.eth.getBlockNumber();
                
                // Only process if we have a new block
                if (latestBlock > this.lastBlockNumber) {
                    // Get transactions from the new blocks
                    for (let i = this.lastBlockNumber + 1; i <= latestBlock; i++) {
                        const block = await this.web3.eth.getBlock(i, true);
                        if (block && block.transactions) {
                            for (const tx of block.transactions) {
                                if (typeof tx === 'object' && tx.value) {
                                    const valueInEth: string = this.web3.utils.fromWei(tx.value, 'ether');
                                    if (Number(valueInEth) >= this.config.minTransactionValue) {
                                        this.emit('transaction', {
                                            hash: tx.hash,
                                            from: tx.from,
                                            to: tx.to,
                                            value: valueInEth,
                                            timestamp: new Date()
                                        });
                                    }
                                }
                            }
                        }
                    }
                    
                    // Update last processed block
                    this.lastBlockNumber = latestBlock;
                    console.log(`Polled blocks up to ${latestBlock}`);
                }
            } catch (error) {
                console.error('Error in blockchain polling:', error);
            }
        }, 15000); // 15 seconds interval
    }

    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) return;

        if (this.subscription) {
            try {
                await this.subscription.unsubscribe();
            } catch (error) {
                console.error('Error unsubscribing:', error);
            }
            this.subscription = null;
        }
        
        // Clear polling interval if it's running
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        this.isStreaming = false;
    }

    async getContextForNews(newsItem: NewsItem): Promise<any> {
        // Implementation
        return Promise.resolve(null);
    }
}