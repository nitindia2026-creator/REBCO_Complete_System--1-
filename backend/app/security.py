import jwt, secrets
from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from .config import settings
password_hash=PasswordHash.recommended()
def hash_password(p): return password_hash.hash(p)
def verify_password(p,h): return password_hash.verify(p,h)
def create_token(user):
    now=datetime.now(timezone.utc)
    return jwt.encode({"sub":str(user.id),"role":user.role,"iat":now,"exp":now+timedelta(minutes=settings.jwt_expire_minutes),"jti":secrets.token_urlsafe(16)},settings.jwt_secret,algorithm="HS256")
def encrypt_value(value):
    if not value: return None
    nonce=secrets.token_bytes(12)
    return nonce + AESGCM(settings.encryption_key).encrypt(nonce,value.encode(),None)
def decrypt_value(value):
    if not value: return ""
    return AESGCM(settings.encryption_key).decrypt(value[:12],value[12:],None).decode()
def mask(value, visible=4):
    if not value: return ""
    return "*" * max(0,len(value)-visible) + value[-visible:]
