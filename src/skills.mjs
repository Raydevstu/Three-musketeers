export const defaultSkills = [
  { name: 'api-debugger', description: 'Debug API authentication and routes', keywords: ['api', 'auth'] },
  { name: 'test-auditor', description: 'Run and inspect automated tests', keywords: ['test', 'verify'] },
  { name: 'context-governor', description: 'Inspect context and routing safety', keywords: ['context', 'routing'] }
];

export function createSkillRegistry(skills = defaultSkills) {
  const normalized = skills.map((skill) => ({ name: skill.name, keywords: skill.keywords.map((keyword) => keyword.toLowerCase()) }));
  return {
    match(intentVector) {
      const text = String(intentVector).toLowerCase();
      return normalized.flatMap((skill) => {
        const keyword = skill.keywords.find((candidate) => text.includes(candidate));
        return keyword ? [{ name: skill.name, reason: `keyword:${keyword}` }] : [];
      });
    }
  };
}
