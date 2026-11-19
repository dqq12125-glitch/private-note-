# 回声岛 · 老板自己把 App Store Connect 的上传密钥存进 GitHub 的小窗口（ios/README.md 里 TestFlight 那几步用）：
# 密钥文件的内容直接从文件交给 gh，谁都不用复制、不打印、不落盘，只告诉你存好了哪几个。
# 从收银 App 那个仓库的 rw-pos/scripts/ios-secrets-dialog.ps1 抄过来，默认填好了这个仓库和 Echo of Forest 的 Team ID。
# 运行：pwsh -NoProfile -STA -File tools/ios-secrets-dialog.ps1   （要 PowerShell 7 的 pwsh；gh 已经登录）
param([string]$Repo = "dqq12125-glitch/private-note-", [string]$TeamId = "8DC33LZZ4G", [string]$IssuerId = "")
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$downloads = Join-Path $env:USERPROFILE "Downloads"
$found = Get-ChildItem $downloads -Filter "AuthKey_*.p8" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

$form = New-Object System.Windows.Forms.Form
$form.Text = "App Store Connect 密钥"
$form.ClientSize = New-Object System.Drawing.Size(520, 320)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.TopMost = $true
$form.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 10)

function Add-Label($text, $y) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Location = New-Object System.Drawing.Point(20, $y)
  $l.Size = New-Object System.Drawing.Size(480, 24)
  $form.Controls.Add($l)
}
function Add-Box($y) {
  $b = New-Object System.Windows.Forms.TextBox
  $b.Location = New-Object System.Drawing.Point(20, $y)
  $b.Size = New-Object System.Drawing.Size(480, 28)
  $form.Controls.Add($b)
  return $b
}

Add-Label "密钥文件（从 App Store Connect 下载的 .p8）" 14
$file = Add-Box 40
if ($found) { $file.Text = $found.FullName }
Add-Label "Key ID（文件名里的那段，已自动填好）" 76
$keyId = Add-Box 102
if ($found -and $found.Name -match '^AuthKey_([A-Z0-9]+)\.p8$') { $keyId.Text = $Matches[1] }
Add-Label "Issuer ID（App Store Connect 密钥列表上方的一串）" 138
$issuer = Add-Box 164
$issuer.Text = $IssuerId

$ok = New-Object System.Windows.Forms.Button
$ok.Text = "存进 GitHub"
$ok.Location = New-Object System.Drawing.Point(350, 206)
$ok.Size = New-Object System.Drawing.Size(150, 42)
$form.Controls.Add($ok)
$form.AcceptButton = $ok

$state = New-Object System.Windows.Forms.Label
$state.Location = New-Object System.Drawing.Point(20, 258)
$state.Size = New-Object System.Drawing.Size(480, 50)
$form.Controls.Add($state)

$ok.Add_Click({
  $path = $file.Text.Trim()
  $k = $keyId.Text.Trim()
  $i = $issuer.Text.Trim()
  if (-not (Test-Path $path) -or $path -notmatch '\.p8$') { $state.Text = "找不到 .p8 文件"; return }
  if ($k -notmatch '^[A-Z0-9]{10}$') { $state.Text = "Key ID 应该是 10 位字母数字"; return }
  if ($i -notmatch '^[0-9a-fA-F-]{36}$') { $state.Text = "Issuer ID 的格式不对"; return }
  $ok.Enabled = $false
  $state.Text = "正在保存…"
  $form.Refresh()
  $set = {
    param($name, $value)
    $value | & gh secret set $name --repo $Repo 2>$null
    return $LASTEXITCODE -eq 0
  }
  $done = (& $set "ASC_KEY_P8" (Get-Content -Raw $path)) -and (& $set "ASC_KEY_ID" $k) -and (& $set "ASC_ISSUER_ID" $i) -and (& $set "APPLE_TEAM_ID" $TeamId)
  if ($done) {
    $state.Text = "4 个密钥都存好了，可以关掉这个窗口。"
  } else {
    $ok.Enabled = $true
    $state.Text = "保存失败，请告诉 Claude。"
  }
})

[void]$form.ShowDialog()
