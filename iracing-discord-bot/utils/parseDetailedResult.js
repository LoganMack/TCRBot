// utils/parseDetailedResult.js

function iRacingTimeToSeconds(rawTime) {
  // e.g. best_lap_time = 1396984 => 139.6984 seconds
  if (!rawTime || rawTime < 0) return 0;
  return rawTime / 10000.0;
}

function parseSessionWeather(session) {
  // If session && session.weather_result => check `avg_skies`, etc.
  if (!session || !session.weather_result) return null;

  const wr = session.weather_result;
  // wr.avg_skies => e.g. 0=clear,1=partly,2=mostly,3=overcast
  const skyVal = Math.round(wr.avg_skies || 0);

  let conditionEmoji = "☀️"; // default
  switch (skyVal) {
    case 0: conditionEmoji = "☀️"; break; // Clear
    case 1: conditionEmoji = "🌤️"; break; // Partly
    case 2: conditionEmoji = "🌥️"; break; // Mostly
    case 3: conditionEmoji = "☁️"; break; // Overcast
    default: conditionEmoji = "☀️"; break; // fallback
  }

  return {
    conditionEmoji,
    avgSkies: skyVal,
  };
}

function parseDetailedResult(detailed) {
  if (!detailed) return null;

  // Pull top-level info
  const startTime = detailed.start_time || null;
  const trackName = detailed.track?.track_name || "Unknown Track";
  // If iRacing says "weather_type" includes "rain", do isWet = true
  const isWet = (detailed.weather?.track_water > 0) 
                ? true : false;

  // Race week fix => +1
  const raceWeek = (typeof detailed.race_week_num === 'number') ? (detailed.race_week_num + 1) : 1;
  const lapCount = detailed.race_summary?.laps_complete ?? 0;
  const gridSize = detailed.num_drivers ?? 0;

  // Find the race session => type=6
  const raceSession = detailed.session_results?.find(sr => sr.simsession_type === 6);
  const sof = raceSession?.strength_of_field ?? detailed.event_strength_of_field ?? 0;

  // Possibly parse weather from the race session if it's not wet
  let weatherCondition = "☀️"; // default to sun if not wet
  if (raceSession) {
    const w = parseSessionWeather(raceSession);
    if (w && !isWet) {
      weatherCondition = w.conditionEmoji; 
    }
  }

  // Sort drivers by finishing_position
  if (!raceSession || !raceSession.results) {
    console.warn("[parseDetailedResult] No race session found");
    return {
      startTime,
      trackName,
      isWet,
      raceWeek,
      lapCount,
      gridSize,
      sof,
      podium: [],
      weatherCondition,
    };
  }

  const drivers = [...raceSession.results].sort(
    (a,b) => a.finish_position - b.finish_position
  );

  // Build the podium array
  const podium = drivers.map((d) => {
    // Margin in seconds if same lap
    let marginSec = 0;
    if (d.interval && d.interval > 0) {
      marginSec = d.interval / 10000.0;
    }

    // Best lap
    const bestLapSec = iRacingTimeToSeconds(d.best_lap_time);

    return {
      position: (d.finish_position+1 || 0),
      lapsComplete: d.laps_complete ?? 0,
      marginRaw: marginSec,
      driverName: d.display_name || "???",
      points: d.champ_points ?? 0,
      bestLap: bestLapSec,
    };
  });

  return {
    startTime,
    trackName,
    isWet,
    raceWeek,
    lapCount,
    gridSize,
    sof,
    podium,
    weatherCondition, // e.g. "🌤️"
  };
}

module.exports = { parseDetailedResult };
