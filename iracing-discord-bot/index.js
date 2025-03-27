// index.js
require('dotenv').config();
const schedule = require('node-schedule');
const { Client, GatewayIntentBits } = require('discord.js');

// Our iRacing login + cookie-based client instance
const { iracingApi, iracingLogin } = require('./utils/iracingClient');
const { getDetailedResult } = require('./utils/getDetailedResult');
const { parseDetailedResult } = require('./utils/parseDetailedResult');
const { formatFriendlyDateTime } = require('./utils/formatDate');

// TCR series IDs
const TCR_SERIES_IDS = [430, 503];

/**
 * searchForRecentSubsessions:
 *  - GET /data/results/search_series?finish_range_begin=...
 *  - parse chunk_info => chunk files => gather sub.subsession_id
 */
async function searchForRecentSubsessions(seriesId, finishBeginISO, finishEndISO) {
  console.log(`[searchForRecentSubsessions] series=${seriesId} range=[${finishBeginISO}, ${finishEndISO}]`);

  const baseUrl = 'https://members-ng.iracing.com/data/results/search_series';
  const params = {
    series_id: seriesId,
    finish_range_begin: finishBeginISO,
    finish_range_end: finishEndISO,
    official_only: true,
    event_types: '5', // Race
  };

  const mainResp = await iracingApi.get(baseUrl, { params });
  const body = mainResp.data;
  if (!body?.data?.chunk_info) {
    console.log(`[searchForRecentSubsessions] No chunk_info => no results for series ${seriesId}`);
    return [];
  }

  const chunkInfo = body.data.chunk_info;
  const baseDownloadUrl = chunkInfo.base_download_url;
  const chunkFiles = chunkInfo.chunk_file_names || [];
  if (chunkFiles.length === 0) {
    console.log(`[searchForRecentSubsessions] No chunk files => no results for series ${seriesId}`);
    return [];
  }

  const subIds = [];
  for (const fileName of chunkFiles) {
    const chunkUrl = baseDownloadUrl + fileName;
    console.log(`[searchForRecentSubsessions] fetch chunk => ${chunkUrl}`);
    const chunkResp = await iracingApi.get(chunkUrl);
    // The structure typically => { "type":"search_series_chunk", "data":{ "data":[...], ... } }
    const chunkRoot = chunkResp.data;
    const chunkDataObj = chunkRoot; 
    if (!chunkDataObj) {
      console.warn("[searchForRecentSubsessions] no data object => skip");
      continue;
    }
    const sessionsArray = chunkDataObj;
    if (!Array.isArray(sessionsArray)) {
      console.warn("[searchForRecentSubsessions] sessionsArray not array => skip");
      continue;
    }
    for (const sub of sessionsArray) {
      if (sub.event_type_name === "Race") {
        subIds.push(sub.subsession_id);
      }
    }
  }
  return subIds;
}

/**
 * findTcrSeriesSubsessions:
 *   - merges results from both TCR series for the last hour
 *   - sorts them descending
 */
async function findTcrSeriesSubsessions() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1100);
  const finishBeginISO = oneHourAgo.toISOString();
  const finishEndISO = now.toISOString();

  let combined = [];
  for (const sid of TCR_SERIES_IDS) {
    const subs = await searchForRecentSubsessions(sid, finishBeginISO, finishEndISO);
    combined.push(...subs);
  }
  // remove duplicates
  const unique = [...new Set(combined)];
  // reverse sort => largest subId first
  unique.sort((a, b) => b - a);
  console.log('[findTcrSeriesSubsessions] final subs =>', unique);
  return unique;
}

/**
 * We truncate the name => "F. Last" if no flag is there (flags might be broken right now), 
 * or "🇺🇸 F. Last" if there's a leading emoji. We'll do it inside build function.
 */
function truncateNameToInitialLast(fullName) {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const firstInitial = parts[0].charAt(0).toUpperCase() + ".";
  const lastName = parts[parts.length - 1];
  return `${firstInitial} ${lastName}`;
}

/**
 * Build TCR Race Message:
 *  1) # Week x Race Result + possible emojis
 *  2) lines => "Split #x", "Series: ___", "Start: ___", "Track: ___" => now normal lines
 *  3) SoF, Grid, Laps, Wet => single line with '|'
 *  4) code block => columns => Pos, Gap, Driver(20 wide), Pts
 * 
 * For emojis:
 *   - If gap(P2) < 1 => 🔥
 *   - If wet => 🌧️, else use parseDetailedResult's weatherCondition (☀️ etc.)
 *   - If sof > 4000 => 🏆
 */
function buildTcrRaceMessage(parsed, { splitNumber, seriesName }) {
  const {
    startTime,
    trackName,
    isWet,
    raceWeek,
    lapCount,
    gridSize,
    sof,
    podium,
    weatherCondition, // e.g. "☀️", "☁️", etc.
  } = parsed;

  // Title
  let titleLine = `# Week ${raceWeek} Race Result`;

  // Check gap < 1 => if podium[1] exists and on same lap
  let secondPlaceGapSec = 99_999; 
  if (podium.length > 1) {
    // only if they're on same lap as leader => lapsComplete
    const leaderLaps = podium[0].lapsComplete;
    const secondLaps = podium[1].lapsComplete;
    if (leaderLaps === secondLaps) {
      secondPlaceGapSec = podium[1].marginRaw || 0;
    }
  }

  // build up emojis
  let emojis = "";
  if (secondPlaceGapSec < 1) {
    emojis += "🔥";
  }
  if (isWet) {
    emojis += "🌧️";
  } else {
    // not wet => use weatherCondition
    emojis += weatherCondition;
  }
  if (sof > 4000) {
    emojis += "🏆";
  }
  if (emojis) {
    titleLine += ` ${emojis}`;
  }

  // lines => "Split #x", "Series: ___", "Start: ___", "Track: ___"
  const lineSplit  = `Split #${splitNumber}`;
  const lineSeries = `${seriesName}`;
  const lineStart  = `${startTime ? formatFriendlyDateTime(startTime) : "???"}`;
  const lineTrack  = `${trackName}`;

  // SoF, Grid, Laps, Wet => single line with '|'
  // e.g. `SoF: 2000 | Grid: 12 | Laps: 15 | Wet: No`
  const wetStr = isWet ? "Yes" : "No";
  const infoLine = `SoF: ${sof} | Grid: ${gridSize} | Laps: ${lapCount} | Wet: ${wetStr}`;

  // code block => columns => Pos, Gap, Driver(20 wide), Pts
  let tableText = "```\n";
  tableText += "Pos  Gap    Driver            Pts\n";
  tableText += "--------------------------------------\n";

  const leaderLaps = (podium.length > 0) ? podium[0].lapsComplete : 0;
  podium.forEach((p, idx) => {
    let gapDisplay = "";
    if (idx === 0) {
      gapDisplay = "";
    } else {
      const lapsBehind = leaderLaps - p.lapsComplete;
      if (lapsBehind > 0) {
        gapDisplay = `-${lapsBehind}L`;
      } else {
        const raw = p.marginRaw > 0 ? p.marginRaw : 0;
        gapDisplay = raw.toFixed(1);
      }
    }

    // handle possible flag in name
    let finalName = p.driverName;
    const nameParts = finalName.split(/\s+/);
    if (nameParts.length > 1 && /[\uD83C-\uDBFF\uDC00-\uDFFF]+/.test(nameParts[0])) {
      // first token is flag
      const flag = nameParts.shift();
      const rawName = nameParts.join(" ");
      finalName = `${flag} ${truncateNameToInitialLast(rawName)}`;
    } else {
      finalName = truncateNameToInitialLast(finalName);
    }

    const posStr = `P${p.position}`.padEnd(3);
    const gapStr = gapDisplay.padEnd(6);
    const drvStr = finalName.padEnd(19).slice(0,19);
    const ptsStr = String(p.points);

    tableText += `${posStr} ${gapStr} ${drvStr} ${ptsStr}\n`;
  });
  tableText += "```";

  // Combine
  return [
    titleLine,
    lineSplit,
    lineSeries,
    lineStart,
    lineTrack,
    infoLine,
    tableText,
  ].join("\n");
}

async function checkTcrRaces() {
  try {
    console.log("[checkTcrRaces] Start...");

    // login
    await iracingLogin();

    // get the subIds reversed
    const subIds = await findTcrSeriesSubsessions();
    console.log("[checkTcrRaces] subIds:", subIds);

    // label splits from 1..N
    let splitCount = subIds.length;
    for (const subId of subIds) {
      // fetch the details per split
      const detailsResp = await getDetailedResult(subId); // uses iracingApi inside, presumably
      if (!detailsResp) {
        console.warn("No details for subId=", subId);
        continue;
      }
      const parsed = parseDetailedResult(detailsResp);
      if (!parsed) {
        console.warn("No parseable data for subId=", subId);
        continue;
      }

      // pick up the series name from detailsResp, if present
      const seriesName = detailsResp.series_name || "TCR Virtual Challenge";

      // build
      const msg = buildTcrRaceMessage(parsed, {
        splitNumber: splitCount,
        seriesName,
      });

      // post to Discord
      const channel = await discordClient.channels.fetch(process.env.CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        console.log(`[DEBUG] subId=${subId}, length=${msg.length}`);
        if (msg.length > 2000) {
          console.warn("Message near or over 2000 chars");
        }
        await channel.send(msg);
        console.log(`Posted TCR result for subId=${subId}`);
      }
      splitCount--;
    }

  } catch (err) {
    console.error("[checkTcrRaces] error:", err);
  }
}

// Discord bot setup
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
discordClient.once('ready', () => {
  console.log(`[Discord] Logged in as ${discordClient.user.tag}`);
});
discordClient.login(process.env.DISCORD_TOKEN);

// Scheduler 0:45 every hour ---
schedule.scheduleJob('0 45 * * * *', () => {
  console.log("Scheduled job => check TCR races from last hour...");
  checkTcrRaces();
});

// Optionally run once at startup for debugging
//checkTcrRaces();
