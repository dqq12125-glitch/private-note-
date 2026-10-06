// 休息一下 Rest Well（heal）
// 在哪里放：怪兽中心恢复体力（一次性）
// 情绪：温柔的摇篮曲：6/8（meter 3，用八分音符写）长–短、长–短地摇，竖琴分解和弦，没有鼓
// 结构：2 小节 6/8，126 bpm ≈ 2.9 秒（+ 引擎 1 秒尾音）
// 和弦：Ab → Bbm | Eb → Ab（I–ii | V–I）
// 旋律：「5 3 | 6 4」两声轻轻的叹气，一声比一声高（F、Db 都是 Bbm 的和弦音）——「慢慢好起来」；
//       再「3 5 7 1'」升回主音。不用往下走的「5 3 | 4 2」，免得像儿歌。不用回声主题（SPEC §3 没列 heal）。
module.exports = {
  id: 'heal',
  title: 'Rest Well',
  zh: '休息一下',
  use: '怪兽中心恢复体力',
  bpm: 126,
  meter: 3,
  key: 'Ab', mode: 'major',
  loop: false,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'sine', harm: 'strings', arp: 'pluck', bass: 'tri' },
  mix: { lead: 0.85, harm: 0.35, arp: 0.5, bass: 0.6 },
  fx: { echo: 0.25 },
  sections: {
    F: {
      lead: [
        'Eb5/4 C5/8 F5/4 Db5/8',
        'C5/8 Eb5/8 G5/8 Ab5/4.',
      ],
      harm: [
        '[Ab3 C4 Eb4]/4. [Bb3 Db4 F4]/4.',
        '[G3 Bb3 Eb4]/4. [Ab3 C4 Eb4]/4.',
      ],
      arp: [
        'Ab3/8 Eb4/8 Ab4/8 Bb3/8 F4/8 Bb4/8',
        'G3/8 Eb4/8 Bb4/8 [Ab3 Eb4 Ab4 C5]/4.',
      ],
      bass: [
        'Ab2/4. Bb2/4.',
        'Eb2/4. Ab2/4.',
      ],
    },
  },
  order: ['F'],
};
