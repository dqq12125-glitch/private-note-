// 拿到啦 Found It（item）
// 在哪里放：拿到道具（一次性）——全游戏放得最多的一首小音乐，所以要轻、不累耳朵
// 情绪：短而亮，「叮」一下：一小节里 I → IV → V → I 三个小分解和弦往上跳，导音落到高八度主音，钟琴闪一下
// 结构：1 小节，152 bpm ≈ 1.6 秒（+ 引擎 1 秒尾音）
// 和弦：E | A | B | E
// 音色：旋律用木琴（不是方波），不打吊镲——和 levelup（方波 + 吊镲）分开，升级听起来是更大的事；落地靠钟琴闪光。
// 不用回声主题（SPEC §3 没列 item）。
module.exports = {
  id: 'item',
  title: 'Found It',
  zh: '拿到啦',
  use: '拿到道具',
  bpm: 152,
  meter: 4,
  key: 'E', mode: 'major',
  loop: false,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'marimba', harm: 'pulse50', arp: 'bell', bass: 'tri' },
  mix: { lead: 0.9, harm: 0.4, arp: 0.38, bass: 0.8, drums: 0.5 },
  fx: { echo: 0.22 },
  sections: {
    F: {
      lead: ['E5/16 G#5/16 B5/8 A5/16 C#6/16 E6/8 D#6/8 E6/4.!'],
      harm: ['[E4 G#4 B4]/4 [E4 A4 C#5]/4 [D#4 F#4 B4]/8 [E4 G#4 B4]/4.'],
      arp: ['r/2 r/8 B6/16 E7/16 [G#6 B6]/4'],
      bass: ['E3/4 A2/4 B2/8 E2/4.'],
      drums: ['k...k...k.......'],
    },
  },
  order: ['F'],
};
