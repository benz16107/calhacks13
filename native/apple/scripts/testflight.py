#!/usr/bin/env python3
"""Internal TestFlight for GurtOS, through the App Store Connect API (nothing public, no review).

  scripts/testflight.py wait      wait for the app record (only a person can create it: the API refuses)
  scripts/testflight.py group     make the internal group "GurtOS team" with every account holder and admin in it,
                                  and give it the newest processed build
  scripts/testflight.py status    the newest builds and their processing state

Uses the API key in ~/.appstoreconnect/private_keys (ASC_KID, ASC_ISS) with pyjwt: `uv run --with pyjwt --with
cryptography scripts/testflight.py ...`.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
import jwt

KID = os.environ.get("ASC_KID", "PLMMVZAW9U")
ISS = os.environ.get("ASC_ISS", "f9583201-6a86-49b0-a866-c418cab9223b")
BUNDLE = os.environ.get("BUNDLE", "com.benzhou.gurtos")
KEY = open(os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{KID}.p8")).read()


def call(method, path, body=None):
    tok = jwt.encode({"iss": ISS, "iat": int(time.time()), "exp": int(time.time()) + 1200, "aud": "appstoreconnect-v1"}, KEY, algorithm="ES256", headers={"kid": KID, "typ": "JWT"})
    req = urllib.request.Request("https://api.appstoreconnect.apple.com" + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Bearer " + tok, "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path}: {e.code} {e.read()[:500].decode()}")


def app_id():
    d = call("GET", f"/v1/apps?filter[bundleId]={BUNDLE}")["data"]
    return d[0]["id"] if d else None


def builds(app):
    return call("GET", f"/v1/builds?filter[app]={app}&sort=-uploadedDate&limit=5&fields[builds]=version,uploadedDate,processingState")["data"]


cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
if cmd == "wait":
    while not app_id():
        time.sleep(60)
    print("app record:", app_id())
elif cmd == "status":
    a = app_id()
    print("app record:", a or "missing")
    for b in builds(a) if a else []:
        print(b["attributes"])
elif cmd == "group":
    a = app_id()
    # Wait for the newest build to finish processing (2 to 15 minutes).
    for _ in range(60):
        bs = builds(a)
        if bs and bs[0]["attributes"]["processingState"] in ("VALID", "INVALID", "FAILED"):
            break
        time.sleep(30)
    build = bs[0]
    print("build", build["attributes"])
    groups = call("GET", f"/v1/apps/{a}/betaGroups")["data"]
    g = next((x for x in groups if x["attributes"]["name"] == "GurtOS team"), None)
    if not g:
        g = call("POST", "/v1/betaGroups", {"data": {"type": "betaGroups", "attributes": {"name": "GurtOS team", "isInternalGroup": True, "hasAccessToAllBuilds": True},
                                                   "relationships": {"app": {"data": {"type": "apps", "id": a}}}}})["data"]
    # Internal testers are App Store Connect users: the account holder and admins.
    users = [u for u in call("GET", "/v1/users?limit=50")["data"] if set(u["attributes"]["roles"]) & {"ACCOUNT_HOLDER", "ADMIN"}]
    for u in users:
        at = u["attributes"]
        have = call("GET", f"/v1/betaTesters?filter[email]={urllib.parse.quote(at['username'])}&filter[apps]={a}")["data"]
        in_group = [t["id"] for t in call("GET", f"/v1/betaGroups/{g['id']}/betaTesters?limit=200")["data"]]
        if have and have[0]["id"] in in_group:
            pass  # already a tester in this group
        elif have:
            call("POST", f"/v1/betaGroups/{g['id']}/relationships/betaTesters", {"data": [{"type": "betaTesters", "id": have[0]["id"]}]})
        else:
            call("POST", "/v1/betaTesters", {"data": {"type": "betaTesters", "attributes": {"email": at["username"], "firstName": at.get("firstName", ""), "lastName": at.get("lastName", "")},
                                                      "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": g["id"]}]}}}})
        print("tester:", at["username"])
    print("group:", g["id"], "has every build")
