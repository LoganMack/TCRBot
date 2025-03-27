// utils/iracingAuth.js
const CryptoJS = require('crypto-js');

/**
 * Hash the password according to iRacing’s requirement
 * @param {string} username - The iRacing username (email)
 * @param {string} plainPassword - The plain-text password
 * @returns {string} Base64-encoded SHA-256 hash
 */
function hashIracingPassword(username, plainPassword) {
  // username must be lowercased per docs
  const toHash = plainPassword + username.toLowerCase();
  // Create the SHA-256 hash
  const hash = CryptoJS.SHA256(toHash);
  // Encode the hash in Base64
  const base64Hash = CryptoJS.enc.Base64.stringify(hash);

  return base64Hash;
}

module.exports = { hashIracingPassword };
