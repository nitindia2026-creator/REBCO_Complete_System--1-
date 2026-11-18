import re
from typing import Optional, Tuple

# =========================================================================
# VERHOEFF ALGORITHM (Aadhaar Checksum Validation)
# =========================================================================

D_TABLE = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
]

P_TABLE = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
]

INV_TABLE = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

def validate_verhoeff(num_str: str) -> bool:
    """Validate numeric string using Verhoeff checksum algorithm."""
    if not num_str or not num_str.isdigit():
        return False
    c = 0
    for i, item in enumerate(reversed(num_str)):
        c = D_TABLE[c][P_TABLE[i % 8][int(item)]]
    return c == 0

def generate_verhoeff_checksum(num_str: str) -> int:
    """Generate 12th Verhoeff checksum digit for 11 digits."""
    c = 0
    for i, item in enumerate(reversed(num_str + '0')):
        c = D_TABLE[c][P_TABLE[i % 8][int(item)]]
    return INV_TABLE[c]


# =========================================================================
# FIELD VALIDATION FUNCTIONS
# =========================================================================

NAME_REGEX = re.compile(r"^[A-Za-z]+([ A-Za-z.'-])*$")
PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
MOBILE_REGEX = re.compile(r"^[6-9][0-9]{9}$")
PINCODE_REGEX = re.compile(r"^[1-9][0-9]{5}$")
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
LOAN_ACCOUNT_REGEX = re.compile(r"^[A-Za-z0-9\-_/]+$")
LENDER_REGEX = re.compile(r"^[A-Za-z0-9\s.&'-]+$")
DISALLOWED_SCRIPT_REGEX = re.compile(r"<\s*script|javascript:|on\w+\s*=", re.IGNORECASE)

def validate_full_name(name: str) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        raise ValueError("Full Name is required")
    if len(cleaned) < 2 or len(cleaned) > 100:
        raise ValueError("Full Name must be between 2 and 100 characters")
    if not NAME_REGEX.match(cleaned):
        raise ValueError("Full Name must contain only alphabetical characters and spaces")
    return cleaned

def validate_pan(pan: str) -> str:
    cleaned = re.sub(r"\s+", "", (pan or "")).upper()
    if not cleaned:
        raise ValueError("PAN number is required")
    if len(cleaned) != 10:
        raise ValueError("PAN must contain exactly 10 characters")
    if not PAN_REGEX.match(cleaned):
        raise ValueError("Enter a valid 10-character PAN format (e.g. ABCDE1234F)")
    return cleaned

def validate_aadhaar(aadhaar: Optional[str]) -> Optional[str]:
    if not aadhaar:
        return None
    cleaned = re.sub(r"[\s\-]+", "", aadhaar)
    if not cleaned:
        return None
    if not cleaned.isdigit() or len(cleaned) != 12:
        raise ValueError("Aadhaar number must contain exactly 12 numeric digits")
    if not validate_verhoeff(cleaned):
        raise ValueError("Invalid Aadhaar number format or checksum")
    return cleaned

def validate_mobile(mobile: str) -> str:
    cleaned = re.sub(r"[\s\-]+", "", (mobile or ""))
    if not cleaned:
        raise ValueError("Mobile number is required")
    if not cleaned.isdigit() or len(cleaned) != 10:
        raise ValueError("Mobile number must contain exactly 10 digits")
    if not MOBILE_REGEX.match(cleaned):
        raise ValueError("Mobile number must start with 6, 7, 8, or 9")
    return cleaned

def validate_contact_no(contact: Optional[str]) -> str:
    if not contact:
        raise ValueError("Contact number is required")
    cleaned = re.sub(r"[\s\-]+", "", contact)
    if not cleaned.isdigit() or len(cleaned) != 10:
        raise ValueError("Contact number must contain exactly 10 digits")
    if not MOBILE_REGEX.match(cleaned):
        raise ValueError("Contact number must start with 6, 7, 8, or 9")
    return cleaned

def validate_pincode(pincode: Optional[str]) -> Optional[str]:
    if not pincode:
        return None
    cleaned = (pincode or "").strip()
    if not PINCODE_REGEX.match(cleaned):
        raise ValueError("PIN code must contain exactly 6 digits and cannot start with 0")
    return cleaned

def validate_address(address: str, field_name: str = "Address") -> str:
    cleaned = (address or "").strip()
    if not cleaned:
        raise ValueError(f"{field_name} is required")
    if len(cleaned) < 5:
        raise ValueError(f"{field_name} must be at least 5 characters long")
    if DISALLOWED_SCRIPT_REGEX.search(cleaned):
        raise ValueError(f"{field_name} contains disallowed script or HTML tags")
    return cleaned

def validate_lender(lender: str) -> str:
    cleaned = (lender or "").strip()
    if not cleaned:
        raise ValueError("Lending institution name is required")
    if len(cleaned) < 2 or len(cleaned) > 100:
        raise ValueError("Lending institution name must be between 2 and 100 characters")
    if not LENDER_REGEX.match(cleaned):
        raise ValueError("Lending institution contains unsupported special characters")
    return cleaned

def validate_loan_account(account: str) -> str:
    cleaned = (account or "").strip()
    if not cleaned:
        raise ValueError("Loan account number is required")
    if len(cleaned) < 3 or len(cleaned) > 40:
        raise ValueError("Loan account number must be between 3 and 40 characters")
    if not LOAN_ACCOUNT_REGEX.match(cleaned):
        raise ValueError("Loan account number contains invalid characters (letters, numbers, hyphens, slashes only)")
    return cleaned

def validate_sanctioned_amount(amount: float) -> float:
    try:
        val = float(amount)
    except (TypeError, ValueError):
        raise ValueError("Sanctioned loan amount must be a valid number")
    if val <= 0:
        raise ValueError("Sanctioned loan amount must be greater than zero")
    if val > 500000000:  # 50 Crores limit
        raise ValueError("Sanctioned loan amount exceeds maximum institutional threshold (₹50 Cr)")
    return val

def validate_outstanding_balance(balance: float, sanctioned: float) -> float:
    try:
        val = float(balance)
    except (TypeError, ValueError):
        raise ValueError("Outstanding balance must be a valid number")
    if val <= 0:
        raise ValueError("Outstanding balance must be greater than zero")
    if sanctioned > 0 and val > (sanctioned * 1.05):
        raise ValueError("Outstanding balance cannot exceed sanctioned loan amount")
    return val

def validate_emi_amount(emi: float, sanctioned: float) -> float:
    try:
        val = float(emi)
    except (TypeError, ValueError):
        raise ValueError("Monthly EMI amount must be a valid number")
    if val <= 0:
        raise ValueError("Monthly EMI amount must be greater than zero")
    if sanctioned > 0 and val > sanctioned:
        raise ValueError("Monthly EMI cannot exceed total sanctioned loan amount")
    return val

def validate_tenure(tenure: int) -> int:
    try:
        val = int(tenure)
    except (TypeError, ValueError):
        raise ValueError("Remaining tenure must be a valid number of months")
    if val < 12:
        raise ValueError("Minimum eligible remaining loan tenure is 12 months")
    if val > 480:
        raise ValueError("Remaining loan tenure cannot exceed 480 months (40 years)")
    return val

def validate_ifsc(ifsc: Optional[str]) -> Optional[str]:
    if not ifsc:
        return None
    cleaned = re.sub(r"\s+", "", ifsc).upper()
    if not IFSC_REGEX.match(cleaned):
        raise ValueError("Enter a valid 11-character IFSC code (e.g. HDFC0001234)")
    return cleaned


# =========================================================================
# FILE & DOCUMENT SECURITY VALIDATOR
# =========================================================================

MAGIC_SIGNATURES = {
    "pdf": [b"%PDF"],
    "jpeg": [b"\xFF\xD8\xFF"],
    "png": [b"\x89PNG\r\n\x1a\n"]
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB default

def detect_file_type(header: bytes) -> Optional[str]:
    """Inspect magic bytes to determine genuine file type."""
    for ftype, sigs in MAGIC_SIGNATURES.items():
        for sig in sigs:
            if header.startswith(sig):
                return ftype
    return None

def validate_file_content(content: bytes, filename: str, content_type: str, max_bytes: int = MAX_FILE_SIZE_BYTES) -> Tuple[str, str]:
    """
    Strict validation of uploaded file content:
    - Length <= max_bytes
    - Magic bytes match allowed types (PDF, JPEG, PNG)
    - Rejection of executables, scripts, and archives
    """
    if not content:
        raise ValueError("Uploaded file is empty")
    if len(content) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise ValueError(f"File size ({len(content) / (1024*1024):.1f} MB) exceeds maximum allowed limit of {mb} MB")

    # Detect genuine file signature
    detected_type = detect_file_type(content[:16])
    if not detected_type:
        # Check specifically for malicious signatures to give descriptive error
        if content.startswith(b"MZ") or content.startswith(b"\x7fELF"):
            raise ValueError("Executable files are strictly rejected for security")
        if content.startswith(b"PK\x03\x04") or content.startswith(b"Rar!") or content.startswith(b"\x1f\x8b"):
            raise ValueError("Compressed archive files are not allowed")
        if b"<script" in content[:256].lower() or b"<?php" in content[:256].lower() or b"<html" in content[:256].lower():
            raise ValueError("Script or HTML files are strictly disallowed")
        raise ValueError("Unsupported or corrupted file format. Allowed formats: PDF, JPG, PNG")

    # Match extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ext_map = {
        "pdf": {"pdf"},
        "jpeg": {"jpg", "jpeg"},
        "png": {"png"}
    }
    if ext not in ext_map.get(detected_type, set()):
        raise ValueError(f"File content ({detected_type.upper()}) does not match file extension (.{ext})")

    # Normalized content type
    normalized_mime = {
        "pdf": "application/pdf",
        "jpeg": "image/jpeg",
        "png": "image/png"
    }[detected_type]

    return detected_type, normalized_mime
