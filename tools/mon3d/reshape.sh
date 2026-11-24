#!/bin/bash
# 把「纸片一样扁」的怪兽重新生成成立体的（2026-11-24，老板：「怪物的模型还是像纸片人一样」）。
#   bash tools/mon3d/reshape.sh <标签> <id> [id ...]           形状用补了明暗的图（puff.py），贴图用原画
#   SEEDS=7,1,3 K=1.6 MIN=0.40 bash tools/mon3d/reshape.sh p2 <id> ...   换种子、明暗重一点、及格线
# 一步步：① 原画（art/gemini/cut2，没有就用 cut）抄到 art/gemini/src1 ② puff.py 补明暗 → art/gemini/puff
#        ③ gen.py 生成形状（每只最多试 SEEDS 这几个种子，按主成分量厚度，挑最厚的）→ art/hy3d/<id>_shape_<标签>.glb
#        ④ 厚度够 MIN 的才贴图（用原画）→ art/hy3d/<id>_raw_<标签>.glb
# 不动 art/hy3d/<id>_raw.glb、不绑骨骼、不发布：出来的先看过，再换上去（见 tools/mon3d/RESHAPE.md）。
# 结果记在 art/hy3d/reshape-<标签>.txt：每只一行「id 厚度 种子 ok / flat」
PY=/d/Claude/tools/hy3d/Scripts/python
cd "$(dirname "$0")/../.." || exit 1
TAG="$1"; shift
[ -z "$TAG" ] || [ $# -eq 0 ] && { echo "用法：bash tools/mon3d/reshape.sh <标签> <id> [id ...]"; exit 2; }
SEEDS="${SEEDS:-21,42,5}"; K="${K:-1.0}"; MIN="${MIN:-0.40}"
mkdir -p art/gemini/src1 art/gemini/puff
ids=()
for id in "$@"; do
  if [ -f "art/gemini/cut2/$id.png" ]; then cp "art/gemini/cut2/$id.png" "art/gemini/src1/$id.png"; ids+=("$id")
  elif [ -f "art/gemini/cut/$id.png" ]; then cp "art/gemini/cut/$id.png" "art/gemini/src1/$id.png"; ids+=("$id")
  else echo "没有原画：$id"; fi
done
[ ${#ids[@]} -eq 0 ] && exit 1
LOG="art/hy3d/reshape-$TAG.log"; OUT="art/hy3d/reshape-$TAG.txt"
echo "reshape $TAG：${#ids[@]} 只，种子 $SEEDS，明暗 $K，及格线 $MIN" | tee -a "$LOG"
$PY tools/mon3d/puff.py "${ids[@]}" --src=src1 --out=puff --k="$K" >> "$LOG" 2>&1 || { echo "puff 出错，看 $LOG"; exit 1; }
# --ok：够及格线就不再试别的种子（省一半时间）；--skipdone：已经有这个标签的白模的不重做（中断了接着跑）
$PY tools/mon3d/gen.py "${ids[@]}" --src=puff --notex --pca --seeds="$SEEDS" --tag="$TAG" --ok="$MIN" --skipdone >> "$LOG" 2>&1
# 「shape <id> <面数> faces seed <种子> thick <厚度> <秒> s」
ok=()
for id in "${ids[@]}"; do
  line=$(grep -a "^shape $id " "$LOG" | tail -1)
  th=$(echo "$line" | sed -n 's/.* thick \([0-9.]*\) .*/\1/p'); sd=$(echo "$line" | sed -n 's/.* seed \([0-9]*\) .*/\1/p')
  if [ -z "$th" ]; then echo "$id - - fail" >> "$OUT"; continue; fi
  if awk "BEGIN{exit !($th >= $MIN)}"; then echo "$id $th $sd ok" >> "$OUT"; ok+=("$id"); else echo "$id $th $sd flat" >> "$OUT"; fi
done
echo "形状做完：够厚的 ${#ok[@]} 只 / ${#ids[@]} 只" | tee -a "$LOG"
[ ${#ok[@]} -eq 0 ] && exit 0
$PY tools/mon3d/gen.py "${ok[@]}" --noshape --src=src1 --tag="$TAG" >> "$LOG" 2>&1
echo "贴图做完：$(grep -a -c "^paint " "$LOG") 只" | tee -a "$LOG"
