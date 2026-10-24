import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createUiApi } from './api.js';
import { Canvas } from '@react-three/fiber';
import './styles.css';

function StatusCard({ label, value, tone = 'neutral' }) { return <article className={`card ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }

function ContextSphere() {
  const [webgl, setWebgl] = useState(true);
  return <section className="panel sphere-panel"><div><p className="eyebrow">CONTEXT MAP</p><h2>Context Sphere</h2><p className="muted">A visual placeholder for authoritative category usage. The text summary remains available when WebGL is unavailable.</p></div>{webgl ? <div className="sphere"><Canvas fallback={<button onClick={() => setWebgl(false)}>Use accessible 2D view</button>}><ambientLight intensity={1} /><mesh rotation={[0.3, 0.5, 0]}><sphereGeometry args={[1.1, 32, 32]} /><meshStandardMaterial color="#38bdf8" emissive="#164e63" emissiveIntensity={1.1} wireframe /></mesh></Canvas></div> : <div className="fallback-chart" aria-label="2D context usage fallback"><i style={{ width: '72%' }} /><i style={{ width: '48%' }} /><i style={{ width: '28%' }} /></div>}</section>;
}

function ResultSummary({ result }) {
  const delegation = result?.result ?? result?.execution;
  const workerResult = delegation?.result;
  if (result?.error) return <div className="result-summary"><strong>Workflow failed</strong><p>{result.error}</p></div>;
  if (!delegation) return <div className="result-summary"><strong>Completed</strong><p>Operation finished successfully.</p></div>;
  if (workerResult?.worker === 'research' && workerResult.report) return <div className="result-summary"><strong>Research report</strong><p>{workerResult.report.answer}</p><p>Confidence: {workerResult.report.confidence ?? 'not reported'} · Sources: {workerResult.report.sources.length} · Verification: {workerResult.report.verification}</p>{workerResult.report.competitors?.length > 0 && <><h4>Competitor comparison</h4><ul>{workerResult.report.competitors.map((item, index) => <li key={`${item.name}-${index}`}><strong>{item.name}</strong>: {item.comparison}</li>)}</ul></>}{workerResult.report.citations?.length > 0 && <details><summary>Sources and citations</summary><ul>{workerResult.report.citations.map((citation, index) => <li key={`${citation.id ?? index}-${index}`}><a href={citation.url} target="_blank" rel="noreferrer">{citation.id ?? `Source ${index + 1}`}</a>{citation.claim ? ` — ${citation.claim}` : ''}</li>)}</ul></details>}</div>;
  if (delegation?.subtasks) return <div className="result-summary"><strong>{delegation.status === 'succeeded' ? 'Completed successfully' : delegation.status ?? 'Completed'}</strong><p>{delegation.subtasks.length} automated subtasks completed.</p></div>;
  return <div className="result-summary"><strong>{workerResult?.status === 'succeeded' ? 'Completed successfully' : workerResult?.status ?? delegation?.status ?? 'Completed'}</strong><p>{delegation.selected_worker ? `Worker: ${delegation.selected_worker}` : 'Automated workflow'}{delegation.task ? ` · Task: ${delegation.task}` : ''}</p>{workerResult?.output && <pre>{workerResult.output}</pre>}</div>;
}

function Operations({ api, enabled }) {
  const [prompt, setPrompt] = useState('Debug API authentication');
  const [filePath, setFilePath] = useState('package.json');
  const [task, setTask] = useState('Run a safe smoke test');
  const [gatewayPrompt, setGatewayPrompt] = useState('Explain the current test status.');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const resultText = result == null ? '' : typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const run = async (action) => { setBusy(true); try { setResult(await action()); } catch (error) { setResult({ error: error.message, state: error.state ?? 'failed' }); } finally { setBusy(false); } };
  return <section className="panel operations" aria-label="Operations">
    <p className="eyebrow">OPERATIONS</p><h2>Run the system</h2><p className="muted">Authenticated controls for the implemented compiler, workers, tools, gateway, and routing features.</p>
    <div className="workflow-bar"><button disabled={!enabled || busy} onClick={() => run(() => api.runWorkflow(prompt))}>Run workflow</button><span className="muted">Compile, delegate, execute, and record evidence automatically.</span></div>
    <div className="operation-grid">
      <div className="operation-card"><h3>Prompt compiler</h3><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /><div className="button-row"><button disabled={!enabled || busy} onClick={() => run(() => api.compilePrompt(prompt))}>Compile</button><button disabled={!enabled || busy} onClick={() => run(() => api.preparePrompt(prompt))}>Prepare + skills</button></div></div>
      <div className="operation-card"><h3>Workers</h3><input value={task} onChange={(event) => setTask(event.target.value)} /><div className="button-row"><button disabled={!enabled || busy} onClick={() => run(() => api.getWorkers())}>List workers</button><button disabled={!enabled || busy} onClick={() => run(() => api.delegate({ task, capabilities: ['codex'], budget_tokens: 2000, input: { mode: 'dry-run' } }))}>Codex dry-run</button><button disabled={!enabled || busy} onClick={() => run(() => api.delegateMany([{ task, capabilities: ['codex'], budget_tokens: 2000, input: { mode: 'dry-run' } }, { task, capabilities: ['testing'], budget_tokens: 2000 }]))}>Parallel run</button></div></div>
      <div className="operation-card"><h3>MCP retrieval</h3><input value={filePath} onChange={(event) => setFilePath(event.target.value)} /><button disabled={!enabled || busy} onClick={() => run(() => api.retrieveFile(filePath))}>Read safely</button></div>
      <div className="operation-card"><h3>Gateway chat</h3><textarea value={gatewayPrompt} onChange={(event) => setGatewayPrompt(event.target.value)} /><button disabled={!enabled || busy} onClick={() => run(() => api.chat([{ role: 'user', content: gatewayPrompt }]))}>Send prompt</button><button disabled={!enabled || busy} onClick={() => run(() => api.inspectRouting({ previous: {}, current: { files_code: [filePath] }, routing_mode: 'off', turn_id: 'ui-operation' }))}>Inspect routing</button></div>
      <div className="operation-card"><h3>Automation</h3><div className="button-row"><button disabled={!enabled || busy} onClick={() => run(() => api.listAutomation())}>List jobs</button><button disabled={!enabled || busy} onClick={() => run(() => api.runAutomation('local-smoke'))}>Run local smoke</button></div><p className="muted">A local smoke job runs the testing worker and records evidence.</p></div>
    </div>
    {result && <section className="result-panel" aria-label="Operation result"><div className="result-header"><div><p className="eyebrow">LIVE RESULT</p><h3>Operation output</h3></div><div className="button-row"><span className={busy ? 'result-status running' : 'result-status'}>{busy ? 'Running…' : 'Complete'}</span><button onClick={() => navigator.clipboard?.writeText(resultText)}>Copy</button><button onClick={() => setResult(null)}>Clear</button></div></div><ResultSummary result={result} /><details className="result-details"><summary>Show technical details</summary><pre className="operation-result">{resultText}</pre></details></section>}
  </section>;
}

function Dashboard() {
  const [token, setToken] = useState('');
  const [submittedToken, setSubmittedToken] = useState('');
  const api = useMemo(() => createUiApi({ token: submittedToken }), [submittedToken]);
  const readiness = useQuery({ queryKey: ['ready', submittedToken], queryFn: api.getReadiness, enabled: Boolean(submittedToken), retry: false });
  const metrics = useQuery({ queryKey: ['metrics', submittedToken], queryFn: api.getMetrics, enabled: Boolean(submittedToken), retry: false, refetchInterval: 5000 });
  const authRequired = readiness.error?.state === 'unauthorized' || metrics.error?.state === 'unauthorized';
  const [palette, setPalette] = useState(false);
  React.useEffect(() => { const onKey = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette((open) => !open); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  return <main>
    <header><div><p className="eyebrow">CONTEXT GOVERNOR / CONTROL PLANE</p><h1>Observe what the system knows.</h1><p className="muted">Hosted telemetry is visible here before routing enforcement is enabled.</p></div><label className="token">Operator token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Kept in memory only" /><button onClick={() => setSubmittedToken(token)}>Connect</button></label></header>
    <section className="grid"><StatusCard label="Enforcement" value="DISABLED BY DESIGN" tone="safe" /><StatusCard label="Readiness" value={readiness.data?.status ?? (submittedToken ? 'CHECKING' : 'NOT CONNECTED')} /><StatusCard label="Telemetry" value={metrics.data ? 'VISIBLE' : 'WAITING'} /></section>
    {!submittedToken && <section className="empty"><h2>Connect an authorized operator token</h2><p>Credentials are never persisted by this dashboard.</p></section>}
    {authRequired && <section className="empty warning"><h2>Authorization required</h2><p>The hosted service rejected this token. Check the gateway token and reconnect.</p></section>}
    {readiness.data && <section className="panel"><h2>Readiness evidence</h2><pre>{JSON.stringify(readiness.data, null, 2)}</pre></section>}
    {metrics.data && <section className="panel"><h2>Live operations telemetry</h2><pre>{metrics.data}</pre></section>}
    <Operations api={api} enabled={Boolean(submittedToken && readiness.data)} />
    <ContextSphere />
    <section className="panel"><p className="eyebrow">ROUTING OBSERVATORY</p><h2>Observe mode only</h2><p className="muted">Route candidates and safety refusals appear here after an authenticated inspection. No route is applied by this dashboard.</p></section>
    {palette && <div className="palette" role="dialog" aria-label="Command palette"><strong>Command palette</strong><button onClick={() => setPalette(false)}>Close</button><p>Connect token · Refresh telemetry · Open routing observatory</p></div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><Dashboard /></QueryClientProvider>);
