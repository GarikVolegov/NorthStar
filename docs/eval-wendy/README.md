# Wendy Evaluation Suite

Offline test harness for Wendy AI assistant. Covers 54 test cases across 8 categories with automatic and manual (LLM-as-judge) scoring.

Run with `pnpm eval` (offline; needs the API on `localhost:3001` — start it with `pnpm dev:server`) or `pnpm eval:live`. Filter with `--category <name>`, save with `--output <file>`. Test cases live in [`wendy-test-cases.json`](./wendy-test-cases.json) (override the path with `WENDY_EVAL_CASES`).

## Test Categories

| Category | Count | Purpose |
|----------|-------|---------|
| `sector_qa` | 8 | Domain knowledge: sector trends, entry barriers, salary, job market |
| `profession_qa` | 7 | Career paths: skills, progression, remote work, diversity |
| `planning` | 7 | Actionability: roadmaps, timelines, re-skilling, learning paths |
| `navigation` | 7 | UI/UX: feature discovery, settings, help requests |
| `insufficient_data` | 5 | Graceful degradation: no hallucination on unknown topics |
| `guardrail_safety` | 6 | Safety: jailbreak resistance, boundary enforcement, refusals |
| `privacy` | 6 | Privacy: PII handling, feedback tracking, GDPR compliance |
| `rag_grounding` | 8 | RAG faithfulness: answers grounded in retrieved sources, no fabrication |

## Running Evaluations

### Quick Start (Local Server)

```bash
# Start the server on localhost:3001
npm run dev:server

# In another terminal, run the full eval suite
npx ts-node scripts/src/eval-wendy.ts

# Or filter by category
npx ts-node scripts/src/eval-wendy.ts --category sector_qa

# Save report to JSON
npx ts-node scripts/src/eval-wendy.ts --output eval-report.json
```

### Against Production

```bash
# Run against live API
WENDY_API_URL=https://api.northstar.io \
WENDY_TEST_TOKEN=<your-test-jwt> \
npx ts-node scripts/src/eval-wendy.ts --live
```

## Output Format

### Console Output

```
🧪 Wendy Evaluation Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API Base: http://localhost:3001
...

[1/46] sector_qa_001: Query about technology sector trends... ✓ 100% (1234ms)
[2/46] sector_qa_002: Sector comparison query... ✗ 60% (1156ms)
...

📊 OVERALL KPIs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tests Passed:        35/46
Pass Rate:           76.1%
Avg Latency:         1245ms
Avg Accuracy Score:  0.82

📈 BY CATEGORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
sector_qa            6/6 (95%) [1200ms]
profession_qa        5/6 (88%) [1210ms]
...
```

### JSON Report (`--output eval-report.json`)

```json
{
  "summary": [
    {
      "category": "sector_qa",
      "total": 6,
      "passed": 6,
      "failureRate": 0,
      "avgResponseTime": 1200,
      "avgScore": 0.95
    },
    ...
  ],
  "overallKPIs": {
    "total_tests": 46,
    "passed": 35,
    "failed": 11,
    "pass_rate": 0.76,
    "avg_latency_ms": 1245,
    "avg_accuracy_score": 0.82
  },
  "results": [
    {
      "testId": "sector_qa_001",
      "category": "sector_qa",
      "description": "Query about technology sector trends",
      "passed": true,
      "score": 1.0,
      "details": {
        "automaticChecks": [
          {
            "name": "mustContain(\"competenze\")",
            "passed": true
          },
          ...
        ],
        "responseTime": 1234,
        "responseLength": 512,
        "toolsUsed": ["search_sector_trends"],
        "responseCategory": "success"
      }
    },
    ...
  ]
}
```

## Scoring Methodology

### Automatic Checks (String Matching)

- **mustContain**: All phrases must appear in response (case-insensitive)
- **mustNotContain**: No phrase should appear in response
- **minLength/maxLength**: Response length constraints
- **responseCategory**: Expected response type (success, insufficient_data, refused, etc.)
- **toolsToCall**: At least one expected tool must be invoked

### Manual Judge (LLM-as-Judge)

Tests marked with `judgePrompt` require semantic evaluation:

```json
{
  "judgePrompt": "Is this response accurate about tech sector skills for 2026? Rate 1-5 on accuracy and relevance.",
  "fullResponse": "[full response text for human review]"
}
```

**Procedure:**
1. Run evaluation script
2. Review "MANUAL JUDGE REVIEW REQUIRED" section
3. Use the provided prompt to evaluate responses
4. Update test expectations or response logic based on findings

### Overall Score

```
score = (checks_passed / total_checks)
passed = score >= 0.7  (70% threshold)
```

## KPI Targets (V1)

Based on Step 5 specification:

| KPI | Target | Acceptance |
|-----|--------|-----------|
| Accuracy (domain knowledge) | > 80% | All sector_qa + profession_qa |
| Relevance (correct interpretation) | > 85% | planning + navigation |
| Safety (refusal rate) | 100% | guardrail_safety |
| Privacy Compliance | 100% | privacy category |
| Latency (p99) | < 3000ms | All requests |
| No Hallucination | 100% | insufficient_data category |

## Test Case Structure

Each test case is a JSON object in `wendy-test-cases.json`:

```json
{
  "id": "sector_qa_001",
  "category": "sector_qa",
  "description": "Query about technology sector trends",
  "input": {
    "message": "Quali sono le competenze più richieste nel settore tech nel 2026?",
    "pageContext": {
      "page": "sector-detail",
      "entityType": "sector",
      "entityId": 5,
      "entityName": "Tecnologia"
    },
    "locale": "it"
  },
  "expectations": {
    "mustContain": ["competenze", "tech", "2026"],
    "mustNotContain": ["non so", "no data"],
    "toolsToCall": ["search_sector_trends", "fetch_sector_data"],
    "responseCategory": "success",
    "minLength": 150,
    "judgePrompt": "Is this response accurate about tech sector skills for 2026? Rate 1-5..."
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Wendy Evaluation
on: [pull_request]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run dev:server &
      - run: sleep 5
      - run: npx ts-node scripts/src/eval-wendy.ts --output report.json
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: eval-report
          path: report.json
      - name: Check KPIs
        run: |
          PASS_RATE=$(jq '.overallKPIs.pass_rate' report.json)
          if (( $(echo "$PASS_RATE < 0.70" | bc -l) )); then
            echo "❌ Pass rate ${PASS_RATE} below 70%"
            exit 1
          fi
```

## Regression Monitoring

Track KPI trends over time:

```bash
# After each merge to main
npx ts-node scripts/src/eval-wendy.ts --output eval-$(date +%Y%m%d-%H%M%S).json

# Generate trend chart
node scripts/eval-trend-chart.js eval-*.json
```

(Trend chart tool: generate charts from timestamped JSON reports showing pass_rate, avg_latency, avg_accuracy over time)

## Debugging Failed Tests

### Check Response Content

Add to eval-wendy.ts before line 319:

```typescript
if (!result.passed) {
  console.log(`\nFull response for ${test.id}:`);
  console.log(response.fullText);
  console.log(`\nTools used: ${response.toolsUsed.join(", ")}`);
  console.log(`Response category: ${response.responseCategory}`);
}
```

### Check Tool Execution

Monitor `/api/metrics` for tool call counts during test run:

```bash
curl http://localhost:3001/api/metrics | grep tool_calls_total
```

### Check Database Telemetry

View recorded requests in `ai_request_log` table:

```sql
SELECT requestId, toolCallsCount, responseCategory, latencyMs
FROM ai_request_log
WHERE createdAt > now() - interval '10 minutes'
ORDER BY createdAt DESC
LIMIT 20;
```

## Adding New Test Cases

1. Add entry to `eval/wendy-test-cases.json` with:
   - Unique `id` (format: `{category}_{number}`)
   - Expectations matching your intent
   - Optional `judgePrompt` if semantic evaluation needed

2. Run: `npx ts-node scripts/src/eval-wendy.ts --category your_category`

3. Review output and update expectations if needed

## Known Limitations

- **No streaming validation**: Only checks final concatenated response text
- **LLM-as-judge requires manual review**: Script outputs full response for human judgment
- **No performance profiling**: Use `/api/metrics` for detailed latency breakdown
- **No payload comparison**: Doesn't check token usage or cost estimation accuracy

## Future Enhancements

- [ ] Implement LLM-as-judge automation (call Claude/GPT-4 for semantic scoring)
- [ ] Add streaming token validation (check intermediate SSE chunks)
- [ ] Add performance profiling via `/api/metrics` integration
- [ ] Generate historical trend charts (pass_rate, latency over time)
- [ ] Add flakiness detection (re-run failures N times, report variance)
- [ ] Integration with Sentry for production monitoring
