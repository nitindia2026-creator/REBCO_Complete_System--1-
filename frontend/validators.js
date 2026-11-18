// =========================================================================
// REBCO PRODUCTION-GRADE CLIENT VALIDATION MODULE
// Centralized, strict real-time field validation with Verhoeff Checksum
// =========================================================================

// Verhoeff Algorithm Tables
const D_TABLE = [
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
];

const P_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

export function validateVerhoeff(numStr) {
  if (!numStr || typeof numStr !== 'string') return false;
  const clean = numStr.replace(/\s+/g, '');
  if (!/^\d+$/.test(clean)) return false;
  let c = 0;
  const reversed = clean.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = D_TABLE[c][P_TABLE[i % 8][parseInt(reversed[i], 10)]];
  }
  return c === 0;
}

export function formatAadhaarDisplay(val) {
  if (!val) return '';
  const digits = val.replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export function maskAadhaarDisplay(val) {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length !== 12) return formatAadhaarDisplay(digits);
  return 'XXXX XXXX ' + digits.slice(8);
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Validation Regex Constants
const NAME_REGEX = /^[A-Za-z]+([ A-Za-z.'-])*$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE_REGEX = /^[6-9][0-9]{9}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const LOAN_ACCOUNT_REGEX = /^[A-Za-z0-9\-_/]+$/;
const LENDER_REGEX = /^[A-Za-z0-9\s.&'-]+$/;
const SCRIPT_CHECK_REGEX = /<\s*script|javascript:|on\w+\s*=/i;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

export function validateFile(file, isRequired = false) {
  if (!file) {
    if (isRequired) return { valid: false, error: 'This document is mandatory for underwriting.' };
    return { valid: true, error: '' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed limit of 5 MB.` };
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsupported format (.${ext}). Allowed formats: PDF, JPG, PNG.` };
  }
  return { valid: true, error: '' };
}

/**
 * Validate a single field in real-time
 * @param {string} field - Field key
 * @param {any} value - Current value
 * @param {object} allValues - Full formData context for relational checks
 * @returns {{ valid: boolean, error: string, normalized?: any }}
 */
export function validateField(field, value, allValues = {}) {
  const strVal = typeof value === 'string' ? value.trim() : (value !== null && value !== undefined ? String(value) : '');

  switch (field) {
    case 'full_name': {
      if (!strVal) return { valid: false, error: 'Full Name is required.' };
      if (strVal.length < 2) return { valid: false, error: 'Full Name must be at least 2 characters.' };
      if (!NAME_REGEX.test(strVal)) return { valid: false, error: 'Only letters, spaces and valid name punctuation (. \'-) are allowed.' };
      if (/\d/.test(strVal)) return { valid: false, error: 'Numbers are not allowed in names.' };
      return { valid: true, error: '' };
    }

    case 'gender': {
      if (!strVal) return { valid: false, error: 'Please select your gender.' };
      return { valid: true, error: '' };
    }

    case 'occupation': {
      if (!strVal) return { valid: false, error: 'Please select your employment type.' };
      return { valid: true, error: '' };
    }

    case 'pan': {
      const cleanPan = strVal.replace(/\s+/g, '').toUpperCase();
      if (!cleanPan) return { valid: false, error: 'PAN number is required.' };
      if (cleanPan.length < 10) return { valid: false, error: `PAN must be exactly 10 characters (currently ${cleanPan.length}).` };
      if (cleanPan.length > 10) return { valid: false, error: 'PAN cannot exceed 10 characters.' };
      if (!PAN_REGEX.test(cleanPan)) {
        return { valid: false, error: 'Invalid PAN structure. Must follow ABCDE1234F (5 letters, 4 numbers, 1 letter).' };
      }
      return { valid: true, error: '', normalized: cleanPan };
    }

    case 'aadhaar': {
      const cleanAadhaar = strVal.replace(/\D/g, '');
      if (!cleanAadhaar) return { valid: true, error: '' }; // Optional
      if (cleanAadhaar.length !== 12) {
        return { valid: false, error: `Aadhaar must contain exactly 12 digits (currently ${cleanAadhaar.length}).` };
      }
      if (!validateVerhoeff(cleanAadhaar)) {
        return { valid: false, error: 'Invalid Aadhaar checksum digits. Please verify the 12-digit number.' };
      }
      return { valid: true, error: '', normalized: cleanAadhaar };
    }

    case 'contact_no': {
      const clean = strVal.replace(/\D/g, '');
      if (!clean) return { valid: false, error: 'Contact number is required.' };
      if (clean.length !== 10) {
        return { valid: false, error: `Contact number must contain exactly 10 digits (currently ${clean.length}).` };
      }
      if (!/^[6-9]/.test(clean)) {
        return { valid: false, error: 'Indian mobile/contact number must start with 6, 7, 8, or 9.' };
      }
      return { valid: true, error: '', normalized: clean };
    }

    case 'mobile': {
      const clean = strVal.replace(/\D/g, '');
      if (!clean) return { valid: false, error: 'Mobile number is required.' };
      if (clean.length !== 10) {
        return { valid: false, error: `Mobile number must contain exactly 10 digits (currently ${clean.length}).` };
      }
      if (!/^[6-9]/.test(clean)) {
        return { valid: false, error: 'Indian mobile number must start with 6, 7, 8, or 9.' };
      }
      return { valid: true, error: '', normalized: clean };
    }

    case 'email': {
      if (!strVal) return { valid: false, error: 'Email address is required.' };
      if (!EMAIL_REGEX.test(strVal)) return { valid: false, error: 'Enter a valid corporate or personal email address (e.g. name@domain.com).' };
      return { valid: true, error: '' };
    }

    case 'current_address': {
      if (!strVal) return { valid: false, error: 'Current residential address is required.' };
      if (strVal.length < 5) return { valid: false, error: 'Address must be at least 5 characters long.' };
      if (SCRIPT_CHECK_REGEX.test(strVal)) return { valid: false, error: 'Disallowed characters or script tags detected.' };
      return { valid: true, error: '' };
    }

    case 'permanent_address': {
      if (!strVal) return { valid: true, error: '' }; // Optional
      if (strVal.length < 5) return { valid: false, error: 'Address must be at least 5 characters long.' };
      if (SCRIPT_CHECK_REGEX.test(strVal)) return { valid: false, error: 'Disallowed characters or script tags detected.' };
      return { valid: true, error: '' };
    }

    // Step 2: Loan Details
    case 'lender': {
      if (!strVal) return { valid: false, error: 'Lending institution name is required.' };
      if (strVal.length < 2) return { valid: false, error: 'Lender name must be at least 2 characters.' };
      if (!LENDER_REGEX.test(strVal)) return { valid: false, error: 'Lender name contains unsupported special characters.' };
      return { valid: true, error: '' };
    }

    case 'loan_account': {
      if (!strVal) return { valid: false, error: 'Loan account number is required.' };
      if (strVal.length < 3) return { valid: false, error: 'Loan account number must be at least 3 characters.' };
      if (!LOAN_ACCOUNT_REGEX.test(strVal)) return { valid: false, error: 'Allowed characters: letters, numbers, hyphens and slashes.' };
      return { valid: true, error: '' };
    }

    case 'sanctioned_amount': {
      const num = Number(strVal);
      if (!strVal || isNaN(num) || num <= 0) return { valid: false, error: 'Enter a valid positive sanctioned loan amount.' };
      if (num < 50000) return { valid: false, error: 'Minimum eligible loan amount is ₹50,000.' };
      if (num > 500000000) return { valid: false, error: 'Amount exceeds maximum allowable threshold (₹50 Cr).' };
      return { valid: true, error: '' };
    }

    case 'outstanding_balance': {
      const num = Number(strVal);
      if (!strVal || isNaN(num) || num <= 0) return { valid: false, error: 'Enter a valid outstanding loan balance.' };
      const sanctioned = Number(allValues.sanctioned_amount);
      if (sanctioned > 0 && num > sanctioned * 1.05) {
        return { valid: false, error: 'Outstanding balance cannot exceed sanctioned loan amount.' };
      }
      return { valid: true, error: '' };
    }

    case 'emi_amount': {
      const num = Number(strVal);
      if (!strVal || isNaN(num) || num <= 0) return { valid: false, error: 'Enter a valid monthly EMI amount.' };
      if (num < 500) return { valid: false, error: 'Minimum protected monthly EMI is ₹500.' };
      const sanctioned = Number(allValues.sanctioned_amount);
      if (sanctioned > 0 && num > sanctioned) {
        return { valid: false, error: 'Monthly EMI cannot exceed total sanctioned loan amount.' };
      }
      return { valid: true, error: '' };
    }

    case 'emi_due_date': {
      const num = parseInt(strVal, 10);
      if (!strVal || isNaN(num) || num < 1 || num > 31) return { valid: false, error: 'Select a valid calendar day of the month (1-31).' };
      return { valid: true, error: '' };
    }

    case 'remaining_tenure': {
      const num = parseInt(strVal, 10);
      if (!strVal || isNaN(num)) return { valid: false, error: 'Remaining loan tenure is required.' };
      if (num < 12) return { valid: false, error: 'Minimum eligible loan tenure is 12 months.' };
      if (num > 480) return { valid: false, error: 'Tenure cannot exceed 480 months (40 years).' };
      return { valid: true, error: '' };
    }

    case 'subscription_commencement_date': {
      if (!strVal) return { valid: false, error: 'Subscription commencement date is required.' };
      return { valid: true, error: '' };
    }

    case 'place': {
      if (!strVal) return { valid: false, error: 'Place of application is required.' };
      if (!NAME_REGEX.test(strVal)) return { valid: false, error: 'Place contains invalid characters.' };
      return { valid: true, error: '' };
    }

    case 'declaration': {
      if (!value) return { valid: false, error: 'You must confirm the applicant declaration to submit.' };
      return { valid: true, error: '' };
    }

    default:
      return { valid: true, error: '' };
  }
}

/**
 * Validate all fields of a specific wizard step
 */
export function validateStepFields(stepNumber, formData, files = {}) {
  const errors = {};

  if (stepNumber === 1) {
    const requiredKeys = ['full_name', 'gender', 'occupation', 'pan', 'contact_no', 'mobile', 'email', 'current_address'];
    requiredKeys.forEach(k => {
      const res = validateField(k, formData[k], formData);
      if (!res.valid) errors[k] = res.error;
    });
    // Check optional Aadhaar if entered
    if (formData.aadhaar) {
      const res = validateField('aadhaar', formData.aadhaar, formData);
      if (!res.valid) errors.aadhaar = res.error;
    }
  } else if (stepNumber === 2) {
    const requiredKeys = ['lender', 'loan_account', 'sanctioned_amount', 'outstanding_balance', 'emi_amount', 'emi_due_date', 'remaining_tenure'];
    requiredKeys.forEach(k => {
      const res = validateField(k, formData[k], formData);
      if (!res.valid) errors[k] = res.error;
    });
  } else if (stepNumber === 3) {
    const resPlan = validateField('subscription_commencement_date', formData.subscription_commencement_date, formData);
    if (!resPlan.valid) errors.subscription_commencement_date = resPlan.error;
    const resPlace = validateField('place', formData.place, formData);
    if (!resPlace.valid) errors.place = resPlace.error;
  } else if (stepNumber === 4) {
    // Required documents: pan, loan_sanction, loan_statement, income_proof, bank_statement
    const mandatorySlots = [
      { key: 'pan', label: 'PAN Card Copy' },
      { key: 'loan_sanction', label: 'Loan Sanction Letter' },
      { key: 'loan_statement', label: 'Loan Statement' },
      { key: 'income_proof', label: 'Salary Slip / Income Proof' },
      { key: 'bank_statement', label: 'Bank Statement' }
    ];
    mandatorySlots.forEach(slot => {
      const fileRes = validateFile(files[slot.key], true);
      if (!fileRes.valid) errors[slot.key] = `${slot.label}: ${fileRes.error}`;
    });
    if (!formData.declaration) {
      errors.declaration = 'You must confirm the legal declaration before submission.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
