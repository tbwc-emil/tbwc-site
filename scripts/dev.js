// `npx serve`'s --no-port-switching flag doesn't actually stop it from picking
// a random port when 3000 is taken (tested against serve 14.2.6 — it still
// switches). This frees port 3000 first so `npm run dev` always lands there.
const { execSync, spawn } = require('child_process');

function freePort3000() {
  if (process.platform !== 'win32') return; // best-effort; only tested on Windows
  let out;
  try {
    out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
  } catch {
    return;
  }
  const pids = new Set();
  out.split('\n').forEach((line) => {
    const m = line.match(/^\s*TCP\s+\S*:3000\s+\S+\s+LISTENING\s+(\d+)/i);
    if (m) pids.add(m[1]);
  });
  pids.forEach((pid) => {
    try {
      execSync('taskkill /F /PID ' + pid, { stdio: 'ignore' });
      console.log('Freed port 3000 (killed PID ' + pid + ')');
    } catch {}
  });
}

freePort3000();

const child = spawn('npx', ['serve', '.', '-l', '3000'], { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code));
