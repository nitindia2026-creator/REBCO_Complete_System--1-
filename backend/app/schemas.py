from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List, Dict, Any
from .validators import (
    validate_full_name, validate_pan, validate_aadhaar, validate_mobile,
    validate_contact_no, validate_address, validate_lender, validate_loan_account,
    validate_sanctioned_amount, validate_outstanding_balance, validate_emi_amount,
    validate_tenure, validate_ifsc
)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class ApplicationIn(BaseModel):
    # Step 1: Personal
    full_name: str
    gender: str
    occupation: str
    pan: str
    aadhaar: Optional[str] = None
    contact_no: str
    mobile: str
    email: EmailStr
    current_address: str
    permanent_address: Optional[str] = None
    organization: Optional[str] = None
    monthly_income: Optional[float] = Field(default=None, ge=0)
    existing_emis: Optional[float] = Field(default=None, ge=0)
    
    # Step 2: Loan
    lender: str
    loan_account: str
    sanctioned_amount: float
    outstanding_balance: float
    emi_amount: float
    emi_due_date: int = Field(ge=1, le=31)
    remaining_tenure: int
    
    # Step 3: Subscription & Terms
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

    @field_validator("full_name")
    @classmethod
    def check_full_name(cls, v: str) -> str:
        return validate_full_name(v)

    @field_validator("pan")
    @classmethod
    def check_pan(cls, v: str) -> str:
        return validate_pan(v)

    @field_validator("aadhaar")
    @classmethod
    def check_aadhaar(cls, v: Optional[str]) -> Optional[str]:
        return validate_aadhaar(v)

    @field_validator("mobile")
    @classmethod
    def check_mobile(cls, v: str) -> str:
        return validate_mobile(v)

    @field_validator("contact_no")
    @classmethod
    def check_contact_no(cls, v: str) -> str:
        return validate_contact_no(v)

    @field_validator("gender")
    @classmethod
    def check_gender(cls, v: str) -> str:
        allowed = {"Male", "Female", "Others", "Other"}
        if (v or "").strip().title() not in allowed:
            raise ValueError("Gender must be one of: Male, Female, Others")
        return (v or "").strip().title()

    @field_validator("current_address")
    @classmethod
    def check_address(cls, v: str) -> str:
        return validate_address(v, "Current residential address")

    @field_validator("permanent_address")
    @classmethod
    def check_perm_address(cls, v: Optional[str]) -> Optional[str]:
        if v and v.strip():
            return validate_address(v, "Permanent address")
        return v

    @field_validator("lender")
    @classmethod
    def check_lender(cls, v: str) -> str:
        return validate_lender(v)

    @field_validator("loan_account")
    @classmethod
    def check_loan_account(cls, v: str) -> str:
        return validate_loan_account(v)

    @field_validator("sanctioned_amount")
    @classmethod
    def check_sanctioned(cls, v: float) -> float:
        return validate_sanctioned_amount(v)

    @field_validator("remaining_tenure")
    @classmethod
    def check_tenure(cls, v: int) -> int:
        return validate_tenure(v)

    @model_validator(mode="after")
    def check_financial_consistency(self):
        sanctioned = float(self.sanctioned_amount or 0)
        outstanding = float(self.outstanding_balance or 0)
        emi = float(self.emi_amount or 0)
        validate_outstanding_balance(outstanding, sanctioned)
        validate_emi_amount(emi, sanctioned)
        return self

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
