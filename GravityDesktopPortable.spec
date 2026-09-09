# -*- mode: python ; coding: utf-8 -*-
import os
import webview

webview_pkg = os.path.dirname(webview.__file__)
webview_lib = os.path.join(webview_pkg, 'lib')

a = Analysis(
    ['desktop_app/desktop_window.py'],
    pathex=['desktop_app'],
    binaries=[
        (os.path.join(webview_lib, 'Microsoft.Web.WebView2.Core.dll'), '.'),
        (os.path.join(webview_lib, 'Microsoft.Web.WebView2.WinForms.dll'), '.'),
        (os.path.join(webview_lib, 'WebBrowserInterop.x64.dll'), '.'),
        (os.path.join(webview_lib, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'), '.'),
        (os.path.join(webview_lib, 'Microsoft.Web.WebView2.Core.dll'), 'lib'),
        (os.path.join(webview_lib, 'Microsoft.Web.WebView2.WinForms.dll'), 'lib'),
        (os.path.join(webview_lib, 'WebBrowserInterop.x64.dll'), 'lib'),
        (os.path.join(webview_lib, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'), 'lib'),
        (os.path.join(webview_lib, 'Microsoft.Web.WebView2.Core.dll'), 'webview/lib'),
        (os.path.join(webview_lib, 'Microsoft.Web.WebView2.WinForms.dll'), 'webview/lib'),
        (os.path.join(webview_lib, 'WebBrowserInterop.x64.dll'), 'webview/lib'),
        (os.path.join(webview_lib, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'), 'webview/lib'),
        (os.path.join(webview_lib, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'), 'runtimes/win-x64/native'),
    ],
    datas=[
        ('dist/index.html', 'dist'),
        ('dist/index.html', '.'),
        ('desktop_app/schema.sql', 'desktop_app'),
        ('desktop_app/app_icon.ico', 'desktop_app'),
        ('desktop_app/app_icon.png', 'desktop_app'),
        (webview_lib, 'webview/lib'),
        (webview_lib, 'lib'),
        (webview_lib, '.'),
    ],
    hiddenimports=[
        'webview',
        'webview.platforms.winforms',
        'webview.platforms.edgechromium',
        'sqlite3',
        'json',
        'uuid',
        'datetime',
        'shutil',
        're',
        'csv',
        'hashlib',
        'clr',
        'pythonnet',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Cotizador-Cisco-Intcomex-Portable',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='desktop_app/app_icon.ico',
)
