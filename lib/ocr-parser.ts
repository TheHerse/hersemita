interface ParsedRunData {
  distance: number | null; // always in miles
  duration: string | null;
  pace: string | null;
  date: string | null;
  app: 'garmin_connect' | 'garmin_clipboard' | 'strava' | 'apple_watch' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  rawDistance: string | null;
  rawPace: string | null;
}

const KM_TO_MILES = 0.621371;

function convertKmToMiles(km: number): number {
  return km * KM_TO_MILES;
}

function convertKmhToMinPerMile(paceMin: number, paceSec: number): string {
  const totalSecPerKm = (paceMin * 60) + paceSec;
  const totalSecPerMile = totalSecPerKm / KM_TO_MILES;
  const min = Math.floor(totalSecPerMile / 60);
  const sec = Math.round(totalSecPerMile % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Detect app based on visual/text patterns
function detectApp(text: string): ParsedRunData['app'] {
  const lower = text.toLowerCase();
  
  // Apple Watch: colored text, "Outdoor Run", Workout Time
  if (text.includes('Outdoor Run') || 
      text.includes('Workout Time') || 
      /[0-9]+'[0-9]+"/.test(text)) {
    return 'apple_watch';
  }
  
  // Garmin Clipboard: "Total Distance", "Total Duration", "Summary" heading
  if (text.includes('Summary') && 
      text.includes('Total Distance') && 
      text.includes('Total Duration')) {
    return 'garmin_clipboard';
  }
  
  // Garmin Connect: dark mode with tabs, "Overview", "Stats"
  if (text.includes('Running') && 
      (text.includes('Overview') && text.includes('Stats'))) {
    return 'garmin_connect';
  }
  
  // Strava: orange header, "Moving Time", specific layout
  if (lower.includes('strava') || 
      text.includes('Moving Time') || 
      text.includes('Elevation Gain') && text.includes('/km')) {
    return 'strava';
  }
  
  return 'unknown';
}

// Parse Garmin Clipboard (the new screenshots)
function parseGarminClipboard(text: string): Partial<ParsedRunData> {
  let distance: number | null = null;
  let duration: string | null = null;
  let pace: string | null = null;
  let date: string | null = null;
  let rawDistance: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  // Distance: "0.00 mi" labeled "Total Distance"
  const distMatch = text.match(/Total\s*Distance[:\s]*(\d+\.\d+)\s*mi/i) ||
                    text.match(/(\d+\.\d+)\s*mi\s*\n\s*Total\s*Distance/i);
  if (distMatch) {
    distance = parseFloat(distMatch[1]);
    rawDistance = `${distMatch[1]} mi`;
    confidence = 'high';
  }
  
  // Time: "0:03" labeled "Total Duration"
  const timeMatch = text.match(/Total\s*Duration[:\s]*(\d+:\d+(?:\.\d+)?)/i) ||
                    text.match(/(\d+:\d+(?:\.\d+)?)\s*\n\s*Total\s*Duration/i);
  if (timeMatch) {
    duration = timeMatch[1];
    confidence = 'high';
  }
  
  // Pace: "—" or actual pace like "8:45" labeled "Avg Pace"
  const paceMatch = text.match(/Avg\s*Pace[:\s]*(\d+:\d{2})/i);
  if (paceMatch) {
    pace = paceMatch[1];
  }
  
  // Date: "February 10, 2026" or "Feb 10 @ 10:14 PM"
  const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/i) ||
                    text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*@\s*\d{1,2}:\d{2}/i);
  if (dateMatch) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let monthNum: number;
    let day: string;
    let year: number;
    
    if (monthNames.includes(dateMatch[1])) {
      monthNum = monthNames.indexOf(dateMatch[1]) + 1;
      day = dateMatch[2].padStart(2, '0');
      year = parseInt(dateMatch[3]);
    } else {
      monthNum = shortMonthNames.indexOf(dateMatch[1]) + 1;
      day = dateMatch[2].padStart(2, '0');
      year = new Date().getFullYear();
    }
    
    date = `${year}-${monthNum.toString().padStart(2, '0')}-${day}`;
  }
  
  return { distance, duration, pace, date, confidence, rawDistance };
}

// Parse Garmin Connect (original mobile app screenshots)
function parseGarminConnect(text: string): Partial<ParsedRunData> {
  let distance: number | null = null;
  let duration: string | null = null;
  let pace: string | null = null;
  let date: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  // Distance: "0.00 mi"
  const distMatch = text.match(/(\d+\.\d+)\s*mi/i);
  if (distMatch) {
    distance = parseFloat(distMatch[1]);
    confidence = 'high';
  }
  
  // Time: "0:03" or "26:45" labeled as "Total Time"
  const timeMatch = text.match(/Total\s*Time[:\s]*(\d+:\d+(?:\.\d+)?)/i);
  if (timeMatch) {
    duration = timeMatch[1];
    confidence = 'high';
  }
  
  // Pace: "0:00 /mi" or "8:45 /mi"
  const paceMatch = text.match(/(\d+:\d{2})\s*\/mi/i);
  if (paceMatch) {
    pace = paceMatch[1];
  }
  
  // Date: "Feb 10 @ 10:14 PM"
  const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
  if (dateMatch) {
    const year = new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNum = monthNames.indexOf(dateMatch[1]) + 1;
    date = `${year}-${monthNum.toString().padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
  }
  
  return { distance, duration, pace, date, confidence };
}

// Parse Strava
function parseStrava(text: string): Partial<ParsedRunData> {
  let distance: number | null = null;
  let duration: string | null = null;
  let pace: string | null = null;
  let date: string | null = null;
  let rawDistance: string | null = null;
  let rawPace: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  // Distance: "5.01 km" or "16.6 km" or "3.1 mi"
  const distMatch = text.match(/(\d+\.?\d*)\s*(km|mi)\b/i);
  if (distMatch) {
    const value = parseFloat(distMatch[1]);
    const unit = distMatch[2].toLowerCase();
    rawDistance = `${value} ${unit}`;
    
    if (unit === 'km') {
      distance = convertKmToMiles(value);
    } else {
      distance = value;
    }
    confidence = 'high';
  }
  
  // Moving Time: "24:17" or "1:47:41"
  const timeMatch = text.match(/Moving\s*Time[^\d]*(\d+:\d{2}(?::\d{2})?)/i);
  if (timeMatch) {
    duration = timeMatch[1];
    confidence = 'high';
  }
  
  // Pace: "4:51 /km" or "6:28 /km" or "8:30 /mi"
  const paceMatch = text.match(/(\d+:\d{2})\s*\/\s*(km|mi)/i);
  if (paceMatch) {
    const time = paceMatch[1];
    const unit = paceMatch[2].toLowerCase();
    rawPace = `${time}/${unit}`;
    
    if (unit === 'km') {
      const [min, sec] = time.split(':').map(Number);
      pace = convertKmhToMinPerMile(min, sec || 0);
    } else {
      pace = time;
    }
  }
  
  // Date: "November 25, 2017 at 7:51 AM"
  const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/i);
  if (dateMatch) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = (monthNames.indexOf(dateMatch[1]) + 1).toString().padStart(2, '0');
    const day = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3];
    date = `${year}-${month}-${day}`;
  }
  
  return { distance, duration, pace, date, confidence, rawDistance, rawPace };
}

// Parse Apple Watch
function parseAppleWatch(text: string): Partial<ParsedRunData> {
  let distance: number | null = null;
  let duration: string | null = null;
  let pace: string | null = null;
  let date: string | null = null;
  let rawDistance: string | null = null;
  let rawPace: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  // Distance: "4.86KM" or "6.22MI" (uppercase, attached)
  const distMatch = text.match(/(\d+\.\d+)\s*(KM|MI)\b/);
  if (distMatch) {
    const value = parseFloat(distMatch[1]);
    const unit = distMatch[2].toUpperCase();
    rawDistance = `${value} ${unit}`;
    
    if (unit === 'KM') {
      distance = convertKmToMiles(value);
    } else {
      distance = value;
    }
    confidence = 'high';
  }
  
  // Time patterns: "0:31:45", "1:14:23" or "1:47:41"
  const timeMatch = text.match(/(?:Workout Time|Total Time|Moving Time)[^\d]*(\d+:\d{2}(?::\d{2})?)/i) ||
                    text.match(/\b(\d+:\d{2}(?::\d{2})?)\s*$/m);
  if (timeMatch) {
    duration = timeMatch[1];
    confidence = 'high';
  }
  
  // Pace: "6'31"/KM" or "6'09"/MI" (uses ' and ")
  const paceMatch = text.match(/(\d+)'(\d+)"\s*\/\s*(KM|MI)/i);
  if (paceMatch) {
    const min = parseInt(paceMatch[1]);
    const sec = parseInt(paceMatch[2]);
    const unit = paceMatch[3].toUpperCase();
    rawPace = `${min}'${sec}"/${unit}`;
    
    if (unit === 'KM') {
      pace = convertKmhToMinPerMile(min, sec);
    } else {
      pace = `${min}:${sec.toString().padStart(2, '0')}`;
    }
  }
  
  // Date: "Sun 9 Oct" or "Sun 19 Nov"
  const dateMatch = text.match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  if (dateMatch) {
    const day = dateMatch[2];
    const month = dateMatch[3];
    const year = new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNum = monthNames.indexOf(month) + 1;
    date = `${year}-${monthNum.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return { distance, duration, pace, date, confidence, rawDistance, rawPace };
}

// Main export function
export function parseOCR(text: string): ParsedRunData {
  const app = detectApp(text);
  let result: Partial<ParsedRunData>;
  
  switch (app) {
    case 'garmin_clipboard':
      result = parseGarminClipboard(text);
      break;
    case 'garmin_connect':
      result = parseGarminConnect(text);
      break;
    case 'strava':
      result = parseStrava(text);
      break;
    case 'apple_watch':
      result = parseAppleWatch(text);
      break;
    default:
      // Try all parsers and take the best one
      const parsers = [
        parseGarminClipboard(text),
        parseGarminConnect(text),
        parseStrava(text),
        parseAppleWatch(text)
      ];
      result = parsers.reduce((best, current) => 
        (current.confidence === 'high' && best.confidence !== 'high') ? current : best
      , parsers[0]);
  }
  
  return {
    distance: result.distance || null,
    duration: result.duration || null,
    pace: result.pace || null,
    date: result.date || null,
    app,
    confidence: result.confidence || 'low',
    rawDistance: result.rawDistance || null,
    rawPace: result.rawPace || null
  };
}

// Helper functions
export function convertTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export function calculatePace(distance: number, timeSeconds: number): string {
  if (!distance || !timeSeconds || distance === 0) return '--:--';
  const paceSeconds = timeSeconds / distance;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}