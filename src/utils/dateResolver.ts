import { format, addDays, getDay, parseISO, isValid } from 'date-fns';
import { TimeConstraint } from '../types';

/**
 * Resolves a semantic time constraint into a concrete ISO date (YYYY-MM-DD).
 * Detersministic logic - NO PROBABILISTIC MODELS.
 */
export function resolveTargetDate(constraint: TimeConstraint, referenceDate: Date): string {
    const today = new Date(referenceDate);
    const todayNum = getDay(today); // 0 (Sun) to 6 (Sat)
    const todayName = format(today, 'EEEE');

    const daysMap: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
    };

    // Pre-processing: If LLM sent a day name as ABSOLUTE, fix it
    if (constraint.type === 'ABSOLUTE' && daysMap[constraint.value.toLowerCase().split(/\s+/)[0]]) {
        constraint.type = 'DAY_OF_WEEK';
    }

    switch (constraint.type) {
        case 'ABSOLUTE':
            // If it's already YYYY-MM-DD, just return it
            if (/^\d{4}-\d{2}-\d{2}$/.test(constraint.value)) {
                return constraint.value;
            }
            // Fallback: try parsing
            const parsed = parseISO(constraint.value);
            if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd');
            return format(today, 'yyyy-MM-dd');

        case 'RELATIVE':
            if (constraint.value.toLowerCase() === 'today') {
                return format(today, 'yyyy-MM-dd');
            }
            if (constraint.value.toLowerCase() === 'tomorrow') {
                return format(addDays(today, 1), 'yyyy-MM-dd');
            }
            return format(today, 'yyyy-MM-dd');

        case 'DAY_OF_WEEK':
            const daysMap: Record<string, number> = {
                'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                'thursday': 4, 'friday': 5, 'saturday': 6
            };

            // Extract first day in case LLM outputs "Monday or Tuesday"
            const rawDay = constraint.value.toLowerCase().split(/\s+or\s+/)[0].trim();
            const targetDay = daysMap[rawDay];

            if (targetDay === undefined) {
                return format(today, 'yyyy-MM-dd');
            }

            let diff = targetDay - todayNum;

            // Logic:
            // If diff < 0 (day has passed), it's definitely next week.
            // If diff == 0 (today), we take TODAY.
            // If diff > 0 (future this week), we take this week.
            if (diff < 0) {
                diff += 7;
            }
            // diff === 0 means today. That's fine.

            const result = format(addDays(today, diff), 'yyyy-MM-dd');
            return result;

        default:
            return format(today, 'yyyy-MM-dd');
    }
}

/**
 * Validates that the resolved date actually matches the semantic constraint.
 */
export function validateResolvedDate(resolvedDateStr: string, constraint: TimeConstraint): boolean {
    const date = parseISO(resolvedDateStr);
    if (!isValid(date)) return false;

    if (constraint.type === 'DAY_OF_WEEK') {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const actualDay = days[getDay(date)];
        return actualDay === constraint.value.toLowerCase();
    }

    return true;
}
