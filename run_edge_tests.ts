import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import chalk from 'chalk';

const scenarios = [
    {
        id: 1,
        name: "Malformed Anchor (Feb 30)",
        calendar: `Week of February 30, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Monday Feb 30, 2026
- 9:00 AM - 10:00 AM: Standup`,
        query: "Schedule 30 min Monday morning"
    },
    {
        id: 2,
        name: "Inconsistent Day Name",
        calendar: `Week of January 20, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Tuesday Jan 20, 2026
- 9:00 AM - 10:00 AM: Team Standup
- 2:00 PM - 3:00 PM: 1:1 with Sarah`,
        query: "Schedule 30 min Monday afternoon"
    },
    {
        id: 3,
        name: "No AM/PM, 24-Hr Mix",
        calendar: `Week of January 20, 2026
Working hours: 09:00 - 17:00
Timezone: America/New_York

Monday Jan 20, 2026
- 9:00 - 10:00: Team Standup
- 14:00 PM - 15:00: 1:1 with Sarah`,
        query: "Schedule 30 min Monday afternoon"
    },
    {
        id: 4,
        name: "Negative/Zero Duration",
        calendar: `Week of January 20, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Monday Jan 20, 2026
- 10:00 AM - 9:00 AM: Backward Event
- 2:00 PM - 2:00 PM: Zero Duration`,
        query: "Schedule 30 min Monday morning"
    },
    {
        id: 5,
        name: "Multi-Line/Extra Noise",
        calendar: `Week of January 20, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York
Note: This is a test with extra lines.

Monday Jan 20, 2026
- 9:00 AM - 10:00 AM: Team Standup
  Continued on next line: details here.
- 2:00 PM - 3:00 PM: 1:1 with Sarah
Extra blank line

# Comment`,
        query: "Schedule 30 min Monday afternoon"
    },
    {
        id: 6,
        name: "Missing Sections",
        calendar: `Week of January 20, 2026

Monday Jan 20, 2026
- 9:00 AM - 10:00 AM: Team Standup
- 2:00 PM - 3:00 PM: 1:1 with Sarah`,
        query: "Schedule 30 min Monday afternoon"
    },
    {
        id: 7,
        name: "Overlapping + Outside Hours",
        calendar: `Week of January 20, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Monday Jan 20, 2026
- 8:00 AM - 9:30 AM: Early Overrun
- 1:00 PM - 3:00 PM: Overlap1
- 2:00 PM - 4:00 PM: Overlap2
- 5:00 PM - 6:00 PM: Late`,
        query: "Schedule 30 min Monday afternoon"
    },
    {
        id: 8,
        name: "Different Locale",
        calendar: `Week of 20 January 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Monday 20 Jan, 2026
- 9:00 AM - 10:00 AM: Team Standup
- 2:00 PM - 3:00 PM: 1:1 with Sarah`,
        query: "Schedule 30 min Monday afternoon"
    },
    {
        id: 9,
        name: "Multi-Week/Extra Days",
        calendar: `Week of January 20, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Monday Jan 20, 2026
- 9:00 AM - 10:00 AM: Team Standup

Saturday Jan 25, 2026
- 10:00 AM - 11:00 AM: Weekend Event

Monday Jan 27, 2026
- 9:00 AM - 10:00 AM: Next Standup`,
        query: "Schedule 30 min Monday Jan 27"
    },
    {
        id: 10,
        name: "All-Day/Non-Time",
        calendar: `Week of January 20, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Monday Jan 20, 2026
- All day: Holiday
- No time: Floating Task
- 2:00 PM - 3:00 PM: 1:1 with Sarah`,
        query: "Schedule 30 min Monday afternoon"
    },
    {
        id: 11,
        name: "Empty Days/No Events",
        calendar: `Week of January 20, 2026
Working hours: 9:00 AM - 5:00 PM
Timezone: America/New_York

Monday Jan 20, 2026

Tuesday Jan 21, 2026
- (empty)`,
        query: "Schedule 30 min Monday morning"
    },
    {
        id: 12,
        name: "Extreme Noise",
        calendar: `Week of January 20, 2026 !!!
Working hours: 9:00AM-5:00PM (flexible)
Timezone: America/New_York

Monday Jan 20, 2026
- 9:00 AM -- 10:00 AM:: Team Standup 😉
- 2:00 PM - 3:00 PM: 1:1 with Sarah
Invalid line without bullet.`,
        query: "Schedule 30 min Monday morning"
    }
];

async function runTests() {
    console.log(chalk.bold.yellow("Starting Edge Case Torture Tests...\n"));

    for (const s of scenarios) {
        console.log(chalk.bold.cyan(`Scenario ${s.id}: ${s.name}`));
        console.log(chalk.gray("--------------------------------------"));

        // 1. Write calendar.txt
        await fs.writeFile('calendar.txt', s.calendar);

        // 2. Run CLI
        try {
            const output = execSync(`npx tsx src/index.ts "${s.query}"`, { encoding: 'utf-8', stdio: 'pipe' });
            console.log(chalk.green("Output:"));
            console.log(output);
        } catch (err: any) {
            console.log(chalk.red("Error/Crash:"));
            console.log(err.stdout || "");
            console.log(err.stderr || "");
        }
        console.log("\n");
    }
}

runTests();
