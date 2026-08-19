# Smoke test for rust-server API contract (runs against http://127.0.0.1:3100)
# Requires: server running, test db ohmymeme_rust_test (dropped before by caller)
$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:3100"
$results = [System.Collections.Generic.List[string]]::new()
function Check($name, $cond, $detail = "") {
  $mark = if ($cond) { "PASS" } else { "FAIL" }
  $results.Add("[$mark] $name $detail")
  Write-Host "[$mark] $name $detail"
}

$nuxt = Get-Content "..\nuxt-app\.env" | Where-Object { $_ -match '^NUXT_ACCESS_TOKEN=' }
$accessToken = ($nuxt -split '=', 2)[1].Trim()

# --- login ---
$bad = try { Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body '{"token":"wrong"}' -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "login wrong token -> 401" ($bad -eq 401)

$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes((@{ token = $accessToken } | ConvertTo-Json -Compress))) -TimeoutSec 10
Check "login ok returns token" ($null -ne $login.token)
$sessionToken = $login.token
$headers = @{ Authorization = "Bearer $sessionToken" }

$status = Invoke-RestMethod -Uri "$base/api/auth/status" -Headers $headers -TimeoutSec 10
Check "auth/status authenticated" ($status.authenticated -eq $true)

# --- groups ---
$groups = Invoke-RestMethod -Uri "$base/api/groups" -Headers $headers -TimeoutSec 10
Check "groups is array" ($groups -is [array]) ("count=" + $groups.Count)
$systemNames = @($groups | ForEach-Object { $_.name })
Check "system groups exist" (($systemNames -contains "收藏") -and ($systemNames -contains "最近使用") -and ($systemNames -contains "未分组")) ($systemNames -join ",")
$favGroup = $groups | Where-Object { $_.isFavorites } | Select-Object -First 1
$recentGroup = $groups | Where-Object { $_.isRecent } | Select-Object -First 1

# create group
$newGroup = Invoke-RestMethod -Uri "$base/api/groups" -Method Post -Headers $headers -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes('{"name":"测试分组"}')) -TimeoutSec 10
Check "create group" ($newGroup.id.Length -eq 24)
$dup = try { Invoke-RestMethod -Uri "$base/api/groups" -Method Post -Headers $headers -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes('{"name":"测试分组"}')) -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "duplicate group -> 409" ($dup -eq 409)
$sysName = try { Invoke-RestMethod -Uri "$base/api/groups" -Method Post -Headers $headers -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes('{"name":"收藏"}')) -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "system name group -> 409" ($sysName -eq 409)
$emptyName = try { Invoke-RestMethod -Uri "$base/api/groups" -Method Post -Headers $headers -ContentType "application/json" -Body '{"name":"  "}' -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "empty name -> 400" ($emptyName -eq 400)

# rename group
$renamed = Invoke-RestMethod -Uri "$base/api/groups/$($newGroup.id)" -Method Patch -Headers $headers -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes('{"name":"测试分组2"}')) -TimeoutSec 10
Check "rename group" ($renamed.name -eq "测试分组2")
$sysPatch = try { Invoke-RestMethod -Uri "$base/api/groups/$($favGroup.id)" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"name":"x"}' -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "patch system group -> 403" ($sysPatch -eq 403)
$sysDel = try { Invoke-RestMethod -Uri "$base/api/groups/$($favGroup.id)" -Method Delete -Headers $headers -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "delete system group -> 403" ($sysDel -eq 403)

# --- memes ---
$list = Invoke-RestMethod -Uri "$base/api/memes" -Headers $headers -TimeoutSec 10
Check "memes empty list" ($list.items.Count -eq 0 -and $list.total -eq 0)

# upload via curl (HTTP, no TLS issue)
$uploadRaw = curl.exe -s -X POST -H "Authorization: Bearer $sessionToken" -F "groupId=$($newGroup.id)" -F "files=@.tmp\test.png" "$base/api/memes"
$upload = $uploadRaw | ConvertFrom-Json
Check "upload meme created" ($upload.results[0].status -eq "created") ($uploadRaw)

$list2 = Invoke-RestMethod -Uri "$base/api/memes" -Headers $headers -TimeoutSec 10
$memeId = if ($list2.items.Count -eq 1) { $list2.items[0].id } else { $null }
Check "meme listed" ($null -ne $memeId) ("total=" + $list2.total)

$fileRes = Invoke-WebRequest -Uri "$base/api/memes/$memeId/file" -Headers $headers -TimeoutSec 10 -UseBasicParsing
Check "file content-type png" ($fileRes.Headers["Content-Type"] -eq "image/png") ("bytes=" + $fileRes.RawContentLength)
Check "file cache headers" ($fileRes.Headers["Cache-Control"] -match "immutable")

$thumbRes = Invoke-WebRequest -Uri "$base/api/memes/$memeId/thumb" -Headers $headers -TimeoutSec 10 -UseBasicParsing
Check "thumb is webp" ($thumbRes.Headers["Content-Type"] -eq "image/webp") ("bytes=" + $thumbRes.RawContentLength)

$rangeHeaders = $headers + @{ Range = "bytes=0-9" }
$rangeRes = Invoke-WebRequest -Uri "$base/api/memes/$memeId/file" -Headers $rangeHeaders -TimeoutSec 10 -UseBasicParsing
Check "range -> 206" ($rangeRes.StatusCode -eq 206) ("len=" + $rangeRes.RawContentLength + " cr=" + $rangeRes.Headers["Content-Range"])

$fav = Invoke-RestMethod -Uri "$base/api/memes/$memeId" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"favorite":true}' -TimeoutSec 10
Check "meme favorite true" ($fav.favorite -eq $true)

$used = Invoke-RestMethod -Uri "$base/api/memes/$memeId/use" -Method Post -Headers $headers -TimeoutSec 10
Check "meme use ok" ($null -ne $used.id)

$favList = Invoke-RestMethod -Uri "$base/api/memes?group=$($favGroup.id)" -Headers $headers -TimeoutSec 10
Check "favorites filter" ($favList.total -ge 1) ("total=" + $favList.total)
$recentList = Invoke-RestMethod -Uri "$base/api/memes?group=$($recentGroup.id)" -Headers $headers -TimeoutSec 10
Check "recent filter" ($recentList.total -ge 1) ("total=" + $recentList.total)

$overview = Invoke-RestMethod -Uri "$base/api/overview" -Headers $headers -TimeoutSec 10
Check "overview" ($overview.memeCount -ge 1 -and $overview.storageBytes -gt 0) ($overview | ConvertTo-Json -Compress)

$batchMove = try { Invoke-RestMethod -Uri "$base/api/memes/batch" -Method Post -Headers $headers -ContentType "application/json" -Body (@{ ids = @($memeId); action = "move"; groupId = $favGroup.id } | ConvertTo-Json) -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "batch move to favorites -> 400" ($batchMove -eq 400)
$batchMove2 = Invoke-RestMethod -Uri "$base/api/memes/batch" -Method Post -Headers $headers -ContentType "application/json" -Body (@{ ids = @($memeId); action = "move"; groupId = $newGroup.id } | ConvertTo-Json) -TimeoutSec 10
Check "batch move ok" ($batchMove2.moved -eq 1)

$delGroup = try { Invoke-RestMethod -Uri "$base/api/groups/$($newGroup.id)" -Method Delete -Headers $headers -TimeoutSec 10 } catch { $_.Exception.Response.StatusCode.value__ }
Check "delete non-empty group -> 409" ($delGroup -eq 409)

$delMeme = Invoke-RestMethod -Uri "$base/api/memes/$memeId" -Method Delete -Headers $headers -TimeoutSec 10
Check "delete meme" ($delMeme.ok -eq $true)

$batchDel = Invoke-RestMethod -Uri "$base/api/memes/batch" -Method Post -Headers $headers -ContentType "application/json" -Body '{"ids":["000000000000000000000000"],"action":"delete"}' -TimeoutSec 10
Check "batch delete noop" ($batchDel.deleted -eq 0)

$delGroup2 = Invoke-RestMethod -Uri "$base/api/groups/$($newGroup.id)" -Method Delete -Headers $headers -TimeoutSec 10
Check "delete empty group" ($delGroup2.ok -eq $true)

# --- CORS ---
$corsRes = Invoke-WebRequest -Uri "$base/api/health" -Headers @{ Origin = "http://localhost:1420" } -TimeoutSec 10 -UseBasicParsing
Check "CORS allowed origin" ($corsRes.Headers["Access-Control-Allow-Origin"] -eq "http://localhost:1420")
$corsBad = Invoke-WebRequest -Uri "$base/api/health" -Headers @{ Origin = "http://evil.example" } -TimeoutSec 10 -UseBasicParsing
Check "CORS denies evil origin" ($null -eq $corsBad.Headers["Access-Control-Allow-Origin"])
$preflight = Invoke-WebRequest -Uri "$base/api/groups" -Method Options -Headers @{ Origin = "http://localhost:1420" } -TimeoutSec 10 -UseBasicParsing
Check "preflight 204" ($preflight.StatusCode -eq 204)

# --- rate limit (login) ---
Start-Sleep -Seconds 2
$codes = @()
for ($i = 0; $i -lt 6; $i++) {
  try { Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body '{"token":"wrong"}' -TimeoutSec 10 | Out-Null; $codes += 200 } catch { $codes += $_.Exception.Response.StatusCode.value__ }
}
Check "login rate limit 429" ($codes[5] -eq 429) ("codes=" + ($codes -join ","))

Write-Host "`n===== SUMMARY ====="
$fail = ($results | Where-Object { $_ -like "*[FAIL]*" }).Count
Write-Host "FAIL count: $fail"
$results | Where-Object { $_ -like "*[FAIL]*" } | ForEach-Object { Write-Host $_ }
