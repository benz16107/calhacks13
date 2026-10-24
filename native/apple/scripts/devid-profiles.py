#!/usr/bin/env python3
"""Developer ID provisioning profiles for the Mac app and its Share extension (the API key can make these; Xcode's
cloud Developer ID signing it cannot). Replaces any old ones with the same names and installs them for xcodebuild."""
import base64, json, os, sys, time, urllib.error, urllib.parse, urllib.request
import jwt
KID="PLMMVZAW9U"; ISS="f9583201-6a86-49b0-a866-c418cab9223b"
key=open(os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{KID}.p8")).read()
def call(m,p,b=None):
    t=jwt.encode({"iss":ISS,"iat":int(time.time()),"exp":int(time.time())+1200,"aud":"appstoreconnect-v1"},key,algorithm="ES256",headers={"kid":KID,"typ":"JWT"})
    r=urllib.request.Request("https://api.appstoreconnect.apple.com"+p,method=m,data=json.dumps(b).encode() if b else None,headers={"Authorization":"Bearer "+t,"content-type":"application/json"})
    try: return json.loads(urllib.request.urlopen(r).read() or b"{}")
    except urllib.error.HTTPError as e: sys.exit(f"{m} {p}: {e.code} {e.read()[:400]}")
d=os.path.expanduser("~/Library/Developer/Xcode/UserData/Provisioning Profiles"); os.makedirs(d,exist_ok=True)
for ident,name in [("com.benzhou.gurtos.mac","GurtOS Mac Developer ID"),("com.benzhou.gurtos.mac.share","GurtOS Share Developer ID")]:
    bid=call("GET",f"/v1/bundleIds?filter[identifier]={ident}")["data"]; bid=[b for b in bid if b["attributes"]["identifier"]==ident][0]["id"]
    old=[p for p in call("GET",f"/v1/profiles?filter[name]={urllib.parse.quote(name)}")["data"]]
    for p in old: call("DELETE",f"/v1/profiles/{p['id']}")
    p=call("POST","/v1/profiles",{"data":{"type":"profiles","attributes":{"name":name,"profileType":"MAC_APP_DIRECT"},"relationships":{"bundleId":{"data":{"type":"bundleIds","id":bid}},"certificates":{"data":[{"type":"certificates","id":os.environ.get("DEVID_CERT","AD9ZJX82UF")}]}}}})["data"]
    content=base64.b64decode(p["attributes"]["profileContent"]); path=f"{d}/{p['attributes']['uuid']}.provisionprofile"
    open(path,"wb").write(content); print(ident, p["attributes"]["uuid"], name)
