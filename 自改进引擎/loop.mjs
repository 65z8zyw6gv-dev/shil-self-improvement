import { config } from './config.mjs';
import { createSnapshot, listSnapshots, restore, lastPassing, recordScores } from './store.mjs';
import { evaluate } from './eval.mjs';

const mode = process.argv.includes('--offline') ? 'offline' : 'live';
if (mode === 'offline') config.offline = true;

function line(tag, text) {
  console.log(`[${tag}] ${text}`);
}

async function cycle() {
  line('1/3', `建立快照（模式: ${mode}）`);
  const bench = createSnapshot(`bench-${mode}`);

  line('2/3', '执行评测');
  let result;
  try {
    result = await evaluate();
  } catch (err) {
    line('ERR', `评测中断: ${err.message}`);
    line('3/3', `回滚到上一个达标快照`);
    const good = lastPassing(config.passThreshold);
    if (good) {
      restore(good.id);
      line('OK', `已回滚至 ${good.id}`);
    } else {
      line('WARN', '无历史达标快照，保留当前状态并终止');
    }
    process.exitCode = 1;
    return;
  }

  for (const d of result.details) {
    const mark = d.pass ? 'PASS' : 'FAIL';
    const why = d.error || [...d.miss.map((k) => `缺少:${k}`), ...d.bad.map((k) => `出现禁用词:${k}`)].join(' ');
    if (!d.pass) line(mark, `${d.id} ${why}`);
  }

  const promoted = result.score >= config.passThreshold;
  recordScores(bench.id, result, promoted);

  line('SCORE', `${result.passed}/${result.total} = ${result.score}，阈值 ${config.passThreshold}`);
  line('3/3', promoted ? '达标，保留当前版本' : '未达标，查找可回滚快照');

  if (promoted) {
    line('OK', `基准 ${bench.id} 已保留`);
  } else {
    const good = lastPassing(config.passThreshold);
    if (good) {
      restore(good.id);
      line('OK', `已回滚至 ${good.id}`);
      process.exitCode = 2;
    } else {
      line('WARN', '无历史达标快照，保留当前状态，需人工介入');
      process.exitCode = 2;
    }
  }

  const all = listSnapshots();
  line('INFO', `快照总数 ${all.length}，最新 ${all[all.length - 1]?.id}`);
}

cycle();
