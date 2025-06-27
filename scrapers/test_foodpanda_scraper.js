const FoodpandaScraper = require('./foodpandaScraper');
const readline = require('readline');

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  const searchQuery = 'nasi lemak';
  const location = 'Kuala Lumpur, Malaysia';
  const userId = await ask('Enter a user ID (for session reuse): ');
  const email = await ask('Enter your Foodpanda email: ');
  const password = await ask('Enter your Foodpanda password: ');
  const scraper = new FoodpandaScraper();
  try {
    const results = await scraper.scrape(searchQuery, location, userId, email, password);
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Scraper error:', err);
  }
})(); 