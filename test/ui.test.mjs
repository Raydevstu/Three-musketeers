import test from 'node:test';
import assert from 'node:assert/strict';
import { createUiApi } from '../ui/src/api.js';

const testToken = ['operator', 'token'].join('-');

test('UI API preserves unauthorized state without persisting the token', async () => {
  const api = createUiApi({ fetchImpl: async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) });
  await assert.rejects(() => api.getMetrics(), (error) => error.status === 401 && error.state === 'unauthorized');
  assert.equal(api.tokenStorage, 'memory');
});

test('UI API returns observable telemetry payloads', async () => {
  const api = createUiApi({
    token: testToken,
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${testToken}`);
      return new Response('# TYPE governor_requests_total counter\ngovernor_requests_total 4\n', { status: 200 });
    }
  });
  assert.match(await api.getMetrics(), /governor_requests_total 4/);
});

test('UI API submits a prompt to the authenticated preparation route', async () => {
  const api = createUiApi({
    token: testToken,
    fetchImpl: async (url, options) => {
      assert.equal(url, '/prompt/prepare');
      assert.equal(options.headers.Authorization, `Bearer ${testToken}`);
      assert.deepEqual(JSON.parse(options.body), { prompt: 'Inspect API auth' });
      return new Response(JSON.stringify({ compiled: { intent_vector: 'inspect api auth' }, skills: [{ name: 'api-debugger', reason: 'keyword:api' }] }), { status: 200 });
    }
  });
  assert.deepEqual(await api.preparePrompt('Inspect API auth'), { compiled: { intent_vector: 'inspect api auth' }, skills: [{ name: 'api-debugger', reason: 'keyword:api' }] });
});

test('UI API exposes operations for workers, delegation, retrieval, and chat', async () => {
  const seen = [];
  const api = createUiApi({ token: testToken, fetchImpl: async (url) => { seen.push(url); return new Response(url === '/v1/chat' ? 'event: done' : JSON.stringify({ ok: true }), { status: 200 }); } });
  await api.getWorkers(); await api.compilePrompt('x'); await api.delegate({ task: 'x' }); await api.delegateMany([]); await api.retrieveFile('package.json'); await api.chat([]); await api.listAutomation(); await api.runAutomation('job');
  assert.deepEqual(seen, ['/orchestration/workers', '/prompt/compile', '/orchestration/delegate', '/orchestration/delegate-many', '/mcp', '/v1/chat', '/automation/jobs', '/automation/job']);
});

test('UI API starts the automatic workflow', async () => {
  const api = createUiApi({ token: testToken, fetchImpl: async (url, options) => {
    assert.equal(url, '/workflow/run');
    assert.equal(options.headers.Authorization, `Bearer ${testToken}`);
    assert.deepEqual(JSON.parse(options.body), { prompt: 'Run tests', platform: 'ui' });
    return new Response(JSON.stringify({ status: 'succeeded' }), { status: 200 });
  } });
  assert.deepEqual(await api.runWorkflow('Run tests'), { status: 'succeeded' });
});
