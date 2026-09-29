# 标骨骼助手（给子代理用）
#   bash tools/mon3d/rigtool.sh grid <id> [yaw] [thick]  → art/hy3d/grid/<id>.png（坐标网格参考图，按 yaw/thick 摆正后）
#   bash tools/mon3d/rigtool.sh rig <id>                  → 读 tools/mon3d/rigs/<id>.json 绑骨骼做动作导出 art/mon3d/<id>.glb，再出检查图 art/mon3d/check/<id>.png
B=/d/Claude/tools/blender-5.2.1-windows-x64/blender.exe
R=D:/Claude/echo-island
cd /d/Claude/echo-island
mkdir -p art/hy3d/grid art/mon3d/check
case "$1" in
  grid) "$B" -b --factory-startup --python tools/blender/gridview.py -- $R/art/hy3d/$2_raw.glb $R/art/hy3d/grid/$2.png ${3:-0} ${4:-1} 2>&1 | grep -E "Traceback|Error" | head -5; ls art/hy3d/grid/$2.png ;;
  rig) "$B" -b --factory-startup --python tools/blender/monrig.py -- $2 2>&1 | grep -E "RIG|EXPORT|PARTS|CUTBASE|Traceback|Error" | head -8
       "$B" -b --factory-startup --python tools/blender/animsheet.py -- $R/art/mon3d/$2.glb $R/art/mon3d/check/$2.png mini 2>&1 | grep -E "Traceback" | head -3; ls art/mon3d/check/$2.png ;;
esac
