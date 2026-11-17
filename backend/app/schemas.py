from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class ApplicationIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    gender: str
    occupation: str
    pan: str = Field(pattern=r"^[A-Za-z]{5}[0-9]{4}[A-Za-z]$")
    aadhaar: Optional[str] = Field(default=None, pattern=r"^[0-9]{12}$")
    contact_no: str = Field(pattern=r"^[6-9][0-9]{9}$")
    mobile: str = Field(pattern=r"^[6-9][0-9]{9}$")
    email: EmailStr
    current_address: str = Field(min_length=5)
    permanent_address: Optional[str] = None
    organization: Optional[str] = None
    monthly_income: Optional[float] = Field(default=None, ge=0)
    existing_emis: Optional[float] = Field(default=None, ge=0)
    lender: str
    loan_account: str
    sanctioned_amount: float = Field(ge=0)
    outstanding_balance: float = Field(ge=0)
    emi_amount: float = Field(gt=0)
    emi_due_date: int = Field(ge=1, le=31)
    remaining_tenure: int = Field(ge=0)
    
    # Plans & Terms
    plan_name: Optional[str] = "EMI Shield Pro"
    plan_rate: Optional[float] = Field(default=18.99, ge=0)
    repayment_period_days: Optional[int] = Field(default=90, ge=30)
    annual_subscription_fee: Optional[float] = Field(default=None, ge=0)
    subscription_commencement_date: Optional[str] = None
    subscription_expiry_date: Optional[str] = None
    place: Optional[str] = None
    form_date: Optional[str] = None
    declaration: bool
    financial_notes: Optional[str] = None

class StatusIn(BaseModel):
    status: str
    admin_notes: Optional[str] = None
    remarks: Optional[str] = None
    assigned_to_id: Optional[int] = None
    verification_checklist: Optional[str] = None

class DocumentStatusIn(BaseModel):
    status: str = Field(pattern=r"^(pending|approved|rejected)$")
    remarks: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: str = Field(min_length=8, max_length=128)
    role: str = "reviewer"  # super_admin, admin, verification_executive, reviewer

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class PlanConfigIn(BaseModel):
    code: str
    name: str
    fee_percentage: float = Field(ge=0, le=100)
    avail_benefit_times: int = Field(ge=1)
    activation_period_days: int = Field(ge=0)
    repayment_period_days: int = Field(ge=0)
    activation_service_charge: str
    default_interest_monthly: float = Field(ge=0)
    description: Optional[str] = None
    is_active: bool = True
