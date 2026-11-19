#!/usr/bin/env node
// 在云上的 Mac 里挑一台 iPhone 模拟器（两个工作流用：.github/workflows/ios-simulator.yml、ios-testflight.yml）。
// 用法：node ios/scripts/pick-simulator.mjs [--prefer 26.2,26.1] [--name "iPhone 17"] [--from 文件.json]
//   --prefer  按顺序要哪个 iOS 版本（26.2 也认 26.2.1）；都没有就挑最新的，并在 stderr 说一句
//   --name    优先要这个机型（没有就挑这个版本里第一台 iPhone）
//   --from    读一份 `xcrun simctl list devices available -j` 的输出（测试用）；不给就自己跑 xcrun
// 打印一行：<udid>\t<iOS 版本>\t<机型名>（机型名放最后，里面有空格）。一台都没有就退出码 1。
// 为什么要挑版本：iOS 26.5 的模拟器上 SKTestSession 存不进本地 App Store 的配置（苹果开发者论坛 FB22237318），订阅的测试要在 26.2 上跑
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ver = key => { const m = /iOS-(\d+)-(\d+)(?:-(\d+))?$/.exec(key); return m ? [+m[1], +m[2], +(m[3] || 0)] : null; };
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const text = v => v[0] + '.' + v[1] + (v[2] ? '.' + v[2] : '');

// json：simctl 的输出（对象）。返回 { udid, os, name, preferred }，没有就 null
export function pick(json, { prefer = [], name = '' } = {}) {
  const runtimes = [];
  for (const [key, list] of Object.entries((json && json.devices) || {})) {
    const v = ver(key);
    if (!v) continue;
    const phones = (list || []).filter(d => d && d.isAvailable !== false && /^iPhone/.test(d.name || '') && d.udid);
    if (phones.length) runtimes.push({ v, phones });
  }
  if (!runtimes.length) return null;
  const choose = (r, preferred) => {
    const d = (name && r.phones.find(p => p.name === name)) || r.phones.slice().sort((a, b) => a.name.localeCompare(b.name))[0];
    return { udid: d.udid, os: text(r.v), name: d.name, preferred };
  };
  for (const want of prefer) {
    const w = String(want).split('.').map(Number);
    const hits = runtimes.filter(r => r.v[0] === w[0] && r.v[1] === w[1] && (w.length < 3 || r.v[2] === w[2])).sort((a, b) => cmp(b.v, a.v));
    if (hits.length) return choose(hits[0], true);
  }
  return choose(runtimes.sort((a, b) => cmp(b.v, a.v))[0], prefer.length === 0);
}

function main(argv) {
  const arg = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
  const from = arg('from');
  const raw = from ? fs.readFileSync(path.resolve(from), 'utf8') : execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' });
  const prefer = String(arg('prefer') || '').split(',').map(s => s.trim()).filter(Boolean);
  const r = pick(JSON.parse(raw), { prefer, name: arg('name') || '' });
  if (!r) { console.error('pick-simulator: no available iPhone simulator'); process.exit(1); }
  if (prefer.length && !r.preferred) console.error('pick-simulator: none of iOS ' + prefer.join(' / ') + ' is installed; using iOS ' + r.os);
  console.log(r.udid + '\t' + r.os + '\t' + r.name);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
