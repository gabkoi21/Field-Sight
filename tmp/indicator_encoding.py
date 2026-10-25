from pathlib import Path
p=Path('fieldsight-frontend/src/pages/organization/IndicatorForms.tsx')
s=p.read_bytes().decode('utf-8', errors='surrogateescape')
s=''.join(bytes([ord(c)-0xdc00]).decode('cp1252') if 0xdc80 <= ord(c) <= 0xdcff else c for c in s)
p.write_text(s,encoding='utf-8')
script=Path('tmp/indicator_activation.py').read_text(encoding='utf-8')
script='from pathlib import Path\n'+script[script.index("p=Path('fieldsight-frontend/src/pages"):]
exec(script)
