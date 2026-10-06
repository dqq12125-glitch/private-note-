// 下次再来 Next Time（lose）
// 在哪里放：战斗输了（一次性）
// 情绪：失落但不吓人（给孩子的）：三角波两声往下落的「唉——」（Cm 上 b3 1 5，Fm 上 b6 4，都是和弦音），
//       再从 4 一步走到 5，导音轻轻回到主音，用大三和弦（皮卡第三度）收——「没关系，再来一次」
// 结构：2 小节，132 bpm ≈ 3.6 秒（+ 引擎 1 秒尾音），没有鼓
// 和弦：Cm → Fm | G → C（大三和弦收尾）
// 旋律：Eb5 C5 G4 | Ab4 F4 | G4 B4 C5——两声叹气都是跳着落的和弦音，故意不用「3 2 1」一级级往下的走法
//       （那样像几首有名的老曲子）。
// 配器：弦乐和拨弦都放在旋律下面（最高到 E4），三角波旋律不会被盖住。
// 调用和声小调（B 还原是 V 和弦的导音）；剩下的调外音是最后 C 大三和弦里的 E 还原——皮卡第三度，故意的。
// 不用回声主题（SPEC §3 没列 lose）。
module.exports = {
  id: 'lose',
  title: 'Next Time',
  zh: '下次再来',
  use: '战斗输了',
  bpm: 132,
  meter: 4,
  key: 'C', mode: 'harmonicMinor',
  loop: false,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'tri', harm: 'strings', arp: 'pluck', bass: 'wave' },
  mix: { lead: 0.9, harm: 0.4, arp: 0.4, bass: 0.6 },
  fx: { echo: 0.25 },
  sections: {
    F: {
      lead: [
        'Eb5/4 C5/8 G4/8 Ab4/4. F4/8',     // 两声往下落的叹气
        'G4/4. B4/8 C5/2',                  // 一步走到 5，导音轻轻回到主音（大三和弦）
      ],
      harm: [
        '[G3 C4 Eb4]/2 [F3 Ab3 C4]/2',
        '[G3 B3 D4]/2 [G3 C4 E4]/2',
      ],
      arp: [
        'C4/8 G3/8 Eb4/8 G3/8 F3/8 C4/8 Ab3/8 C4/8',
        'G3/8 D4/8 B3/8 D4/8 [G3 C4 E4]/2',
      ],
      bass: [
        'C3/2 F2/2',
        'G2/2 C2/2',
      ],
    },
  },
  order: ['F'],
};
