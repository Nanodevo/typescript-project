import { startAutopostScheduler } from '../autopost';

console.log('Starting autopost scheduler...');
startAutopostScheduler();

// Keep process running
process.stdin.resume();