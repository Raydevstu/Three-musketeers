export function planTask(prompt) {
  const text = String(prompt).toLowerCase();
  if (/browser|website|desktop|click|computer/.test(text)) return { status: 'blocked', reason: 'browser and desktop adapters are not enabled', capabilities: [], steps: [] };
  if (/research|investigate|competitor|compare/.test(text)) return { status: 'delegate', capabilities: ['research'], steps: [] };
  const steps = [];
  if (/test|tests|bug|failure|audit|verify/.test(text)) steps.push({ tool: 'run_tests', input: {} });
  if (/repository|repo|codebase|git|review/.test(text)) steps.unshift({ tool: 'repo_status', input: {} });
  if (!steps.length) steps.push({ tool: 'repo_status', input: {} });
  return { status: 'execute', capabilities: ['tools'], steps };
}

const allowedTools = new Set(['read_file', 'repo_status', 'run_tests', 'terminal', 'browser', 'desktop']);

export function planSubtasks(prompt) {
  const text = String(prompt).toLowerCase();
  const subtasks = [];
  if (/research|competitor|investigate|compare/.test(text)) subtasks.push({ id: 'research', worker: 'research', capabilities: ['research'], depends_on: [], retries: 2 });
  if (/implement|build|fix|code|feature/.test(text)) subtasks.push({ id: 'implementation', worker: 'codex', capabilities: ['codex'], depends_on: subtasks.length ? [subtasks.at(-1).id] : [], retries: 1 });
  if (/test|bug|audit|review|verify/.test(text) || subtasks.length) subtasks.push({ id: 'testing', worker: 'testing', capabilities: ['testing'], depends_on: subtasks.length ? [subtasks.at(-1).id] : [], retries: 1 });
  if (/review|audit|quality|security/.test(text)) subtasks.push({ id: 'audit', worker: 'testing', capabilities: ['audit'], depends_on: subtasks.length ? [subtasks.at(-1).id] : [], retries: 1 });
  if (!subtasks.length) subtasks.push({ id: 'task', worker: 'tools', capabilities: ['tools'], depends_on: [], retries: 0 });
  return { status: 'delegate', subtasks };
}

export function validateSubtaskPlan(plan) {
  if (!plan || plan.status !== 'delegate' || !Array.isArray(plan.subtasks) || !plan.subtasks.length) throw new Error('invalid subtask plan');
  const ids = new Set(plan.subtasks.map((subtask) => subtask.id));
  for (const subtask of plan.subtasks) {
    if (!subtask.id || !subtask.worker || !Array.isArray(subtask.depends_on) || subtask.depends_on.some((id) => id === subtask.id || !ids.has(id))) throw new Error('invalid subtask dependency');
    if (!Number.isInteger(subtask.retries) || subtask.retries < 0 || subtask.retries > 3) throw new Error('invalid subtask retry policy');
  }
  return plan;
}

export async function planTaskWithProvider(prompt, compiled, { providerUrl = process.env.LOCAL_AI_URL ?? 'http://127.0.0.1:11434/api/generate', model = process.env.LOCAL_AI_MODEL ?? 'llama3.2:3b', fetchImpl = fetch } = {}) {
  const response = await fetchImpl(providerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, stream: false, format: 'json', options: { temperature: 0, num_predict: 500 }, prompt: `Return only JSON with fields status (execute|delegate|blocked), capabilities (array of strings), steps (array of objects with tool and input), and reason (string). Plan this task using only read_file, repo_status, run_tests, terminal, browser, and desktop. Terminal requires input.approved=true and an allowlisted command. Browser and desktop require input.approved=true and may return adapter-not-connected. Never choose shell, delete, write, or network tools. If the task requires an unavailable tool, return blocked.\n\nTask: ${prompt}\nCompiled intent: ${compiled.intent_vector}` }) });
  if (!response.ok) throw new Error(`Planner provider failed: ${response.status}`);
  let plan;
  try { plan = JSON.parse((await response.json()).response); } catch { throw new Error('Planner provider did not return valid JSON'); }
  if (!['execute', 'delegate', 'blocked'].includes(plan.status) || !Array.isArray(plan.capabilities) || !Array.isArray(plan.steps)) throw new Error('Planner returned an invalid plan');
  if (plan.steps.some((step) => !step || !allowedTools.has(step.tool) || typeof step.input !== 'object')) throw new Error('Planner selected an unavailable tool');
  if (plan.status === 'blocked' && typeof plan.reason !== 'string') throw new Error('Blocked plan must include a reason');
  return plan;
}
