import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { parseOCR, convertTimeToSeconds, calculatePace } from '@/lib/ocr-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('screenshots') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const results = [];
    
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Simple Tesseract call
      const { data: { text } } = await Tesseract.recognize(
        buffer,
        'eng'
      );

      console.log('Tesseract extracted:', text);
      const parsed = parseOCR(text); // Changed from parseGarminOCR to parseOCR
      results.push({ text, parsed, filename: file.name });
    }

    // Merge results - take best confidence values
    const bestResult = results.reduce((best, current) => {
      if (current.parsed.confidence === 'high') return current;
      return best;
    }, results[0]);

    // If we have distance and time but no pace, calculate it
    if (bestResult.parsed.distance && bestResult.parsed.duration && !bestResult.parsed.pace) {
      const timeSeconds = convertTimeToSeconds(bestResult.parsed.duration);
      bestResult.parsed.pace = calculatePace(bestResult.parsed.distance, timeSeconds);
    }

    return NextResponse.json({
      success: true,
      data: bestResult.parsed,
      rawText: results.map(r => r.text).join('\n---\n'),
      multipleScreenshots: results.length > 1
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: (error as Error).message }, 
      { status: 500 }
    );
  }
}