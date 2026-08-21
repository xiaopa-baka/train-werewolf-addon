@echo off
chcp 65001 >nul
set "DEST_BP_ROOT=%AppData%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs"
set "DEST_RP_ROOT=%AppData%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_resource_packs"

if exist "%DEST_BP_ROOT%\BP" rd /s /q "%DEST_BP_ROOT%\BP" 2>nul
if exist "%DEST_RP_ROOT%\RP" rd /s /q "%DEST_RP_ROOT%\RP" 2>nul

xcopy "%~dp0BP" "%DEST_BP_ROOT%\BP\" /E /H /Y /I >nul 2>&1
xcopy "%~dp0RP" "%DEST_RP_ROOT%\RP\" /E /H /Y /I >nul 2>&1