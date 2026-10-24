#!/usr/bin/env python3
"""Fetch the Developer ID Application certificate Ben made from our signing request and import it.

The request (and its private key) were made on the build Mac in ~/.config/gurtos-signing; only the Account
Holder can turn a request into a Developer ID certificate, on developer.apple.com. This finds the certificate
whose public key is ours, through the App Store Connect API, and imports it into the signing keychain.
Exit 3 if it doesn't exist yet.  uv run --with pyjwt --with cryptography scripts/devid.py
"""
import base64, os, subprocess, sys, time, json, urllib.request
import jwt
from cryptography import x509
from cryptography.hazmat.primitives import serialization

D = os.path.expanduser("~/.config/gurtos-signing")
KID = os.environ.get("ASC_KID", "PLMMVZAW9U")
ISS = os.environ.get("ASC_ISS", "f9583201-6a86-49b0-a866-c418cab9223b")
key = open(os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{KID}.p8")).read()
tok = jwt.encode({"iss": ISS, "iat": int(time.time()), "exp": int(time.time()) + 1200, "aud": "appstoreconnect-v1"}, key, algorithm="ES256", headers={"kid": KID, "typ": "JWT"})
req = urllib.request.Request("https://api.appstoreconnect.apple.com/v1/certificates?limit=200&filter[certificateType]=DEVELOPER_ID_APPLICATION_G2,DEVELOPER_ID_APPLICATION", headers={"Authorization": "Bearer " + tok})
certs = json.load(urllib.request.urlopen(req))["data"]
ours = serialization.load_pem_private_key(open(f"{D}/devid.key", "rb").read(), None).public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
for c in certs:
    der = base64.b64decode(c["attributes"]["certificateContent"])
    if x509.load_der_x509_certificate(der).public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo) == ours:
        open(f"{D}/devid.cer", "wb").write(der)
        pw = open(f"{D}/pw").read().strip()
        kc = os.path.expanduser("~/Library/Keychains/gurtos-signing.keychain-db")
        subprocess.run(f"openssl x509 -inform der -in devid.cer -out devid.pem && openssl pkcs12 -export -legacy -inkey devid.key -in devid.pem -out devid.p12 -passout pass:{pw} && chmod 600 devid.p12", shell=True, cwd=D, check=True)
        subprocess.run(["security", "import", f"{D}/devid.p12", "-k", kc, "-P", pw, "-T", "/usr/bin/codesign"], check=False)
        subprocess.run(["security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", pw, kc], check=True, capture_output=True)
        print("imported", c["attributes"]["name"])
        sys.exit(0)
print("no Developer ID certificate from our request yet")
sys.exit(3)
