from getpass import getpass
from sqlalchemy import select
from .db import SessionLocal,Base,engine
from .models import User
from .security import hash_password
Base.metadata.create_all(engine)
email=input("Admin email: ").strip().lower()
p=getpass("Password (minimum 12 chars): ")
if len(p)<12: raise SystemExit("Password too short")
db=SessionLocal()
if db.scalar(select(User).where(User.email==email)): raise SystemExit("User already exists")
db.add(User(email=email,password_hash=hash_password(p),role="admin"))
db.commit(); print("Admin created")
