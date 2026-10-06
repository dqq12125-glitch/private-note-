// 道馆挑战（Gym Puzzle）
// 在哪里放：道馆里面（解机关、找雕像答题）
// 情绪：专注、有决心——A 混合利底亚调式（大调里带一个还原的七级 G，I–bVII–IV 很「往前推」），124 bpm 中速，
//       木琴像齿轮一样一直转的八分音符，鼓点稳（一直是一三拍底鼓、二四拍军鼓），锯齿波铺底；
//       低音用 GB 波形（wave）：三角波在 D2–A2 几乎没有泛音，手机喇叭上会听不见，wave 的泛音能把低音线带出来
// 结构：I(2) A(8) A2(8) B(8) C(8) → 回 A（循环 32 小节 ≈ 62 秒）
//   I  ：木琴齿轮 + 低音先走两小节，第二小节军鼓滚奏
//   A  ：A | G | D | A | A | G | D | G —— 主题「附点长音 → 一串八分往下绕」（呼），两小节一句，按 A → G → D 一句句往下模进，
//        最后 bVII → I 的混合利底亚终止接回来
//   A2 ：A | G | D | A | A | G | D | E7sus4 —— 前四小节是 A 的「回答」：同样的附点开头，但一串八分往上爬（A 往下绕、A2 往上爬，主题头不会 16 小节里听四遍）；
//        后四小节往高处走，停在 E7sus4（不用 G#，保持调式）
//   B  ：F#m | D | Bm | E7sus4 | F#m | D | G | G —— 「想一想」：旋律变长音，木琴改成一拍一下的滴答，鼓也变空
//   C  ：F#m7 | Em7 | D | A | F#m7 | G | D | G —— 机关段：断奏的「一–五–一二三」小动机按和弦往下搬；
//        和声换成 vi–v–IV–I 往下走（旋律不变，正拍上的音变成 F#m7 / Em7 的三音和七音），不再是 A 段 A–G–D 的又一圈；锯齿波在二四拍点和弦
// 回声主题：不用
// 旋律密度：约 2.1 个/秒，留出给英语朗读的空间（引擎朗读时也会压低音乐）
// 和 rival 同是混合利底亚 I–bVII–IV，但这首是 124 的直八分、rival 是 144 的 shuffle，C 段又换成了 vi–v–IV–I，不会听混
// 原创检查：A 第 1–2 小节 E. A B A G E | D. G A G E D——音程 +5 +2 -2 -2 -3 | -2 +5 +2 -2 -3 -2，节奏 附点四分、八分×5（两小节一样），
//   是自己的「附点 + 下绕」句型；A2 的回答 A. E F# A B C# | B. G A B D B 是「附点 + 往上爬」；C 段 A-E-A-B-C# 是「先掉到下五度再往上一级级爬」，
//   和《G 大调小步舞曲》那种「上五度起、往上爬」方向不同；和宝可梦道馆音乐、其他名曲都对不上。

const up = n => n.replace(/(-?\d)$/, d => +d + 1);                                                      // 升八度
const gear = (r, t, f) => `${r}/8 ${f}/8 ${up(r)}/8 ${f}/8 ${t}/8 ${f}/8 ${up(r)}/8 ${f}/8`;          // 木琴齿轮：根 五 八 五 三 五 八 五
const tick = (r, t, f) => `${r}/8 r/8 ${f}/8 r/8 ${up(r)}/8 r/8 ${t}/8 r/8`;                         // 木琴滴答（B 段）
const bl = (r, f) => `${r}/8 ${r}/8 ${f}/8 ${r}/8 ${r}/8 ${r}/8 ${f}/8 ${up(r)}/8`;                  // 低音
const st = c => `r/4 ${c}/4^ r/4 ${c}/4^`;                                                             // 二四拍和弦（C 段）

const A = '[A3 C#4 E4]', G = '[G3 B3 D4]', D = '[F#3 A3 D4]', Fm = '[F#3 A3 C#4]', Bm = '[F#3 B3 D4]', Es = '[E3 A3 B3]', Em = '[E3 G3 B3]';
const gA = gear('A3', 'C#4', 'E4'), gG = gear('G3', 'B3', 'D4'), gD = gear('D4', 'F#4', 'A4');
const gFm = gear('F#3', 'A3', 'C#4'), gEm = gear('E3', 'G3', 'B3');
const bA = bl('A2', 'E3'), bG = bl('G2', 'D3'), bD = bl('D2', 'A2'), bFm = bl('F#2', 'C#3'), bEm = bl('E2', 'B2');

const g1 = 'k.h.s.h.k.h.s.h.', g2 = 'k.h.s.h.k.hks.hs', gr = 'k.h.s.h.k.h.ssss', gc = 'c.h.s.h.k.h.s.h.';

module.exports = {
  id: 'gym',
  title: 'Gym Puzzle',
  zh: '道馆挑战',
  use: '道馆里面（解机关）',
  bpm: 124,
  meter: 4,
  key: 'A', mode: 'mixolydian',
  loop: true,
  loopFrom: 1,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'pulse25', harm: 'saw', arp: 'marimba', bass: 'wave' },
  mix: { lead: 0.85, harm: 0.35, arp: 0.5, bass: 0.8, drums: 0.55 },
  fx: { echo: 0.15 },
  sections: {
    I: {
      arp: [gA, gG],
      bass: [bA, bG],
      drums: ['k...k...k...k...', 'k...k...k.k.ssss'],
    },
    A: {
      lead: [
        'E5/4. A5/8 B5/8 A5/8 G5/8 E5/8',                  // A
        'D5/4. G5/8 A5/8 G5/8 E5/8 D5/8',                  // G   低一级模进
        'F#5/4. D5/8 E5/8 F#5/8 A5/4',                     // D
        'E5/2. r/4',                                       // A   换气
        'E5/4. A5/8 B5/8 A5/8 G5/8 E5/8',                  // A
        'D5/4. G5/8 B5/8 D6/8 B5/8 G5/8',                  // G   这次往上
        'A5/4. F#5/8 E5/8 D5/8 E5/8 F#5/8',                // D
        'G5/2. F#5/8 D5/8',                                // G   bVII → 接回 A
      ],
      harm: [`${A}/1`, `${G}/1`, `${D}/1`, `${A}/1`, `${A}/1`, `${G}/1`, `${D}/1`, `${G}/1`],
      arp: [gA, gG, gD, gA, gA, gG, gD, gG],
      bass: [bA, bG, bD, bA, bA, bG, bD, bG],
      drums: [gc, g1, g1, g2, g1, g1, g1, gr],
    },
    A2: {
      lead: [
        'A5/4. E5/8 F#5/8 A5/8 B5/8 C#6/8',                // A   回答：附点之后往上爬
        'B5/4. G5/8 A5/8 B5/8 D6/8 B5/8',                  // G
        'A5/4. F#5/8 D5/8 F#5/8 A5/4',                     // D
        'E5/2. r/4',                                       // A
        'E5/4. A5/8 B5/8 C#6/8 B5/8 A5/8',                 // A
        'B5/4. D6/8 B5/8 A5/8 G5/8 D5/8',                  // G
        'F#5/4. A5/8 D6/4 C#6/4',                          // D
        'B5/2 A5/4 E5/4',                                  // E7sus4 → B 段
      ],
      harm: [`${A}/1`, `${G}/1`, `${D}/1`, `${A}/1`, `${A}/1`, `${G}/1`, `${D}/1`, `${Es}/1`],
      arp: [gA, gG, gD, gA, gA, gG, gD, gear('E3', 'A3', 'B3')],
      bass: [bA, bG, bD, bA, bA, bG, bD, bl('E2', 'B2')],
      drums: [gc, g1, g1, g2, g1, g1, g2, gr],
    },
    B: {
      lead: [
        'C#6/4. B5/8 A5/2',                                // F#m
        'F#5/4. E5/8 D5/2',                                // D
        'D5/8 E5/8 F#5/8 A5/8 B5/4 A5/8 F#5/8',            // Bm
        'E5/2. r/4',                                       // E7sus4
        'C#6/4. B5/8 A5/4 C#6/4',                          // F#m
        'D6/4. C#6/8 A5/4 F#5/4',                          // D
        'G5/4 B5/4 D6/4 B5/4',                             // G
        'A5/2. r/4',                                       // G（九音，悬着）→ C 段
      ],
      harm: [`${Fm}/1`, `${D}/1`, `${Bm}/1`, `${Es}/1`, `${Fm}/1`, `${D}/1`, `${G}/1`, `${G}/1`],
      arp: [tick('F#3', 'A3', 'C#4'), tick('D4', 'F#4', 'A4'), tick('B3', 'D4', 'F#4'), tick('E3', 'A3', 'B3'),
        tick('F#3', 'A3', 'C#4'), tick('D4', 'F#4', 'A4'), tick('G3', 'B3', 'D4'), tick('G3', 'B3', 'D4')],
      bass: [bFm, bD, bl('B1', 'F#2'), bl('E2', 'B2'), bFm, bD, bG, bG],
      drums: ['c...h...s...h...', 'k...h...s...h...', 'k...h...s...h...', 'k...h...s..sh.s.',
        'k...h...s...h...', 'k...h...s...h...', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.ssssssss'],
    },
    C: {
      lead: [
        'A5/8^ r/8 E5/8^ r/8 A5/8^ B5/8^ C#6/4',           // F#m7  机关咔哒咔哒
        'G5/8^ r/8 D5/8^ r/8 G5/8^ A5/8^ B5/4',            // Em7
        'F#5/8^ r/8 D5/8^ r/8 F#5/8^ G5/8^ A5/4',          // D
        'E5/8^ r/8 C#5/8^ r/8 E5/8^ F#5/8^ G5/4',          // A
        'A5/8^ r/8 E5/8^ r/8 A5/8^ B5/8^ C#6/8 E6/8',      // F#m7
        'D6/4 B5/4 G5/4 D5/4',                             // G
        'F#5/4 A5/4 D6/4 C#6/8 B5/8',                      // D
        'A5/2 G5/4 F#5/4',                                 // G  → 接回 A 段的 E5
      ],
      harm: [st(Fm), st(Em), st(D), st(A), st(Fm), st(G), st(D), st(G)],
      arp: [gFm, gEm, gD, gA, gFm, gG, gD, gG],
      bass: [bFm, bEm, bD, bA, bFm, bG, bD, bG],
      drums: [gc, 'k.h.s.hsk.h.s.hs', g1, 'k.h.s.hsk.h.s.hs', gc, 'k.h.s.hsk.h.s.hs', g1, gr],
    },
  },
  order: ['I', 'A', 'A2', 'B', 'C'],
};
