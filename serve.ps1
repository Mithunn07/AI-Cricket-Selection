$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8085/")
try {
    $listener.Start()
    Write-Host "Listening on http://localhost:8085/..."
    Write-Host "Press Ctrl+C to stop the server."
} catch {
    Write-Host "Failed to start listener: $_"
    exit 1
}

$baseDir = $PSScriptRoot

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.RawUrl
        # Strip query parameters
        if ($rawUrl.Contains("?")) {
            $rawUrl = $rawUrl.Split("?")[0]
        }
        
        # Default document
        if ($rawUrl -eq "/" -or $rawUrl -eq "") {
            $path = Join-Path $baseDir "index.html"
        } else {
            # Normalize path delimiters for Windows filesystem
            $urlPath = $rawUrl.TrimStart('/')
            $urlPath = $urlPath -replace '/', '\'
            $path = Join-Path $baseDir $urlPath
        }

        if (Test-Path $path -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($path).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".svg"  { "image/svg+xml; charset=utf-8" }
                ".pdf"  { "application/pdf" }
                default { "application/octet-stream" }
            }
            $response.ContentType = $contentType
            $bytes = [System.IO.File]::ReadAllBytes($path)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = "File Not Found: $rawUrl"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch {
        Write-Host "Error in connection handling: $_"
    } finally {
        if ($null -ne $response) {
            $response.Close()
        }
    }
}
$listener.Close()
