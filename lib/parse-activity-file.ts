import FitParser from 'fit-file-parser';

const MAX_ACTIVITY_FILE_BYTES = 8 * 1024 * 1024;
const MAX_GPX_POINTS = 100_000;

export interface ParsedActivity {
  distance_miles: number;
  duration_seconds: number;
  pace_per_mile: number;
  start_time: string;
}

export async function parseActivityFile(file: File, fileType: string): Promise<ParsedActivity> {
  if (file.size <= 0 || file.size > MAX_ACTIVITY_FILE_BYTES) {
    throw new Error('Activity file must be between 1 byte and 8 MB');
  }
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  switch (fileType) {
    case 'fit':
      return parseFIT(uint8Array);
    case 'gpx':
      return parseGPX(uint8Array);
    case 'tcx':
      return parseTCX(uint8Array);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

function parseFIT(data: Uint8Array): Promise<ParsedActivity> {
  const fitParser = new FitParser({ force: true, speedUnit: 'm/s' });
  const fitBuffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(fitBuffer).set(data);
  
  return new Promise((resolve, reject) => {
    fitParser.parse(fitBuffer, (err, parsedData) => {
      if (err) return reject(err);
      if (!parsedData?.sessions?.length) return reject(new Error('Invalid FIT file'));
      
      const session = parsedData.sessions[0];
      if (!session?.total_distance || !session?.total_timer_time) {
        return reject(new Error('Invalid FIT file: Missing session data'));
      }
      
      resolve({
        distance_miles: session.total_distance / 1609.34,
        duration_seconds: Math.round(session.total_timer_time),
        pace_per_mile: session.total_timer_time / (session.total_distance / 1609.34),
        start_time: session.start_time || new Date().toISOString(),
      });
    });
  });
}

function parseGPX(data: Uint8Array): ParsedActivity {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(data);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error('Invalid GPX file: Document declarations are not allowed');
  }

  const pointPattern = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt\s*>/gi;
  const points: Array<{ latitude: number; longitude: number; time: number | null }> = [];
  let match: RegExpExecArray | null;
  while ((match = pointPattern.exec(xml)) !== null) {
    if (points.length >= MAX_GPX_POINTS) {
      throw new Error('Invalid GPX file: Too many track points');
    }
    const latitudeMatch = match[1].match(/\blat\s*=\s*["']([^"']+)["']/i);
    const longitudeMatch = match[1].match(/\blon\s*=\s*["']([^"']+)["']/i);
    if (!latitudeMatch || !longitudeMatch) continue;
    const latitude = Number(latitudeMatch[1]);
    const longitude = Number(longitudeMatch[1]);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) continue;
    const timeMatch = match[2].match(/<time\b[^>]*>\s*([^<]+?)\s*<\/time\s*>/i);
    const timestamp = timeMatch ? new Date(timeMatch[1]).getTime() : NaN;
    points.push({ latitude, longitude, time: Number.isFinite(timestamp) ? timestamp : null });
  }

  if (points.length < 2) {
    throw new Error('Invalid GPX file: No track data');
  }

  let distanceMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceMeters += haversineMeters(points[index - 1], points[index]);
  }
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    throw new Error('Invalid GPX file: No measurable distance');
  }

  const timedPoints = points.filter((point) => point.time != null);
  const firstTime = timedPoints[0]?.time ?? null;
  const lastTime = timedPoints[timedPoints.length - 1]?.time ?? null;
  if (firstTime == null || lastTime == null || lastTime <= firstTime) {
    throw new Error('Invalid GPX file: Missing or invalid track times');
  }
  const duration = (lastTime - firstTime) / 1000;
  const distanceMiles = distanceMeters / 1609.34;
  return {
    distance_miles: distanceMiles,
    duration_seconds: Math.round(duration),
    pace_per_mile: duration / distanceMiles,
    start_time: new Date(firstTime).toISOString(),
  };
}

function haversineMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseTCX(data: Uint8Array): ParsedActivity {
  const xml = new TextDecoder().decode(data);
  const distanceMatch = xml.match(/<DistanceMeters>(\d+)<\/DistanceMeters>/);
  const timeMatch = xml.match(/<TotalTimeSeconds>(\d+)<\/TotalTimeSeconds>/);
  const startTimeMatch = xml.match(/<Id>([^<]+)<\/Id>/);
  
  const distanceMiles = distanceMatch ? parseInt(distanceMatch[1]) / 1609.34 : 0;
  const durationSeconds = timeMatch ? parseInt(timeMatch[1]) : 0;
  
  return {
    distance_miles: distanceMiles,
    duration_seconds: durationSeconds,
    pace_per_mile: durationSeconds / distanceMiles || 0,
    start_time: startTimeMatch ? startTimeMatch[1] : new Date().toISOString(),
  };
}
