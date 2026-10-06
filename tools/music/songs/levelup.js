// 升级啦 Level Up（levelup）
// 在哪里放：怪兽升级（一次性）；进化动画揭晓的那一下也放这首
// 情绪：「往上走一级」：先一组三连音分解 I（Bb）往上，再在利底亚的 II（C 大三，带 E 还原）上来回折一下（G E C'），
//       最后 A–C'–Bb 绕着主音落到高八度的 Bb。只有第一组是直上的分解和弦，后面故意折返，不做「两组平行三和弦一级级往上」。
// 结构：1 小节，150 bpm ≈ 1.6 秒（+ 引擎 1 秒尾音）
// 和弦：Bb | C | F | Bb（I–II–V–I，Bb 利底亚，所以 E 不算调外音）
// 和 item 分开：这首是方波旋律 + 吊镲，「更大的事」；item 换成木琴、不打吊镲。
// 不用回声主题（SPEC §3 没列 levelup）。
module.exports = {
  id: 'levelup',
  title: 'Level Up',
  zh: '升级啦',
  use: '怪兽升级',
  bpm: 150,
  meter: 4,
  key: 'Bb', mode: 'lydian',
  loop: false,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'pulse25', harm: 'pulse50', arp: 'bell', bass: 'tri' },
  mix: { lead: 0.9, harm: 0.42, arp: 0.4, bass: 0.8, drums: 0.5 },
  fx: { echo: 0.2 },
  sections: {
    F: {
      lead: ['Bb4/12 D5/12 F5/12 G5/12 E5/12 C6/12 A5/8 C6/8 Bb5/4!'],
      harm: ['[Bb3 D4 F4]/4 [C4 E4 G4]/4 [F4 A4 C5]/4 [D4 F4 Bb4]/4'],
      arp: ['r/2 r/4 [D6 F6 Bb6]/4'],
      bass: ['Bb2/4 C3/4 F2/4 Bb2/4'],
      drums: ['k...k...k.s.c...'],
    },
  },
  order: ['F'],
};
