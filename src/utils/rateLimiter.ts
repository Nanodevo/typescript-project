//must have the data from twitter regarding the rates, 
// should not exceed a human speed. 
// one tweet at a time with the speed of a human being typing. 

export class RateLimiter {
    private lastRequest: Date = new Date(0);
    private requestCount: number = 0;
    private maxRequests: number = 5;
    private timeWindow: number = 60 * 60 * 1000; // 1 hour in ms

    constructor(options?: { maxRequests?: number; timeWindow?: number }) {
        if (options) {
            this.maxRequests = options.maxRequests || this.maxRequests;
            this.timeWindow = options.timeWindow || this.timeWindow;
        }
    }

    setLimits(maxRequests: number, timeWindow: number): void {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
    }

    async execute(fn: () => Promise<any>, key: string = 'default'): Promise<any> {
        if (this.canMakeRequest()) {
            return await fn();
        }
        throw new Error('Rate limit exceeded');
    }

    canMakeRequest(): boolean {
        const now = new Date();
        const timeElapsed = now.getTime() - this.lastRequest.getTime();
        
        // Reset counter if time window has passed
        if (timeElapsed > this.timeWindow) {
            this.requestCount = 0;
            this.lastRequest = now;
            return true;
        }

        // Check if under limit
        if (this.requestCount < this.maxRequests) {
            this.requestCount++;
            this.lastRequest = now;
            return true;
        }

        return false;
    }
}