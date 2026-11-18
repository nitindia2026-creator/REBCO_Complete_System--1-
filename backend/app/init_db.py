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
            ("plan_name", "VARCHAR(50) DEFAULT 'EMI Shield'"),
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

    # 3. Seed official EMI Shield plan (18.99%) & clean up legacy plans
    db = SessionLocal()
    try:
        # Migrate existing applications if any had old plan name
        db.execute(text("UPDATE applications SET plan_name = 'EMI Shield', plan_rate = 18.99, repayment_period_days = 90 WHERE plan_name IN ('EMI Shield Pro', 'Standard EMI Shield')"))
        db.commit()

        # Remove deprecated emi_shield_pro plan if present
        pro_plan = db.scalar(select(PlanConfig).where(PlanConfig.code == "emi_shield_pro"))
        if pro_plan:
            db.delete(pro_plan)
            db.commit()
            print("Removed deprecated emi_shield_pro plan entry")

        plan = db.scalar(select(PlanConfig).where(PlanConfig.code == "emi_shield"))
        if not plan:
            db.add(PlanConfig(
                code="emi_shield",
                name="EMI Shield",
                fee_percentage=18.99,
                avail_benefit_times=5,
                activation_period_days=60,
                repayment_period_days=90,
                activation_service_charge="Nil",
                default_interest_monthly=1.5,
                description="Comprehensive loan protection plan covering up to 5 EMI defaults annually with 90 days repayment window and zero activation charge."
            ))
            db.commit()
            print("Seeded plan: EMI Shield (18.99%)")
        else:
            plan.name = "EMI Shield"
            plan.fee_percentage = 18.99
            plan.avail_benefit_times = 5
            plan.activation_period_days = 60
            plan.repayment_period_days = 90
            plan.activation_service_charge = "Nil"
            plan.default_interest_monthly = 1.5
            plan.description = "Comprehensive loan protection plan covering up to 5 EMI defaults annually with 90 days repayment window and zero activation charge."
            db.commit()
            print("Updated plan: EMI Shield (18.99%)")
            
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
