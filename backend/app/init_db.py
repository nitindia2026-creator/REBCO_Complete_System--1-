import sqlite3
from sqlalchemy import select, text
from .db import Base, engine, SessionLocal
from . import models
from .models import PlanConfig, User
from .security import hash_password

def run_migrations():
    # 1. Create tables that do not exist
    Base.metadata.create_all(bind=engine)
    
    # 2. Add columns if missing (safe schema migration for SQLite / PostgreSQL)
    with engine.connect() as conn:
        # Check applications columns
        app_cols = [
            ("plan_name", "VARCHAR(50) DEFAULT 'EMI Shield Pro'"),
            ("plan_rate", "NUMERIC(6,2)"),
            ("repayment_period_days", "INTEGER DEFAULT 90"),
            ("assigned_to_id", "INTEGER"),
            ("verification_checklist", "TEXT"),
            ("financial_notes", "TEXT")
        ]
        for col_name, col_type in app_cols:
            try:
                conn.execute(text(f"ALTER TABLE applications ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Added column {col_name} to applications")
            except Exception:
                pass  # column already exists
        
        # Check documents columns
        doc_cols = [
            ("category", "VARCHAR(50) DEFAULT 'other'"),
            ("status", "VARCHAR(30) DEFAULT 'pending'"),
            ("remarks", "TEXT")
        ]
        for col_name, col_type in doc_cols:
            try:
                conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Added column {col_name} to documents")
            except Exception:
                pass
                
        # Check users columns
        user_cols = [
            ("full_name", "VARCHAR(120)")
        ]
        for col_name, col_type in user_cols:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Added column {col_name} to users")
            except Exception:
                pass

    # 3. Seed official EMI Shield Pro plan (18.99%) & clean up legacy plans
    db = SessionLocal()
    try:
        # Remove deprecated 7% emi_shield plan if present
        old_plan = db.scalar(select(PlanConfig).where(PlanConfig.code == "emi_shield"))
        if old_plan:
            db.delete(old_plan)
            db.commit()
            print("Removed deprecated 7% EMI Shield plan")

        # Migrate existing applications if any had old plan name
        db.execute(text("UPDATE applications SET plan_name = 'EMI Shield Pro', plan_rate = 18.99, repayment_period_days = 90 WHERE plan_name = 'EMI Shield'"))
        db.commit()

        if not db.scalar(select(PlanConfig).where(PlanConfig.code == "emi_shield_pro")):
            db.add(PlanConfig(
                code="emi_shield_pro",
                name="EMI Shield Pro",
                fee_percentage=18.99,
                avail_benefit_times=5,
                activation_period_days=60,
                repayment_period_days=90,
                activation_service_charge="Nil",
                default_interest_monthly=1.5,
                description="Premium risk mitigation plan covering up to 5 EMI defaults annually with 90 days repayment window and zero activation charge."
            ))
            print("Seeded plan: EMI Shield Pro (18.99%)")
            
        # Ensure default admin user is super_admin or admin
        admin_user = db.scalar(select(User).where(User.email == "admin@rebco.com"))
        if admin_user:
            admin_user.role = "super_admin"
            admin_user.full_name = "REBCO Administrator"
        else:
            db.add(User(
                email="admin@rebco.com",
                full_name="REBCO Administrator",
                password_hash=hash_password("Admin@REBCO1234"),
                role="super_admin",
                active=True
            ))
            print("Created default admin user")
            
        db.commit()
    finally:
        db.close()

    print("Database tables & initial configuration ready")

if __name__ == "__main__":
    run_migrations()
