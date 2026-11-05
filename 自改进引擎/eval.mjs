import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

const casesPath = path.join(config.root, 'cases.json');
const promptPath = path.join(config.root, 'prompt.md');

function loadCases() {
  return JSON.parse(fs.readFileSync(casesPath, 'utf8'));
}

function loadRules() {
  return fs.readFileSync(promptPath, 'utf8');
}

export async function callModel(rules, input) {
  if (config.offline) return stub(input);

  if (!config.apiKey) throw new Error('SHIL_API_KEY 为空，无法在线评测');
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 512,
      messages: [
        { role: 'system', content: rules },
        { role: 'user', content: input },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content ?? '';
}

function stub(input) {
  return `结论：先复现再判断。\n依据：针对「${input}」，检查 401 响应体与密钥有效期，命令可复现。\n下一步：读取配置文件确认阈值与回滚策略后给出修改方案。`;
}

function judge(c, output) {
  const miss = (c.mustInclude || []).filter((k) => !output.includes(k));
  const bad = (c.mustNotInclude || []).filter((k) => output.includes(k));
  return { id: c.id, pass: miss.length === 0 && bad.length === 0, miss, bad };
}

export async function evaluate() {
  const rules = loadRules();
  const cases = loadCases();
  const details = [];

  for (const c of cases) {
    try {
      const output = await callModel(rules, c.input);
      details.push({ ...judge(c, output), output });
    } catch (err) {
      details.push({ id: c.id, pass: false, error: err.message, output: '' });
    }
  }

  const passed = details.filter((d) => d.pass).length;
  return {
    passed,
    total: details.length,
    score: details.length ? Number((passed / details.length).toFixed(3)) : 0,
    details,
  };
}
