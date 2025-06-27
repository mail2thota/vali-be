const FoodpandaScraper = require('../scrapers/foodpandaScraper');

async function scrape(platform, searchQuery, location) {
  let scraper;
  switch (platform) {
    case 'foodpanda':
      scraper = new FoodpandaScraper();
      break;
    default:
      throw new Error('Platform not supported');
  }
  return await scraper.scrape(searchQuery, location);
}

module.exports = { scrape }; 