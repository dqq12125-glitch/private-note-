// 学习时光 Quiet Pages（study）
// 在哪里放：闯关练习、每日复习、对话动画——孩子一直在听英语、开口说英语，音乐只是陪伴
// 情绪：安静、温暖、lo-fi 的「窗边写作业」感；轻摇摆（swing 0.18），鼓很轻，木琴旋律大量留白
// 结构：I(2) A(8) B(8) A'(8) → 回 A（循环 24 小节 ≈ 65 秒）
// 和弦：I ：Fm7 Gm7（ii–iii 往上走进 A）
//       A ：Abmaj7 Gm7 Fm7 Ebmaj7 | Abmaj7 Gm7 Fm7 Bbsus4–Bb（IV–iii–ii–I 一级级往下，lo-fi 常用的走法）
//       B ：Cm7 Gm7 Abmaj7 Ebmaj7 | Fm7 Gm7 Abadd9 Bb（从 vi 开始，旋律高一点、音长一点，做对比；
//           第 7 小节旋律落在 Ab5 上，和声改成 add9，不在它下面放 maj7 的 G，免得撞小九度）
//       A'：同 A，结尾改成 Fm7 Gm7，一步步走回 Abmaj7（循环接缝和前奏一样是 iii→IV 上行）
// 动机：「空一拍 + 8 8 4. 8」的三音小动机（同音-下三度-同音）；旋律停下来的小节，钟琴把动机在高八度轻轻「回」一遍。
//       这首不用回声主题（SPEC §3 没列 study）。
// 节奏组：A / A' 低音「1、2 的后半拍、4、4 的后半拍」，底鼓打在 1 和「2 的后半拍」上，和低音一起落；
//       B 段低音改成半拍速的长音（1、3、4 拍），底鼓打 1、3 拍，B 段更宽、更舒展；B 最后一小节低音回到 A 的律动，带回 A'。
// 旋律约 1 个/秒（上限 2.5），强拍只落三和弦音；七和弦、九音这些 lo-fi 色彩放在弦乐和钟琴里。
module.exports = {
  id: 'study',
  title: 'Quiet Pages',
  zh: '安静的书页',
  use: '闯关练习、每日复习、对话动画',
  bpm: 88,
  meter: 4,
  key: 'Eb', mode: 'major',
  loop: true,
  loopFrom: 1,
  swing: 0.18,
  drumGrid: 4,
  inst: { lead: 'marimba', harm: 'strings', arp: 'bell', bass: 'tri' },
  mix: { lead: 0.75, harm: 0.3, arp: 0.28, bass: 0.65, drums: 0.3 },
  fx: { echo: 0.2 },
  sections: {
    // 前奏：只有弦乐、低音和钟琴，钟琴先把动机哼一下
    I: {
      harm: ['[F3 Ab3 C4 Eb4]/1', '[G3 Bb3 D4 F4]/1'],
      arp: ['r/4 C6/8 Ab5/8 C6/4. Eb6/8', 'r/4 D6/8 Bb5/8 D6/4. F6/8'],
      bass: ['F2/4. F2/8 r/4 C3/8 Ab2/8', 'G2/4. G2/8 r/4 D3/8 G2/8'],
      drums: ['k.....k.h...h...', 'k...h.k.h...h.s.'],
    },
    A: {
      lead: [
        'r/4 Eb5/8 C5/8 Eb5/4. F5/8',     // 呼：空一拍，小动机往上探
        'G5/4 r/4 r/2',                     // 停住，留白
        'r/4 C5/8 Ab4/8 C5/4. Eb5/8',      // 同样的节奏，低三度再说一遍
        'Bb4/2. r/4',
        'r/4 Eb5/8 C5/8 Eb5/4. G5/8',      // 第二句：开头一样，往上跳
        'Bb5/4. G5/8 D5/2',
        'r/4 Eb5/8 F5/8 Ab5/4 G5/8 F5/8',
        'Eb5/2 D5/2',                       // 4–3 挂留解决，停在属和弦上
      ],
      harm: [
        '[Ab3 C4 Eb4 G4]/1', '[G3 Bb3 D4 F4]/1', '[F3 Ab3 C4 Eb4]/1', '[Eb3 G3 Bb3 D4]/1',
        '[Ab3 C4 Eb4 G4]/1', '[G3 Bb3 D4 F4]/1', '[F3 Ab3 C4 Eb4]/1', '[Bb3 Eb4 F4]/2 [Bb3 D4 F4]/2',
      ],
      arp: [
        'r/1',
        'r/4 D6/8 Bb5/8 D6/4 r/4',          // 钟琴回声：把上一小节的动机按 Gm7 回一遍
        'r/1',
        'r/4 Bb5/8 G5/8 Bb5/4 D6/4',
        'r/1',
        'r/1',
        'r/1',
        'r/2 F6/8 D6/8 Bb5/4',
      ],
      bass: [
        'Ab2/4. Ab2/8 r/4 Eb3/8 Ab2/8', 'G2/4. G2/8 r/4 D3/8 G2/8', 'F2/4. F2/8 r/4 C3/8 F2/8', 'Eb2/4. Eb2/8 r/4 Bb2/8 G2/8',
        'Ab2/4. Ab2/8 r/4 Eb3/8 Ab2/8', 'G2/4. G2/8 r/4 D3/8 G2/8', 'F2/4. F2/8 r/4 C3/8 Ab2/8', 'Bb2/4. Bb2/8 r/4 F2/8 Bb2/8',
      ],
      drums: [
        'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.o.',
        'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.hs',
      ],
    },
    B: {
      lead: [
        'G5/2 r/8 Eb5/8 F5/8 G5/8',        // 长音 + 三个八分音符往上接
        'Bb5/2 F5/4 r/4',
        'r/4 C6/8 Bb5/8 Ab5/4 Eb5/4',
        'G5/2. r/4',
        'Ab5/2 r/8 F5/8 G5/8 Ab5/8',       // 和第 1 小节同样的节奏，高一级
        'Bb5/4. D6/8 Bb5/2',
        'r/4 Eb6/8 D6/8 C6/4 Ab5/4',
        'F5/2 D5/4 r/4',                    // 停在属和弦的五音上，接回 A'
      ],
      harm: [
        '[Bb3 C4 Eb4 G4]/1', '[G3 Bb3 D4 F4]/1', '[Ab3 C4 Eb4]/1', '[Eb3 G3 Bb3 D4]/1',
        '[F3 Ab3 C4 Eb4]/1', '[G3 Bb3 D4 F4]/1', '[Ab3 C4 Eb4 Bb4]/1', '[Bb3 D4 F4]/1',
      ],
      arp: [
        'r/4 G6/8 Eb6/8 r/2',
        'r/2 r/4 D6/8 F6/8',
        'G6/8 Eb6/8 r/4 r/2',
        'r/4 D6/8 Bb5/8 D6/4 G6/4',
        'r/4 C6/8 Ab5/8 r/2',
        'r/2 r/4 F6/8 D6/8',
        'C6/8 Eb6/8 r/4 r/2',
        'r/4 F6/8 D6/8 Bb5/4 r/4',
      ],
      bass: [
        'C3/2 G2/4 Bb2/4', 'G2/2 D3/4 G2/4', 'Ab2/2 Eb3/4 C3/4', 'Eb2/2 Bb2/4 G2/4',
        'F2/2 Ab2/4 C3/4', 'G2/2 D3/4 G2/4', 'Ab2/2 Eb3/4 Ab2/4', 'Bb2/4. Bb2/8 r/4 F2/8 Bb2/8',
      ],
      drums: [
        'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.o.',
        'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.k.h.h.s.o.',
      ],
    },
    A2: {
      lead: [
        'r/4 Eb5/8 C5/8 Eb5/4. F5/8',
        'G5/4 r/4 r/2',
        'r/4 C5/8 Ab4/8 C5/4. Eb5/8',
        'Bb4/2. r/4',
        'r/4 Eb5/8 C5/8 Eb5/4. G5/8',
        'Bb5/4 G5/8 F5/8 D5/4 r/4',        // 变化：往下走
        'C5/4. Eb5/8 Ab4/4 r/4',
        'Bb4/2. r/4',                       // 停在 Gm7 的三音，接回 A 开头的 Abmaj7
      ],
      harm: [
        '[Ab3 C4 Eb4 G4]/1', '[G3 Bb3 D4 F4]/1', '[F3 Ab3 C4 Eb4]/1', '[Eb3 G3 Bb3 D4]/1',
        '[Ab3 C4 Eb4 G4]/1', '[G3 Bb3 D4 F4]/1', '[F3 Ab3 C4 Eb4]/1', '[G3 Bb3 D4 F4]/1',
      ],
      arp: [
        'r/1',
        'r/4 D6/8 Bb5/8 D6/4 r/4',
        'r/1',
        'r/4 Bb5/8 G5/8 Bb5/4 D6/4',
        'r/1',
        'r/1',
        'r/2 r/4 Eb6/8 C6/8',
        'r/4 D6/8 Bb5/8 D6/4 F6/4',         // 回声把人带回开头
      ],
      bass: [
        'Ab2/4. Ab2/8 r/4 Eb3/8 Ab2/8', 'G2/4. G2/8 r/4 D3/8 G2/8', 'F2/4. F2/8 r/4 C3/8 F2/8', 'Eb2/4. Eb2/8 r/4 Bb2/8 G2/8',
        'Ab2/4. Ab2/8 r/4 Eb3/8 Ab2/8', 'G2/4. G2/8 r/4 D3/8 G2/8', 'F2/4. F2/8 r/4 C3/8 Ab2/8', 'G2/4. G2/8 r/4 D3/8 G2/8',
      ],
      drums: [
        'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.o.',
        'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.h.', 'k.h.s.k.h.h.s.ks',
      ],
    },
  },
  order: ['I', 'A', 'B', 'A2'],
};
