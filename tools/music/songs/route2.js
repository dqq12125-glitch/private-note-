// Onward, Brave Heart 勇往直前 —— 第 6–12 岛的道路
// 情绪：比 route 更成熟、更有决心，像背着行囊走在长长的山路上。E 多利亚（E dorian：E 小调把 C 升成 C#，那个明亮的大六度是「不服输」的味道），138 bpm，4/4。
// 音色：pulse50 主旋律（比 pulse25 厚）、柔和锯齿波铺底、pulse12 十六分音符的分解和弦「马达」、带咬合的合成低音「哒哒哒」马蹄节奏。
// 结构：I(2，只放一次) → A(8) A2(8) B(8) C(8) → 回 A（循环 32 小节 ≈ 56 秒）
//   I ：先只有 pulse12 的十六分音符马达，第二小节马蹄低音 + 军鼓过门。
//   A ：号角一样的宽音程旋律「1 — 5 1 | 2. 3 4 2 | 1 — 6 1 | 5 ———」，长音配快速伴奏，四小节一句；结尾 Bsus4 → B（和声小调的属和弦）拉回 Em。
//       马达在 I 和 A 里放低一个八度（G3–E4），号角的音（B4 以上）不会被十六分音符一直重敲；第 6 小节 1 2 4. 5 4 用八分音符起步。
//       和弦：Em | D | A | Em | G | A | Bm | Bsus4 B
//   A2：同样的和弦，旋律升高八度左右，情绪往上推（马达回到高八度）；第 4、6 小节用切分（短—长—短—长），第 7 小节 B C# D 往上顶再落到 F#；
//       最后 B 大三和弦的 D# 半音下滑到 B 段的 G 大调（色彩转换）。
//   B ：对比段，转到关系大调 G 的明亮一侧，八分音符往上「迈步」的短句，问答两小节一句；鼓换成「咚—咚咚」的底鼓 + 开镲（和 route 的鼓型分开）。
//       和弦：G | A | D | Bm | G | A | F#m7 | B
//   C ：「爬坡」：旋律的长音一级一级往上（E → F# → G → B → E'），双数小节用八分音符小跑步接上来，鼓从四拍底鼓慢慢加到十六分，最后军鼓滚奏冲回 A。
//       和弦：A | A | Bm | Bm | G | G | Bsus4 | B
// 原创自查：A2 第 7 小节、A 第 6 小节原来和 title 同位置的小节音符节奏一样，A2 第 4 小节原来和 route B' 第 7 小节一样，都已改。
// 不用回声主题（SPEC §3）。
// 关于检查器：B 大三和弦里的 D# 是和声小调的导音（故意的），调外音占比很低。
const os = (a, b, c, d) => Array(4).fill(a + '/16 ' + b + '/16 ' + c + '/16 ' + d + '/16').join(' ');           // 一小节同一个四音型
const os2 = (x, y) => [x, x, y, y].map(c => c.map(n => n + '/16').join(' ')).join(' ');                          // 前半小节 x，后半小节 y
const gal = (r, top, last) => Array(3).fill(r + '/8 ' + r + '/16 ' + r + '/16').join(' ') + ' ' + top + '/8 ' + last + '/8';   // 马蹄节奏低音
const EM = os('E5', 'B4', 'G4', 'B4'), D = os('D5', 'A4', 'F#4', 'A4'), A = os('C#5', 'A4', 'E4', 'A4'), G = os('D5', 'B4', 'G4', 'B4');
const BM = os('D5', 'B4', 'F#4', 'B4'), BSUS = os2(['E5', 'B4', 'F#4', 'B4'], ['D#5', 'B4', 'F#4', 'B4']), B = os('D#5', 'B4', 'F#4', 'B4');
const FSM = os('C#5', 'A4', 'F#4', 'A4'), BS4 = os('E5', 'B4', 'F#4', 'B4');
// 低八度的马达（I、A 段用，让开号角旋律的音区）
const EM_L = os('E4', 'B3', 'G3', 'B3'), D_L = os('D4', 'A3', 'F#3', 'A3'), A_L = os('C#4', 'A3', 'E3', 'A3'), G_L = os('D4', 'B3', 'G3', 'B3');
const BM_L = os('D4', 'B3', 'F#3', 'B3'), BSUS_L = os2(['E4', 'B3', 'F#3', 'B3'], ['D#4', 'B3', 'F#3', 'B3']);
const DR = 'k.hhs.hhk.hhs.hh', DR2 = 'k.hhs.hkk.hhs.hh';
const DB = 'k.h.s.k.k.h.s.o.', DB2 = 'k.h.s.k.k.hhs.hh', DB3 = 'k.h.s.k.k.hhs.Tt';   // B 段：底鼓跟着低音的 0、1.5、2 拍
module.exports = {
  id: 'route2',
  title: 'Onward, Brave Heart',
  zh: '勇往直前',
  use: '第 6–12 岛的道路',
  bpm: 138,
  meter: 4,
  key: 'E', mode: 'dorian',
  loop: true,
  loopFrom: 1,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'pulse50', harm: 'saw', arp: 'pulse12', bass: 'bass' },
  mix: { lead: 0.8, harm: 0.35, arp: 0.25, bass: 0.8, drums: 0.62 },
  fx: { echo: 0.2 },
  sections: {
    I: {
      arp: [EM_L, EM_L],
      bass: ['r/1', gal('E2', 'E3', 'B2')],
      drums: ['h.h.h.h.h.h.h.h.', 'k.hhs.hhs.ssTTtt'],
    },
    A: {
      lead: [
        'E5/2 B4/4 E5/4',
        'F#5/4. G5/8 A5/4 F#5/4',
        'E5/2 C#5/4 E5/4',                 // 多利亚的 C#
        'B4/1',
        'D5/2 B4/4 D5/4',
        'E5/8 F#5/8 A5/4. B5/8 A5/4',
        'F#5/2 D5/4 F#5/4',
        'E5/2 D#5/2',                      // sus4 → 导音
      ],
      harm: [
        '[E4 G4 B4]/1',
        '[D4 F#4 A4]/1',
        '[C#4 E4 A4]/1',
        '[E4 G4 B4]/1',
        '[D4 G4 B4]/1',
        '[C#4 E4 A4]/1',
        '[D4 F#4 B4]/1',
        '[E4 F#4 B4]/2 [D#4 F#4 B4]/2',
      ],
      arp: [EM_L, D_L, A_L, EM_L, G_L, A_L, BM_L, BSUS_L],
      bass: [
        gal('E2', 'E3', 'B2'),
        gal('D2', 'D3', 'A2'),
        gal('A2', 'A3', 'E3'),
        gal('E2', 'E3', 'B2'),
        gal('G2', 'G3', 'D3'),
        gal('A2', 'A3', 'E3'),
        gal('B2', 'B3', 'F#3'),
        gal('B2', 'B3', 'D#3'),
      ],
      drums: [DR, DR2, DR, DR2, DR, DR2, DR, 'k.hhs.hhs.ssTTtt'],
    },
    A2: {
      lead: [
        'B5/2 E5/4 G5/4',
        'A5/4. G5/8 F#5/4 D5/4',
        'C#6/2 A5/4 C#6/4',
        'B5/8 A5/4 G5/8 E5/2',               // 切分，句尾落在主音
        'D6/2 B5/4 D6/4',
        'C#6/8 B5/4 A5/8 E5/2',
        'B5/4. C#6/8 D6/4 F#5/4',
        'B5/2 D#5/2',
      ],
      harm: [
        '[E4 G4 B4]/1',
        '[D4 F#4 A4]/1',
        '[C#4 E4 A4]/1',
        '[E4 G4 B4]/1',
        '[D4 G4 B4]/1',
        '[C#4 E4 A4]/1',
        '[D4 F#4 B4]/1',
        '[E4 F#4 B4]/2 [D#4 F#4 B4]/2',
      ],
      arp: [EM, D, A, EM, G, A, BM, BSUS],
      bass: [
        gal('E2', 'E3', 'B2'),
        gal('D2', 'D3', 'A2'),
        gal('A2', 'A3', 'E3'),
        gal('E2', 'E3', 'B2'),
        gal('G2', 'G3', 'D3'),
        gal('A2', 'A3', 'E3'),
        gal('B2', 'B3', 'F#3'),
        gal('B2', 'B3', 'D#3'),
      ],
      drums: ['c.hhs.hhk.hhs.hh', DR2, DR, DR2, 'c.hhs.hhk.hhs.hh', DR2, DR, 'k.hhs.hks.sTsTtt'],
    },
    // 对比段：关系大调 G 那一侧，八分音符往上迈步
    B: {
      lead: [
        'r/8 D5/8 G5/8 A5/8 B5/4 A5/8 G5/8',
        'A5/4. E5/8 C#5/2',
        'r/8 D5/8 F#5/8 G5/8 A5/4 G5/8 F#5/8',
        'F#5/4. D5/8 B4/2',
        'r/8 G5/8 B5/8 D6/8 E6/4 D6/8 B5/8',
        'C#6/4. B5/8 A5/2',
        'A5/4 F#5/4 C#5/4 E5/4',
        'D#5/2 F#5/4 A5/4',
      ],
      harm: [
        '[D4 G4 B4]/1',
        '[C#4 E4 A4]/1',
        '[D4 F#4 A4]/1',
        '[D4 F#4 B4]/1',
        '[D4 G4 B4]/1',
        '[C#4 E4 A4]/1',
        '[C#4 E4 A4]/1',
        '[D#4 F#4 B4]/1',
      ],
      arp: [G, A, D, BM, G, A, FSM, B],
      bass: [
        'G2/4. G2/8 D3/4 G2/4',
        'A2/4. A2/8 E2/4 A2/4',
        'D2/4. D2/8 A2/4 D3/4',
        'B1/4. B1/8 F#2/4 B2/4',
        'G2/4. G2/8 D3/4 G2/4',
        'A2/4. A2/8 E2/4 A2/4',
        'F#2/4. F#2/8 C#3/4 F#2/4',
        'B1/4. B1/8 F#2/4 B2/4',
      ],
      drums: [DB, DB2, DB, DB3, DB, DB2, DB, 'k.h.s.hks.s.sTTt'],
    },
    // 爬坡：全音符一级一级往上，鼓越来越密
    C: {
      lead: [
        'E5/1',
        'r/8 A4/8 C#5/8 D5/8 E5/2',          // 小跑步接上来
        'F#5/1',
        'r/8 B4/8 D5/8 E5/8 F#5/2',
        'G5/1',
        'r/8 D5/8 G5/8 A5/8 B5/4 D6/4',
        'E6/1',
        'D#6/2. B5/4',
      ],
      harm: [
        '[C#4 E4 A4]/1',
        '[C#4 E4 A4]/1',
        '[D4 F#4 B4]/1',
        '[D4 F#4 B4]/1',
        '[D4 G4 B4]/1',
        '[D4 G4 B4]/1',
        '[E4 F#4 B4]/1',
        '[D#4 F#4 B4]/1',
      ],
      arp: [A, A, BM, BM, G, G, BS4, B],
      bass: [
        gal('A2', 'A3', 'E3'),
        gal('A2', 'A3', 'E3'),
        gal('B2', 'B3', 'F#3'),
        gal('B2', 'B3', 'F#3'),
        gal('G2', 'G3', 'D3'),
        gal('G2', 'G3', 'D3'),
        gal('B2', 'B3', 'F#3'),
        gal('B2', 'B3', 'D#3'),
      ],
      drums: [
        'k...k...k...k...',
        'k...k...k...k.k.',
        'k.h.k.h.k.h.k.h.',
        'k.h.k.h.k.h.k.hk',
        'k.hhs.hhk.hhs.hh',
        'k.hhs.hkk.hhs.hh',
        'k.hhs.hhk.hhs.hh',
        'ssssssssssssTTtt',
      ],
    },
  },
  order: ['I', 'A', 'A2', 'B', 'C'],
};
