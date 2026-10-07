// 训练师对战（Trainer Battle）
// 在哪里放：训练师、对手、嘘声团团员的战斗
// 情绪：比野生战更有对抗感——C 小调，164 bpm，旋律用切分（第二拍前半拍就抢进来），低音是 GB 波形的「马蹄」节奏（八分 + 两个十六分）
// 结构：I(2) A(8) B(8) A2(8) C(8) → 回 A（循环 32 小节 ≈ 47 秒）
//   I  ：第 1 小节两下重击 Cm、Db（那不勒斯和弦，「来者不善」）；第 2 小节三下半音往上顶的断奏重击 G7 → G7(b9) → G7，
//        最后 D–F 两个八分接进主题（三首战斗曲的前奏各不相同：野生战琶音冲上去、这首是重击、决战是铜管 + 同音震音）
//   A  ：Cm | Cm | Ab | Bb | Cm | Cm | Ab | G —— 主题「三步上去、切分落下」，和声是 3+3+2 的方波断奏；
//        第 8 小节第四拍落在导音 B（和断奏和弦同音），再一个四度接到 B 段的 C6
//   B  ：Ab | Bb | Gm | Cm | Fm | Bb | Eb | G —— 对比段：旋律长音往下走，和声改成一条和旋律反向的四分音符副旋律
//   A2 ：A 的前五小节 + 往上走的后三小节（最高到 Eb6，不在 G6 上长时间尖叫），十六分琶音放在旋律下面一个八度；
//        最后一个 Eb5 一步接到 C 段的 F5
//   C  ：Fm | G | Cm | Cm | Fm | G | Ab | G —— 「追逐」段：两个方波平行六度齐奏（双吉他式），嗵鼓多；
//        最后一小节两个声部一起往下走（还是六度），旋律 D5 一步接回 A 的 Eb5
// 鼓：每八小节的句尾是这首的招牌「齐停」——鼓和 3+3+2 的断奏和弦一起砸三下然后空掉（k.....s.....s...），和野生战、决战区分开
// 和声：小调 i–VI–VII、iv–V，B 段 VI–VII–v–i；G 和弦里的还原 B 是故意的导音（调外音主要来自它和 Db）
// 回声主题：不用
// 原创检查：A 第 1–2 小节 Eb F G Bb~ Ab G | F G Eb C~——音程 +2 +2 +3 -2 -1 | -2 +2 -4 -3，节奏 八分×3、切分四分、八分、四分 | 八分×3、附点四分、休止；
//   开头 3-4-5 一步步上去和《两只老虎》第二句（3-4-5）有点像，但这里第四个音是切分抢进来的降七级 Bb（不是停在 5 上），
//   后面也不是 5-6-5-4-3-1；没有「do do sol」（小星星）开头，和现成游戏的训练师战、其他名曲的开头都不一样。

const up = n => n.replace(/(-?\d)$/, d => +d + 1);                                                    // 升八度
const gal = r => Array(2).fill(`${r}/8 ${r}/16 ${r}/16 ${up(r)}/8 ${r}/16 ${r}/16`).join(' ');         // 马蹄低音
const eight = r => `${r}/8 ${r}/8 ${up(r)}/8 ${r}/8 ${r}/8 ${r}/8 ${up(r)}/8 ${r}/8`;                  // 直八分低音
const hit = c => `${c}/8^ r/4 ${c}/8^ r/4 ${c}/8^ r/8`;                                                 // 3+3+2 断奏
const a16 = (a, b, c) => Array(4).fill(`${a}/16 ${c}/16 ${b}/16 ${c}/16`).join(' ');                    // 十六分琶音

const Cm = '[C4 Eb4 G4]', Ab = '[C4 Eb4 Ab4]', Bb = '[D4 F4 Bb4]', G = '[B3 D4 G4]';

const t1 = 'k.hhs.h.k.hhs.hk', t2 = 'k.hhs.hkk.hhs.h.', tc = 'c.hhs.h.k.hhs.hk';
const ct = 'k.hhs.hTk.hhs.tt';
const stop = 'k.....s.....s...';                                                                       // 招牌句尾：和 3+3+2 断奏一起砸三下，然后空掉

module.exports = {
  id: 'battle_trainer',
  title: 'Trainer Battle',
  zh: '训练师对战',
  use: '训练师、对手、嘘声团团员的战斗',
  bpm: 164,
  meter: 4,
  key: 'C', mode: 'minor',
  loop: true,
  loopFrom: 1,
  swing: 0,
  drumGrid: 4,
  inst: { lead: 'pulse50', harm: 'pulse25', arp: 'pulse12', bass: 'wave' },
  mix: { lead: 0.85, harm: 0.45, arp: 0.28, bass: 0.9, drums: 0.65 },
  fx: { echo: 0.1 },
  sections: {
    I: {
      lead: [
        'C5/8! r/8 r/4 Db5/8! r/8 r/4',
        'G5/8! r/8 Ab5/8! r/8 B5/8! r/8 D5/8 F5/8',        // 半音往上顶的三下重击，D–F 接进主题的 Eb
      ],
      harm: [
        `${Cm}/8^ r/8 r/4 [Db4 F4 Ab4]/8^ r/8 r/4`,
        '[G3 B3 D4 F4]/8^ r/8 [Ab3 B3 D4 F4]/8^ r/8 [B3 D4 F4 G4]/8^ r/8 r/4',
      ],
      bass: [
        'C2/8^ r/8 r/4 Db2/8^ r/8 r/4',
        'G1/8! r/8 G1/8! r/8 G1/8! r/8 G1/16 G1/16 G1/16 G1/16',
      ],
      drums: [
        'c.......c.......',
        'c...c...c...TTtt',
      ],
    },
    A: {
      lead: [
        'Eb5/8 F5/8 G5/8 Bb5/4 Ab5/8 G5/4',               // Cm  三步上去，切分
        'F5/8 G5/8 Eb5/8 C5/4. r/4',                       // Cm  落下
        'Eb5/8 F5/8 Ab5/8 C6/4 Bb5/8 Ab5/4',               // Ab  同样的节奏，更高
        'G5/8 Ab5/8 F5/8 D5/4. r/4',                       // Bb
        'Eb5/8 F5/8 G5/8 Bb5/4 Ab5/8 G5/4',               // Cm
        'Bb5/8 C6/8 G5/8 Eb5/4. r/4',                      // Cm
        'F5/8 G5/8 Ab5/8 C6/4 Bb5/8 Ab5/8 F5/8',           // Ab
        'G5/4. F5/8 Eb5/8 D5/8 B4/8 G5/8',                 // G   第四拍 B 和断奏同音，G → B 段的 C6
      ],
      harm: [hit(Cm), hit(Cm), hit(Ab), hit(Bb), hit(Cm), hit(Cm), hit(Ab), hit(G)],
      bass: [gal('C2'), gal('C2'), gal('Ab1'), gal('Bb1'), gal('C2'), gal('C2'), gal('Ab1'), gal('G1')],
      drums: [tc, t1, t2, t1, t1, t2, t1, stop],
    },
    B: {
      lead: [
        'C6/2 Bb5/4 Ab5/4',                                // Ab
        'D6/2 C6/4 Bb5/4',                                 // Bb  模进
        'Bb5/4. G5/8 D5/2',                                // Gm
        'Eb5/2. F5/8 G5/8',                                // Cm
        'Ab5/4. G5/8 F5/2',                                // Fm
        'F5/4. Eb5/8 D5/2',                                // Bb
        'Eb5/4. F5/8 G5/4 Bb5/4',                          // Eb
        'B5/2 G5/4 D5/4',                                  // G
      ],
      harm: [                                              // 和旋律反向走的副旋律
        'Eb4/4 F4/4 G4/4 Ab4/4',
        'F4/4 G4/4 Ab4/4 Bb4/4',
        'D5/4 C5/4 Bb4/2',
        'G4/2 C5/4 D5/4',
        'C5/4 Bb4/4 Ab4/4 G4/4',
        'D5/4 C5/4 Bb4/4 Ab4/4',
        'G4/4 Ab4/4 Bb4/4 C5/4',
        'D5/4 F5/4 G4/4 B4/4',
      ],
      bass: [eight('Ab1'), eight('Bb1'), eight('G1'), eight('C2'), eight('F1'), eight('Bb1'), eight('Eb2'), eight('G1')],
      drums: [tc, t1, t1, t2, tc, t1, t1, stop],
    },
    A2: {
      lead: [
        'Eb5/8 F5/8 G5/8 Bb5/4 Ab5/8 G5/4',
        'F5/8 G5/8 Eb5/8 C5/4. r/4',
        'Eb5/8 F5/8 Ab5/8 C6/4 Bb5/8 Ab5/4',
        'G5/8 Ab5/8 F5/8 D5/4. r/4',
        'Eb5/8 F5/8 G5/8 Bb5/4 Ab5/8 G5/4',
        'Bb5/8 C6/8 Eb6/8 C6/4 Bb5/8 G5/4',                // Cm  往上走，每个断奏上都是和弦音
        'Eb6/8 C6/8 Ab5/8 Eb5/4 Ab5/8 C6/4',               // Ab
        'D6/4. B5/8 G5/8 F5/8 D5/8 Eb5/8',                 // G   Eb5 一步接到 C 段的 F5
      ],
      harm: [hit(Cm), hit(Cm), hit(Ab), hit(Bb), hit(Cm), hit(Cm), hit(Ab), hit(G)],
      arp: [                                               // 放在旋律下面一个八度
        a16('C4', 'Eb4', 'G4'), a16('C4', 'Eb4', 'G4'), a16('Ab3', 'C4', 'Eb4'), a16('Bb3', 'D4', 'F4'),
        a16('C4', 'Eb4', 'G4'), a16('C4', 'Eb4', 'G4'), a16('Ab3', 'C4', 'Eb4'), a16('G3', 'B3', 'D4'),
      ],
      bass: [gal('C2'), gal('C2'), gal('Ab1'), gal('Bb1'), gal('C2'), gal('C2'), gal('Ab1'), gal('G1')],
      drums: [tc, t1, t2, t1, tc, t2, t1, stop],
    },
    C: {
      lead: [
        'F5/8 Ab5/8 G5/8 F5/8 Ab5/8 C6/8 Bb5/8 Ab5/8',     // Fm  追逐
        'B5/8 D6/8 C6/8 B5/8 G5/4 D5/4',                   // G
        'C6/8 Eb6/8 D6/8 C6/8 G5/8 Bb5/8 Ab5/8 G5/8',      // Cm
        'Eb5/4. D5/8 C5/2',                                // Cm
        'F5/8 Ab5/8 G5/8 F5/8 Ab5/8 C6/8 Bb5/8 Ab5/8',     // Fm
        'B5/8 D6/8 C6/8 B5/8 D6/8 F6/8 Eb6/8 D6/8',        // G   这次往上
        'C6/4. Bb5/8 Ab5/4 Eb5/4',                         // Ab
        'G5/4. F5/8 Eb5/8 D5/8 C5/8 D5/8',                 // G   D5 一步接回 A 的 Eb5
      ],
      harm: [                                              // 低六度平行（两个方波齐奏）
        'Ab4/8 C5/8 Bb4/8 Ab4/8 C5/8 Eb5/8 D5/8 C5/8',
        'D5/8 F5/8 Eb5/8 D5/8 B4/4 G4/4',
        'Eb5/8 G5/8 F5/8 Eb5/8 Bb4/8 D5/8 C5/8 Bb4/8',
        'G4/4. F4/8 Eb4/2',
        'Ab4/8 C5/8 Bb4/8 Ab4/8 C5/8 Eb5/8 D5/8 C5/8',
        'D5/8 F5/8 Eb5/8 D5/8 F5/8 Ab5/8 G5/8 F5/8',
        'Eb5/4. D5/8 C5/4 Ab4/4',
        'B4/4. Ab4/8 G4/8 F4/8 Eb4/8 B3/8',                // 和旋律一起往下走，还是六度
      ],
      bass: [gal('F1'), gal('G1'), gal('C2'), gal('C2'), gal('F1'), gal('G1'), gal('Ab1'), gal('G1')],
      drums: [tc, ct, t1, ct, tc, ct, t1, stop],
    },
  },
  order: ['I', 'A', 'B', 'A2', 'C'],
};
