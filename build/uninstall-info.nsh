; Aimtp — 卸载程序自定义页面
; 由 electron-builder.json 的 nsis.include 引入，只在 Windows 卸载程序里生效。
; 目的：卸载前明确告知用户个人数据（自定义模板）的存放位置，
; 并说明卸载不会删除这些数据。
!macro customUnInstallPage
  Page custom un.aimtpUninstallInfoPage

  Function un.aimtpUninstallInfoPage
    nsDialogs::Create 1018
    Pop $0

    ${NSD_CreateLabel} 0 0 100% 60u "卸载 Aimtp 不会删除你的个人数据。$\r$\n$\r$\n自定义模板目录：$APPDATA\Aimtp\templates$\r$\n$\r$\n重新安装后模板仍会保留。如需彻底清除，请手动删除上述目录。"
    Pop $0

    nsDialogs::Show
  FunctionEnd
!macroend