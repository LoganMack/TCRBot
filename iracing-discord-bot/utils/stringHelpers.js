// utils/stringHelpers.js

/**
 * Manually pads the right side of a string with spaces until we reach 'len'.
 *
 * @param {string|number} value - The value to pad (will be converted to string).
 * @param {number} len - The target length of the resulting string.
 * @returns {string} The original string plus trailing spaces (if needed).
 */
function padEndManual(value, len) {
  let str = String(value);
  while (str.length < len) {
    str += ' ';
  }
  return str;
}

module.exports = { padEndManual };
