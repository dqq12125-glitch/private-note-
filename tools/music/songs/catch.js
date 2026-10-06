// 收服成功 Got It!（catch）
// 在哪里放：回声球收服成功（一次性）
// 情绪：欢呼——6/8 的蹦跳（meter 3，用八分音符写）：先「下—上」弹两下（3 1 3 | 2 7 2），再一下冲到最高的 E6，落在主音
// 结构：2 小节 6/8，138 bpm ≈ 2.6 秒（+ 引擎 1 秒尾音）
// 和弦：A → E | A → E → A
// 旋律：C#6 A5 C#6 | B5 G#5 B5 | C#6 E6 B5 | A5——3-1-3 | 2-7-2 | 3-5-2 | 1，往上冲只有最后一次。
// 不用回声主题（SPEC §3 没列 catch）：故意不从「5 1 3」开头，免得听起来像 win 号角又响了一遍。
// 配器：方波和弦压在旋律下面（E4–C#5），木琴最后的闪光等旋律的主音响了才往上刷。
module.exports = {
  id: 'catch',
  title: 'Got It!',
  zh: '收服成功',
  use: '收服怪兽成功',
  bpm: 138,
  meter: 3,
  key: 'A', mode: 'major',
  loop: false,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'pulse25', harm: 'pulse50', arp: 'marimba', bass: 'tri' },
  mix: { lead: 0.9, harm: 0.42, arp: 0.45, bass: 0.8, drums: 0.55 },
  fx: { echo: 0.2 },
  sections: {
    F: {
      lead: [
        'C#6/8 A5/8 C#6/8! B5/8 G#5/8 B5/8',
        'C#6/8 E6/8 B5/8 A5/4.!',
      ],
      harm: [
        '[E4 A4 C#5]/4. [E4 G#4 B4]/4.',
        '[E4 A4 C#5]/4 [E4 G#4 B4]/8 [E4 A4 C#5]/4.',
      ],
      arp: [
        'A4/8 E4/8 A4/8 B4/8 E4/8 B4/8',
        'r/4. C#6/16 E6/16 A6/16 C#7/16 r/8',
      ],
      bass: [
        'A2/4. E2/4.',
        'A2/8 r/8 E2/8 A2/4.',
      ],
      drums: [
        'k...s.k.s.ss',
        'k.k.s.c.....',
      ],
    },
  },
  order: ['F'],
};
