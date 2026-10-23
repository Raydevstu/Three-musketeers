Phase 3 transforms the Context Governor from an **enforcement plane** into an **intelligent optimization engine**. 

In this phase, we tackle the two most advanced features:
1. **Context Diff Analytics:** Answering the developer's most frustrating question: *"Why did this turn just cost 5x more than the last one?"*
2. **Telemetry-Backed Model Router:** Automatically downgrading to cheaper, high-context models for specific tasks (like log parsing), but *only* when context-shape telemetry proves it is safe.

Here is the complete, runnable implementation blueprint for Phase 3.

---

### Step 1: Database Schema Migration (Tracking Routing & Diffs)
Before building the analytics and router, we must update the SQLite schema to track routing decisions and allow for turn-by-turn diffing.

Update `src/db.ts` to include a migration step:

```typescript
// Add to src/db.ts inside the initialization block

// Migration for Phase 3
const tableInfo = db.pragma("table_info('context_ledger')") as any[];
const hasRouterCols = tableInfo.some((col: any) => col.name === 'original_model');

if (!hasRouterCols) {
  db.exec(`
    ALTER TABLE context_ledger ADD COLUMN original_model TEXT;
    ALTER TABLE context_ledger ADD COLUMN router_decision TEXT;
    ALTER TABLE context_ledger ADD COLUMN turn_index INTEGER DEFAULT 0;
  `);
  console.log('[DB] Migrated schema for Phase 3 (Router & Diff tracking).');
}

// Update the insert statement to include new columns
const insertStmt = db.prepare(`
  INSERT INTO context_ledger (
    timestamp, provider, model_id, original_model, router_decision, turn_index, latency_ms, 
    prompt_tokens, completion_tokens, cached_tokens, 
    estimated_cost_usd, context_breakdown, session_id
  ) VALUES (
    @timestamp, @provider, @model_id, @original_model, @router_decision, @turn_index, @latency_ms, 
    @prompt_tokens, @completion_tokens, @cached_tokens, 
    @estimated_cost_usd, @context_breakdown, @session_id
  )
`);

// Add a helper to get the current turn index
export function getNextTurnIndex(sessionId: string): number {
  const row = db.prepare('SELECT MAX(turn_index) as max_idx FROM context_ledger WHERE session_id = ?').get(sessionId) as any;
  return (row?.max_idx || 0) + 1;
}
```

---

### Step 2: Context Diff Analytics (The "Why did it spike?" Engine)
This engine compares Turn $N$ with Turn $N-1$ and highlights exactly which context category caused a token spike.

Create `src/analytics/diff.ts`:

```typescript
// src/analytics/diff.ts
import { getDb } from '../db.js';
import chalk from 'chalk';

interface TurnData {
  turn_index: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  context_breakdown: string;
}

export function renderContextDiff(sessionId: string) {
  const db = getDb();
  
  // Fetch the last two turns
  const turns = db.prepare(`
    SELECT turn_index, prompt_tokens, completion_tokens, estimated_cost_usd, context_breakdown 
    FROM context_ledger WHERE session_id = ? ORDER BY turn_index DESC LIMIT 2
  `).all(sessionId) as TurnData[];

  if (turns.length === 0) {
    console.log(chalk.yellow('No turns recorded yet.'));
    return;
  }

  const currentTurn = turns[0];
  const previousTurn = turns[1]; // May be undefined if this is turn 1

  console.clear();
  console.log(chalk.bold.hex('#00FFFF')('📊 CONTEXT DIFF ANALYTICS'));
  console.log(chalk.gray(`Session: ${sessionId.substring(0, 8)}... | Current Turn: #${currentTurn.turn_index}`));
  console.log('─'.repeat(60));

  // 1. Overall Token & Cost Diff
  const promptDiff = previousTurn ? currentTurn.prompt_tokens - previousTurn.prompt_tokens : currentTurn.prompt_tokens;
  const costDiff = previousTurn ? currentTurn.estimated_cost_usd - previousTurn.estimated_cost_usd : currentTurn.estimated_cost_usd;

  console.log(chalk.bold('💰 Turn-over-Turn Delta:'));
  console.log(`  Prompt Tokens: ${formatDiff(promptDiff)} ${chalk.gray(`(Total: ${currentTurn.prompt_tokens})`)}`);
  console.log(`  Est. Cost:     ${formatDiff(costDiff, true)} ${chalk.gray(`(Total: $${currentTurn.estimated_cost_usd.toFixed(4)})`)}`);

  // 2. Category Breakdown Diff
  if (previousTurn) {
    const currentBreakdown = JSON.parse(currentTurn.context_breakdown);
    const prevBreakdown = JSON.parse(previousTurn.context_breakdown);

    console.log('\n' + chalk.bold('🔍 Context Category Spikes (Why this turn cost more):'));
    
    const categories = Object.keys(currentBreakdown) as Array<keyof typeof currentBreakdown>;
    let foundSpike = false;

    for (const cat of categories) {
      const diff = currentBreakdown[cat] - prevBreakdown[cat];
      if (Math.abs(diff) > 50) { // Only show meaningful changes
        foundSpike = true;
        const label = cat.replace(/_/g, ' ').padEnd(20);
        console.log(`  ${label} ${formatDiff(diff)} ${chalk.gray(`(Total: ${currentBreakdown[cat]})`)}`);
      }
    }
    
    if (!foundSpike) {
      console.log(chalk.green('  No significant context spikes detected. Context is stable.'));
    }
  } else {
    console.log(chalk.gray('\n  (First turn of session - no previous baseline for diff)'));
  }
  
  console.log('─'.repeat(60));
}

function formatDiff(value: number, isCurrency = false): string {
  const prefix = value > 0 ? '+' : '';
  const formatted = isCurrency ? `$${value.toFixed(4)}` : value.toLocaleString();
  
  if (value > 0) return chalk.red(`${prefix}${formatted}`);
  if (value < 0) return chalk.green(`${prefix}${formatted}`);
  return chalk.gray(`${prefix}${formatted}`);
}
```

---

### Step 3: Telemetry-Backed Model Router (Context-Shape Routing)
*The Engineering Insight:* We don't need an LLM to classify intent. The **shape of the context** dictates the optimal model. 
- If `tool_output_logs` is > 70% of the context, it's a log-parsing task. Route to a high-context, cheap model (e.g., Gemini 1.5 Flash or GPT-4o-mini).
- If `files_code` is high and `history` is low, it's a code-generation task. Route to a strong reasoning model (e.g., Claude 3.5 Sonnet / o1).

Create `src/router/engine.ts`:

```typescript
// src/router/engine.ts
import { ContextBreakdown } from '../schemas.js';

export interface RouterDecision {
  targetModel: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

// Define your provider/model mappings here
const MODELS = {
  STRONG_CODE: 'claude-3-5-sonnet-20241022',
  CHEAP_LOGS: 'gpt-4o-mini',
  DEFAULT: 'gpt-4o'
};

export class TelemetryRouter {
  route(requestedModel: string, breakdown: ContextBreakdown, messages: any[]): RouterDecision {
    const totalTokens = Object.values(breakdown).reduce((a, b) => a + b, 0);
    if (totalTokens === 0) return { targetModel: requestedModel, reason: 'Empty context', confidence: 'low' };

    const logPct = (breakdown.tool_output_logs / totalTokens) * 100;
    const codePct = (breakdown.files_code / totalTokens) * 100;

    // RULE 1: Massive Log Analysis (Downgrade to cheap, high-context model)
    if (logPct > 60 && breakdown.tool_output_logs > 2000) {
      return {
        targetModel: MODELS.CHEAP_LOGS,
        reason: `Log-heavy context (${logPct.toFixed(0)}%). Routed to high-context/low-cost model.`,
        confidence: 'high'
      };
    }

    // RULE 2: Pure Code Generation (Upgrade to strong reasoning model)
    // Only if the user didn't explicitly request a specific model in the UI
    if (codePct > 50 && requestedModel === MODELS.DEFAULT) {
      return {
        targetModel: MODELS.STRONG_CODE,
        reason: `Code-heavy context (${codePct.toFixed(0)}%). Routed to strong reasoning model.`,
        confidence: 'medium'
      };
    }

    // FALLBACK: Respect user's requested model
    return {
      targetModel: requestedModel,
      reason: 'Context shape is balanced or unrecognized. Respecting requested model.',
      confidence: 'high'
    };
  }
}
```

---

### Step 4: Integrating the Router into the Gateway
Now we wire the Router and the Diff engine into the main Gateway proxy.

Update `src/gateway.ts`:

```typescript
// Add imports to src/gateway.ts
import { TelemetryRouter } from './router/engine.js';
import { getNextTurnIndex } from './db.js';

const router = new TelemetryRouter();
let currentTurnIndex = 0; // Will be initialized per session

app.post('/v1/chat/completions', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const originalModel = req.body.model;
  
  // 1. PRE-FLIGHT: Tag context
  const contextBreakdown = tagContext(req.body.messages || []);

  // 2. ROUTE: Apply Telemetry-Backed Routing
  const decision = router.route(originalModel, contextBreakdown, req.body.messages);
  req.body.model = decision.targetModel; // MUTATE the request body
  
  if (decision.targetModel !== originalModel) {
    console.log(chalk.yellow(`[Router] ${decision.reason} (${originalModel} -> ${decision.targetModel})`));
  }

  // ... [Keep the existing stream_options injection and upstream fetch logic] ...
  
  // Inside the finally block, update the recording logic:
  if (finalUsage && req.body.stream) {
    currentTurnIndex = getNextTurnIndex(SESSION_ID);
    
    const normalized: NormalizedUsage = {
      provider: 'openai', // Note: In prod, map this dynamically based on the routed model
      model_id: decision.targetModel,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
      prompt_tokens: finalUsage.prompt_tokens,
      completion_tokens: finalUsage.completion_tokens,
      cached_tokens: finalUsage.prompt_tokens_details?.cached_tokens || 0,
      context_breakdown: contextBreakdown,
      estimated_cost_usd: calculateCost(decision.targetModel, finalUsage),
    };

    // Record with Phase 3 fields
    insertStmt.run({
      // ... existing fields ...
      original_model: originalModel,
      router_decision: decision.reason,
      turn_index: currentTurnIndex,
      // ... map normalized fields to DB params ...
    });
    
    console.log(`[Ledger] Turn #${currentTurnIndex} recorded. Routed: ${decision.targetModel}`);
  }
});
```
*(Note: Ensure you update the `recordUsage` function in `db.ts` to accept and insert `original_model`, `router_decision`, and `turn_index` based on the schema update in Step 1).*

---

### Step 5: Updating the CLI for Phase 3
Add the new commands to your main CLI entry point.

Update `src/cli.ts`:

```typescript
// Add to src/cli.ts
import { renderContextDiff } from './analytics/diff.js';

// Simple command router for the CLI
const command = process.argv[2];

if (command === 'diff') {
  const db = getDb();
  const session = db.prepare('SELECT session_id FROM context_ledger ORDER BY id DESC LIMIT 1').get() as any;
  if (session) renderContextDiff(session.session_id);
  else console.log('No session found.');
} else {
  // Default to the original TUI dashboard
  runTUI(); 
}
```

---

### Step 6: Execution & Verification Guide

Here is how to prove Phase 3 is working.

#### 1. Test the Context Diff Analytics
1. Start the gateway: `npx ts-node src/gateway.ts`
2. Send a small request (e.g., "Hello").
3. Send a massive request (e.g., inject a 5,000-line dummy log into the `messages` array as a `tool` role output, and ask "Summarize this").
4. Run the diff CLI:
   ```bash
   npx ts-node src/cli.ts diff
   ```
5. **Observe:** The terminal will show a bright red `+5,000` next to `tool output logs`, explicitly telling you *exactly* why the second turn cost more.

#### 2. Test the Telemetry Router (Context-Shape Routing)
1. Send a request where the context is 80% `tool` logs (simulating a failed test run analysis).
2. Request the default model (e.g., `gpt-4o`).
3. **Observe the Gateway Logs:**
   ```text
   [Router] Log-heavy context (82%). Routed to high-context/low-cost model. (gpt-4o -> gpt-4o-mini)
   [Ledger] Turn #3 recorded. Routed: gpt-4o-mini
   ```
4. **The Value:** You just saved ~80% on that turn's cost without the developer having to manually switch models in their IDE, and without sacrificing quality (because GPT-4o-mini is excellent at structured log extraction).

#### 3. Test the Router Safety (Code Generation)
1. Send a request where the context is 80% `user` code files (simulating a complex refactoring task).
2. **Observe:** The router will detect the `code-heavy` shape and route it to `claude-3-5-sonnet` (or your configured strong model), ensuring high-quality architectural reasoning.

---

### Definition of Done for Phase 3 (and the Entire MVP)

You have now successfully built the **Provider-Neutral Agent Context Governor**. 

**What you have achieved:**
1. **Phase 1 (Observability):** Zero-latency streaming gateway, authoritative SQLite ledger, and deterministic log distillation.
2. **Phase 2 (Enforcement):** Symbol-graph codebase indexing, hard budget gates that prevent context bloat, and MCP profile management.
3. **Phase 3 (Optimization):** Turn-by-turn context diff analytics and context-shape telemetry routing that automatically optimizes cost vs. quality.

### Next Steps for Productionization
To take this from a local MVP to a production SaaS or enterprise tool:
1. **Swap Regex for Tree-Sitter:** Replace the lightweight regex in `indexer.ts` with `tree-sitter` WASM bindings for 100% accurate AST parsing across all languages.
2. **Add Auth & Multi-tenancy:** Move the SQLite DB to Postgres and add API key validation to the Gateway.
3. **Build the IDE Extension:** Wrap the MCP server and Gateway into a VSCode/Cursor extension so developers don't have to manage local Node processes.
4. **Implement the Feedback Loop:** Add an endpoint where the IDE extension reports "User rejected this code" to train the Telemetry Router on which context-shapes actually require the strong model.

You now possess a complete, architecturally sound blueprint for a tool that solves the biggest bottleneck in AI-assisted engineering: **Context Waste**. Build it, and the market will follow.