#!/bin/bash
# ============================================================
#  HumanPhys 网页 —— 本地启动脚本（macOS / Linux）
#
#  · macOS  : 双击本文件即可（首次可能需右键 → 打开）
#  · Linux  : 在终端执行  bash start-mac-linux.command
#
#  它会自动挑一个空闲端口、打印本机与同网段地址、并打开浏览器。
#  停止服务：按 Ctrl+C
# ============================================================

cd "$(dirname "$0")" || {
    echo "无法进入脚本所在目录，请把本文件放在 index.html 同一目录下。"
    read -r -p "按回车退出..." _
    exit 1
}

if [ ! -f index.html ]; then
    echo "错误：当前目录下找不到 index.html"
    echo "请确认本脚本与 index.html 放在同一个文件夹里。"
    read -r -p "按回车退出..." _
    exit 1
fi

# ---------- 找一个可用端口（8080 起，最多试到 8090）----------
PORT=8080
while [ "$PORT" -le 8090 ]; do
    if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        break
    fi
    PORT=$((PORT + 1))
done

if [ "$PORT" -gt 8090 ]; then
    echo "8080-8090 端口都被占用了。"
    echo "请先关闭占用端口的程序，或手动执行：python3 -m http.server 9000"
    read -r -p "按回车退出..." _
    exit 1
fi

# ---------- 找 Python ----------
PY=""
for c in python3 python; do
    if command -v "$c" >/dev/null 2>&1; then
        PY="$c"
        break
    fi
done

if [ -z "$PY" ]; then
    echo "==========================================================="
    echo " 未找到 Python，无法启动本地服务器。"
    echo ""
    echo " 但不要紧 —— 直接双击本文件夹里的 index.html"
    echo " 就能用浏览器打开，效果完全一样，不需要 Python。"
    echo "==========================================================="
    read -r -p "按回车退出..." _
    exit 1
fi

# ---------- 取本机局域网 IP ----------
IP=""
if command -v ipconfig >/dev/null 2>&1; then
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$IP" ] && command -v hostname >/dev/null 2>&1; then
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

echo "==========================================================="
echo "  HumanPhys 网页已启动"
echo "-----------------------------------------------------------"
echo "  本机访问     : http://127.0.0.1:$PORT"
if [ -n "$IP" ]; then
echo "  同网段访问   : http://$IP:$PORT"
else
echo "  同网段访问   : （未取到本机 IP，可在系统设置里查看）"
fi
echo "-----------------------------------------------------------"
echo "  停止服务     : 按 Ctrl+C"
echo "==========================================================="
echo ""

# ---------- 自动打开浏览器 ----------
if command -v open >/dev/null 2>&1; then
    open "http://127.0.0.1:$PORT" >/dev/null 2>&1
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:$PORT" >/dev/null 2>&1
fi

# ---------- 启动服务器（前台运行，Ctrl+C 结束）----------
exec "$PY" -m http.server "$PORT" --bind 0.0.0.0
