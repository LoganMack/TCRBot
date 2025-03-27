// utils/tcrSearch.js
const axios = require('axios');
const { client } = require('./iracingClient');

async function getRecentTcrFixedRace() {
  // This is TCR fixed series ID, open series is 530
  const seriesId = 430; 

  const baseUrl = 'https://members-ng.iracing.com/data/results/search_series';
  const url = `${baseUrl}?series_id=${seriesId}&season_year=2025&season_quarter=1`;

  console.log('[getRecentTcrFixedRace] URL:', url);

  try {
    const resp = await client.get(url);
    const body = resp.data;
    if (!body?.data?.chunk_info) {
      console.warn("No chunk_info, so probably no results at all for that series & season combo.");
      return null;
    }

    const chunkInfo = body.data.chunk_info;
    const baseDownloadUrl = chunkInfo.base_download_url;
    const chunkFiles = chunkInfo.chunk_file_names || [];

    let allRaces = [];

    // Loop over ALL chunk files
    for (const fileName of chunkFiles) {
      const chunkUrl = baseDownloadUrl + fileName;
      console.log("[DEBUG] fetching chunk:", chunkUrl);

      // chunkResp.data is the array of race objects
      const chunkResp = await axios.get(chunkUrl);
      const chunkData = chunkResp.data;

      if (!Array.isArray(chunkData)) {
        console.log("Chunk data is not an array:", typeof chunkData);
        continue;
      }

      // Filter to "Race" sessions
      const raceEvents = chunkData.filter(r => r.event_type_name === 'Race');
      allRaces = allRaces.concat(raceEvents);
    }

    if (allRaces.length === 0) {
      console.log("No race events found for TCR Fixed in these chunks.");
      return null;
    }

    // Sort by start_time descending
    allRaces.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    const mostRecent = allRaces[0];
    console.log("Most recent TCR Fixed race is:", mostRecent);

    return mostRecent;
  } catch (err) {
    console.error("Error in getRecentTcrFixedRace:", err);
    return null;
  }
}

module.exports = {
  getRecentTcrFixedRace,
};
