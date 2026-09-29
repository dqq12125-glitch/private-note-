# 打印家族 a..b 的精简参数：[编号, 阶段数, 各阶段描述]（画风说明和排版句子放在页面里的 __go() 拼）
import json, sys
F = {f['fam']: f for f in json.load(open('art/gemini/families.json', encoding='utf-8'))}
a, b = int(sys.argv[1]), int(sys.argv[2])
for k in range(a, b + 1):
    who = F[k]['prompt'].split('\n\n')[-1]
    print(json.dumps([k, len(F[k]['ids']), who], ensure_ascii=True))
