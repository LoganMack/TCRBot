// testLogin.js
require('dotenv').config();
const { iracingLogin, client } = require('./utils/iracingClient');

(async function test() {
  // Log in
  await iracingLogin();

  // If login succeeded, try a test call
  try {
    const resp = await client.get('https://members-ng.iracing.com/data/series/get');
    console.log('Series get response:', resp.data);
  } catch (err) {
    console.error('Error fetching series data:', err);
  }
})();
