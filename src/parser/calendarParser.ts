import { parse, format, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';

interface ParsedCalendar {
    weekStart: string; // ISO
    workingHours: [number, number];
    timezone: string;
    dayLabels: Record<string, string>; // ISO -> "Monday", etc.
    events: Array<{
        date: string;
        startMin: number;
        endMin: number;
        title: string;
    }>;
}

export function parseCalendar(content: string, referenceDate: string): ParsedCalendar {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Force the correct anchor date (User's recommended approach)
    function extractAnchorDate(content: string): Date {
        const weekLineRegex = /Week of\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4})/i;
        const match = content.match(weekLineRegex);
        if (!match) {
            const altMatch = content.match(/Week (?:beginning|of)?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
            if (altMatch) return new Date(altMatch[1]);
            return new Date(referenceDate);
        }

        const dateStr = match[1].replace(/(st|nd|rd|th)/, ''); // remove ordinal
        const parsed = parse(dateStr, 'MMMM d, yyyy', new Date(), { locale: enUS });
        if (isNaN(parsed.getTime())) return new Date(referenceDate);
        return parsed;
    }

    const anchor = extractAnchorDate(content);
    const weekStart = format(anchor, 'yyyy-MM-dd');
    console.log(`Parsed anchor (final): ${weekStart}`);

    let workingHours: [number, number] = [540, 1020];
    let timezone = 'UTC';
    const dayLabels: Record<string, string> = {};
    const events: Array<any> = [];
    let currentDate: string | null = null;

    for (const line of lines) {
        // Working hours
        const hoursMatch = line.match(/(?:Working)?\s*hours:\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
        if (hoursMatch) {
            workingHours = [
                parseTimeToken(hoursMatch[1], hoursMatch[2], hoursMatch[3]),
                parseTimeToken(hoursMatch[4], hoursMatch[5], hoursMatch[6])
            ];
            continue;
        }

        // Timezone
        const tzMatch = line.match(/Timezone:\s*(.+)/i);
        if (tzMatch) {
            timezone = tzMatch[1].replace(/\(.*\)/, '').trim();
            continue;
        }

        // Day header: Resolve relative to anchor
        const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*([A-Za-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
        if (dayMatch) {
            const dayName = dayMatch[1];
            const monthStr = dayMatch[2].toLowerCase().slice(0, 3);
            const dayNum = parseInt(dayMatch[3]);
            const yearNum = dayMatch[4] ? parseInt(dayMatch[4]) : anchor.getFullYear();

            const months: Record<string, number> = {
                jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            const monthIdx = months[monthStr];

            if (monthIdx !== undefined) {
                // IMPORTANT: new Date(y, m, d) uses local timezone, but we'll treat it as standard
                const d = new Date(yearNum, monthIdx, dayNum);
                if (!isNaN(d.getTime())) {
                    currentDate = format(d, 'yyyy-MM-dd');
                    if (dayName) dayLabels[currentDate] = dayName;
                }
            }
            continue;
        }

        // Event
        const eventMatch = line.match(/^-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?[:\s]+(.+)/i);
        if (eventMatch && currentDate) {
            const startMin = parseTimeToken(eventMatch[1], eventMatch[2], eventMatch[3]);
            const endMin = parseTimeToken(eventMatch[4], eventMatch[5], eventMatch[6] || eventMatch[3]);
            const title = eventMatch[7].trim();

            if (title.toLowerCase().includes('no events')) continue;
            // Skip zero duration events
            if (startMin >= endMin) {
                console.log(`Skipping zero-duration event: ${title} at ${currentDate}`);
                continue;
            }

            events.push({ date: currentDate, startMin, endMin, title });
        }
    }

    return { weekStart, workingHours, timezone, dayLabels, events };
}

function parseTimeToken(hour: string, min: string = '00', meridiem?: string): number {
    let h = parseInt(hour);
    const m = parseInt(min || '0');

    if (meridiem) {
        const ampm = meridiem.toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
    } else {
        // Guess based on hour if absolutely no meridiem
        // If hour is 1-7, assume PM for business meetings unless specified?
        // Actually, better to just treat as 24h if no meridiem.
    }

    return h * 60 + m;
}

function parseFlexibleDate(dateStr: string, reference: string): string {
    const cleanStr = dateStr.replace(/[!?;:]/g, '').trim();

    // Regex for "January 20, 2026" or "Jan 20, 2026"
    const monthDayYear = cleanStr.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})/i);
    if (monthDayYear) {
        const months: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const m = months[monthDayYear[1].toLowerCase().slice(0, 3)];
        const d = monthDayYear[2].padStart(2, '0');
        const y = monthDayYear[3];
        if (m) return `${y}-${m}-${d}`;
    }

    try {
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch { }

    return reference;
}
