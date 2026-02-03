export class ReferenceDateManager {
    private static instance: ReferenceDateManager;
    private _referenceDate: Date | null = null;
    private _source: 'cli' | 'env' | 'system' | 'test' | null = null;

    private constructor() { }

    static getInstance(): ReferenceDateManager {
        if (!ReferenceDateManager.instance) {
            ReferenceDateManager.instance = new ReferenceDateManager();
        }
        return ReferenceDateManager.instance;
    }

    /**
     * Initialize the reference date with strict precedence
     * MUST be called at the very start of the application
     */
    initialize(options: {
        cliDate?: string;      // From --date flag
        envDate?: string;      // From process.env.REFERENCE_DATE
        allowSystemDate?: boolean; // Default: true in production, false in tests
    }): void {
        if (options.cliDate) {
            this._referenceDate = this.parseDate(options.cliDate);
            this._source = 'cli';
            console.log(`[ReferenceDate] Using CLI date: ${this.getDateString()} (source: cli)`);
            return;
        }

        if (options.envDate) {
            this._referenceDate = this.parseDate(options.envDate);
            this._source = 'env';
            console.log(`[ReferenceDate] Using ENV date: ${this.getDateString()} (source: env)`);
            return;
        }

        if (options.allowSystemDate) {
            this._referenceDate = new Date();
            this._source = 'system';
            console.log(`[ReferenceDate] Using system date: ${this.getDateString()} (source: system)`);
            return;
        }

        throw new Error(
            'REFERENCE_DATE not set. Tests must provide a date via --date flag or REFERENCE_DATE env var.'
        );
    }

    getDate(): Date {
        if (!this._referenceDate) {
            throw new Error('ReferenceDateManager not initialized. Call initialize() first.');
        }
        return new Date(this._referenceDate);
    }

    /**
     * Returns the date as YYYY-MM-DD string, respecting local date components
     */
    getDateString(): string {
        const d = this.getDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getMetadata(): { date: string; source: string } {
        return {
            date: this.getDateString(),
            source: this._source || 'unknown'
        };
    }

    private parseDate(dateStr: string): Date {
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
            const [_, year, month, day] = isoMatch;
            // Anchor to noon local time to prevent TZ shifts at midnight
            return new Date(+year, +month - 1, +day, 12, 0, 0);
        }

        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
            throw new Error(`Invalid date format: "${dateStr}". Use YYYY-MM-DD format.`);
        }
        return parsed;
    }
}
