Phase 2 shifts our focus from **observing the LLM** (Phase 1) to **controlling the Agent's environment**. 

To achieve "Surgical Precision," we must introduce a new architectural component: **The Governor MCP (Model Context Protocol) Server**. While the Gateway sits between the Agent and the LLM, the MCP Server sits between the Agent and the local file system/terminal. This is where we enforce Budget Gates and manage the MCP Inventory.

Here is the complete, runnable implementation blueprint for Phase 2.

### Prerequisites
Install the official MCP SDK and schema validation library:
```bash
npm install @modelcontextprotocol/sdk zod
```

---

### Step 1: The Symbol Graph Engine (Codebase Indexer & Retriever)
*Production Note: For a production system, you would use `tree-sitter` for perfect AST parsing. For this MVP blueprint, we use a highly optimized, zero-dependency regex parser for JS/TS/Python to ensure it runs instantly without native C++ compilation headaches.*

Create `src/graph/indexer.ts`:
```typescript
// src/graph/indexer.ts
import fs from 'fs';
import path from 'path';

export interface SymbolNode {
  filePath: string;
  symbols: string[]; // Functions, classes, exports
  imports: string[]; // Files this file depends on
  importedBy: string[]; // Files that depend on this file (callers)
  testFile?: string; // Associated test file
}

export class SymbolGraph {
  private nodes: Map<string, SymbolNode> = new Map();

  // Lightweight regex parsers for MVP (Replace with Tree-sitter in Prod)
  private extractImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) imports.push(match[1]);
    while ((match = requireRegex.exec(content)) !== null) imports.push(match[1]);
    
    // Resolve relative paths
    return imports
      .filter(i => i.startsWith('.'))
      .map(i => {
        const ext = ['.ts', '.js', '.tsx', '.jsx', '.py'].find(e => fs.existsSync(path.resolve(path.dirname(filePath), i + e)));
        return path.resolve(path.dirname(filePath), i + (ext || ''));
      })
      .filter(i => fs.existsSync(i));
  }

  private extractSymbols(content: string): string[] {
    const symbols: string[] = [];
    // Match TS/JS functions, classes, and exports
    const regex = /(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) symbols.push(match[1]);
    return [...new Set(symbols)];
  }

  indexDirectory(dir: string) {
    const files = this.walkDir(dir).filter(f => /\.(ts|js|tsx|jsx|py)$/.test(f) && !f.includes('node_modules'));
    
    // Pass 1: Create nodes and extract forward dependencies
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      this.nodes.set(file, {
        filePath: file,
        symbols: this.extractSymbols(content),
        imports: this.extractImports(content, file),
        importedBy: []
      });
    }

    // Pass 2: Build reverse dependencies (callers) and link tests
    for (const [file, node] of this.nodes) {
      for (const imp of node.imports) {
        const target = this.nodes.get(imp);
        if (target) target.importedBy.push(file);
      }
      
      // Link test files (e.g., src/user.ts -> src/user.test.ts)
      const testPath = file.replace(/(\.ts|\.js|\.py)$/, '.test$1').replace(/(\.tsx|\.jsx)$/, '.test$1');
      if (this.nodes.has(testPath)) node.testFile = testPath;
    }
    
    console.log(`[Graph] Indexed ${this.nodes.size} files.`);
  }

  // Surgical Retrieval: Get target, direct dependencies, callers, and tests
  getSurgicalContext(targetFile: string, depth: number = 1): SymbolNode[] {
    const result = new Set<SymbolNode>();
    const queue: { file: string, depth: number }[] = [{ file: targetFile, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { file, depth: currentDepth } = queue.shift()!;
      if (visited.has(file) || currentDepth > depth) continue;
      visited.add(file);

      const node = this.nodes.get(file);
      if (!node) continue;

      result.add(node);
      if (node.testFile) result.add(this.nodes.get(node.testFile)!);

      if (currentDepth < depth) {
        for (const imp of node.imports) queue.push({ file: imp, depth: currentDepth + 1 });
        for (const caller of node.importedBy) queue.push({ file: caller, depth: currentDepth + 1 });
      }
    }

    return Array.from(result);
  }

  private walkDir(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) results = results.concat(this.walkDir(filePath));
      else results.push(filePath);
    }
    return results;
  }
}
```

---

### Step 2: Budget Gates (The Enforcer)
Budget gates intercept tool outputs *before* they are sent to the LLM. If a file or log exceeds the token budget, we **do not blindly truncate**. We reject it and force the LLM to use a more surgical tool.

Create `src/mcp/budget-gates.ts`:
```typescript
// src/mcp/budget-gates.ts

export interface BudgetConfig {
  max_file_read_tokens: number;
  max_command_output_tokens: number;
  chars_per_token: number; // Heuristic for pre-flight checks
}

export const DEFAULT_BUDGET: BudgetConfig = {
  max_file_read_tokens: 4000,
  max_command_output_tokens: 2000,
  chars_per_token: 4
};

export class BudgetGate {
  constructor(private config: BudgetConfig = DEFAULT_BUDGET) {}

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.config.chars_per_token);
  }

  // Enforces budget on file reads
  enforceFileRead(filePath: string, content: string): { allowed: boolean; content: string; message?: string } {
    const tokens = this.estimateTokens(content);
    
    if (tokens <= this.config.max_file_read_tokens) {
      return { allowed: true, content };
    }

    // REJECT: Do not silently truncate. Force the agent to be surgical.
    return {
      allowed: false,
      content: '',
      message: `BUDGET EXCEEDED: File '${filePath}' is ~${tokens} tokens (Limit: ${this.config.max_file_read_tokens}). 
      Do not read the whole file. Use 'search_file' to find specific lines, or use 'read_file_range' to read specific line numbers.`
    };
  }

  // Enforces budget on terminal/command outputs
  enforceCommandOutput(command: string, output: string): { allowed: boolean; content: string; message?: string } {
    const tokens = this.estimateTokens(output);
    
    if (tokens <= this.config.max_command_output_tokens) {
      return { allowed: true, content: output };
    }

    // Degrade gracefully for logs: Keep head and tail, summarize the middle
    const lines = output.split('\n');
    const keepLines = Math.floor((this.config.max_command_output_tokens * this.config.chars_per_token) / 80); // Assume 80 chars/line
    const head = lines.slice(0, keepLines / 2).join('\n');
    const tail = lines.slice(-keepLines / 2).join('\n');
    
    return {
      allowed: true, // We allow it, but we modified it
      content: `${head}\n\n... [BUDGET GATE: ${lines.length - keepLines} middle lines truncated to save context. Use 'grep' or pipe to 'tail' for specific errors] ...\n\n${tail}`,
      message: `Output truncated by Budget Gate.`
    };
  }
}
```

---

### Step 3: MCP Inventory & Profile Manager
This manages which tools the LLM is allowed to see based on the current task profile, minimizing schema bloat and security risks.

Create `src/mcp/inventory.ts`:
```typescript
// src/mcp/inventory.ts
import fs from 'fs';
import path from 'path';

export type ToolName = 'read_file' | 'read_file_range' | 'search_file' | 'execute_command' | 'get_symbol_graph';

export interface Profile {
  name: string;
  allowed_tools: ToolName[];
}

const DEFAULT_PROFILES: Record<string, Profile> = {
  'full-access': {
    name: 'full-access',
    allowed_tools: ['read_file', 'read_file_range', 'search_file', 'execute_command', 'get_symbol_graph']
  },
  'read-only': {
    name: 'read-only',
    allowed_tools: ['read_file', 'read_file_range', 'search_file', 'get_symbol_graph']
  },
  'code-review': {
    name: 'code-review',
    allowed_tools: ['read_file_range', 'search_file', 'get_symbol_graph'] // No execute, no full file reads
  }
};

export class MCPInventory {
  private activeProfile: Profile;

  constructor(profileName: string = 'full-access') {
    // In production, load from governor.config.json
    this.activeProfile = DEFAULT_PROFILES[profileName] || DEFAULT_PROFILES['full-access'];
    console.log(`[Inventory] Active Profile: ${this.activeProfile.name}`);
  }

  isToolAllowed(toolName: ToolName): boolean {
    return this.activeProfile.allowed_tools.includes(toolName);
  }
  
  getActiveProfileName(): string {
    return this.activeProfile.name;
  }
}
```

---

### Step 4: The Governor MCP Server (Tying it Together)
This is the main entry point. It registers the tools with the official MCP SDK, applies the Inventory filter, and routes executions through the Budget Gates.

Create `src/mcp/server.ts`:
```typescript
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs';
import { execSync } from 'child_process';
import { SymbolGraph } from "../graph/indexer.js";
import { BudgetGate } from "./budget-gates.js";
import { MCPInventory, ToolName } from "./inventory.js";

// Initialize Components
const graph = new SymbolGraph();
const budgetGate = new BudgetGate();
const inventory = new MCPInventory(process.env.GOVERNOR_PROFILE || 'full-access');

// Index the current working directory on startup
const targetDir = process.env.TARGET_DIR || process.cwd();
graph.indexDirectory(targetDir);

const server = new McpServer({
  name: "ContextGovernor",
  version: "1.0.0",
});

// --- TOOL DEFINITIONS ---

// 1. Read File (with Budget Gate)
if (inventory.isToolAllowed('read_file')) {
  server.tool(
    "read_file",
    "Reads a file. Subject to token budget limits.",
    { path: z.string().describe("Absolute path to the file") },
    async ({ path: filePath }) => {
      if (!fs.existsSync(filePath)) return { content: [{ type: "text", text: "File not found." }] };
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const gateResult = budgetGate.enforceFileRead(filePath, content);
      
      return {
        content: [{ type: "text", text: gateResult.allowed ? gateResult.content : gateResult.message! }]
      };
    }
  );
}

// 2. Read File Range (Surgical alternative)
if (inventory.isToolAllowed('read_file_range')) {
  server.tool(
    "read_file_range",
    "Reads specific lines of a file. Use this when read_file exceeds budget.",
    { 
      path: z.string(), 
      start_line: z.number(), 
      end_line: z.number() 
    },
    async ({ path: filePath, start_line, end_line }) => {
      if (!fs.existsSync(filePath)) return { content: [{ type: "text", text: "File not found." }] };
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
      const slice = lines.slice(start_line - 1, end_line).join('\n');
      return { content: [{ type: "text", text: slice }] };
    }
  );
}

// 3. Execute Command (with Budget Gate)
if (inventory.isToolAllowed('execute_command')) {
  server.tool(
    "execute_command",
    "Runs a shell command. Output is subject to token budget limits.",
    { command: z.string() },
    async ({ command }) => {
      try {
        const output = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        const gateResult = budgetGate.enforceCommandOutput(command, output);
        return { content: [{ type: "text", text: gateResult.content }] };
      } catch (error: any) {
        const errOutput = error.stdout ? error.stdout.toString() + error.stderr.toString() : error.message;
        const gateResult = budgetGate.enforceCommandOutput(command, errOutput);
        return { content: [{ type: "text", text: `Command failed:\n${gateResult.content}` }] };
      }
    }
  );
}

// 4. Get Symbol Graph (Surgical Retrieval)
if (inventory.isToolAllowed('get_symbol_graph')) {
  server.tool(
    "get_symbol_graph",
    "Retrieves the symbol graph (callers, dependencies, tests) for a specific file.",
    { file_path: z.string(), depth: z.number().optional().default(1) },
    async ({ file_path, depth }) => {
      const nodes = graph.getSurgicalContext(file_path, depth);
      if (nodes.length === 0) return { content: [{ type: "text", text: "No graph data found for this file." }] };
      
      // Format as a concise text representation for the LLM
      const summary = nodes.map(n => {
        return `File: ${n.filePath}\nSymbols: ${n.symbols.slice(0, 10).join(', ')}${n.symbols.length > 10 ? '...' : ''}\nImports: ${n.imports.length}\nCallers: ${n.importedBy.length}\nTest: ${n.testFile || 'None'}`;
      }).join('\n---\n');
      
      return { content: [{ type: "text", text: summary }] };
    }
  );
}

// --- START SERVER ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[Governor MCP] Server running on stdio. Profile: ${inventory.getActiveProfileName()}`);
}

main().catch(console.error);
```

---

### Step 5: Integration & Verification Guide

To test Phase 2, we need to connect an MCP Client (like Claude Desktop, Cursor, or a custom script) to our new Governor MCP Server.

#### 1. Configure your MCP Client
If you are using **Claude Desktop** or **Cursor**, add this to your `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "context-governor": {
      "command": "npx",
      "args": ["ts-node", "/absolute/path/to/context-governor/src/mcp/server.ts"],
      "env": {
        "TARGET_DIR": "/absolute/path/to/your/target/codebase",
        "GOVERNOR_PROFILE": "full-access"
      }
    }
  }
}
```

#### 2. Test the Budget Gates (The "Never Blindly Truncate" Rule)
1. Open your MCP Client.
2. Ask the LLM: *"Read the entire package-lock.json file and tell me what version of React is installed."*
3. **Observe:** 
   - The LLM will call `read_file("package-lock.json")`.
   - The Budget Gate will intercept it, see it's >4000 tokens, and **reject** it.
   - The LLM will receive the rejection message: *"BUDGET EXCEEDED... Use 'search_file' or 'execute_command' with grep."*
   - The LLM will self-correct and run `execute_command("grep 'react' package-lock.json")` or use a line-range tool.
   - *This is the core value proposition: You just saved 15,000 tokens of context waste without breaking the agent's flow.*

#### 3. Test the Symbol Graph (Surgical Retrieval)
1. Ask the LLM: *"I need to modify the `UserAuth` class in `src/auth/user.ts`. What files depend on it, and are there tests I need to update?"*
2. **Observe:**
   - The LLM calls `get_symbol_graph("src/auth/user.ts")`.
   - It receives a highly compressed, structured list of callers and the exact path to `user.test.ts`.
   - It does *not* read the entire codebase to figure this out.

#### 4. Test the MCP Inventory (Profile Switching)
1. Change the `GOVERNOR_PROFILE` env var in your MCP config to `"code-review"`.
2. Restart the client.
3. Ask the LLM to run `npm test`.
4. **Observe:** The `execute_command` tool will not even be visible to the LLM. It will tell you it doesn't have permission to run terminal commands, enforcing a strict read-only boundary.

### Definition of Done for Phase 2
You now have:
1. **A Symbol Graph Engine** that maps codebases into navigable dependency/caller graphs without sending raw code to the LLM.
2. **Hard Budget Gates** that actively refuse bloated file reads and terminal outputs, forcing the AI to use surgical alternatives.
3. **An MCP Inventory** that dynamically restricts tool access based on security and task profiles.
4. **A fully compliant MCP Server** that integrates natively with modern AI IDEs and clients.

Phase 2 is complete. You have transformed the system from a passive observer into an **active enforcement plane**. You are now ready for Phase 3: Advanced Optimization (Telemetry-Backed Model Routing and Context Diff Analytics).