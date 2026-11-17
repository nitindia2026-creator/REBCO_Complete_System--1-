import os, uuid, csv, io, re, json
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, and_, desc
import jwt

from .config import settings
from .db import get_db, Base, engine
from .models import User, Application, Document, AuditLog, ApplicationTimeline, PlanConfig
from .schemas import (
    LoginIn, ApplicationIn, StatusIn, DocumentStatusIn, 
    UserCreate, UserUpdate, PlanConfigIn
)
from .security import (
    verify_password, hash_password, create_token, 
    encrypt_value, decrypt_value, mask
)

app = FastAPI(title="REBCO Corporate Enrollment & Admin API", version="2.0.0")

cors_list = [x.strip() for x in settings.cors_origins.split(",") if x.strip()]
is_wildcard = "*" in cors_list or not cors_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else cors_list,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer()
ALLOWED = {"application/pdf", "image/jpeg", "image/png"}

# RBAC helpers
ADMIN_ROLES = {"super_admin", "admin"}
STAFF_ROLES = {"super_admin", "admin", "verification_executive", "reviewer"}

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.active:
        raise HTTPException(401, "Account unavailable or disabled")
    return user

def require_staff(user: User = Depends(current_user)):
    if user.role not in STAFF_ROLES:
        raise HTTPException(403, "Staff access required")
    return user

def require_executive_or_admin(user: User = Depends(current_user)):
    if user.role not in {"super_admin", "admin", "verification_executive"}:
        raise HTTPException(403, "Verification executive or administrator privileges required")
    return user

def require_admin(user: User = Depends(current_user)):
    if user.role not in ADMIN_ROLES:
        raise HTTPException(403, "Administrator access required")
    return user

def log_audit(db: Session, user: User | None, action: str, app_id: int | None = None, detail: str | None = None, request: Request | None = None):
    ip = request.client.host if request and request.client else None
    db.add(AuditLog(
        user_id=user.id if user else None,
        application_id=app_id,
        action=action,
        detail=detail,
        ip_address=ip
    ))

def serialize_application(a: Application, include_sensitive: bool = False):
    pan_dec = decrypt_value(a.pan_encrypted) if a.pan_encrypted else ""
    aad_dec = decrypt_value(a.aadhaar_encrypted) if a.aadhaar_encrypted else ""
    
    docs = [
        {
            "id": d.id,
            "name": d.original_name,
            "size": d.size,
            "content_type": d.content_type,
            "category": d.category or "other",
            "status": d.status or "pending",
            "remarks": d.remarks,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None
        }
        for d in (a.documents or [])
    ]
    
    timeline = [
        {
            "id": t.id,
            "previous_status": t.previous_status,
            "new_status": t.new_status,
            "remarks": t.remarks,
            "user_email": t.user_email,
            "created_at": t.created_at.isoformat() if t.created_at else None
        }
        for t in (a.timeline or [])
    ]
    
    return {
        "id": a.id,
        "application_no": a.application_no,
        "status": a.status,
        "full_name": a.full_name,
        "gender": a.gender,
        "occupation": a.occupation,
        "pan": pan_dec if include_sensitive else mask(pan_dec),
        "aadhaar": aad_dec if include_sensitive else mask(aad_dec),
        "is_unmasked": include_sensitive,
        "contact_no": a.contact_no,
        "mobile": a.mobile,
        "email": a.email,
        "current_address": a.current_address,
        "permanent_address": a.permanent_address,
        "organization": a.organization,
        "monthly_income": float(a.monthly_income) if a.monthly_income is not None else None,
        "existing_emis": float(a.existing_emis) if a.existing_emis is not None else None,
        "lender": a.lender,
        "loan_account": a.loan_account,
        "sanctioned_amount": float(a.sanctioned_amount),
        "outstanding_balance": float(a.outstanding_balance),
        "emi_amount": float(a.emi_amount),
        "emi_due_date": a.emi_due_date,
        "remaining_tenure": a.remaining_tenure,
        
        # Plan info
        "plan_name": a.plan_name or "EMI Shield Pro",
        "plan_rate": float(a.plan_rate) if a.plan_rate is not None else 18.99,
        "repayment_period_days": a.repayment_period_days or 90,
        "annual_subscription_fee": float(a.annual_subscription_fee) if a.annual_subscription_fee is not None else None,
        "subscription_commencement_date": a.subscription_commencement_date,
        "subscription_expiry_date": a.subscription_expiry_date,
        "place": a.place,
        "form_date": a.form_date,
        "declaration": a.declaration,
        "admin_notes": a.admin_notes,
        "financial_notes": a.financial_notes,
        
        # Staff assignment & checklist
        "assigned_to_id": a.assigned_to_id,
        "assigned_to_name": a.assigned_to.full_name if a.assigned_to else (a.assigned_to.email if a.assigned_to else None),
        "verification_checklist": json.loads(a.verification_checklist) if a.verification_checklist else {},
        
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        "documents": docs,
        "timeline": timeline
    }

# --- PUBLIC ENDPOINTS ---

@app.get("/health")
def health():
    return {"status": "ok", "app": "REBCO Corporate Enrollment & Admin System", "version": "2.0.0"}

@app.get("/plans")
def get_plans(db: Session = Depends(get_db)):
    legacy = db.scalar(select(PlanConfig).where(PlanConfig.code == "emi_shield"))
    if legacy:
        db.delete(legacy)
        db.commit()

    plans = db.scalars(select(PlanConfig).where(and_(PlanConfig.is_active == True, PlanConfig.code != "emi_shield"))).all()
    return [
        {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "fee_percentage": float(p.fee_percentage),
            "avail_benefit_times": p.avail_benefit_times,
            "activation_period_days": p.activation_period_days,
            "repayment_period_days": p.repayment_period_days,
            "activation_service_charge": p.activation_service_charge,
            "default_interest_monthly": float(p.default_interest_monthly),
            "description": p.description
        }
        for p in plans
    ]

@app.post("/applications", status_code=201)
def create_application(data: ApplicationIn, request: Request, db: Session = Depends(get_db)):
    if not data.declaration:
        raise HTTPException(422, "Applicant declaration is required")
    
    d = data.model_dump()
    pan = d.pop("pan")
    aadhaar = d.pop("aadhaar", None)
    
    # Calculate fee if not provided based on selected plan
    plan_name = d.get("plan_name") or "EMI Shield Pro"
    plan = db.scalar(select(PlanConfig).where(PlanConfig.name == plan_name))
    plan_rate = float(plan.fee_percentage) if plan else 18.99
    d["plan_name"] = plan_name
    d["plan_rate"] = plan_rate
    d["repayment_period_days"] = plan.repayment_period_days if plan else 90
    
    if d.get("annual_subscription_fee") is None:
        # Standard fee calculation: plan_rate percentage of annual EMI or monthly EMI base
        d["annual_subscription_fee"] = round(d["emi_amount"] * (plan_rate / 100.0), 2)
    
    # Initial verification checklist structure
    default_checklist = {
        "identity_verified": False,
        "pan_verified": False,
        "loan_sanction_verified": False,
        "income_proof_verified": False,
        "bank_statement_verified": False,
        "address_verified": False
    }
    d["verification_checklist"] = json.dumps(default_checklist)
    
    app_no = "RB-" + datetime.now(timezone.utc).strftime("%y%m%d") + "-" + uuid.uuid4().hex[:6].upper()
    a = Application(
        application_no=app_no,
        pan_encrypted=encrypt_value(pan.upper()),
        aadhaar_encrypted=encrypt_value(aadhaar) if aadhaar else None,
        **d
    )
    db.add(a)
    db.flush()
    
    # Create initial timeline record
    timeline_entry = ApplicationTimeline(
        application_id=a.id,
        user_id=None,
        user_email="Applicant",
        previous_status=None,
        new_status="Pending",
        remarks=f"Public application submitted via REBCO Enrollment Portal under plan: {plan_name}"
    )
    db.add(timeline_entry)
    
    log_audit(db, None, "APPLICATION_CREATED", a.id, f"Public enrollment submitted: {a.application_no} ({plan_name})", request)
    db.commit()
    
    return {
        "message": "Application received successfully",
        "application_no": a.application_no,
        "plan_name": a.plan_name,
        "annual_subscription_fee": float(a.annual_subscription_fee)
    }

@app.post("/applications/{application_no}/documents", status_code=201)
async def public_upload_document(
    application_no: str, 
    file: UploadFile = File(...), 
    category: str = Form("other"), 
    db: Session = Depends(get_db)
):
    a = db.scalar(select(Application).where(Application.application_no == application_no))
    if not a:
        raise HTTPException(404, "Application not found")
    if file.content_type not in ALLOWED:
        raise HTTPException(415, "Only PDF, JPEG and PNG files are allowed")
    
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, "File exceeds maximum upload size")
        
    stored = uuid.uuid4().hex
    os.makedirs(settings.upload_dir, exist_ok=True)
    Path(settings.upload_dir, stored).write_bytes(content)
    
    doc = Document(
        application_id=a.id,
        original_name=os.path.basename(file.filename or "document"),
        stored_name=stored,
        content_type=file.content_type,
        size=len(content),
        category=category,
        status="pending"
    )
    db.add(doc)
    db.commit()
    return {"message": "Document uploaded successfully", "id": doc.id, "name": doc.original_name, "category": category}

# --- AUTHENTICATION ---

@app.post("/auth/login")
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == data.email.lower()))
    if not u or not u.active or not verify_password(data.password, u.password_hash):
        raise HTTPException(401, "Invalid email or password")
    
    log_audit(db, u, "LOGIN", detail="Successful corporate staff login", request=request)
    db.commit()
    return {
        "access_token": create_token(u),
        "token_type": "bearer",
        "role": u.role,
        "email": u.email,
        "full_name": u.full_name or u.email.split("@")[0].title()
    }

@app.get("/auth/me")
def get_current_user_profile(user: User = Depends(current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name or user.email.split("@")[0].title(),
        "role": user.role
    }

# --- ADMIN / STAFF ENDPOINTS ---

@app.get("/admin/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    total = db.scalar(select(func.count(Application.id))) or 0
    statuses = ["Pending", "Under Review", "Documents Required", "Approved", "Rejected"]
    counts = {s: db.scalar(select(func.count(Application.id)).where(Application.status == s)) or 0 for s in statuses}
    
    # Financial metrics
    total_sanctioned = db.scalar(select(func.sum(Application.sanctioned_amount))) or 0
    total_emi = db.scalar(select(func.sum(Application.emi_amount))) or 0
    total_fees = db.scalar(select(func.sum(Application.annual_subscription_fee))) or 0
    
    # Plan distribution
    plan_counts = {
        "EMI Shield Pro": db.scalar(select(func.count(Application.id)).where(Application.plan_name == "EMI Shield Pro")) or 0
    }
    
    recent_apps = db.scalars(select(Application).order_by(Application.created_at.desc()).limit(10)).all()
    recent_audits = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(8)).all()
    
    # Monthly trend calculation for last 6 months
    now = datetime.now(timezone.utc)
    monthly_trend = []
    for i in range(5, -1, -1):
        m_start = (now - timedelta(days=i*30)).strftime("%Y-%m")
        count = db.scalar(select(func.count(Application.id)).where(func.strftime("%Y-%m", Application.created_at) == m_start)) or 0
        monthly_trend.append({"month": m_start, "count": count})
    
    return {
        "total": total,
        "statuses": counts,
        "plans": plan_counts,
        "financials": {
            "total_sanctioned": float(total_sanctioned),
            "total_emi_monthly": float(total_emi),
            "total_fees_projected": float(total_fees)
        },
        "monthly_trend": monthly_trend,
        "recent": [serialize_application(a, include_sensitive=False) for a in recent_apps],
        "activities": [
            {
                "id": act.id,
                "action": act.action,
                "detail": act.detail,
                "application_id": act.application_id,
                "created_at": act.created_at.isoformat() if act.created_at else None
            }
            for act in recent_audits
        ]
    }

@app.get("/admin/applications")
def list_applications(
    q: str = "",
    status: str = "",
    plan: str = "",
    assigned_to: Optional[int] = None,
    date_from: str = "",
    date_to: str = "",
    page: int = 1,
    page_size: int = 25,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    db: Session = Depends(get_db),
    user: User = Depends(require_staff)
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(Application)
    
    if q:
        stmt = stmt.where(or_(
            Application.full_name.ilike(f"%{q}%"),
            Application.email.ilike(f"%{q}%"),
            Application.contact_no.ilike(f"%{q}%"),
            Application.application_no.ilike(f"%{q}%"),
            Application.loan_account.ilike(f"%{q}%"),
            Application.lender.ilike(f"%{q}%")
        ))
    if status:
        stmt = stmt.where(Application.status == status)
    if plan:
        stmt = stmt.where(Application.plan_name == plan)
    if assigned_to is not None:
        stmt = stmt.where(Application.assigned_to_id == assigned_to)
    if date_from:
        stmt = stmt.where(func.date(Application.created_at) >= date_from)
    if date_to:
        stmt = stmt.where(func.date(Application.created_at) <= date_to)
        
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    
    # Sorting
    order_col = getattr(Application, sort_by, Application.created_at)
    stmt = stmt.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())
    
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "items": [serialize_application(a, include_sensitive=False) for a in rows],
        "total": total,
        "page": page,
        "page_size": page_size
    }

@app.get("/admin/applications/{app_id}")
def get_application(app_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    log_audit(db, user, "APPLICATION_VIEWED", a.id, f"Viewed details for {a.application_no}", request)
    db.commit()
    # Masked by default even for admins; unmasking is done via explicit audited endpoint
    return serialize_application(a, include_sensitive=False)

@app.get("/admin/applications/{app_id}/unmask")
def unmask_sensitive_data(app_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    
    # Strict audit log for sensitive KYC unmasking
    log_audit(db, user, "SENSITIVE_DATA_UNMASKED", a.id, f"Admin unmasked PAN/Aadhaar for {a.application_no}", request)
    db.commit()
    
    pan = decrypt_value(a.pan_encrypted) if a.pan_encrypted else ""
    aadhaar = decrypt_value(a.aadhaar_encrypted) if a.aadhaar_encrypted else ""
    return {
        "id": a.id,
        "application_no": a.application_no,
        "pan": pan,
        "aadhaar": aadhaar
    }

@app.patch("/admin/applications/{app_id}")
def update_application(
    app_id: int, 
    data: StatusIn, 
    request: Request, 
    db: Session = Depends(get_db), 
    user: User = Depends(require_executive_or_admin)
):
    allowed = ["Pending", "Under Review", "Approved", "Rejected", "Documents Required"]
    if data.status and data.status not in allowed:
        raise HTTPException(422, "Invalid application status")
        
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found")
        
    old_status = a.status
    status_changed = (data.status and data.status != old_status)
    if status_changed:
        a.status = data.status
        
    if data.admin_notes is not None:
        a.admin_notes = data.admin_notes
    if data.assigned_to_id is not None:
        a.assigned_to_id = data.assigned_to_id if data.assigned_to_id > 0 else None
    if data.verification_checklist is not None:
        a.verification_checklist = data.verification_checklist
        
    remarks_text = data.remarks or data.admin_notes or ("Status updated" if status_changed else "Application updated")
    
    if status_changed or data.remarks:
        timeline_entry = ApplicationTimeline(
            application_id=a.id,
            user_id=user.id,
            user_email=user.email,
            previous_status=old_status,
            new_status=a.status,
            remarks=remarks_text
        )
        db.add(timeline_entry)
        
    log_audit(db, user, "STATUS_CHANGED" if status_changed else "APPLICATION_UPDATED", a.id, f"{old_status} -> {a.status}; {remarks_text}", request)
    db.commit()
    return serialize_application(a, include_sensitive=False)

# --- DOCUMENT MANAGEMENT ---

@app.get("/admin/documents")
def list_all_documents(
    status: str = "", 
    category: str = "", 
    page: int = 1, 
    page_size: int = 50, 
    db: Session = Depends(get_db), 
    user: User = Depends(require_staff)
):
    stmt = select(Document).join(Application)
    if status:
        stmt = stmt.where(Document.status == status)
    if category:
        stmt = stmt.where(Document.category == category)
        
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    docs = db.scalars(stmt.order_by(Document.uploaded_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    
    return {
        "items": [
            {
                "id": d.id,
                "application_id": d.application_id,
                "application_no": d.application.application_no,
                "customer_name": d.application.full_name,
                "name": d.original_name,
                "size": d.size,
                "content_type": d.content_type,
                "category": d.category or "other",
                "status": d.status or "pending",
                "remarks": d.remarks,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None
            }
            for d in docs
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }

@app.post("/admin/applications/{app_id}/documents", status_code=201)
async def admin_upload_document(
    app_id: int,
    request: Request,
    file: UploadFile = File(...),
    category: str = Form("other"),
    db: Session = Depends(get_db),
    user: User = Depends(require_executive_or_admin)
):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    if file.content_type not in ALLOWED:
        raise HTTPException(415, "Only PDF, JPEG and PNG files are allowed")
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, "File exceeds maximum upload size")
        
    stored = uuid.uuid4().hex
    os.makedirs(settings.upload_dir, exist_ok=True)
    Path(settings.upload_dir, stored).write_bytes(content)
    
    doc = Document(
        application_id=a.id,
        original_name=os.path.basename(file.filename or "document"),
        stored_name=stored,
        content_type=file.content_type,
        size=len(content),
        category=category,
        status="pending"
    )
    db.add(doc)
    log_audit(db, user, "DOCUMENT_UPLOADED", a.id, f"Document uploaded by staff: {doc.original_name} ({category})", request)
    db.commit()
    return {"id": doc.id, "name": doc.original_name, "category": doc.category}

@app.patch("/admin/documents/{doc_id}/status")
def update_document_status(
    doc_id: int, 
    data: DocumentStatusIn, 
    request: Request, 
    db: Session = Depends(get_db), 
    user: User = Depends(require_executive_or_admin)
):
    d = db.get(Document, doc_id)
    if not d:
        raise HTTPException(404, "Document not found")
        
    old_status = d.status
    d.status = data.status
    if data.remarks is not None:
        d.remarks = data.remarks
        
    log_audit(db, user, "DOCUMENT_VERIFIED", d.application_id, f"Doc #{d.id} ({d.original_name}): {old_status} -> {d.status}. Remarks: {data.remarks}", request)
    db.commit()
    return {"id": d.id, "status": d.status, "remarks": d.remarks}

@app.get("/admin/documents/{doc_id}")
def download_document(doc_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    d = db.get(Document, doc_id)
    if not d:
        raise HTTPException(404, "Document not found")
    path = Path(settings.upload_dir, d.stored_name)
    if not path.exists():
        raise HTTPException(404, "Stored document missing on server disk")
    log_audit(db, user, "DOCUMENT_DOWNLOADED", d.application_id, f"Downloaded {d.original_name}", request)
    db.commit()
    return FileResponse(path, media_type=d.content_type, filename=d.original_name, content_disposition_type="attachment")

# --- EXPORT & AUDIT ---

@app.get("/admin/export.csv")
def export_csv(
    status: str = "",
    date_from: str = "",
    date_to: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_admin)
):
    stmt = select(Application)
    if status:
        stmt = stmt.where(Application.status == status)
    if date_from:
        stmt = stmt.where(func.date(Application.created_at) >= date_from)
    if date_to:
        stmt = stmt.where(func.date(Application.created_at) <= date_to)
        
    rows = db.scalars(stmt.order_by(Application.created_at.desc())).all()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow([
        "Application No", "Date", "Status", "Full Name", "Gender", "Occupation",
        "Contact", "Mobile", "Email", "Current Address", "Organization", "Monthly Income",
        "Lender", "Loan Account", "Sanctioned Amount", "Outstanding Balance", "EMI Amount",
        "EMI Due Date", "Remaining Tenure", "Plan Name", "Plan Rate (%)", "Subscription Fee",
        "Assigned Executive", "PAN (Masked)"
    ])
    for a in rows:
        pan_masked = mask(decrypt_value(a.pan_encrypted)) if a.pan_encrypted else ""
        exec_name = a.assigned_to.full_name if a.assigned_to else (a.assigned_to.email if a.assigned_to else "Unassigned")
        w.writerow([
            a.application_no, a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "",
            a.status, a.full_name, a.gender, a.occupation,
            a.contact_no, a.mobile, a.email, a.current_address, a.organization or "",
            a.monthly_income or 0, a.lender, a.loan_account, a.sanctioned_amount,
            a.outstanding_balance, a.emi_amount, a.emi_due_date, a.remaining_tenure,
            a.plan_name, a.plan_rate, a.annual_subscription_fee or 0,
            exec_name, pan_masked
        ])
    log_audit(db, user, "EXPORT_CSV", detail=f"Exported {len(rows)} application rows")
    db.commit()
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=rebco-applications-{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/admin/audit-logs")
def audit_logs(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    logs = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(300)).all()
    return [
        {
            "id": x.id,
            "user_id": x.user_id,
            "application_id": x.application_id,
            "action": x.action,
            "detail": x.detail,
            "ip_address": x.ip_address,
            "created_at": x.created_at.isoformat() if x.created_at else None
        }
        for x in logs
    ]

# --- USER & STAFF MANAGEMENT ---

@app.get("/admin/executives")
def list_executives(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    users = db.scalars(select(User).where(and_(User.active == True, User.role.in_(["super_admin", "admin", "verification_executive"])))).all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name or u.email.split("@")[0].title(), "role": u.role} for u in users]

@app.get("/admin/users")
def list_all_users(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    res = []
    for u in users:
        assigned_count = db.scalar(select(func.count(Application.id)).where(Application.assigned_to_id == u.id)) or 0
        res.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name or u.email.split("@")[0].title(),
            "role": u.role,
            "active": u.active,
            "assigned_applications": assigned_count,
            "created_at": u.created_at.isoformat() if u.created_at else None
        })
    return res

@app.post("/admin/users", status_code=201)
def create_staff_user(data: UserCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if data.role not in STAFF_ROLES:
        raise HTTPException(422, f"Role must be one of: {', '.join(STAFF_ROLES)}")
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "User email already exists")
    
    u = User(
        email=email,
        full_name=data.full_name or email.split("@")[0].title(),
        password_hash=hash_password(data.password),
        role=data.role,
        active=True
    )
    db.add(u)
    log_audit(db, user, "USER_CREATED", detail=f"Created staff account {email} with role {data.role}", request=request)
    db.commit()
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}

@app.patch("/admin/users/{user_id}")
def update_user_status(user_id: int, data: UserUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if data.role:
        if data.role not in STAFF_ROLES:
            raise HTTPException(422, "Invalid role specified")
        u.role = data.role
    if data.full_name is not None:
        u.full_name = data.full_name
    if data.active is not None:
        u.active = data.active
    if data.password:
        if len(data.password) < 8:
            raise HTTPException(422, "Password must be at least 8 characters")
        u.password_hash = hash_password(data.password)
        
    log_audit(db, user, "USER_UPDATED", detail=f"Updated user #{u.id} ({u.email})", request=request)
    db.commit()
    return {"id": u.id, "email": u.email, "role": u.role, "active": u.active}

# --- PLAN CONFIGURATION ---

@app.get("/admin/plans")
def list_admin_plans(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    legacy = db.scalar(select(PlanConfig).where(PlanConfig.code == "emi_shield"))
    if legacy:
        db.delete(legacy)
        db.commit()

    plans = db.scalars(select(PlanConfig).where(PlanConfig.code != "emi_shield")).all()
    return [
        {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "fee_percentage": float(p.fee_percentage),
            "avail_benefit_times": p.avail_benefit_times,
            "activation_period_days": p.activation_period_days,
            "repayment_period_days": p.repayment_period_days,
            "activation_service_charge": p.activation_service_charge,
            "default_interest_monthly": float(p.default_interest_monthly),
            "description": p.description,
            "is_active": p.is_active,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None
        }
        for p in plans
    ]

@app.put("/admin/plans/{code}")
def update_plan_config(code: str, data: PlanConfigIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    p = db.scalar(select(PlanConfig).where(PlanConfig.code == code))
    if not p:
        raise HTTPException(404, "Plan configuration not found")
        
    old_rate = float(p.fee_percentage)
    p.name = data.name
    p.fee_percentage = data.fee_percentage
    p.avail_benefit_times = data.avail_benefit_times
    p.activation_period_days = data.activation_period_days
    p.repayment_period_days = data.repayment_period_days
    p.activation_service_charge = data.activation_service_charge
    p.default_interest_monthly = data.default_interest_monthly
    p.description = data.description
    p.is_active = data.is_active
    
    log_audit(db, user, "PLAN_CONFIG_UPDATED", detail=f"Updated plan {code}: Rate changed {old_rate}% -> {data.fee_percentage}%", request=request)
    db.commit()
    return {"message": "Plan updated successfully", "code": p.code, "fee_percentage": float(p.fee_percentage)}

# --- COMPREHENSIVE REPORTS ---

@app.get("/admin/reports")
def get_reports(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    total_apps = db.scalar(select(func.count(Application.id))) or 0
    total_loans = float(db.scalar(select(func.sum(Application.sanctioned_amount))) or 0)
    total_emis = float(db.scalar(select(func.sum(Application.emi_amount))) or 0)
    total_fees = float(db.scalar(select(func.sum(Application.annual_subscription_fee))) or 0)
    
    # Status breakdown
    statuses = ["Pending", "Under Review", "Documents Required", "Approved", "Rejected"]
    status_metrics = []
    for s in statuses:
        count = db.scalar(select(func.count(Application.id)).where(Application.status == s)) or 0
        rate = round((count / total_apps * 100), 1) if total_apps > 0 else 0
        status_metrics.append({"status": s, "count": count, "percentage": rate})
        
    # Executive performance
    executives = db.scalars(select(User).where(User.role.in_(["super_admin", "admin", "verification_executive"]))).all()
    exec_performance = []
    for e in executives:
        assigned = db.scalar(select(func.count(Application.id)).where(Application.assigned_to_id == e.id)) or 0
        approved = db.scalar(select(func.count(Application.id)).where(and_(Application.assigned_to_id == e.id, Application.status == "Approved"))) or 0
        reviewed = db.scalar(select(func.count(Application.id)).where(and_(Application.assigned_to_id == e.id, Application.status.in_(["Approved", "Rejected"])))) or 0
        exec_performance.append({
            "executive_id": e.id,
            "name": e.full_name or e.email.split("@")[0].title(),
            "email": e.email,
            "assigned": assigned,
            "reviewed": reviewed,
            "approved": approved
        })
        
    # Lender distribution top 5
    lenders = db.execute(
        select(Application.lender, func.count(Application.id), func.sum(Application.sanctioned_amount))
        .group_by(Application.lender)
        .order_by(desc(func.count(Application.id)))
        .limit(6)
    ).all()
    lender_stats = [
        {"lender": row[0], "applications": row[1], "sanctioned_total": float(row[2] or 0)}
        for row in lenders
    ]
    
    return {
        "summary": {
            "total_applications": total_apps,
            "total_loan_value": total_loans,
            "total_monthly_emi": total_emis,
            "total_subscription_volume": total_fees
        },
        "status_metrics": status_metrics,
        "executive_performance": exec_performance,
        "top_lenders": lender_stats
    }

# --- STATIC FILE SERVING & SPA FALLBACK FOR PRODUCTION DEPLOYMENT ---
from fastapi.staticfiles import StaticFiles

frontend_dist_candidates = [
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
    Path("frontend/dist"),
    Path("/app/frontend/dist"),
    Path("../frontend/dist")
]

dist_dir = next((p for p in frontend_dist_candidates if p.exists() and (p / "index.html").exists()), None)

if dist_dir and settings.serve_frontend:
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.api_route("/logo.svg", methods=["GET", "HEAD"], include_in_schema=False)
    def serve_logo():
        logo_path = dist_dir / "logo.svg"
        if logo_path.exists():
            return FileResponse(logo_path, media_type="image/svg+xml")
        raise HTTPException(404)

    @app.api_route("/rebco_logo.svg", methods=["GET", "HEAD"], include_in_schema=False)
    def serve_rebco_logo():
        logo_path = dist_dir / "rebco_logo.svg"
        if logo_path.exists():
            return FileResponse(logo_path, media_type="image/svg+xml")
        raise HTTPException(404)

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_spa_frontend(full_path: str):
        if full_path.startswith(("api/", "admin/", "auth/", "health", "plans", "applications", "docs", "redoc", "openapi.json")):
            raise HTTPException(404, "Not Found")
        target_file = dist_dir / full_path
        if target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(dist_dir / "index.html")
