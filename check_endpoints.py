with open('src/App.tsx') as f:
    app_text = f.read()

import re

fetches = re.findall(r'(?:fetch|authFetch)\s*\(\s*([`\'\"][^,\)]+[`\'\"])', app_text)
print(f'Total fetch calls: {len(fetches)}')
for u in sorted(set(fetches)):
    print('  ', u)
