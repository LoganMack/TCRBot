// utils/getDetailedResult.js
const axios = require('axios');
const { iracingApi } = require('./iracingClient');

/**
 * Fetch full detailed results for a given subsession.
 * If iRacing returns a presigned "link" object, we do a second fetch
 * to retrieve the actual JSON with session_results.
 */
async function getDetailedResult(subsessionId) {
  const url = `https://members-ng.iracing.com/data/results/get?subsession_id=${subsessionId}`;
  console.log("[getDetailedResult] URL:", url);

  try {
    // Make the initial call to iRacing
    const resp = await iracingApi.get(url);

    // If the data is just { link: "..." }, do a second fetch
    if (resp.data && resp.data.link) {
      console.log("[getDetailedResult] Found a presigned S3 link. Fetching real JSON...");
      const secondResp = await iracingApi.get(resp.data.link);
	  console.log("[getDetailedResult] da", secondResp.data);
      return secondResp.data; // This should contain session_results, track, etc.
    }

    // Otherwise, iRacing gave us the final data directly
    return resp.data;
  } catch (err) {
    console.error("Error fetching detailed result for", subsessionId, err);
    return null;
  }
}

module.exports = { getDetailedResult };
