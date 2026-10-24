export function createUiApi({ token = '', fetchImpl = fetch } = {}) {
  const request = async (path, options = {}) => {
    const response = await fetchImpl(path, { ...options, headers: { ...(options.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Authentication required' : `Request failed: ${response.status}`);
      error.status = response.status;
      error.state = response.status === 401 ? 'unauthorized' : response.status >= 500 ? 'unavailable' : 'failed';
      throw error;
    }
    return response;
  };
  return {
    tokenStorage: 'memory',
    getMetrics: async () => (await request('/metrics')).text(),
    getReadiness: async () => (await request('/ready')).json(),
    getWorkers: async () => (await request('/orchestration/workers')).json(),
    compilePrompt: async (prompt) => (await request('/prompt/compile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) })).json(),
    inspectRouting: async (body) => (await request('/optimization/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(),
    preparePrompt: async (prompt) => (await request('/prompt/prepare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) })).json(),
    runWorkflow: async (prompt) => (await request('/workflow/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, platform: 'ui' }) })).json(),
    delegate: async (body) => (await request('/orchestration/delegate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(),
    delegateMany: async (requests) => (await request('/orchestration/delegate-many', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests }) })).json(),
    retrieveFile: async (path, profile = 'inspect') => (await request('/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'retrieval/read', path, profile }) })).json(),
    chat: async (messages) => (await request('/v1/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages }) })).text(),
    listAutomation: async () => (await request('/automation/jobs')).json(),
    runAutomation: async (name) => (await request(`/automation/${encodeURIComponent(name)}`, { method: 'POST' })).json()
  };
}
