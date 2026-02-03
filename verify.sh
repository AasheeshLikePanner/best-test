#!/bin/bash

echo "Running Stress Tests..."
npx tsx run_stress_tests.ts

echo "Running Edge Case Tests..."
npx tsx run_edge_tests.ts

if [ -f stress_test_report.md ]; then
    echo "------------------------------------------------"
    echo "TEST COMPLETE. SHIFTING TO REPORT SUMMARY:"
    grep "###" stress_test_report.md
    echo "------------------------------------------------"
    echo "View full results in stress_test_report.md"
else
    echo "Error: stress_test_report.md was not generated."
fi
