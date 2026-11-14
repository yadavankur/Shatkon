import json
t=open('template.html').read()
body=open('body.html').read()
app='\n'.join(open(f).read() for f in ['geom.js','app1.js','app2.js','app3.js','app4.js','app5.js','app6.js'])
data=open('data.json').read(); wm=open('worldmap.json').read()
import urllib.parse
fav='data:image/svg+xml,'+urllib.parse.quote(open('/workspace/shatkon-guide/brand/favicon.svg').read().strip())
out=t.replace('__FAVICON__',fav).replace('__BODY__',body).replace('__DATA__',data).replace('__WORLDMAP__',wm).replace('__APP__',app)
open('/workspace/shatkon-guide/index.html','w').write(out)
print(len(out))
