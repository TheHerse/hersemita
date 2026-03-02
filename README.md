# Hersemita

Operating system for cross-country coaches. Automates athlete data collection from the tools coaches already use (phone photos), skipping the friction of file downloads and manual spreadsheets.

**Status:** MVP in development, pilot testing with award-winning coaches  
**Live:** hersemita.com  
**Stack:** Next.js 14, TypeScript, Supabase, Twilio, Tesseract OCR

## How I Found This Problem

**The Observation:**
Former high school cross-country runner. College roommates ran XC and I watched them screenshot their Garmin/Apple Watch results and text them to their coach because downloading GPX files on mobile was impossible. 

Teacher coworker was head coach and spent Sundays manually copying data from 50+ athlete screenshots into Excel, then texting parents individually about practice changes.

**The Technical Reality Check:**
I initially built file upload support (GPX/FIT/TCX), but discovered Garmin, Apple Watch, and Strava make mobile file exports intentionally difficult. Buried in submenus, require desktop sync, or locked behind paywalls. Athletes simply will not do it.

The solution: Meet them where they are. Screenshots are instant. OCR extracts the data automatically.

## Pilot Validation

Currently testing with two award-winning coaches:

- **Jorge Maese** - Former head coach of state champion XC team, El Paso Times All-City Boys Coach of the Year. Testing athlete data workflows and parent communication features.

- **Ulises Lopez** - Class 6A Girls Cross-Country Head Coach of the Year, Region 4. Testing team management at scale and performance analytics.

These are not just early users. They are domain experts with championship track records. Their feedback is shaping the OCR accuracy requirements and dashboard prioritization.

## Current Implementation

### Data Ingestion (The Pivot)

**Attempt 1:** File uploads  
Failed: Mobile OS restrictions make GPS file exports friction-heavy

**Attempt 2 (Current):** OCR workout screenshot parsing  
In progress: Tesseract preprocessing pipeline for watch face recognition
- Handles Garmin, Apple Watch, Strava screenshot variations
- Image rotation correction, lighting normalization
- Manual entry fallback when OCR confidence is low

### Core Features

- **Runner portal:** 6-digit codes (no accounts) to upload screenshot for instant data extraction
- **Coach dashboard:** Performance trends, mileage tracking, PR history (Recharts)
- **Parent SMS:** Twilio integration for team-wide updates (10DLC approval in progress)
- **Multi-tenant:** Supabase RLS ensures coach data isolation

## Technical Challenges Active

**OCR Accuracy:** Training Tesseract on watch UI variations. Garmin round faces vs Apple square layouts, different font weights, glare issues.

**Mobile-First Constraints:** Designing for coaches who manage everything from phones on bus rides to meets.

**SMS Compliance:** Navigating Twilio A2P 10DLC as a solo founder. Documentation, business verification, use-case approval.

## Architecture
```
app/
├── dashboard/         # Coach analytics and team overview
├── runner/
│   ├── login/         # 6-digit code access for athletes
│   └── upload/        # Workout screenshot submission
├── runners/
│   ├── page.tsx       # Team roster management
│   ├── new/           # Add new athletes
│   ├── message/       # Mass SMS to parents
│   └── upload/[runnerId]/  # Coach upload for specific athlete
├── about/             # Product info
├── privacy/           # Privacy policy
├── terms/             # Terms of service
└── sign-in/           # Clerk authentication
lib/
├── ocr-parser.ts      # Tesseract OCR processing pipeline
├── parse-activity-file.ts  # GPS file parsing fallback (GPX/FIT/TCX)
├── supabase.ts        # Database client with RLS
└── twilio.ts          # Mass SMS service
middleware.ts          # Clerk auth routing protection
```
## Roadmap

**Q1 2025 (Now):**
- Fix OCR accuracy for 95%+ successful parse rate
- Complete Twilio 10DLC business verification
- Pilot with Jorge Maese and Ulises Lopez
- Manual entry fallback for OCR edge cases

**Q2/Q3 2025:**
- Training calendar with parent view
- Automated weekly progress reports
- Injury risk detection (sudden mileage spike algorithms)

## Founder Background

- CS/Math double major
- 2 years high school math teacher (saw the admin pain from the teacher side)
- 3 years Resident Assistant (managed 40 students, systems thinking)
- High school XC runner with connections to championship-level coaches

Built this solo, iterating based on feedback from award-winning coaches rather than assumptions.

## Stack

Next.js 14, TypeScript, Supabase/PostgreSQL, Tesseract OCR, Twilio, Tailwind, Recharts, Clerk Auth
