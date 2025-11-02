import json
import os
from functools import lru_cache

import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
ALGORITHMS = ["RS256"]

if not AUTH0_DOMAIN or not AUTH0_AUDIENCE:
    # Backend can still start but will reject requests until properly configured
    print("Warning: AUTH0_DOMAIN or AUTH0_AUDIENCE not set for Auth0 integration")

http_bearer = HTTPBearer()


@lru_cache()
def _get_jwks():
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    response = requests.get(jwks_url)
    response.raise_for_status()
    return response.json()


def _get_rsa_key(token: str):
    unverified_header = jwt.get_unverified_header(token)
    jwks = _get_jwks()
    for key in jwks["keys"]:
        if key["kid"] == unverified_header["kid"]:
            # python-jose does not provide a public ``algorithms`` module like
            # PyJWT. We therefore return the JWK values directly so ``jwt.decode``
            # can validate the signature.
            return {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key.get("use"),
                "n": key["n"],
                "e": key["e"],
            }
    raise HTTPException(status_code=401, detail="Invalid authorization header")


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    token = credentials.credentials
    try:
        rsa_key = _get_rsa_key(token)
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )
        # Log payload to see what profile info is available
        import logging

        logging.getLogger(__name__).info(f"JWT payload: {payload}")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return payload
