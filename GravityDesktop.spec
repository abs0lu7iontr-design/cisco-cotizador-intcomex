# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['desktop_app/desktop_window.py'],
    pathex=['desktop_app'],
    binaries=[],
    datas=[
        ('dist/index.html', 'dist'),
        ('dist/index.html', '.'),
        ('desktop_app/schema.sql', 'desktop_app'),
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
    [],
    exclude_binaries=True,
    name='GravityDesktop',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='GravityDesktop',
)
