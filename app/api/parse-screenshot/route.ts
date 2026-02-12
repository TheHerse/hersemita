import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { parseOCR, convertTimeToSeconds, calculatePace } from '@/lib/ocr-parser';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('screenshots') as File[];
    const runnerId = formData.get('runnerId') as string;
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (!runnerId) {
      return NextResponse.json({ error: 'Runner ID required' }, { status: 400 });
    }

    const results = [];
    const screenshotUrls: string[] = [];
    
    // Process all uploaded screenshots
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Upload to Supabase Storage with organized path
      const fileName = `${runnerId}/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      
      const { error: uploadError } = await supabase
        .storage
        .from('activity-screenshots')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to save screenshot: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('activity-screenshots')
        .getPublicUrl(fileName);
      
      screenshotUrls.push(publicUrl);
      
      // OCR processing
      const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
      console.log(`Tesseract extracted from ${file.name}:`, text);
      
      const parsed = parseOCR(text);
      results.push({ 
        text, 
        parsed, 
        filename: file.name, 
        url: publicUrl 
      });
    }

    // Find best result based on confidence
    const bestResult = results.reduce((best, current) => {
      if (!best) return current;
      if (current.parsed.confidence === 'high') return current;
      if (current.parsed.confidence === 'medium' && best.parsed.confidence !== 'high') return current;
      return best;
    }, results[0]);

    // Calculate pace if we have distance and time but no pace
    if (bestResult?.parsed?.distance && bestResult?.parsed?.duration && !bestResult?.parsed?.pace) {
      const timeSeconds = convertTimeToSeconds(bestResult.parsed.duration);
      bestResult.parsed.pace = calculatePace(bestResult.parsed.distance, timeSeconds);
    }

    return NextResponse.json({
      success: true,
      data: bestResult?.parsed || {},
      detectedApp: bestResult?.parsed?.app || 'unknown', // 'garmin_connect', 'strava', etc.
      rawDistance: bestResult?.parsed?.rawDistance || null, // Original text like "5.01 km"
      rawPace: bestResult?.parsed?.rawPace || null, // Original text like "4:51 /km"
      screenshotUrls,
      rawText: results.map(r => r.text).join('\n---\n'),
      multipleScreenshots: results.length > 1,
      confidence: bestResult?.parsed?.confidence || 'low'
    });

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: (error as Error).message }, 
      { status: 500 }
    );
  }
}