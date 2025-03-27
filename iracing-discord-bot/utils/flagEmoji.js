// utils/flagEmoji.js
function countryCodeToFlagEmoji(countryCode) {
  if (!countryCode) return '';
  
  // We only want the first 2 letters in uppercase
  const upperCased = countryCode.toUpperCase().slice(0, 2);

  // Convert each character A-Z to the corresponding regional indicator symbol
  return [...upperCased]
    .map(char => 0x1F1E6 + (char.charCodeAt(0) - 65))
    .map(code => String.fromCodePoint(code))
    .join('');
}

module.exports = { countryCodeToFlagEmoji };
