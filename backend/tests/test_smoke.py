import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app.models import User, Application, Document, PlanConfig
from app.security import hash_password

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_get_plans():
    response = client.get("/plans")
    assert response.status_code == 200
    plans = response.json()
    assert len(plans) >= 1
    codes = [p["code"] for p in plans]
    assert "emi_shield_pro" in codes

def test_admin_login():
    response = client.post("/auth/login", json={
        "email": "admin@rebco.com",
        "password": "Admin@REBCO1234"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] in ["super_admin", "admin"]

def test_create_application_and_retrieve():
    # 1. Submit valid customer application
    app_data = {
        "full_name": "Rajesh Sharma",
        "gender": "Male",
        "occupation": "Salaried",
        "pan": "ABCDE1234F",
        "aadhaar": "987654321012",
        "contact_no": "9876543210",
        "mobile": "9876543210",
        "email": "rajesh.sharma@example.com",
        "current_address": "Flat 402, Highmont Towers, Hinjewadi Phase 1, Pune",
        "permanent_address": "Flat 402, Highmont Towers, Hinjewadi Phase 1, Pune",
        "organization": "Tech Solutions India Pvt Ltd",
        "monthly_income": 125000.0,
        "existing_emis": 25000.0,
        "lender": "HDFC Bank",
        "loan_account": "HDFC-HL-88992211",
        "sanctioned_amount": 5500000.0,
        "outstanding_balance": 4800000.0,
        "emi_amount": 46500.0,
        "emi_due_date": 10,
        "remaining_tenure": 180,
        "plan_name": "EMI Shield Pro",
        "declaration": True
    }
    create_res = client.post("/applications", json=app_data)
    assert create_res.status_code == 201
    res_json = create_res.json()
    assert "application_no" in res_json
    app_no = res_json["application_no"]
    assert res_json["plan_name"] == "EMI Shield Pro"
    assert res_json["annual_subscription_fee"] > 0
    
    # 2. Login as admin to view the application
    login_res = client.post("/auth/login", json={
        "email": "admin@rebco.com",
        "password": "Admin@REBCO1234"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Check application in list
    list_res = client.get(f"/admin/applications?q={app_no}", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) >= 1
    found = next((i for i in items if i["application_no"] == app_no), None)
    assert found is not None
    assert found["full_name"] == "Rajesh Sharma"
    # Ensure sensitive fields are masked by default!
    assert found["pan"] == "******234F"
    assert found["aadhaar"] == "********1012"
    
    # 4. View single application
    app_id = found["id"]
    detail_res = client.get(f"/admin/applications/{app_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["pan"] == "******234F"
    assert len(detail["timeline"]) >= 1
    
    # 5. Test audited unmasking endpoint
    unmask_res = client.get(f"/admin/applications/{app_id}/unmask", headers=headers)
    assert unmask_res.status_code == 200
    unmask_data = unmask_res.json()
    assert unmask_data["pan"] == "ABCDE1234F"
    assert unmask_data["aadhaar"] == "987654321012"
    
    # 6. Update status and verify timeline
    patch_res = client.patch(f"/admin/applications/{app_id}", headers=headers, json={
        "status": "Under Review",
        "admin_notes": "Initial documentation under review by operations team",
        "remarks": "Assigned to desk for KYC check"
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "Under Review"
    assert len(updated["timeline"]) >= 2
