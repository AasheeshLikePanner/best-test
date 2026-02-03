# Scheduling Agent - Deterministic Date & Detail Resolution

A robust CLI scheduling agent built with LangGraph, deterministic date logic, and detail-aware extraction.

## Features
- **Deterministic Date Resolution**: Robustly handles day-of-week math (Monday, Tuesday, etc.) using `date-fns`.
- **Timezone Awareness**: Converts user timezones (UTC, IST) to the local calendar timezone.
- **Participant Extraction**: Correctly identifies names (e.g., "Jordan or Sarah") and includes them in the proposal.
- **Anchor-Based Ranking**: Prioritizes specific time requests over general availability.
- **Out-of-Hours Detection**: Warns the user when a requested time falls outside the 9 AM - 5 PM window.

## Installation
```bash
npm install
```

## Usage
### Running the CLI
```bash
npx tsx src/index.ts --date [YYYY-MM-DD] "[REQUEST]"
```
**Example**:
```bash
npx tsx src/index.ts --date 2026-01-15 "30 min Thursday at 3 PM UTC with Jordan"
```

### Running Stress Tests
Use the provided verification script to run the 5-point stress test suite:
```bash
bash verify.sh
```

## Architecture
The agent uses a 3-stage pipeline:
1. **Extraction**: LLM parses natural language into semantic tokens (DAY_OF_WEEK, DURATION, PARTICIPANTS, SPECIFIC_TIME).
2. **Resolution**: Deterministic code calculates the ISO date and converts timezones.
3. **Execution**: Slot finder computes availability, ranks by proximity to the anchor time, and generates a formatted proposal.
