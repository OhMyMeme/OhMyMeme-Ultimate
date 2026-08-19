# Auth & security verification against the running rust-server (port 3000)
# Reads ACCESS_TOKEN from rust-server/.env (never printed)
$ErrorActionPreference = "Continue"
$base = "http://127.0.0.1:3000"
$results = [System.Collections.Generic.List[string]]::new()
function Check($name, $cond, $detail = "") {
  $mark = if ($cond) { "PASS" } else { "FAIL" }
  $results.Add("[$mark] $name $detail")
  Write-Host "[$mark] $name $detail"
}
function StatusOf($scriptBlock) {
  try { & $scriptBlock | Out-Null; return 200 } catch { return $_.Exception.Response.StatusCode.value__ }
}

$rust = Get-Content "rust-server\.env" | Where-Object { $_ -match '^ACCESS_TOKEN=' }
$accessToken = ($rust -split '=', 2)[1].Trim()

# 1. unauthenticated access to protected API
$c1 = StatusOf { Invoke-WebRequest -Uri "$base/api/groups" -TimeoutSec 8 -UseBasicParsing }
Check "未登录访问 /api/groups -> 401" ($c1 -eq 401) "got=$c1"

# 2. unauthenticated access to protected API via query without token
$c2 = StatusOf { Invoke-WebRequest -Uri "$base/api/overview" -TimeoutSec 8 -UseBasicParsing }
Check "未登录访问 /api/overview -> 401" ($c2 -eq 401) "got=$c2"

# 3. public endpoints stay open
$c3 = StatusOf { Invoke-WebRequest -Uri "$base/api/health" -TimeoutSec 8 -UseBasicParsing }
Check "公开 /api/health 可匿名访问 -> 200" ($c3 -eq 200) "got=$c3"
$c3b = StatusOf { Invoke-WebRequest -Uri "$base/api/auth/status" -TimeoutSec 8 -UseBasicParsing }
Check "公开 /api/auth/status 可匿名访问 -> 200" ($c3b -eq 200) "got=$c3b"

# 4. wrong access key login
$wrongBody = [Text.Encoding]::UTF8.GetBytes('{"token":"definitely-wrong-key-123"}')
$c4 = StatusOf { Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body $wrongBody -TimeoutSec 8 -UseBasicParsing }
Check "错误访问密钥登录 -> 401" ($c4 -eq 401) "got=$c4"

# 5. correct login
$loginRes = Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes((@{ token = $accessToken } | ConvertTo-Json -Compress))) -TimeoutSec 8 -UseBasicParsing
$login = $loginRes.Content | ConvertFrom-Json
Check "正确访问密钥登录 -> 200 + token" ($loginRes.StatusCode -eq 200 -and $login.token.Length -gt 50) "token len=$($login.token.Length)"
$sessionToken = $login.token

# 6. Bearer token works
$c6 = StatusOf { Invoke-WebRequest -Uri "$base/api/groups" -Headers @{ Authorization = "Bearer $sessionToken" } -TimeoutSec 8 -UseBasicParsing }
Check "Bearer 会话令牌访问 /api/groups -> 200" ($c6 -eq 200) "got=$c6"

# 7. invalid Bearer token rejected
$c7 = StatusOf { Invoke-WebRequest -Uri "$base/api/groups" -Headers @{ Authorization = "Bearer invalid-token" } -TimeoutSec 8 -UseBasicParsing }
Check "无效 Bearer 令牌 -> 401" ($c7 -eq 401) "got=$c7"

# 8. image URL without token -> 401 (auth gate fires before file read)
$memes = Invoke-RestMethod -Uri "$base/api/memes?limit=5" -Headers @{ Authorization = "Bearer $sessionToken" } -TimeoutSec 8
$memeId = if ($memes.items.Count -gt 0) { $memes.items[0].id } else { $null }
if ($memeId) {
  $c8 = StatusOf { Invoke-WebRequest -Uri "$base/api/memes/$memeId/thumb" -TimeoutSec 8 -UseBasicParsing }
  Check "图片 URL 不带 token -> 401（鉴权先于文件读取）" ($c8 -eq 401) "got=$c8"

  # 9. image URL with ?token= -> passes auth (404 here means file missing = the known data issue, NOT auth)
  $c9 = StatusOf { Invoke-WebRequest -Uri "$base/api/memes/$memeId/thumb?token=$sessionToken" -TimeoutSec 8 -UseBasicParsing }
  Check "图片 URL 带 ?token= -> 通过鉴权（非 401 即鉴权 OK；404 为已知文件缺失）" ($c9 -ne 401) "got=$c9"
} else {
  Check "取到一个 meme 用于图片鉴权验证" $false "无 meme 记录"
}

# 10. rate limit: 6 wrong logins -> 6th returns 429 (do this last; locks login for 60s)
Write-Host ""
Write-Host "[i] 限流测试会触发登录锁定 60 秒（这是预期行为）..."
$codes = @()
for ($i = 0; $i -lt 6; $i++) {
  $code = StatusOf { Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body $wrongBody -TimeoutSec 8 -UseBasicParsing }
  $codes += $code
}
Check "登录限流：6 次错误后第 6 次 -> 429" ($codes[5] -eq 429) ("codes=" + ($codes -join ","))

Write-Host "`n===== SUMMARY ====="
$fail = ($results | Where-Object { $_ -like "*[FAIL]*" }).Count
Write-Host "FAIL count: $fail"
$results | Where-Object { $_ -like "*[FAIL]*" } | ForEach-Object { Write-Host $_ }
