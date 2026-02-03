import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { HumanMessage } from '@langchain/core/messages';
import { compiledGraph } from './agent/graph';
import { initializeDatabase } from './db/checkpoint';
import { SchedulerState } from './types';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

import { ReferenceDateManager } from './utils/referenceDate';

const program = new Command();

program
    .name('scheduler')
    .description('Meeting scheduling agent with stateful conversations')
    .argument('[message]', 'Your scheduling request')
    .option('-t, --thread <id>', 'Resume conversation with thread ID')
    .option('-d, --date <iso>', 'Set reference date (YYYY-MM-DD)')
    .option('--debug', 'Enable debug logging')
    .action(async (message, options) => {
        try {
            if (!message && !options.thread) {
                console.error(chalk.red('Error: Provide a message or --thread'));
                process.exit(1);
            }

            // Initialize DB
            await initializeDatabase();

            const dateManager = ReferenceDateManager.getInstance();
            dateManager.initialize({
                cliDate: options.date,
                envDate: process.env.REFERENCE_DATE,
                allowSystemDate: !process.env.TEST_MODE
            });

            if (options.debug) {
                const { date, source } = dateManager.getMetadata();
                console.log(chalk.gray(`[Debug] RefDate: ${date} Source: ${source}`));
            }

            const threadId = options.thread || `sched_${uuidv4().slice(0, 8)}`;
            const config = { configurable: { thread_id: threadId } };
            const referenceDate = dateManager.getDateString();

            if (options.thread) {
                console.log(chalk.blue(`Resuming Thread ID: ${threadId}\n`));
                const result = (await compiledGraph.invoke({
                    messages: [new HumanMessage(message)],
                    // We don't overwrite referenceDate on resume unless it's explicitly passed?
                    // Actually, index.ts should always pass it to the state.
                    referenceDate: referenceDate
                }, config)) as any;

                const lastMsg = result.messages[result.messages.length - 1];
                console.log(chalk.green(lastMsg.content));
            } else {
                console.log(chalk.blue(`Thread ID: ${threadId}\n`));
                const initialState: Partial<SchedulerState> = {
                    threadId,
                    messages: [new HumanMessage(message)],
                    referenceDate,
                };

                const result = (await compiledGraph.invoke(initialState, config)) as any;
                const lastMsg = result.messages[result.messages.length - 1];
                console.log(chalk.green(lastMsg.content));
            }

            process.exit(0);
        } catch (err: any) {
            console.error(chalk.red(`Fatal error: ${err.message}`));
            process.exit(1);
        }
    });

program.parse();
