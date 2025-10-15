# Setup Android Environment Variables for Expo Development
# Run this script before building: .\setup-android-env.ps1

Write-Host "Setting up Android environment variables..." -ForegroundColor Green

# Android SDK Location
$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk"

if (Test-Path $AndroidSdk) {
    Write-Host "[OK] Android SDK found at: $AndroidSdk" -ForegroundColor Green
    
    # Set environment variables for current session
    $env:ANDROID_HOME = $AndroidSdk
    $env:ANDROID_SDK_ROOT = $AndroidSdk
    
    # Add Android SDK tools to PATH for current session
    $platformTools = Join-Path $AndroidSdk "platform-tools"
    $emulator = Join-Path $AndroidSdk "emulator"
    $tools = Join-Path $AndroidSdk "tools"
    $toolsBin = Join-Path $AndroidSdk "tools\bin"
    $env:PATH = "$platformTools;$emulator;$tools;$toolsBin;$env:PATH"
    
    Write-Host "[OK] ANDROID_HOME set to: $env:ANDROID_HOME" -ForegroundColor Green
    Write-Host "[OK] Android SDK tools added to PATH" -ForegroundColor Green
    
} else {
    Write-Host "[ERROR] Android SDK not found at expected location" -ForegroundColor Red
    Write-Host "  Please check Android Studio installation" -ForegroundColor Yellow
    exit 1
}

# Find Java (bundled with Android Studio)
$JavaPaths = @(
    "C:\Program Files\Android\Android Studio\jbr\bin",
    "C:\Program Files\Android\Android Studio\jre\bin",
    "$env:LOCALAPPDATA\Android\Android Studio\jbr\bin",
    "$env:LOCALAPPDATA\Android\Android Studio\jre\bin"
)

$JavaFound = $false
foreach ($path in $JavaPaths) {
    if (Test-Path "$path\java.exe") {
        $JavaHome = Split-Path $path -Parent
        $env:JAVA_HOME = $JavaHome
        $env:PATH = "$path;$env:PATH"
        Write-Host "[OK] Java found at: $JavaHome" -ForegroundColor Green
        $JavaFound = $true
        break
    }
}

if (-not $JavaFound) {
    Write-Host "[ERROR] Java not found in Android Studio installation" -ForegroundColor Red
    Write-Host "  You may need to install JDK separately" -ForegroundColor Yellow
}

# Verify setup
Write-Host "`nVerifying setup..." -ForegroundColor Cyan
Write-Host "Running: java -version"
java -version 2>&1
Write-Host "`nRunning: adb version"
adb version

Write-Host "`n[OK] Environment setup complete!" -ForegroundColor Green
Write-Host "You can now run: npx expo run:android" -ForegroundColor Cyan
