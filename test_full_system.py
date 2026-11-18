import httpx
import json

base_url = "http://localhost:8000"
client = httpx.Client(timeout=10.0)

def test_full_flow():
    print("=== 1. Health & Configured Plans ===")
    r = client.get(f"{base_url}/health")
    assert r.status_code == 200
    print("Health OK:", r.json())

    r = client.get(f"{base_url}/plans")
    assert r.status_code == 200
    plans = r.json()
    print("Plans returned:", [p["name"] + f" ({p['fee_percentage']}%)" for p in plans])
    assert len(plans) >= 1
    assert any(p["name"] == "EMI Shield" for p in plans)

    print("\n=== 2. Admin Authentication ===")
    r = client.post(f"{base_url}/auth/login", json={
        "email": "admin@rebco.com",
        "password": "Admin@REBCO1234"
    })
    assert r.status_code == 200
    admin_auth = r.json()
    admin_token = admin_auth["access_token"]
    print("Admin login success. Role:", admin_auth["role"])
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    print("\n=== 3. RBAC Roles Verification ===")
    # Create Verification Executive
    r_exec = client.post(f"{base_url}/admin/users", headers=admin_headers, json={
        "email": "executive@rebco.com",
        "full_name": "Arjun Kapoor",
        "password": "Executive@1234",
        "role": "verification_executive"
    })
    if r_exec.status_code in [201, 409]:
        print("Executive account created or exists")

    # Login as Executive
    r_exec_login = client.post(f"{base_url}/auth/login", json={
        "email": "executive@rebco.com",
        "password": "Executive@1234"
    })
    assert r_exec_login.status_code == 200
    exec_token = r_exec_login.json()["access_token"]
    exec_headers = {"Authorization": f"Bearer {exec_token}"}
    print("Executive authenticated successfully.")

    # Executive attempts admin-only endpoint (e.g. creating a user) -> should get 403 Forbidden!
    r_forbidden = client.post(f"{base_url}/admin/users", headers=exec_headers, json={
        "email": "unauth@rebco.com",
        "password": "Password@1234",
        "role": "reviewer"
    })
    assert r_forbidden.status_code == 403
    print("RBAC verified: Executive is forbidden from creating users (403 Forbidden).")

    # Create Reviewer account
    r_rev = client.post(f"{base_url}/admin/users", headers=admin_headers, json={
        "email": "reviewer@rebco.com",
        "full_name": "Neha Gupta",
        "password": "Reviewer@1234",
        "role": "reviewer"
    })
    if r_rev.status_code in [201, 409]:
        print("Reviewer account created or exists")

    r_rev_login = client.post(f"{base_url}/auth/login", json={
        "email": "reviewer@rebco.com",
        "password": "Reviewer@1234"
    })
    rev_token = r_rev_login.json()["access_token"]
    rev_headers = {"Authorization": f"Bearer {rev_token}"}
    
    # Reviewer attempts updating application status -> should get 403!
    r_rev_forbidden = client.patch(f"{base_url}/admin/applications/1", headers=rev_headers, json={
        "status": "Approved"
    })
    assert r_rev_forbidden.status_code == 403
    print("RBAC verified: Reviewer is forbidden from modifying application status (403 Forbidden).")

    print("\n=== 4. Customer Enrollment Submission ===")
    app_payload = {
        "full_name": "Pooja Hegde",
        "gender": "Female",
        "occupation": "Salaried",
        "pan": "ABCDE5678K",
        "aadhaar": "889977665544",
        "contact_no": "9819283746",
        "mobile": "9819283746",
        "email": "pooja.hegde@example.com",
        "current_address": "B-1204, Lodha Bellissimo, Mahalaxmi, Mumbai - 400011",
        "permanent_address": "B-1204, Lodha Bellissimo, Mahalaxmi, Mumbai - 400011",
        "organization": "Morgan Stanley India",
        "monthly_income": 250000.0,
        "existing_emis": 45000.0,
        "lender": "State Bank of India",
        "loan_account": "SBI-HL-77221100",
        "sanctioned_amount": 9500000.0,
        "outstanding_balance": 8800000.0,
        "emi_amount": 82000.0,
        "emi_due_date": 7,
        "remaining_tenure": 240,
        "plan_name": "EMI Shield",
        "plan_rate": 18.99,
        "declaration": True,
        "financial_notes": "Senior Vice President. Looking for peace of mind against global job mobility."
    }
    r_sub = client.post(f"{base_url}/applications", json=app_payload)
    assert r_sub.status_code == 201
    sub_data = r_sub.json()
    app_no = sub_data["application_no"]
    print(f"Customer application submitted: Ref #{app_no}, Fee: ₹{sub_data['annual_subscription_fee']}")

    print("\n=== 5. Categorized Document Upload ===")
    dummy_pdf = b"%PDF-1.4 dummy salary slip content for verification testing"
    r_doc = client.post(
        f"{base_url}/applications/{app_no}/documents",
        data={"category": "income_proof"},
        files={"file": ("salary_slip_october.pdf", dummy_pdf, "application/pdf")}
    )
    assert r_doc.status_code == 201
    doc_data = r_doc.json()
    print("Document uploaded:", doc_data["name"], "Category:", doc_data["category"])

    print("\n=== 6. Application Retrieval & Masked KYC ===")
    r_list = client.get(f"{base_url}/admin/applications?q={app_no}", headers=admin_headers)
    assert r_list.status_code == 200
    items = r_list.json()["items"]
    app_record = items[0]
    app_id = app_record["id"]
    print("Found record. PAN (Masked):", app_record["pan"], "Aadhaar (Masked):", app_record["aadhaar"])
    assert "******" in app_record["pan"]
    assert "********" in app_record["aadhaar"]

    print("\n=== 7. Audited Unmasking (Super Admin / Admin) ===")
    r_unmask = client.get(f"{base_url}/admin/applications/{app_id}/unmask", headers=admin_headers)
    assert r_unmask.status_code == 200
    unmasked = r_unmask.json()
    print("Unmasked PAN:", unmasked["pan"], "Aadhaar:", unmasked["aadhaar"])
    assert unmasked["pan"] == "ABCDE5678K"
    assert unmasked["aadhaar"] == "889977665544"

    print("\n=== 8. Application Status Transition & Timeline ===")
    r_patch = client.patch(f"{base_url}/admin/applications/{app_id}", headers=exec_headers, json={
        "status": "Under Review",
        "admin_notes": "Income documents verified against Bank statement",
        "remarks": "Assigned to Senior Underwriter Arjun"
    })
    assert r_patch.status_code == 200

    r_patch2 = client.patch(f"{base_url}/admin/applications/{app_id}", headers=admin_headers, json={
        "status": "Approved",
        "admin_notes": "All eligibility criteria met. EMI Shield coverage confirmed.",
        "remarks": "Policy schedule issued to borrower."
    })
    assert r_patch2.status_code == 200
    updated = r_patch2.json()
    print("Updated Status:", updated["status"])
    print("Timeline Events Count:", len(updated["timeline"]))
    assert len(updated["timeline"]) >= 3

    print("\n=== 9. Document Verification ===")
    doc_id = updated["documents"][0]["id"]
    r_doc_verify = client.patch(f"{base_url}/admin/documents/{doc_id}/status", headers=exec_headers, json={
        "status": "approved",
        "remarks": "Official Morgan Stanley letterhead salary slip confirmed"
    })
    assert r_doc_verify.status_code == 200
    print("Document status verified:", r_doc_verify.json()["status"])

    print("\n=== 10. Reports & Audit Trail ===")
    r_rep = client.get(f"{base_url}/admin/reports", headers=admin_headers)
    assert r_rep.status_code == 200
    rep = r_rep.json()
    print("Total Protected Loan Value:", rep["summary"]["total_loan_value"])
    print("Top Lenders:", [l["lender"] for l in rep["top_lenders"]])

    r_aud = client.get(f"{base_url}/admin/audit-logs", headers=admin_headers)
    assert r_aud.status_code == 200
    logs = r_aud.json()
    print("Latest Audit Actions:", [l["action"] for l in logs[:5]])

    print("\n=== 11. CSV Registry Export ===")
    r_csv = client.get(f"{base_url}/admin/export.csv", headers=admin_headers)
    assert r_csv.status_code == 200
    assert "Content-Disposition" in r_csv.headers
    print("CSV Export length:", len(r_csv.text), "bytes")
    print("CSV Header:", r_csv.text.splitlines()[0])

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_flow()

