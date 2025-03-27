// utils/iracingClient.js
require('dotenv').config();
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { hashIracingPassword } = require('./iracingAuth');

const username = process.env.IRACING_USERNAME;
const plainPassword = process.env.IRACING_PASSWORD;

const jar = new CookieJar();
// Create an axios instance with cookie jar
const iracingApi = wrapper(axios.create({
  jar,
  withCredentials: true,
}));

async function iracingLogin() {
  try {
    // Hash the password
    const hashedPass = hashIracingPassword(username, plainPassword);

    // POST to iRacing
    const resp = await iracingApi.post(
      'https://members-ng.iracing.com/auth',
      { email: username, password: hashedPass },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('[iracingLogin] status:', resp.status, resp.data);
    if (resp.status === 200) {
      console.log('[iracingLogin] iRacing login successful, cookies in jar.');
    } else {
      console.warn('[iracingLogin] Unexpected status:', resp.status);
    }
  } catch (err) {
    console.error('[iracingLogin] Error logging in:', err.response?.status, err.response?.data || err);
  }
}

module.exports = {
  iracingApi,
  iracingLogin,
};
