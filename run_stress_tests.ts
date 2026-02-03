import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import chalk from 'chalk';
import * as crypto from 'crypto';

interface StressTestCase {
    id: string;
    name: string;
    calendarFile: string;
    refDate: string;
    steps: Array<{
        query: string;
        threadId?: string;
        expectedInOutput?: string[];
        modifyFile?: { path: string; content: string };
    }>;
}

const stressSuite: StressTestCase[] = [
    // 1. Calendar Parsing Edges
    {
        id: "CP-6",
        name: "Malformed with relative date request",
        calendarFile: "calendar_chaos.txt",
        refDate: "2026-01-15",
        steps: [{
            query: "30 min tomorrow afternoon",
            expectedInOutput: ["2026-01-16"]
        }]
    },
    {
        id: "CP-7",
        name: "Large calendar (performance/merge)",
        calendarFile: "calendar_chaos.txt",
        refDate: "2026-01-15",
        steps: [{ query: "30 min Monday", expectedInOutput: ["2026-01-19"] }]
    },
    // 2. Request Intent Extraction Edges
    {
        id: "IE-6",
        name: "Ambiguous multi-date + participants",
        calendarFile: "calendar_minimal.txt",
        refDate: "2026-01-15",
        steps: [{
            query: "45 min with Jordan or Sarah, Monday or Tuesday afternoon",
            expectedInOutput: ["Jordan", "Sarah"]
        }]
    },
    // 3. Availability Calculation Edges
    {
        id: "AC-6",
        name: "Slot with TZ conversion (UTC to ET)",
        calendarFile: "calendar_minimal.txt",
        refDate: "2026-01-15",
        steps: [{
            query: "30 min Thursday at 3 PM UTC", // Jan 15 is Thursday. "Thursday" might mean next Thu?
            expectedInOutput: ["10:00 AM"]
        }]
    },
    // 4. Resumption and Multi-Turn Edges
    {
        id: "RT-7",
        name: "Multi-turn rejection + intent change",
        calendarFile: "calendar_minimal.txt",
        refDate: "2026-01-15",
        steps: [
            { query: "30 min Monday", expectedInOutput: ["2026-01-19"] },
            { query: "None, make 45 min Tuesday", expectedInOutput: ["2026-01-20"] },
            { query: "Option 1", expectedInOutput: ["Great"] }
        ]
    },
    // Add more cases as needed...
];

async function runStressTests() {
    console.log(chalk.bold.magenta("Starting Extensive Stress Test Suite...\n"));
    const report: string[] = ["# Stress Test Report\n"];

    for (const test of stressSuite) {
        console.log(chalk.bold.cyan(`[${test.id}] ${test.name}`));
        let threadId = `stress_${test.id}_${Date.now()}`;

        for (let i = 0; i < test.steps.length; i++) {
            const step = test.steps[i];
            console.log(chalk.gray(`  Step ${i + 1}: "${step.query}"`));

            // Setup file if needed
            const calendarContent = await fs.readFile(test.calendarFile, 'utf-8');
            await fs.writeFile('calendar.txt', calendarContent);

            if (step.modifyFile) {
                await fs.writeFile(step.modifyFile.path, step.modifyFile.content);
            }

            if (step.modifyFile) {
                await fs.writeFile(step.modifyFile.path, step.modifyFile.content);
            }

            try {
                // Pass date via CLI arg to ensure it sticks
                const cmd = `npx tsx src/index.ts --thread "${threadId}" --date "${test.refDate}" "${step.query}"`;
                const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });

                const passed = step.expectedInOutput?.every(exp => output.includes(exp)) ?? true;
                if (passed) {
                    console.log(chalk.green("    Passed"));
                } else {
                    console.log(chalk.red("    Failed - Expected content missing"));
                }

                report.push(`### ${test.id} Step ${i + 1}\n- **Query**: ${step.query}\n- **Output**:\n\`\`\`\n${output}\n\`\`\`\n`);
            } catch (err: any) {
                console.log(chalk.red(`    Error: ${err.message}`));
                report.push(`### ${test.id} Step ${i + 1} (ERROR)\n- **Query**: ${step.query}\n- **Error**:\n\`\`\`\n${err.stdout}${err.stderr}\n\`\`\`\n`);
            }
        }
        console.log("\n");
    }

    await fs.writeFile('stress_test_report.md', report.join('\n'));
    console.log(chalk.bold.green("Report generated: stress_test_report.md"));
}

runStressTests();
