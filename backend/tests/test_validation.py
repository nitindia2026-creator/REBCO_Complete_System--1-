import pytest
import io
from fastapi.testclient import TestClient
from app.main import app
from app.validators import validate_verhoeff

client = TestClient(app)

BASE_VALID_APP = {
    "full_name": "Rajesh Kumar Sharma",
    "gender": "Male",
    "occupation": "Salaried",
    "pan": "ABCDE1234F",
    "aadhaar": "987654321012",
    "contact_no": "9876543210",
    "mobile": "9876543210",
    "email": "rajesh.sharma@example.com",
    "current_address": "Flat 402, Highmont Towers, Hinjewadi Phase 1, Pune 411057",
    "permanent_address": "House 12, Civil Lines, Nagpur 440001",
    "organization": "Tata Consultancy Services",
    "monthly_income": 125000.0,
    "existing_emis": 25000.0,
    "lender": "HDFC Bank",
    "loan_account": "HDFC-HL-88992211",
    "sanctioned_amount": 5500000.0,
    "outstanding_balance": 4800000.0,
    "emi_amount": 46500.0,
    "emi_due_date": 10,
    "remaining_tenure": 180,
    "plan_name": "EMI Shield",
    "declaration": True
}

def test_valid_application_submission():
    res = client.post("/applications", json=BASE_VALID_APP)
    assert res.status_code == 201
    data = res.json()
    assert "application_no" in data
    assert data["plan_name"] == "EMI Shield"
    assert data["annual_subscription_fee"] > 0

def test_invalid_indian_mobile_numbers():
    # 1. Too short (9 digits)
    bad_app = {**BASE_VALID_APP, "mobile": "987654321"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422
    errors = r.json().get("errors", [])
    assert any(e["field"] == "mobile" for e in errors)

    # 2. Too long (11 digits)
    bad_app = {**BASE_VALID_APP, "mobile": "98765432100"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # 3. Starts with invalid leading digit (e.g. 5)
    bad_app = {**BASE_VALID_APP, "mobile": "5876543210"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # 4. Letters in mobile
    bad_app = {**BASE_VALID_APP, "mobile": "98765ABCDE"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

def test_aadhaar_length_and_verhoeff_checksum():
    # 1. Verhoeff helper direct test
    assert validate_verhoeff("987654321012") is True
    assert validate_verhoeff("987654321019") is False

    # 2. Too short (11 digits)
    bad_app = {**BASE_VALID_APP, "aadhaar": "98765432101"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # 3. Bad checksum (12 digits, but checksum fails)
    bad_app = {**BASE_VALID_APP, "aadhaar": "987654321019"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422
    assert "Aadhaar" in str(r.json())

    # 4. Optional aadhaar omitted is allowed
    good_app = {**BASE_VALID_APP, "aadhaar": None}
    r = client.post("/applications", json=good_app)
    assert r.status_code == 201

def test_valid_and_invalid_pan_patterns():
    # Incomplete PAN (8 characters)
    bad_app = {**BASE_VALID_APP, "pan": "ABCDE123"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # Inverted structure (digits first)
    bad_app = {**BASE_VALID_APP, "pan": "12345ABCDE"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # Lowercase gets normalized and accepted
    good_app = {**BASE_VALID_APP, "pan": "abcde1234f"}
    r = client.post("/applications", json=good_app)
    assert r.status_code == 201

def test_email_validation():
    bad_app = {**BASE_VALID_APP, "email": "not-an-email"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    bad_app = {**BASE_VALID_APP, "email": "user@domain"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

def test_names_containing_digits_or_unsupported_symbols():
    # Name with numbers
    bad_app = {**BASE_VALID_APP, "full_name": "Amol123"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # Name with special symbols
    bad_app = {**BASE_VALID_APP, "full_name": "John@Doe"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

def test_negative_and_zero_financial_amounts():
    # Sanctioned amount <= 0
    bad_app = {**BASE_VALID_APP, "sanctioned_amount": 0}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    bad_app = {**BASE_VALID_APP, "sanctioned_amount": -100000}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # EMI amount <= 0
    bad_app = {**BASE_VALID_APP, "emi_amount": 0}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # Outstanding balance exceeding sanctioned amount
    bad_app = {**BASE_VALID_APP, "sanctioned_amount": 1000000, "outstanding_balance": 2000000}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

def test_loan_tenure_limits():
    # Tenure < 12 months
    bad_app = {**BASE_VALID_APP, "remaining_tenure": 6}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

    # Tenure > 480 months
    bad_app = {**BASE_VALID_APP, "remaining_tenure": 500}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

def test_script_injection_in_address():
    bad_app = {**BASE_VALID_APP, "current_address": "Flat 101 <script>alert('xss')</script>"}
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422

def test_document_upload_security_and_magic_bytes():
    # First submit an application to get application_no
    res = client.post("/applications", json=BASE_VALID_APP)
    assert res.status_code == 201
    app_no = res.json()["application_no"]

    # 1. Valid PDF with proper magic bytes (%PDF)
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    r = client.post(
        f"/applications/{app_no}/documents",
        files={"file": ("sanction.pdf", io.BytesIO(pdf_content), "application/pdf")},
        data={"category": "loan_sanction"}
    )
    assert r.status_code == 201

    # 2. Fake PDF with executable MZ signature
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00"
    r = client.post(
        f"/applications/{app_no}/documents",
        files={"file": ("malware.pdf", io.BytesIO(fake_exe), "application/pdf")},
        data={"category": "loan_sanction"}
    )
    assert r.status_code == 422
    assert "Executable" in str(r.json())

    # 3. Disallowed script/HTML file disguised as PNG
    fake_script = b"<html><script>window.location='evil.com'</script></html>"
    r = client.post(
        f"/applications/{app_no}/documents",
        files={"file": ("fake.png", io.BytesIO(fake_script), "image/png")},
        data={"category": "pan"}
    )
    assert r.status_code == 422

    # 4. Oversized file (> 5 MB)
    large_pdf = b"%PDF" + (b"0" * (6 * 1024 * 1024))
    r = client.post(
        f"/applications/{app_no}/documents",
        files={"file": ("large.pdf", io.BytesIO(large_pdf), "application/pdf")},
        data={"category": "bank_statement"}
    )
    assert r.status_code == 422
    assert "exceeds maximum allowed limit" in str(r.json())

def test_structured_error_response_format():
    bad_app = {
        **BASE_VALID_APP,
        "full_name": "Amol123",
        "mobile": "12345",
        "sanctioned_amount": -500
    }
    r = client.post("/applications", json=bad_app)
    assert r.status_code == 422
    body = r.json()
    assert "errors" in body
    assert isinstance(body["errors"], list)
    assert len(body["errors"]) >= 1
    err0 = body["errors"][0]
    assert "field" in err0
    assert "code" in err0
    assert "message" in err0
