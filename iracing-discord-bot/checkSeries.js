// checkSeries.js
require('dotenv').config(); // load .env so we have IRACING_USERNAME/PASSWORD
const { iracingLogin, client } = require('./utils/iracingClient');

(async function run() {
  try {
  await iracingLogin();

  const resp = await client.get('https://members-ng.iracing.com/data/series/get');
  console.log("Raw series data:", JSON.stringify(resp.data, null, 2));
  
  // Check if there's an issue
} catch (err) {
  console.error("Error checking series:", err);
}

})();
