import sys,json,hashlib,importlib.metadata
import tiktoken
p=json.load(open(sys.argv[1]));enc=tiktoken.get_encoding('cl100k_base');cache={}
def count(text):
 key=hashlib.sha256(text.encode()).hexdigest()
 if key not in cache:cache[key]=len(enc.encode(text,disallowed_special=()))
 return cache[key]
rows=[]
for case in p['cases']:
 a=count(case['baseline']);b=count(case['compact']);rows.append({'name':case['name'],'baselineTokens':a,'compactTokens':b,'reductionPercent':(a-b)/a*100})
print(json.dumps({'tokenizer':'tiktoken','version':tiktoken.__version__,'encoding':'cl100k_base','python':sys.version.split()[0],'dependencies':{n:importlib.metadata.version(n) for n in ['tiktoken','regex','requests']},'schemaTokens':count(p['schema']),'cases':rows}))
