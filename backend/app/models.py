from sqlalchemy import String, Integer, DateTime, ForeignKey, LargeBinary, Text, Numeric, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str|None] = mapped_column(String(120), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default="reviewer")  # super_admin, admin, verification_executive, reviewer
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="Pending", index=True)
    full_name: Mapped[str] = mapped_column(String(200), index=True)
    gender: Mapped[str] = mapped_column(String(30))
    occupation: Mapped[str] = mapped_column(String(40))
    pan_encrypted: Mapped[bytes|None] = mapped_column(LargeBinary, nullable=True)
    aadhaar_encrypted: Mapped[bytes|None] = mapped_column(LargeBinary, nullable=True)
    contact_no: Mapped[str] = mapped_column(String(10), index=True)
    mobile: Mapped[str] = mapped_column(String(10))
    email: Mapped[str] = mapped_column(String(255), index=True)
    current_address: Mapped[str] = mapped_column(Text)
    permanent_address: Mapped[str|None] = mapped_column(Text, nullable=True)
    organization: Mapped[str|None] = mapped_column(String(255), nullable=True)
    monthly_income: Mapped[float|None] = mapped_column(Numeric(14,2), nullable=True)
    existing_emis: Mapped[float|None] = mapped_column(Numeric(14,2), nullable=True)
    lender: Mapped[str] = mapped_column(String(255))
    loan_account: Mapped[str] = mapped_column(String(100))
    sanctioned_amount: Mapped[float] = mapped_column(Numeric(14,2))
    outstanding_balance: Mapped[float] = mapped_column(Numeric(14,2))
    emi_amount: Mapped[float] = mapped_column(Numeric(14,2))
    emi_due_date: Mapped[int] = mapped_column(Integer)
    remaining_tenure: Mapped[int] = mapped_column(Integer)
    
    # Plans & commercial terms
    plan_name: Mapped[str] = mapped_column(String(50), default="EMI Shield Pro")
    plan_rate: Mapped[float|None] = mapped_column(Numeric(6,2), nullable=True, default=18.99)
    repayment_period_days: Mapped[int] = mapped_column(Integer, default=90)
    annual_subscription_fee: Mapped[float|None] = mapped_column(Numeric(14,2), nullable=True)
    subscription_commencement_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    subscription_expiry_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    place: Mapped[str|None] = mapped_column(String(120), nullable=True)
    form_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    declaration: Mapped[bool] = mapped_column(Boolean, default=True)
    admin_notes: Mapped[str|None] = mapped_column(Text, nullable=True)
    financial_notes: Mapped[str|None] = mapped_column(Text, nullable=True)
    
    # Workflow & assignment
    assigned_to_id: Mapped[int|None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    verification_checklist: Mapped[str|None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    documents = relationship("Document", back_populates="application", cascade="all, delete-orphan")
    timeline = relationship("ApplicationTimeline", back_populates="application", cascade="all, delete-orphan", order_by="ApplicationTimeline.created_at.desc()")

class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(50), default="other")  # pan, aadhaar, loan_sanction, loan_statement, income_proof, bank_statement, other
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending, approved, rejected
    remarks: Mapped[str|None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    application = relationship("Application", back_populates="documents")

class ApplicationTimeline(Base):
    __tablename__ = "application_timelines"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int|None] = mapped_column(ForeignKey("users.id"), nullable=True)
    user_email: Mapped[str|None] = mapped_column(String(255), nullable=True)
    previous_status: Mapped[str|None] = mapped_column(String(40), nullable=True)
    new_status: Mapped[str] = mapped_column(String(40))
    remarks: Mapped[str|None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    application = relationship("Application", back_populates="timeline")

class PlanConfig(Base):
    __tablename__ = "plan_configs"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    fee_percentage: Mapped[float] = mapped_column(Numeric(6,2))
    avail_benefit_times: Mapped[int] = mapped_column(Integer)
    activation_period_days: Mapped[int] = mapped_column(Integer)
    repayment_period_days: Mapped[int] = mapped_column(Integer)
    activation_service_charge: Mapped[str] = mapped_column(String(50))
    default_interest_monthly: Mapped[float] = mapped_column(Numeric(6,2))
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int|None] = mapped_column(ForeignKey("users.id"), nullable=True)
    application_id: Mapped[int|None] = mapped_column(ForeignKey("applications.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str|None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str|None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
