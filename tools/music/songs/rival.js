// 对手来啦！（Here Comes the Rival）
// 在哪里放：对手走过来打招呼、说话的时候
// 情绪：自信、俏皮、有点挑衅——Bb 混合利底亚（带降七级 Ab 的「拽」味），144 bpm 的 shuffle（三连音摇摆），
//       旋律故意落在反拍上「晃着走」，铜管在旋律的空档里「哼！哼！」地顶回去
//       swing 0.33：旋律的后半拍正好落在三连音的第三个位置，和 drumGrid 3 的镲对齐（0.3 会差 7 毫秒，听起来像拍子没对齐）
// 结构：I(1) A(8) B(8) A2(4) → 回 A（循环 20 小节 ≈ 33 秒；SPEC 说对手主题 20–40 秒的短循环也可以）
//   I  ：铜管 + 低音三下「登、登—登！」
//   A  ：Bb | Bb | Ab | Eb | Bb | Bb | Ab | F7 —— 主题：分解和弦往上一甩，降七级一拐再下来（第 1、3、5、7 小节），
//        下一小节两拍就收住，留两拍给铜管顶回去；I–bVII–IV 的摇滚式进行，F7 转回
//   B  ：Eb | Eb | Bb | G7 | Cm | F7 | Bb7 | F7 —— 「你追不上我」：旋律两拍挑衅、铜管两拍回嘴，G7 → Cm 是二级属和弦；
//        第 7 小节旋律第四拍落在 Ab，和低音一起成了 Bb7 → F7
//   A2 ：A 的前三小节 + F7 的转身小节，方波琶音放在旋律下面一个八度跟着晃（不重复旋律自己的分解和弦、不填满反拍的空档），接回 A
// 回声主题：不用
// 原创检查：A 第 1–2 小节 D F _ Bb _ Ab F D | F~ _ D C Bb——音程 +3 +5 -2 -3 -3 | -3 -2 -2，节奏 摇摆八分、第二拍和第三拍正拍空着（重音全在反拍）| 四分、休止、八分×3；
//   摇摆的 3-5-8 是通用的爵士手势（《In the Mood》是把 3-5-8 当切分反复，这里只往上甩一次、再从降七级下来）；
//   不是「sol-mi-la-sol-mi」那种儿歌式的嘲笑调，B 段的 Bb G _ Eb 是往下的分解和弦；和宝可梦对手主题、其他名曲都对不上。

const up = n => n.replace(/(-?\d)$/, d => +d + 1);
const kick = c => `r/4 r/8 ${c}/8^ r/4 r/8 ${c}/8^`;          // 铜管在反拍顶一下
const back = c => `r/4 r/8 ${c}/8^ r/4 ${c}/8^ ${c}/8^`;       // 旋律收住时铜管多顶两下
const ar = (a, b, c) => `${a}/8 ${b}/8 ${c}/8 ${b}/8 ${a}/8 ${b}/8 ${c}/8 ${up(a)}/8`;

const Bb = '[D4 F4 Bb4]', Ab = '[Eb4 Ab4 C5]', Eb = '[Eb4 G4 Bb4]', F7 = '[C4 Eb4 A4]';
const wBb = 'Bb1/4 Bb2/4 F2/4 Ab2/4', wAb = 'Ab1/4 C2/4 Eb2/4 F2/4', wEb = 'Eb2/4 G2/4 Bb2/4 G2/4', wF = 'F1/4 A1/4 C2/4 Eb2/4';

const s1 = 'k.hs.hk.hs.h', s2 = 'k.hs.hk.ks.h', sc = 'c.hs.hk.hs.h', sf = 's.ss.sTTtttt', sb = 'k.hs.hk.hs.s';

module.exports = {
  id: 'rival',
  title: 'Here Comes the Rival',
  zh: '对手来啦！',
  use: '对手走过来打招呼的时候',
  bpm: 144,
  meter: 4,
  key: 'Bb', mode: 'mixolydian',
  loop: true,
  loopFrom: 1,
  swing: 0.33,
  drumGrid: 3,
  inst: { lead: 'pulse25', harm: 'brass', arp: 'pulse12', bass: 'bass' },
  mix: { lead: 0.9, harm: 0.5, arp: 0.3, bass: 0.85, drums: 0.6 },
  fx: { echo: 0.15 },
  sections: {
    I: {
      harm: [`${Bb}/8! r/8 r/4 ${Ab}/8! r/8 ${Bb}/8! r/8`],
      bass: ['Bb1/8! r/8 r/4 Ab1/8! r/8 Bb1/8! r/8'],
      drums: ['c.....c..c..'],
    },
    A: {
      lead: [
        'D5/8 F5/8 r/8 Bb5/8 r/8 Ab5/8 F5/8 D5/8',         // Bb  一甩、一拐
        'F5/4 r/8 D5/8 C5/8 Bb4/8 r/4',                    // Bb  收住（铜管回嘴）
        'C5/8 Eb5/8 r/8 Ab5/8 r/8 G5/8 Eb5/8 C5/8',        // Ab  低一级再来
        'Eb5/4 r/8 C5/8 Bb4/8 G4/8 r/4',                   // Eb
        'D5/8 F5/8 r/8 Bb5/8 r/8 C6/8 Bb5/8 Ab5/8',        // Bb  这次甩得更高
        'F5/4 r/8 G5/8 Ab5/8 G5/8 F5/8 D5/8',              // Bb
        'Eb5/8 Ab5/8 r/8 C6/8 r/8 Bb5/8 Ab5/8 Eb5/8',      // Ab
        'F5/4. Eb5/8 C5/8 A4/8 C5/8 Eb5/8',                // F7
      ],
      harm: [kick(Bb), back(Bb), kick(Ab), back(Eb), kick(Bb), kick(Bb), kick(Ab), kick(F7)],
      bass: [wBb, wBb, wAb, wEb, wBb, wBb, wAb, wF],
      drums: [sc, s1, s2, s1, s1, s1, s2, sf],
    },
    B: {
      lead: [
        'Bb5/8 G5/8 r/8 Eb5/8 r/2',                        // Eb  挑衅……
        'C6/8 Bb5/8 r/8 G5/8 r/2',                         // Eb
        'D6/8 C6/8 Bb5/8 Ab5/8 F5/4 D5/4',                 // Bb
        'B4/8 D5/8 F5/8 Ab5/8 G5/4 r/4',                   // G7
        'Eb5/8 G5/8 r/8 Eb5/8 C5/4 r/4',                   // Cm
        'F5/8 A5/8 r/8 F5/8 C5/4 r/4',                     // F7
        'D5/8 F5/8 Bb5/8 D6/8 C6/8 Bb5/8 Ab5/8 F5/8',      // Bb7  第四拍 Ab 和低音同音
        'F5/4. Eb5/8 C5/8 A4/8 Bb4/8 C5/8',                // F7
      ],
      harm: [                                              // ……铜管回嘴
        'r/2 [G4 Bb4 Eb5]/8^ r/8 [G4 Bb4 Eb5]/8^ r/8',
        'r/2 [Ab4 C5 Eb5]/8^ r/8 [G4 Bb4 Eb5]/8^ r/8',
        kick(Bb),
        '[G3 B3 D4]/2 [G3 B3 D4 F4]/4^ r/4',
        'r/2 [G4 C5 Eb5]/8^ r/8 [G4 C5 Eb5]/8^ r/8',
        'r/2 [A4 C5 F5]/8^ r/8 [A4 C5 Eb5]/8^ r/8',
        kick(Bb),
        kick(F7),
      ],
      bass: [wEb, wEb, wBb, 'G1/4 B1/4 D2/4 F2/4', 'C2/4 Eb2/4 G2/4 Bb2/4', wF, wBb, wF],
      drums: [sc, sb, s1, sf, s1, sb, s1, sf],
    },
    A2: {
      lead: [
        'D5/8 F5/8 r/8 Bb5/8 r/8 Ab5/8 F5/8 D5/8',
        'F5/4 r/8 D5/8 C5/8 Bb4/8 r/4',
        'C5/8 Eb5/8 r/8 Ab5/8 r/8 G5/8 Eb5/8 C5/8',
        'Eb5/4 C5/8 A4/8 r/8 Bb4/8 C5/8 Eb5/8',            // F7  转身 → 接回 A 的 D5
      ],
      harm: [kick(Bb), back(Bb), kick(Ab), kick(F7)],
      arp: [ar('D4', 'F4', 'Bb4'), ar('D4', 'F4', 'Bb4'), ar('C4', 'Eb4', 'Ab4'), ar('C4', 'Eb4', 'A4')],   // 旋律下面一个八度
      bass: [wBb, wBb, wAb, wF],
      drums: [sc, s1, s2, sf],
    },
  },
  order: ['I', 'A', 'B', 'A2'],
};
