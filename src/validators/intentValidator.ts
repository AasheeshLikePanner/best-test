import { Intent, IntentSchema } from '../types';
import { Logger } from '../utils/logger';

const logger = new Logger('intentValidator');

export function validateIntent(data: unknown): Intent {
    try {
        const result = IntentSchema.parse(data);

        // Logical validation: duration shouldn't be zero unless explicitly requested
        if (result.durationMin <= 0) {
            logger.warn('Intent has zero duration, investigating query', { raw: result.rawRequest });
        }

        return result;
    } catch (error: any) {
        logger.error('Intent validation failed', { error: error.message, data });
        throw new Error(`Invalid intent extracted: ${error.message}`);
    }
}
