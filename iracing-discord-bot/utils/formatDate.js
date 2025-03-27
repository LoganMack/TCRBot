// utils/formatDate.js
const { format } = require('date-fns');

function formatFriendlyDate(isoString) {
  return format(new Date(isoString), "MMMM do, yyyy");
}

function formatFriendlyDateTime(isoString) {
  return format(
    new Date(isoString),
    "MMMM do, yyyy 'at' h:mm a"
  );
}

module.exports = { formatFriendlyDateTime };
