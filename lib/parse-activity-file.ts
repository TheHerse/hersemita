import FitParser from 'fit-file-parser';
import gpxParser from 'gpxparser';

export interface ParsedActivity {
  distance_miles: number;
  duration_seconds: number;
  pace_per_mile: number;
  start_time: string;
}

export async function parseActivityFile(file: File, fileType: string): Promise<ParsedActivity> {
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
  const gpx = new gpxParser();
  gpx.parse(new TextDecoder().decode(data));
  
  if (!gpx.tracks.length || !gpx.tracks[0].distance.total) {
    throw new Error('Invalid GPX file: No track data');
  }
  
  const track = gpx.tracks[0];
  const startPoint = track.points[0];
  const endPoint = track.points[track.points.length - 1];
  
  const startTime = startPoint?.time ? new Date(startPoint.time).toISOString() : new Date().toISOString();
  const endTime = endPoint?.time ? new Date(endPoint.time).toISOString() : startTime;
  
  const duration = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000;
  
  return {
    distance_miles: track.distance.total / 1609.34,
    duration_seconds: Math.round(duration),
    pace_per_mile: duration / (track.distance.total / 1609.34),
    start_time: startTime,
  };
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
