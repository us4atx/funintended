const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const dir = __dirname; const { meta, tEnd } = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json')));
let txt = '';
for (let i = 0; i < meta.length; i++) {
  const d = i + 1 < meta.length ? meta[i + 1].t - meta[i].t : Math.max(0.5, tEnd - meta[i].t);
  txt += `file 'frames/${meta[i].file}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n`;
}
txt += `file 'frames/${meta.at(-1).file}'\n`;
fs.writeFileSync(path.join(dir, 'concat.txt'), txt);
const out = process.argv[2];
const total = Math.max(meta.at(-1).t + 0.5, tEnd) - meta[0].t;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'concat.txt'),
  '-vf', `scale=1920:1080:flags=lanczos,fps=30,format=yuv420p,fade=t=in:st=0:d=0.8,fade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'animation', '-movflags', '+faststart', '-an', out], { stdio: 'inherit' });
console.log('done', out);
