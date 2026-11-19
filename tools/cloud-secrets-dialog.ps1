# 回声岛公开版服务器 · 老板自己把两把钥匙放进 Cloudflare 的小窗口（cloud/README.md「配置和秘密」）：
#   DASHSCOPE_API_KEY  阿里云百炼的钥匙（默认从本机那份钥匙文件里读 DASHSCOPE_API_KEY= 那一行，也可以直接粘贴）
#   RESEND_API_KEY     发登录验证码邮件用的 Resend 钥匙（粘贴）
# 钥匙从文件 / 输入框直接交给 wrangler，不打印、不落盘，只告诉你放好了哪几把。哪一栏空着就跳过哪一把。
# 运行：pwsh -NoProfile -STA -File tools/cloud-secrets-dialog.ps1   （要 PowerShell 7 的 pwsh；wrangler 已经登录）
param([string]$KeyFile = "D:\Claude\tools\echo-relay\game-key.env", [string]$CloudDir = (Join-Path $PSScriptRoot "..\cloud"))
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "回声岛服务器 · 钥匙"
$form.ClientSize = New-Object System.Drawing.Size(560, 400)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.TopMost = $true
$form.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 10)

function Add-Label($text, $y, $h = 24) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Location = New-Object System.Drawing.Point(20, $y)
  $l.Size = New-Object System.Drawing.Size(520, $h)
  $form.Controls.Add($l)
}
function Add-Box($y, $secret = $false) {
  $b = New-Object System.Windows.Forms.TextBox
  $b.Location = New-Object System.Drawing.Point(20, $y)
  $b.Size = New-Object System.Drawing.Size(520, 28)
  if ($secret) { $b.UseSystemPasswordChar = $true }
  $form.Controls.Add($b)
  return $b
}

Add-Label "① 阿里云百炼钥匙：从这个文件里读（现在家里用的那把）" 14
$file = Add-Box 40
if (Test-Path $KeyFile) { $file.Text = $KeyFile }
Add-Label "   或者直接粘贴一把（粘贴了就用粘贴的；显示成圆点）" 74
$dsPaste = Add-Box 100 $true

Add-Label "② Resend 钥匙（发登录验证码邮件）：resend.com → API Keys → 新建一把，粘贴在这里" 146 44
$resend = Add-Box 192 $true

$ok = New-Object System.Windows.Forms.Button
$ok.Text = "放进 Cloudflare"
$ok.Location = New-Object System.Drawing.Point(370, 244)
$ok.Size = New-Object System.Drawing.Size(170, 42)
$form.Controls.Add($ok)
$form.AcceptButton = $ok

$state = New-Object System.Windows.Forms.Label
$state.Location = New-Object System.Drawing.Point(20, 300)
$state.Size = New-Object System.Drawing.Size(520, 90)
$form.Controls.Add($state)

function Put-Secret($name, $value) {
  Push-Location $CloudDir
  try { $value | & npx wrangler secret put $name *> $null; return $LASTEXITCODE -eq 0 } finally { Pop-Location }
}

$ok.Add_Click({
  $ds = $dsPaste.Text.Trim()
  if (-not $ds -and $file.Text.Trim()) {
    $path = $file.Text.Trim()
    if (-not (Test-Path $path)) { $state.Text = "找不到钥匙文件"; return }
    $line = Get-Content $path | Where-Object { $_ -match '^\s*DASHSCOPE_API_KEY\s*=' } | Select-Object -First 1
    if ($line) { $ds = ($line -replace '^\s*DASHSCOPE_API_KEY\s*=\s*', '').Trim().Trim('"').Trim("'") }
    if (-not $ds) { $state.Text = "钥匙文件里没有 DASHSCOPE_API_KEY= 那一行"; return }
  }
  $rs = $resend.Text.Trim()
  if (-not $ds -and -not $rs) { $state.Text = "两栏都是空的"; return }
  if ($ds -and $ds -notmatch '^sk-[A-Za-z0-9_-]{16,}$') { $state.Text = "阿里云钥匙应该是 sk- 开头的一长串"; return }
  if ($rs -and $rs -notmatch '^re_[A-Za-z0-9_-]{8,}$') { $state.Text = "Resend 钥匙应该是 re_ 开头的"; return }
  $ok.Enabled = $false
  $state.Text = "正在放（每把十几秒）…"
  $form.Refresh()
  $done = @(); $bad = @()
  if ($ds) { if (Put-Secret "DASHSCOPE_API_KEY" $ds) { $done += "阿里云钥匙" } else { $bad += "阿里云钥匙" } }
  if ($rs) { if (Put-Secret "RESEND_API_KEY" $rs) { $done += "Resend 钥匙" } else { $bad += "Resend 钥匙" } }
  $dsPaste.Text = ""; $resend.Text = ""
  $msg = ""
  if ($done.Count) { $msg += "放好了：" + ($done -join "、") + "。" }
  if ($bad.Count) { $msg += " 没放上去：" + ($bad -join "、") + "，请告诉 Claude。"; $ok.Enabled = $true }
  if (-not $bad.Count) { $msg += " 可以关掉这个窗口。" }
  $state.Text = $msg
})

[void]$form.ShowDialog()
