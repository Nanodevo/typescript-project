import { postLatestNews } from '../autopost';

// Run a single post immediately
console.log('Running one-time news post...');
postLatestNews()
  .then(success => {
    console.log(`Post completed. Success: ${success}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });