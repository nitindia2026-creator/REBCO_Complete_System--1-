import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ShieldCheck, Shield, CheckCircle, AlertCircle, Clock, FileText,
  Users, LayoutDashboard, LogOut, Search, Download, RefreshCw, Eye,
  Upload, ChevronRight, ChevronLeft, ArrowRight, Building, Phone,
  Mail, MapPin, Calendar, CreditCard, DollarSign, Lock, Unlock,
  Check, X, FileCheck, Layers, Award, BarChart2, Settings, Briefcase
} from 'lucide-react';
import './style.css';
import {
  validateField,
  validateStepFields,
  validateFile,
  formatAadhaarDisplay,
  maskAadhaarDisplay,
  formatFileSize,
  validateVerhoeff
} from './validators.js';

const API = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (window.location.port === '5173' || window.location.port === '5174'
      ? 'http://localhost:8000'
      : '');

// Format currency in Indian format
const formatINR = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN');
};

// =========================================================================
// CORPORATE HEADER COMPONENT
// =========================================================================
function CorporateHeader({ onNavAdmin, isEnroll = false }) {
  return (
    <header className="corporate-header">
      <div className="corporate-header-inner">
        <a href="/" className="brand-link" onClick={(e) => { if (isEnroll) { e.preventDefault(); location.href = '/'; } }}>
          <img src="/rebco_logo.svg" alt="REBCO Logo" className="brand-logo-img" />
          <div className="brand-title-wrap">
            <span className="brand-tagline-text">Real Estate Banking & Financial Solutions</span>
          </div>
        </a>
        <div className="header-actions">
          <a href="tel:+918408883369" className="advisory-contact-btn">
            <Phone size={14} /> Advisory: +91 84088 83369
          </a>
          {isEnroll ? (
            <button className="header-login-btn" onClick={() => { location.pathname = '/'; }}>
              <Lock size={14} /> Corporate Portal
            </button>
          ) : (
            <button className="header-login-btn" onClick={() => { location.pathname = '/enroll'; }}>
              <ShieldCheck size={14} /> Customer Enrollment
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// =========================================================================
// CORPORATE FOOTER COMPONENT
// =========================================================================
function CorporateFooter() {
  return (
    <footer className="corporate-footer">
      <div className="footer-inner">
        <div className="footer-col">
          <img src="/rebco_logo.svg" alt="REBCO" className="footer-logo-img" />
          <p className="footer-desc">
            India's pioneering Real Estate Banking & Strategic Advisory Company. Protecting EMIs, preserving credit scores, and strengthening borrower peace of mind.
          </p>
          <div className="footer-meta-block">
            <span><strong>CIN:</strong> U68200PN2025PTC249716</span>
            <span><strong>GST:</strong> 27AAPCR3435E1Z9</span>
            <span><strong>DPIIT Reg. No.:</strong> OI-0726-9501BE</span>
          </div>
        </div>
        <div className="footer-col">
          <h4>EMI Protection</h4>
          <ul className="footer-links-list">
            <li><a href="/enroll">EMI Shield (18.99%)</a></li>
            <li><a href="https://www.rebcoindia.com/services" target="_blank" rel="noreferrer">Eligible Loan Types</a></li>
            <li><a href="https://www.rebcoindia.com/brochure" target="_blank" rel="noreferrer">Download Brochure</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Corporate</h4>
          <ul className="footer-links-list">
            <li><a href="https://www.rebcoindia.com/about" target="_blank" rel="noreferrer">About REBCO</a></li>
            <li><a href="https://www.rebcoindia.com/projects" target="_blank" rel="noreferrer">Projects & Investments</a></li>
            <li><a href="https://www.rebcoindia.com/terms-and-conditions" target="_blank" rel="noreferrer">Terms & Conditions</a></li>
            <li><a href="https://www.rebcoindia.com/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Headquarters</h4>
          <p className="footer-desc" style={{ marginBottom: '10px' }}>
            REBCO Ventures Private Limited<br />
            Pune, Maharashtra, India
          </p>
          <div className="footer-meta-block">
            <span><strong>Direct Line:</strong> +91 84088 83369</span>
            <span><strong>Email:</strong> info@rebcoindia.com</span>
            <span><strong>Hours:</strong> Mon - Sat: 9:30 AM - 6:30 PM</span>
          </div>
        </div>
      </div>
      <div className="footer-bottom-bar">
        <span>© {new Date().getFullYear()} REBCO Ventures Private Limited. All rights reserved.</span>
        <span>Institutional Discipline · Transparency · High-Growth Opportunities</span>
      </div>
    </footer>
  );
}

// =========================================================================
// CUSTOMER ENROLLMENT MODULE (Route: /enroll)
// =========================================================================
function CustomerEnrollment() {
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState([]);
  const [formData, setFormData] = useState({
    // Step 1: Personal
    full_name: '',
    gender: '',
    occupation: 'Salaried',
    pan: '',
    aadhaar: '',
    contact_no: '',
    mobile: '',
    email: '',
    current_address: '',
    permanent_address: '',
    organization: '',
    monthly_income: '',
    existing_emis: '',
    // Step 2: Loan
    lender: '',
    loan_account: '',
    sanctioned_amount: '',
    outstanding_balance: '',
    emi_amount: '',
    emi_due_date: '5',
    remaining_tenure: '',
    // Step 3: Subscription
    plan_name: 'EMI Shield',
    plan_rate: 18.99,
    repayment_period_days: 90,
    annual_subscription_fee: '',
    subscription_commencement_date: new Date().toISOString().slice(0, 10),
    subscription_expiry_date: '',
    place: 'Pune',
    form_date: new Date().toISOString().slice(0, 10),
    financial_notes: '',
    // Step 4: Documents & Declaration
    declaration: false
  });

  const [files, setFiles] = useState({
    pan: null,
    aadhaar: null,
    loan_sanction: null,
    loan_statement: null,
    income_proof: null,
    bank_statement: null
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [aadhaarFocused, setAadhaarFocused] = useState(false);
  const [validationSummary, setValidationSummary] = useState([]);
  const [confirmedApp, setConfirmedApp] = useState(null);

  // Fetch active plans from backend
  useEffect(() => {
    fetch(API + '/plans')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length) {
          setPlans(d);
          const activePlan = d.find(p => p.code === 'emi_shield') || d[0];
          setFormData(prev => ({
            ...prev,
            plan_name: activePlan.name,
            plan_rate: activePlan.fee_percentage,
            repayment_period_days: activePlan.repayment_period_days
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Update calculated subscription fee when emi_amount or plan changes
  useEffect(() => {
    const emi = Number(formData.emi_amount) || 0;
    const rate = Number(formData.plan_rate) || 18.99;
    if (emi > 0) {
      const calculated = Math.round(emi * (rate / 100));
      setFormData(prev => ({ ...prev, annual_subscription_fee: calculated }));
    }
  }, [formData.emi_amount, formData.plan_rate]);

  // Real-time input change with instant validation
  const handleInputChange = (field, e) => {
    let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    // Normalizations while typing
    if (field === 'pan') {
      val = val.replace(/\s+/g, '').toUpperCase().slice(0, 10);
    } else if (field === 'aadhaar') {
      val = val.replace(/\D/g, '').slice(0, 12);
    } else if (field === 'mobile' || field === 'contact_no') {
      val = val.replace(/\D/g, '').slice(0, 10);
    }

    const nextForm = { ...formData, [field]: val };
    setFormData(nextForm);

    // Instant real-time field validation
    const res = validateField(field, val, nextForm);
    setFieldErrors(prev => ({
      ...prev,
      [field]: res.valid ? '' : res.error
    }));

    setTouched(prev => ({ ...prev, [field]: true }));
    if (err) setErr('');
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const res = validateField(field, formData[field], formData);
    setFieldErrors(prev => ({
      ...prev,
      [field]: res.valid ? '' : res.error
    }));
  };

  const handleFileSlotChange = (category, file) => {
    if (!file) {
      setFiles(prev => ({ ...prev, [category]: null }));
      setFileErrors(prev => ({ ...prev, [category]: '' }));
      return;
    }

    const res = validateFile(file, true);
    if (!res.valid) {
      setFileErrors(prev => ({ ...prev, [category]: res.error }));
      setFiles(prev => ({ ...prev, [category]: null }));
    } else {
      setFileErrors(prev => ({ ...prev, [category]: '' }));
      setFiles(prev => ({ ...prev, [category]: file }));
    }
    if (err) setErr('');
  };

  const handleNext = () => {
    const stepRes = validateStepFields(step, formData, files);
    if (!stepRes.isValid) {
      // Mark all fields in current step as touched
      setTouched(prev => {
        const next = { ...prev };
        Object.keys(stepRes.errors).forEach(k => { next[k] = true; });
        return next;
      });
      setFieldErrors(prev => ({ ...prev, ...stepRes.errors }));
      const errorList = Object.values(stepRes.errors);
      setValidationSummary(errorList);
      setErr(`Please correct the ${errorList.length} highlighted issue${errorList.length > 1 ? 's' : ''} in this step before proceeding.`);
      window.scrollTo({ top: 220, behavior: 'smooth' });
      return;
    }
    setErr('');
    setValidationSummary([]);
    setStep(prev => prev + 1);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setErr('');
    setValidationSummary([]);
    setStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    // Cross-step multi-tier validation
    const step1 = validateStepFields(1, formData, files);
    const step2 = validateStepFields(2, formData, files);
    const step3 = validateStepFields(3, formData, files);
    const step4 = validateStepFields(4, formData, files);

    const allErrors = { ...step1.errors, ...step2.errors, ...step3.errors, ...step4.errors };
    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...allErrors }));
      setFileErrors(prev => ({ ...prev, ...step4.errors }));
      setTouched(prev => {
        const next = { ...prev };
        Object.keys(allErrors).forEach(k => { next[k] = true; });
        return next;
      });
      const errorList = Object.values(allErrors);
      setValidationSummary(errorList);
      setErr(`Submission blocked: Please resolve ${errorList.length} required field${errorList.length > 1 ? 's' : ''}.`);
      window.scrollTo({ top: 220, behavior: 'smooth' });
      return;
    }

    if (!formData.declaration) {
      setErr('You must confirm the applicant legal declaration to proceed.');
      return;
    }

    setBusy(true);

    try {
      const payload = {
        ...formData,
        pan: formData.pan.trim().toUpperCase(),
        aadhaar: formData.aadhaar ? formData.aadhaar.replace(/\D/g, '') : null,
        mobile: formData.mobile.replace(/\D/g, ''),
        contact_no: formData.contact_no.replace(/\D/g, ''),
        monthly_income: formData.monthly_income ? Number(formData.monthly_income) : null,
        existing_emis: formData.existing_emis ? Number(formData.existing_emis) : null,
        sanctioned_amount: Number(formData.sanctioned_amount),
        outstanding_balance: Number(formData.outstanding_balance),
        emi_amount: Number(formData.emi_amount),
        emi_due_date: Number(formData.emi_due_date),
        remaining_tenure: Number(formData.remaining_tenure),
        plan_rate: Number(formData.plan_rate),
        annual_subscription_fee: Number(formData.annual_subscription_fee)
      };

      const res = await fetch(API + '/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Application submission failed');
      }

      // Upload attached documents
      for (const [category, file] of Object.entries(files)) {
        if (file) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('category', category);
          const docRes = await fetch(`${API}/applications/${data.application_no}/documents`, {
            method: 'POST',
            body: fd
          });
          if (!docRes.ok) {
            const docErr = await docRes.json();
            throw new Error(`Failed to upload ${category}: ${docErr.detail || 'Upload error'}`);
          }
        }
      }

      setConfirmedApp({
        application_no: data.application_no,
        plan_name: formData.plan_name,
        full_name: formData.full_name,
        lender: formData.lender,
        emi_amount: formData.emi_amount,
        fee: formData.annual_subscription_fee,
        email: formData.email
      });
    } catch (err) {
      setErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  // If application confirmed, show corporate receipt view
  if (confirmedApp) {
    return (
      <div>
        <CorporateHeader isEnroll={true} />
        <div className="enroll-container">
          <div className="confirmation-card">
            <div className="confirmation-icon-wrap">
              <CheckCircle size={44} />
            </div>
            <h1>Enrollment Application Received</h1>
            <p className="confirmation-sub">
              Your application for REBCO <strong>{confirmedApp.plan_name}</strong> has been successfully submitted and routed to our underwriting desk.
            </p>

            <div className="app-ref-box">
              <span className="app-ref-lbl">Official Reference Number</span>
              <span className="app-ref-num">{confirmedApp.application_no}</span>
            </div>

            <div className="confirmation-details-summary">
              <div className="summary-kv">
                <small>Applicant Name</small>
                <strong>{confirmedApp.full_name}</strong>
              </div>
              <div className="summary-kv">
                <small>Assigned Plan</small>
                <strong>{confirmedApp.plan_name}</strong>
              </div>
              <div className="summary-kv">
                <small>Lender / NBFC</small>
                <strong>{confirmedApp.lender}</strong>
              </div>
              <div className="summary-kv">
                <small>Protected Monthly EMI</small>
                <strong>{formatINR(confirmedApp.emi_amount)}</strong>
              </div>
              <div className="summary-kv">
                <small>Annual Fee</small>
                <strong>{formatINR(confirmedApp.fee)}</strong>
              </div>
              <div className="summary-kv">
                <small>Verification Desk</small>
                <strong>Pune Central Advisory</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <FileText size={16} /> Print Acknowledgement
              </button>
              <button className="btn btn-gold" onClick={() => { setConfirmedApp(null); setStep(1); }}>
                Submit Another Application
              </button>
            </div>
          </div>
        </div>
        <CorporateFooter />
      </div>
    );
  }

  return (
    <div>
      <CorporateHeader isEnroll={true} />

      <div className="enroll-container">
        {/* Hero Section */}
        <div className="enroll-hero">
          <div className="enroll-hero-content">
            <span className="hero-pretitle">
              <ShieldCheck size={16} /> REBCO EMI Risk Mitigation
            </span>
            <h1>Protecting EMIs. Preserving Credit Scores.</h1>
            <p className="hero-subtitle">
              Life is unpredictable, but your CIBIL reputation shouldn't be. REBCO EMI Shield ensures your loan EMIs are honored on time during temporary cash-flow transitions.
            </p>
            <div className="hero-highlights">
              <div className="hero-highlight-item">
                <span className="highlight-val">0% Interest</span>
                <span className="highlight-lbl">During Grace Period</span>
              </div>
              <div className="hero-highlight-item">
                <span className="highlight-val">90 Days</span>
                <span className="highlight-lbl">Breathing Window</span>
              </div>
              <div className="hero-highlight-item">
                <span className="highlight-val">5x / yr</span>
                <span className="highlight-lbl">Annual Protection</span>
              </div>
            </div>
          </div>
          <div className="enroll-hero-image-wrap">
            <img src="/assets/emi-shield-hero.webp" alt="REBCO EMI Protection" className="enroll-hero-img" />
            <div className="enroll-hero-overlay"></div>
          </div>
        </div>

        {/* Multi-step progress indicator */}
        <div className="step-indicator-card">
          <div className="step-indicator-track">
            <div className="step-indicator-line">
              <div
                className="step-indicator-line-progress"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              ></div>
            </div>
            {[
              { num: 1, label: 'Personal Information' },
              { num: 2, label: 'Primary Loan Details' },
              { num: 3, label: 'Plan & Terms' },
              { num: 4, label: 'Documents & Consent' }
            ].map(s => (
              <div
                key={s.num}
                className={`step-node ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}
                onClick={() => { if (step > s.num) setStep(s.num); }}
              >
                <div className="step-node-bubble">
                  {step > s.num ? <Check size={18} /> : s.num}
                </div>
                <span className="step-node-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Form Card */}
        <form className="wizard-form-card" onSubmit={handleSubmit}>
          {err && (
            <div style={{
              background: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              border: '1px solid rgba(191,0,15,0.2)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} /> {err}
            </div>
          )}

          {validationSummary.length > 0 && (
            <div className="validation-summary-box">
              <div className="validation-summary-header">
                <AlertCircle size={16} /> Action Required: Please correct the following field{validationSummary.length > 1 ? 's' : ''}:
              </div>
              <ul className="validation-summary-list">
                {validationSummary.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* STEP 1: PERSONAL INFORMATION */}
          {step === 1 && (
            <div>
              <div className="wizard-step-header">
                <span className="wizard-step-tag">Step 1 of 4</span>
                <h2>Applicant Personal Information</h2>
                <p className="wizard-step-desc">Enter borrower details matching your government issued KYC documents.</p>
              </div>

              <div className="form-grid-3">
                <div className="form-field span-2">
                  <label className="form-label">
                    <span>Full Name as per PAN <span className="req">*</span></span>
                    {touched.full_name && !fieldErrors.full_name && formData.full_name && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    required
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e)}
                    onBlur={() => handleBlur('full_name')}
                    className={`form-control ${touched.full_name && fieldErrors.full_name ? 'has-error' : (touched.full_name && !fieldErrors.full_name && formData.full_name ? 'is-valid' : '')}`}
                    placeholder="e.g. Rajesh Kumar Sharma"
                  />
                  {touched.full_name && fieldErrors.full_name && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.full_name}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Gender <span className="req">*</span></span>
                    {touched.gender && !fieldErrors.gender && formData.gender && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <select
                    name="gender"
                    required
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e)}
                    onBlur={() => handleBlur('gender')}
                    className={`form-control ${touched.gender && fieldErrors.gender ? 'has-error' : (touched.gender && !fieldErrors.gender && formData.gender ? 'is-valid' : '')}`}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Others">Others</option>
                  </select>
                  {touched.gender && fieldErrors.gender && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.gender}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Occupation <span className="req">*</span></span>
                    {touched.occupation && !fieldErrors.occupation && formData.occupation && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <select
                    name="occupation"
                    required
                    value={formData.occupation}
                    onChange={(e) => handleInputChange('occupation', e)}
                    onBlur={() => handleBlur('occupation')}
                    className={`form-control ${touched.occupation && fieldErrors.occupation ? 'has-error' : (touched.occupation && !fieldErrors.occupation && formData.occupation ? 'is-valid' : '')}`}
                  >
                    <option value="Salaried">Salaried (Corporate / Govt)</option>
                    <option value="Self Employed">Self Employed Professional / Business</option>
                    <option value="Funded">Funded Startup / Enterprise</option>
                    <option value="Non Funded">Non Funded Enterprise</option>
                  </select>
                  {touched.occupation && fieldErrors.occupation && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.occupation}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>PAN Number <span className="req">*</span></span>
                    {touched.pan && !fieldErrors.pan && formData.pan.length === 10 && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid Format
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="pan"
                    maxLength={10}
                    required
                    value={formData.pan}
                    onChange={(e) => handleInputChange('pan', e)}
                    onBlur={() => handleBlur('pan')}
                    className={`form-control ${touched.pan && fieldErrors.pan ? 'has-error' : (touched.pan && !fieldErrors.pan && formData.pan.length === 10 ? 'is-valid' : '')}`}
                    placeholder="ABCDE1234F"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  />
                  {touched.pan && fieldErrors.pan ? (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.pan}</span>
                  ) : (
                    <span className="field-hint">Masked by default in administrative records</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Aadhaar (12 Digits)</span>
                    {touched.aadhaar && !fieldErrors.aadhaar && formData.aadhaar && formData.aadhaar.length === 12 && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid Checksum
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="aadhaar"
                    maxLength={14}
                    value={aadhaarFocused ? formatAadhaarDisplay(formData.aadhaar) : (formData.aadhaar && formData.aadhaar.length === 12 ? maskAadhaarDisplay(formData.aadhaar) : formatAadhaarDisplay(formData.aadhaar))}
                    onFocus={() => setAadhaarFocused(true)}
                    onBlur={() => {
                      setAadhaarFocused(false);
                      handleBlur('aadhaar');
                    }}
                    onChange={(e) => handleInputChange('aadhaar', e)}
                    className={`form-control ${touched.aadhaar && fieldErrors.aadhaar ? 'has-error' : (touched.aadhaar && !fieldErrors.aadhaar && formData.aadhaar && formData.aadhaar.length === 12 ? 'is-valid' : '')}`}
                    placeholder="XXXX XXXX XXXX"
                  />
                  {touched.aadhaar && fieldErrors.aadhaar ? (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.aadhaar}</span>
                  ) : (
                    <span className="field-hint">Masked after entry. Verified via Verhoeff checksum.</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Contact Number <span className="req">*</span></span>
                    {touched.contact_no && !fieldErrors.contact_no && formData.contact_no.length === 10 && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    name="contact_no"
                    maxLength={10}
                    required
                    value={formData.contact_no}
                    onChange={(e) => handleInputChange('contact_no', e)}
                    onBlur={() => handleBlur('contact_no')}
                    className={`form-control ${touched.contact_no && fieldErrors.contact_no ? 'has-error' : (touched.contact_no && !fieldErrors.contact_no && formData.contact_no.length === 10 ? 'is-valid' : '')}`}
                    placeholder="10 digit primary phone"
                  />
                  {touched.contact_no && fieldErrors.contact_no && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.contact_no}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Mobile Number <span className="req">*</span></span>
                    {touched.mobile && !fieldErrors.mobile && formData.mobile.length === 10 && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    name="mobile"
                    maxLength={10}
                    required
                    value={formData.mobile}
                    onChange={(e) => handleInputChange('mobile', e)}
                    onBlur={() => handleBlur('mobile')}
                    className={`form-control ${touched.mobile && fieldErrors.mobile ? 'has-error' : (touched.mobile && !fieldErrors.mobile && formData.mobile.length === 10 ? 'is-valid' : '')}`}
                    placeholder="10 digit mobile"
                  />
                  {touched.mobile && fieldErrors.mobile && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.mobile}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Email Address <span className="req">*</span></span>
                    {touched.email && !fieldErrors.email && formData.email && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e)}
                    onBlur={() => handleBlur('email')}
                    className={`form-control ${touched.email && fieldErrors.email ? 'has-error' : (touched.email && !fieldErrors.email && formData.email ? 'is-valid' : '')}`}
                    placeholder="name@example.com"
                  />
                  {touched.email && fieldErrors.email && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.email}</span>
                  )}
                </div>

                <div className="form-field span-3">
                  <label className="form-label">
                    <span>Current Residential Address <span className="req">*</span></span>
                    {touched.current_address && !fieldErrors.current_address && formData.current_address && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <textarea
                    name="current_address"
                    required
                    value={formData.current_address}
                    onChange={(e) => handleInputChange('current_address', e)}
                    onBlur={() => handleBlur('current_address')}
                    className={`form-control ${touched.current_address && fieldErrors.current_address ? 'has-error' : (touched.current_address && !fieldErrors.current_address && formData.current_address ? 'is-valid' : '')}`}
                    placeholder="Complete address with flat/house number, building, area, city, pin code"
                  />
                  {touched.current_address && fieldErrors.current_address && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.current_address}</span>
                  )}
                </div>

                <div className="form-field span-3">
                  <label className="form-label">
                    <span>Permanent Address (Leave blank if same as current)</span>
                    {touched.permanent_address && !fieldErrors.permanent_address && formData.permanent_address && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <textarea
                    name="permanent_address"
                    value={formData.permanent_address}
                    onChange={(e) => handleInputChange('permanent_address', e)}
                    onBlur={() => handleBlur('permanent_address')}
                    className={`form-control ${touched.permanent_address && fieldErrors.permanent_address ? 'has-error' : ''}`}
                    placeholder="Permanent hometown address"
                  />
                  {touched.permanent_address && fieldErrors.permanent_address && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.permanent_address}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">Organization / Business Name</label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={(e) => handleInputChange('organization', e)}
                    className="form-control"
                    placeholder="Company or Employer name"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Gross Monthly Income (₹)</label>
                  <input
                    type="number"
                    min="0"
                    name="monthly_income"
                    value={formData.monthly_income}
                    onChange={(e) => handleInputChange('monthly_income', e)}
                    className="form-control"
                    placeholder="e.g. 100000"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Existing Monthly EMIs (₹)</label>
                  <input
                    type="number"
                    min="0"
                    name="existing_emis"
                    value={formData.existing_emis}
                    onChange={(e) => handleInputChange('existing_emis', e)}
                    className="form-control"
                    placeholder="e.g. 20000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRIMARY LOAN DETAILS */}
          {step === 2 && (
            <div>
              <div className="wizard-step-header">
                <span className="wizard-step-tag">Step 2 of 4</span>
                <h2>Primary Loan & Banking Details</h2>
                <p className="wizard-step-desc">Enter the details of the active home or retail loan you wish to protect with REBCO.</p>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-label">
                    <span>Bank / NBFC / Lending Institution <span className="req">*</span></span>
                    {touched.lender && !fieldErrors.lender && formData.lender && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="lender"
                    required
                    value={formData.lender}
                    onChange={(e) => handleInputChange('lender', e)}
                    onBlur={() => handleBlur('lender')}
                    className={`form-control ${touched.lender && fieldErrors.lender ? 'has-error' : (touched.lender && !fieldErrors.lender && formData.lender ? 'is-valid' : '')}`}
                    placeholder="e.g. HDFC Bank, SBI, ICICI, Axis Bank, Bajaj Housing"
                  />
                  {touched.lender && fieldErrors.lender && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.lender}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Loan Account Number <span className="req">*</span></span>
                    {touched.loan_account && !fieldErrors.loan_account && formData.loan_account && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="loan_account"
                    required
                    value={formData.loan_account}
                    onChange={(e) => handleInputChange('loan_account', e)}
                    onBlur={() => handleBlur('loan_account')}
                    className={`form-control ${touched.loan_account && fieldErrors.loan_account ? 'has-error' : (touched.loan_account && !fieldErrors.loan_account && formData.loan_account ? 'is-valid' : '')}`}
                    placeholder="e.g. HDFC-HL-998822"
                  />
                  {touched.loan_account && fieldErrors.loan_account && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.loan_account}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Sanctioned Loan Amount (₹) <span className="req">*</span></span>
                    {touched.sanctioned_amount && !fieldErrors.sanctioned_amount && formData.sanctioned_amount && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="sanctioned_amount"
                    required
                    value={formData.sanctioned_amount}
                    onChange={(e) => handleInputChange('sanctioned_amount', e)}
                    onBlur={() => handleBlur('sanctioned_amount')}
                    className={`form-control ${touched.sanctioned_amount && fieldErrors.sanctioned_amount ? 'has-error' : (touched.sanctioned_amount && !fieldErrors.sanctioned_amount && formData.sanctioned_amount ? 'is-valid' : '')}`}
                    placeholder="Total sanctioned amount"
                  />
                  {touched.sanctioned_amount && fieldErrors.sanctioned_amount && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.sanctioned_amount}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Current Outstanding Balance (₹) <span className="req">*</span></span>
                    {touched.outstanding_balance && !fieldErrors.outstanding_balance && formData.outstanding_balance && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="outstanding_balance"
                    required
                    value={formData.outstanding_balance}
                    onChange={(e) => handleInputChange('outstanding_balance', e)}
                    onBlur={() => handleBlur('outstanding_balance')}
                    className={`form-control ${touched.outstanding_balance && fieldErrors.outstanding_balance ? 'has-error' : (touched.outstanding_balance && !fieldErrors.outstanding_balance && formData.outstanding_balance ? 'is-valid' : '')}`}
                    placeholder="Principal balance remaining"
                  />
                  {touched.outstanding_balance && fieldErrors.outstanding_balance && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.outstanding_balance}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Monthly EMI Amount (₹) <span className="req">*</span></span>
                    {touched.emi_amount && !fieldErrors.emi_amount && formData.emi_amount && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    name="emi_amount"
                    required
                    value={formData.emi_amount}
                    onChange={(e) => handleInputChange('emi_amount', e)}
                    onBlur={() => handleBlur('emi_amount')}
                    className={`form-control ${touched.emi_amount && fieldErrors.emi_amount ? 'has-error' : (touched.emi_amount && !fieldErrors.emi_amount && formData.emi_amount ? 'is-valid' : '')}`}
                    placeholder="e.g. 45000"
                  />
                  {touched.emi_amount && fieldErrors.emi_amount && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.emi_amount}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>EMI Due Date (Day of Month) <span className="req">*</span></span>
                    {touched.emi_due_date && !fieldErrors.emi_due_date && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <select
                    name="emi_due_date"
                    required
                    value={formData.emi_due_date}
                    onChange={(e) => handleInputChange('emi_due_date', e)}
                    onBlur={() => handleBlur('emi_due_date')}
                    className={`form-control ${touched.emi_due_date && fieldErrors.emi_due_date ? 'has-error' : (touched.emi_due_date && !fieldErrors.emi_due_date ? 'is-valid' : '')}`}
                  >
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} of every month</option>
                    ))}
                  </select>
                  {touched.emi_due_date && fieldErrors.emi_due_date && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.emi_due_date}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Remaining Tenure (Months) <span className="req">*</span></span>
                    {touched.remaining_tenure && !fieldErrors.remaining_tenure && formData.remaining_tenure && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="12"
                    name="remaining_tenure"
                    required
                    value={formData.remaining_tenure}
                    onChange={(e) => handleInputChange('remaining_tenure', e)}
                    onBlur={() => handleBlur('remaining_tenure')}
                    className={`form-control ${touched.remaining_tenure && fieldErrors.remaining_tenure ? 'has-error' : (touched.remaining_tenure && !fieldErrors.remaining_tenure && formData.remaining_tenure ? 'is-valid' : '')}`}
                    placeholder="e.g. 180 (Min 12 months)"
                  />
                  {touched.remaining_tenure && fieldErrors.remaining_tenure ? (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.remaining_tenure}</span>
                  ) : (
                    <span className="field-hint">Minimum eligible loan tenure is 12 months</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUBSCRIPTION & PLAN SELECTION */}
          {step === 3 && (
            <div>
              <div className="wizard-step-header">
                <span className="wizard-step-tag">Step 3 of 4</span>
                <h2>EMI Shield Protection Plan</h2>
                <p className="wizard-step-desc">Institutional-grade loan risk mitigation and EMI continuity protection.</p>
              </div>

              <div className="plan-single-container">
                <div className="plan-card-fullwidth">
                  <div className="plan-fullwidth-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span className="badge badge-navy">Recommended Package</span>
                        <span className="badge badge-gold">Active Protection</span>
                        <span className="plan-popular-tag">Comprehensive Protection</span>
                      </div>
                      <h3 className="plan-card-title" style={{ fontSize: '22px', margin: '4px 0' }}>EMI Shield</h3>
                      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
                        Maximum institutional coverage with 90-day grace protection and zero interest buffer.
                      </p>
                    </div>
                  </div>

                  <div className="plan-fullwidth-grid">
                    <div className="plan-rate-display" style={{ margin: 0, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline' }}>
                        <span className="plan-rate-num">18.99</span>
                        <span className="plan-rate-pct">%</span>
                      </div>
                      <span className="plan-rate-lbl">Annual Subscription Fee</span>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                        Calculated on registered loan monthly EMI
                      </p>
                    </div>

                    <ul className="plan-fullwidth-benefits-grid">
                      <li className="plan-spec-item"><Shield size={16} /> <span><strong>5 times / year</strong> benefit eligibility</span></li>
                      <li className="plan-spec-item"><Clock size={16} /> <span><strong>90 days</strong> repayment buffer window</span></li>
                      <li className="plan-spec-item"><CheckCircle size={16} /> <span><strong>Nil (0%)</strong> activation service charge</span></li>
                      <li className="plan-spec-item"><Award size={16} /> <span><strong>Priority 24-hr</strong> underwriting desk</span></li>
                      <li className="plan-spec-item"><CheckCircle size={16} /> <span><strong>Zero interest</strong> within 90 days</span></li>
                      <li className="plan-spec-item"><ShieldCheck size={16} /> <span><strong>Direct lender settlement</strong> support</span></li>
                    </ul>
                  </div>

                  <div className="plan-fullwidth-calc-bar">
                    <div>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Projected Annual Subscription Fee
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-body)' }}>
                        Based on entered monthly EMI of {formData.emi_amount ? formatINR(Number(formData.emi_amount)) : '₹0'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="plan-fee-calc-val" style={{ fontSize: '24px', color: 'var(--color-primary-navy)' }}>
                        {formatINR(Number(formData.emi_amount) * 0.1899)}
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        (18.99% of monthly EMI)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label className="form-label">
                    <span>Subscription Commencement Date <span className="req">*</span></span>
                    {touched.subscription_commencement_date && !fieldErrors.subscription_commencement_date && formData.subscription_commencement_date && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    name="subscription_commencement_date"
                    required
                    value={formData.subscription_commencement_date}
                    onChange={(e) => handleInputChange('subscription_commencement_date', e)}
                    onBlur={() => handleBlur('subscription_commencement_date')}
                    className={`form-control ${touched.subscription_commencement_date && fieldErrors.subscription_commencement_date ? 'has-error' : (touched.subscription_commencement_date && !fieldErrors.subscription_commencement_date ? 'is-valid' : '')}`}
                  />
                  {touched.subscription_commencement_date && fieldErrors.subscription_commencement_date && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.subscription_commencement_date}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <span>Place of Application <span className="req">*</span></span>
                    {touched.place && !fieldErrors.place && formData.place && (
                      <span style={{ color: '#2E7D32', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={12} /> Valid
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="place"
                    required
                    value={formData.place}
                    onChange={(e) => handleInputChange('place', e)}
                    onBlur={() => handleBlur('place')}
                    className={`form-control ${touched.place && fieldErrors.place ? 'has-error' : (touched.place && !fieldErrors.place ? 'is-valid' : '')}`}
                    placeholder="e.g. Pune, Mumbai, Delhi"
                  />
                  {touched.place && fieldErrors.place && (
                    <span className="field-error-msg"><AlertCircle size={13} /> {fieldErrors.place}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">Form Submission Date</label>
                  <input
                    type="date"
                    name="form_date"
                    value={formData.form_date}
                    onChange={(e) => handleInputChange('form_date', e)}
                    className="form-control"
                    disabled
                  />
                </div>

                <div className="form-field span-3">
                  <label className="form-label">Special Notes / Loan Terms (Optional)</label>
                  <textarea
                    name="financial_notes"
                    value={formData.financial_notes}
                    onChange={(e) => handleInputChange('financial_notes', e)}
                    className="form-control"
                    placeholder="Enter any additional context or existing loan concessions..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DOCUMENT UPLOAD & DECLARATION */}
          {step === 4 && (
            <div>
              <div className="wizard-step-header">
                <span className="wizard-step-tag">Step 4 of 4</span>
                <h2>KYC & Loan Documentation</h2>
                <p className="wizard-step-desc">Upload supporting files for faster verification (PDF, JPG, PNG; max 5 MB each).</p>
              </div>

              <div className="doc-upload-grid">
                {[
                  { key: 'pan', label: 'PAN Card Copy', req: true, desc: 'Government issued PAN Card (Clear photo or PDF, max 5 MB)' },
                  { key: 'aadhaar', label: 'Aadhaar Card', req: false, desc: 'Masked Aadhaar copy if applicable (max 5 MB)' },
                  { key: 'loan_sanction', label: 'Loan Sanction Letter', req: true, desc: 'Official sanction letter from lender (max 5 MB)' },
                  { key: 'loan_statement', label: 'Loan Account Statement', req: true, desc: 'Latest 3 months repayment statement (max 5 MB)' },
                  { key: 'income_proof', label: 'Salary Slip / Income Proof', req: true, desc: 'Latest 3 salary slips or ITR acknowledgment (max 5 MB)' },
                  { key: 'bank_statement', label: 'Bank Statement (6 Months)', req: true, desc: 'Operating account statement for EMI debit (max 5 MB)' }
                ].map(slot => (
                  <div key={slot.key} className={`doc-slot-card ${files[slot.key] ? 'has-file' : ''} ${fileErrors[slot.key] ? 'has-error' : ''}`}>
                    <div className="doc-slot-header">
                      <span className="doc-slot-title">{slot.label}</span>
                      <span className={`doc-slot-badge ${slot.req ? 'req' : 'opt'}`}>
                        {slot.req ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <p className="doc-slot-desc">{slot.desc}</p>
                    <div className="doc-slot-action-row">
                      {files[slot.key] ? (
                        <>
                          <div className="uploaded-file-info">
                            <CheckCircle size={14} />
                            <span style={{ fontWeight: 600 }}>{files[slot.key].name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>({formatFileSize(files[slot.key].size)})</span>
                          </div>
                          <button
                            type="button"
                            className="remove-file-btn"
                            onClick={() => handleFileSlotChange(slot.key, null)}
                            title="Remove file"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <label className="upload-btn-label">
                          <Upload size={14} /> Select File
                          <input
                            type="file"
                            hidden
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileSlotChange(slot.key, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {fileErrors[slot.key] && (
                      <span className="field-error-msg" style={{ marginTop: '8px' }}>
                        <AlertCircle size={13} /> {fileErrors[slot.key]}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className={`declaration-card ${touched.declaration && fieldErrors.declaration ? 'has-error' : ''}`} style={{ marginTop: '24px' }}>
                <input
                  type="checkbox"
                  id="declaration_checkbox"
                  name="declaration"
                  checked={formData.declaration}
                  onChange={(e) => handleInputChange('declaration', e)}
                  onBlur={() => handleBlur('declaration')}
                  required
                />
                <label htmlFor="declaration_checkbox" className="declaration-text">
                  <strong>Applicant Legal Confirmation & Undertaking:</strong> I hereby declare that all information provided in this enrollment form is true, correct, and complete to the best of my knowledge. I understand and agree that subscription to REBCO EMI Shield is subject to underwriting verification, lender confirmation, and approved commercial terms. In the event of an approved claim, REBCO will remit the scheduled EMI directly to safeguard my credit score, and I undertake to reimburse REBCO within the agreed repayment period without default.
                </label>
              </div>
              {touched.declaration && fieldErrors.declaration && (
                <span className="field-error-msg" style={{ marginTop: '8px', paddingLeft: '4px' }}>
                  <AlertCircle size={14} /> {fieldErrors.declaration}
                </span>
              )}
            </div>
          )}

          {/* Button Navigation Bar */}
          <div className="wizard-nav-bar">
            {step > 1 ? (
              <button type="button" className="btn btn-secondary" onClick={handlePrev}>
                <ChevronLeft size={16} /> Previous Step
              </button>
            ) : <div></div>}

            {step < 4 ? (
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Continue to Step {step + 1} <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit" className="btn btn-gold" disabled={busy}>
                {busy ? 'Submitting Application...' : 'Submit Official Enrollment'} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </form>
      </div>

      <CorporateFooter />
    </div>
  );
}

// =========================================================================
// ADMIN PORTAL MODULE (Route: /)
// =========================================================================
function AdminPortal() {
  const [token, setToken] = useState(localStorage.getItem('rebco_token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('rebco_role') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('rebco_email') || '');
  const [userName, setUserName] = useState(localStorage.getItem('rebco_name') || '');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [totalApps, setTotalApps] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Selected Application for Drawer
  const [selectedApp, setSelectedApp] = useState(null);
  const [unmaskedData, setUnmaskedData] = useState(null);

  // Other modules
  const [executives, setExecutives] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [auditLogsList, setAuditLogsList] = useState([]);
  const [planConfigs, setPlanConfigs] = useState([]);
  const [reportsData, setReportsData] = useState(null);

  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  // New staff modal
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffData, setNewStaffData] = useState({ email: '', full_name: '', password: '', role: 'verification_executive' });

  // API Client Helper
  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(API + endpoint, { ...options, headers });
    if (!res.ok) {
      let errJson = {};
      try { errJson = await res.json(); } catch {}
      throw new Error(errJson.detail || 'API request failed');
    }
    if (res.headers.get('content-type')?.includes('text/csv')) {
      return res.blob();
    }
    return res.json();
  };

  // Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginBusy(true);
    setErrorMsg('');
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      localStorage.setItem('rebco_token', data.access_token);
      localStorage.setItem('rebco_role', data.role);
      localStorage.setItem('rebco_email', data.email);
      localStorage.setItem('rebco_name', data.full_name);
      setToken(data.access_token);
      setUserRole(data.role);
      setUserEmail(data.email);
      setUserName(data.full_name);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoginBusy(false);
    }
  };

  // Sign out Handler
  const handleSignOut = () => {
    localStorage.clear();
    setToken('');
    setUserRole('');
    setUserEmail('');
    setUserName('');
  };

  // Load active tab data
  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg('');
    try {
      if (activeTab === 'dashboard') {
        const d = await apiCall('/admin/dashboard');
        setDashboardData(d);
      } else if (activeTab === 'applications') {
        const queryParams = new URLSearchParams({
          q: searchQuery,
          status: filterStatus,
          plan: filterPlan,
          date_from: filterDateFrom,
          date_to: filterDateTo,
          page: page.toString(),
          page_size: pageSize.toString()
        });
        const d = await apiCall(`/admin/applications?${queryParams.toString()}`);
        setApplications(d.items || []);
        setTotalApps(d.total || 0);
      } else if (activeTab === 'documents') {
        const d = await apiCall('/admin/documents');
        setDocumentsList(d.items || []);
      } else if (activeTab === 'staff') {
        const [users, execs] = await Promise.all([
          apiCall('/admin/users'),
          apiCall('/admin/executives')
        ]);
        setAllUsers(users);
        setExecutives(execs);
      } else if (activeTab === 'reports') {
        const d = await apiCall('/admin/reports');
        setReportsData(d);
      } else if (activeTab === 'plans') {
        const d = await apiCall('/admin/plans');
        setPlanConfigs((d || []).filter(p => p.code !== 'emi_shield'));
      } else if (activeTab === 'audit') {
        const d = await apiCall('/admin/audit-logs');
        setAuditLogsList(d);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, activeTab, page, filterStatus, filterPlan]);

  // Open Application Drawer
  const openAppDetails = async (appId) => {
    try {
      setUnmaskedData(null);
      const app = await apiCall(`/admin/applications/${appId}`);
      setSelectedApp(app);
      // Also fetch executives for assignment
      if (!executives.length) {
        const execs = await apiCall('/admin/executives');
        setExecutives(execs);
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Audited Unmask Action
  const handleUnmask = async (appId) => {
    try {
      const data = await apiCall(`/admin/applications/${appId}/unmask`);
      setUnmaskedData(data);
    } catch (err) {
      alert('Unmask failed: ' + err.message);
    }
  };

  // Update Status & Checklist
  const handleUpdateStatus = async (appId, newStatus, remarks = '') => {
    try {
      await apiCall(`/admin/applications/${appId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          remarks: remarks || `Status changed to ${newStatus}`
        })
      });
      await openAppDetails(appId);
      loadData();
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  };

  // Update Checklist Item
  const handleChecklistToggle = async (key) => {
    if (!selectedApp) return;
    const current = { ...(selectedApp.verification_checklist || {}) };
    current[key] = !current[key];
    try {
      await apiCall(`/admin/applications/${selectedApp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: selectedApp.status,
          verification_checklist: JSON.stringify(current)
        })
      });
      setSelectedApp(prev => ({ ...prev, verification_checklist: current }));
    } catch (err) {
      alert('Failed to update checklist: ' + err.message);
    }
  };

  // Assign Executive
  const handleAssignExecutive = async (appId, execId) => {
    try {
      await apiCall(`/admin/applications/${appId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: selectedApp.status,
          assigned_to_id: Number(execId)
        })
      });
      await openAppDetails(appId);
    } catch (err) {
      alert('Assignment failed: ' + err.message);
    }
  };

  // Verify Document Action
  const handleVerifyDocument = async (docId, newStatus) => {
    const remarks = prompt(`Enter remarks for document (${newStatus}):`, 'Verified by operations desk');
    if (remarks === null) return;
    try {
      await apiCall(`/admin/documents/${docId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, remarks })
      });
      if (selectedApp) {
        await openAppDetails(selectedApp.id);
      }
      loadData();
    } catch (err) {
      alert('Document verification failed: ' + err.message);
    }
  };

  // CSV Export Action
  const handleExportCSV = async () => {
    try {
      const blob = await apiCall('/admin/export.csv');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rebco-applications-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  // Create Staff User Action
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/admin/users', {
        method: 'POST',
        body: JSON.stringify(newStaffData)
      });
      setShowAddStaffModal(false);
      setNewStaffData({ email: '', full_name: '', password: '', role: 'verification_executive' });
      loadData();
    } catch (err) {
      alert('Failed to create staff member: ' + err.message);
    }
  };

  // Update Plan Config Action
  const handleUpdatePlan = async (code, field, val) => {
    const plan = planConfigs.find(p => p.code === code);
    if (!plan) return;
    const updated = { ...plan, [field]: Number(val) };
    try {
      await apiCall(`/admin/plans/${code}`, {
        method: 'PUT',
        body: JSON.stringify(updated)
      });
      loadData();
    } catch (err) {
      alert('Failed to update plan: ' + err.message);
    }
  };

  // 1. IF NOT LOGGED IN, RENDER CORPORATE LOGIN
  if (!token) {
    return (
      <div className="admin-login-wrap">
        <div className="login-visual-pane">
          <img src="/assets/corporate-boardroom.webp" alt="REBCO Headquarters" className="login-bg-img" />
          <div className="login-visual-overlay"></div>
          <div className="login-visual-content">
            <img src="/rebco_logo.svg" alt="REBCO" className="login-visual-logo" style={{ background: '#fff', padding: '6px 12px', borderRadius: '8px' }} />
            <h2 className="login-visual-quote">
              "Bringing institutional discipline, transparency, and high-growth opportunities to real estate finance."
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>
              Authorized corporate portal for REBCO underwriting, customer verification, and risk mitigation management.
            </p>
          </div>
          <div className="login-visual-footer">
            REBCO Ventures Private Limited · Institutional Credit Risk & Advisory Desk
          </div>
        </div>

        <div className="login-form-pane">
          <form className="login-box" onSubmit={handleLogin}>
            <h2>Staff Portal Sign In</h2>
            <p>Enter your corporate credentials to access the administrative terminal.</p>

            {errorMsg && (
              <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
                {errorMsg}
              </div>
            )}

            <div className="form-field" style={{ marginBottom: '16px' }}>
              <label className="form-label">Corporate Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="form-control"
                placeholder="name@rebco.com"
              />
            </div>

            <div className="form-field" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="form-control"
                placeholder="Enter password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={loginBusy}>
              {loginBusy ? 'Authenticating...' : 'Sign In to Portal'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <a href="/enroll" style={{ fontSize: '12px', color: 'var(--color-gold-hover)', fontWeight: '600' }}>
                ← Switch to Customer Enrollment Form
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED CORPORATE ADMIN WORKSPACE
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header className="admin-navbar">
        <div className="admin-navbar-inner">
          <div className="admin-brand-cluster">
            <img src="/rebco_logo.svg" alt="REBCO" className="admin-nav-logo" />
            <span className="admin-portal-badge">Admin Operations</span>
          </div>

          <nav className="admin-nav-tabs">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'applications', label: 'All Applications', icon: Users },
              { id: 'documents', label: 'Document Center', icon: FileCheck },
              { id: 'reports', label: 'Reports & Analytics', icon: BarChart2 },
              { id: 'staff', label: 'Staff & RBAC', icon: Briefcase },
              { id: 'plans', label: 'Plan Config', icon: Settings },
              { id: 'audit', label: 'Audit Trail', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`admin-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => { setActiveTab(tab.id); setSelectedApp(null); }}
                >
                  <Icon size={15} /> {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="admin-user-cluster">
            <div className="user-profile-badge">
              <span className="user-profile-name">{userName}</span>
              <span className="user-profile-role">{userRole.replace('_', ' ')}</span>
            </div>
            <button className="admin-signout-btn" onClick={handleSignOut} title="Sign Out">
              <LogOut size={14} /> Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="admin-workspace" style={{ flexGrow: 1 }}>
        {errorMsg && (
          <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', padding: '12px 18px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
            {errorMsg}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 1: DASHBOARD
           ------------------------------------------------------------- */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="workspace-page-header">
              <div>
                <h1>Executive Operations Dashboard</h1>
                <p>Real-time underwriting metrics, enrollment trends, and risk management portfolio.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={loadData}>
                  <RefreshCw size={14} /> Refresh
                </button>
                <button className="btn btn-primary" onClick={handleExportCSV}>
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="kpi-grid">
              <div className="kpi-card kpi-navy">
                <div className="kpi-header">
                  <span className="kpi-title">Total Applications</span>
                  <Users size={18} color="var(--color-primary-navy)" />
                </div>
                <span className="kpi-value">{dashboardData?.total || 0}</span>
                <span className="kpi-footer-note">All-time public & partner submissions</span>
              </div>

              <div className="kpi-card kpi-gold">
                <div className="kpi-header">
                  <span className="kpi-title">Protected Loan Value</span>
                  <DollarSign size={18} color="var(--color-gold)" />
                </div>
                <span className="kpi-value">{formatINR(dashboardData?.financials?.total_sanctioned || 0)}</span>
                <span className="kpi-footer-note">Sanctioned borrowing portfolio</span>
              </div>

              <div className="kpi-card kpi-green">
                <div className="kpi-header">
                  <span className="kpi-title">Monthly Protected EMI</span>
                  <ShieldCheck size={18} color="var(--color-success)" />
                </div>
                <span className="kpi-value">{formatINR(dashboardData?.financials?.total_emi_monthly || 0)}</span>
                <span className="kpi-footer-note">Monthly commitment secured</span>
              </div>

              <div className="kpi-card kpi-amber">
                <div className="kpi-header">
                  <span className="kpi-title">Projected Annual Fees</span>
                  <Award size={18} color="var(--color-warning)" />
                </div>
                <span className="kpi-value">{formatINR(dashboardData?.financials?.total_fees_projected || 0)}</span>
                <span className="kpi-footer-note">Annual subscription revenue volume</span>
              </div>
            </div>

            {/* Charts & Status Breakdown */}
            <div className="charts-grid">
              {/* Monthly Trend Bar Chart */}
              <div className="chart-card">
                <h3>Monthly Enrollment Volume Trend</h3>
                <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '24px', padding: '10px 0' }}>
                  {(dashboardData?.monthly_trend || []).map((m, idx) => {
                    const maxVal = Math.max(...(dashboardData.monthly_trend.map(x => x.count) || [1]), 5);
                    const heightPct = Math.max((m.count / maxVal) * 100, 10);
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-primary-navy)' }}>{m.count}</span>
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPct}%`,
                            background: idx === (dashboardData.monthly_trend.length - 1) ? 'var(--color-gold)' : 'var(--color-primary-navy)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.4s ease'
                          }}
                        ></div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{m.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Distribution */}
              <div className="chart-card">
                <h3>Status Distribution</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(dashboardData?.statuses || {}).map(([s, cnt]) => {
                    const total = dashboardData?.total || 1;
                    const pct = Math.round((cnt / (total || 1)) * 100);
                    return (
                      <div key={s}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                          <span className={`status-pill status-${s.replace(' ', '')}`}>{s}</span>
                          <span>{cnt} ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--color-bg-warm)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-gold)' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Submissions Table */}
            <div className="table-card">
              <div className="table-toolbar">
                <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-primary-navy)' }}>
                  Recent Applications for Review
                </span>
                <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setActiveTab('applications')}>
                  View All Applications →
                </button>
              </div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>App Reference</th>
                      <th>Customer Details</th>
                      <th>Lender & Loan</th>
                      <th>Plan & Rate</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboardData?.recent || []).map(a => (
                      <tr key={a.id}>
                        <td>
                          <span className="table-primary-text">{a.application_no}</span>
                          <span className="table-sub-text">{a.created_at?.slice(0, 10)}</span>
                        </td>
                        <td>
                          <span className="table-primary-text">{a.full_name}</span>
                          <span className="table-sub-text">{a.email} · {a.contact_no}</span>
                        </td>
                        <td>
                          <span className="table-primary-text">{a.lender}</span>
                          <span className="table-sub-text">{formatINR(a.sanctioned_amount)} (EMI: {formatINR(a.emi_amount)})</span>
                        </td>
                        <td>
                          <span className="badge badge-gold">{a.plan_name}</span>
                          <span className="table-sub-text">Fee: {formatINR(a.annual_subscription_fee)}</span>
                        </td>
                        <td>
                          <span className={`status-pill status-${a.status.replace(' ', '')}`}>{a.status}</span>
                        </td>
                        <td>
                          <button className="action-icon-btn" onClick={() => openAppDetails(a.id)} title="Inspect Dossier">
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: ALL APPLICATIONS
           ------------------------------------------------------------- */}
        {activeTab === 'applications' && (
          <div>
            <div className="workspace-page-header">
              <div>
                <h1>Application Registry & Underwriting</h1>
                <p>Filter, sort, assign, and audit customer enrollments across all lending categories.</p>
              </div>
              <button className="btn btn-primary" onClick={handleExportCSV}>
                <Download size={14} /> Export CSV Registry
              </button>
            </div>

            <div className="table-card">
              <div className="table-toolbar">
                <div className="toolbar-left">
                  <div className="search-input-wrap">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search name, PAN, email, app no, loan acc..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && loadData()}
                    />
                  </div>

                  <select className="filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Documents Required">Documents Required</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <select className="filter-select" value={filterPlan} onChange={e => { setFilterPlan(e.target.value); setPage(1); }}>
                    <option value="">All Plans</option>
                    <option value="EMI Shield">EMI Shield (18.99%)</option>
                  </select>

                  <input
                    type="date"
                    className="filter-select"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    title="From Date"
                  />
                  <input
                    type="date"
                    className="filter-select"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    title="To Date"
                  />

                  <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={loadData}>
                    <Search size={14} /> Filter
                  </button>
                </div>

                <div className="toolbar-right">
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Total: <strong>{totalApps}</strong> applications
                  </span>
                </div>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Application Ref</th>
                      <th>Customer Name</th>
                      <th>Lending Institution</th>
                      <th>Sanction / EMI</th>
                      <th>Plan & Fee</th>
                      <th>Status</th>
                      <th>Assigned Desk</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(a => (
                      <tr key={a.id}>
                        <td>
                          <span className="table-primary-text">{a.application_no}</span>
                          <span className="table-sub-text">{a.created_at?.slice(0, 10)}</span>
                        </td>
                        <td>
                          <span className="table-primary-text">{a.full_name}</span>
                          <span className="table-sub-text">{a.email} · {a.contact_no}</span>
                        </td>
                        <td>
                          <span className="table-primary-text">{a.lender}</span>
                          <span className="table-sub-text">A/C: {a.loan_account}</span>
                        </td>
                        <td>
                          <span className="table-primary-text">{formatINR(a.sanctioned_amount)}</span>
                          <span className="table-sub-text">EMI: {formatINR(a.emi_amount)}</span>
                        </td>
                        <td>
                          <span className="badge badge-gold">{a.plan_name}</span>
                          <span className="table-sub-text">Fee: {formatINR(a.annual_subscription_fee)}</span>
                        </td>
                        <td>
                          <span className={`status-pill status-${a.status.replace(' ', '')}`}>{a.status}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: a.assigned_to_name ? 'var(--color-primary-navy)' : 'var(--color-text-subtle)' }}>
                            {a.assigned_to_name || 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          <button className="action-icon-btn" onClick={() => openAppDetails(a.id)} title="Review Application Dossier">
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!applications.length && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>
                          No application records found matching current query parameters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination-bar">
                <span>
                  Showing {Math.min((page - 1) * pageSize + 1, totalApps)} to {Math.min(page * pageSize, totalApps)} of {totalApps} entries
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    ← Previous
                  </button>
                  <span>Page {page} of {Math.max(1, Math.ceil(totalApps / pageSize))}</span>
                  <button className="page-btn" disabled={page >= Math.ceil(totalApps / pageSize)} onClick={() => setPage(p => p + 1)}>
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: DOCUMENT CENTER
           ------------------------------------------------------------- */}
        {activeTab === 'documents' && (
          <div>
            <div className="workspace-page-header">
              <div>
                <h1>Corporate Document Verification Center</h1>
                <p>Inspect, verify, approve, and download KYC, income, and bank statements submitted by borrowers.</p>
              </div>
            </div>

            <div className="table-card">
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Document Name</th>
                      <th>Application</th>
                      <th>Borrower</th>
                      <th>Category</th>
                      <th>Verification Status</th>
                      <th>Remarks</th>
                      <th>Uploaded Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentsList.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <span className="table-primary-text">{doc.name}</span>
                          <span className="table-sub-text">{Math.round(doc.size / 1024)} KB · {doc.content_type}</span>
                        </td>
                        <td>
                          <span className="table-primary-text">{doc.application_no}</span>
                        </td>
                        <td>
                          <span className="table-primary-text">{doc.customer_name}</span>
                        </td>
                        <td>
                          <span className="badge badge-gold" style={{ textTransform: 'capitalize' }}>
                            {doc.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${doc.status === 'approved' ? 'Approved' : (doc.status === 'rejected' ? 'Rejected' : 'Pending')}`}>
                            {doc.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                            {doc.remarks || '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px' }}>{doc.uploaded_at?.slice(0, 10)}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a
                              href={`${API}/admin/documents/${doc.id}`}
                              className="action-icon-btn"
                              title="Download File"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download size={15} />
                            </a>
                            <button
                              className="action-icon-btn"
                              style={{ color: 'var(--color-success)' }}
                              onClick={() => handleVerifyDocument(doc.id, 'approved')}
                              title="Mark Approved"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              className="action-icon-btn"
                              style={{ color: 'var(--color-error)' }}
                              onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                              title="Mark Rejected"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!documentsList.length && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>
                          No documents currently waiting in verification queue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 4: REPORTS & ANALYTICS
           ------------------------------------------------------------- */}
        {activeTab === 'reports' && (
          <div>
            <div className="workspace-page-header">
              <div>
                <h1>Underwriting & Risk Reports</h1>
                <p>Executive performance, conversion rates, and lender portfolio breakdown.</p>
              </div>
              <button className="btn btn-primary" onClick={handleExportCSV}>
                <Download size={14} /> Download Full CSV Report
              </button>
            </div>

            {/* Financial Summary */}
            <div className="kpi-grid">
              <div className="kpi-card kpi-navy">
                <span className="kpi-title">Total Loan Value Protected</span>
                <span className="kpi-value">{formatINR(reportsData?.summary?.total_loan_value || 0)}</span>
              </div>
              <div className="kpi-card kpi-gold">
                <span className="kpi-title">Total Monthly EMI Secured</span>
                <span className="kpi-value">{formatINR(reportsData?.summary?.total_monthly_emi || 0)}</span>
              </div>
              <div className="kpi-card kpi-green">
                <span className="kpi-title">Annual Subscription Fees</span>
                <span className="kpi-value">{formatINR(reportsData?.summary?.total_subscription_volume || 0)}</span>
              </div>
              <div className="kpi-card kpi-amber">
                <span className="kpi-title">Enrollments Handled</span>
                <span className="kpi-value">{reportsData?.summary?.total_applications || 0}</span>
              </div>
            </div>

            {/* Executive Throughput */}
            <div className="table-card" style={{ marginBottom: '28px' }}>
              <div className="table-toolbar">
                <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-primary-navy)' }}>
                  Underwriting Executive Performance
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Executive Name</th>
                    <th>Email</th>
                    <th>Assigned Applications</th>
                    <th>Reviewed</th>
                    <th>Approved</th>
                    <th>Approval Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportsData?.executive_performance || []).map(e => {
                    const rate = e.reviewed > 0 ? Math.round((e.approved / e.reviewed) * 100) : 0;
                    return (
                      <tr key={e.executive_id}>
                        <td><strong>{e.name}</strong></td>
                        <td>{e.email}</td>
                        <td>{e.assigned}</td>
                        <td>{e.reviewed}</td>
                        <td><span style={{ color: 'var(--color-success)', fontWeight: '700' }}>{e.approved}</span></td>
                        <td>{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Top Lenders */}
            <div className="table-card">
              <div className="table-toolbar">
                <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-primary-navy)' }}>
                  Top Lending Institutions Portfolio
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lender / Bank / NBFC</th>
                    <th>Number of Loans</th>
                    <th>Total Sanctioned Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportsData?.top_lenders || []).map((l, idx) => (
                    <tr key={idx}>
                      <td><strong>{l.lender}</strong></td>
                      <td>{l.applications} applications</td>
                      <td>{formatINR(l.sanctioned_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5: STAFF & RBAC MANAGEMENT
           ------------------------------------------------------------- */}
        {activeTab === 'staff' && (
          <div>
            <div className="workspace-page-header">
              <div>
                <h1>Staff & Role-Based Access Control (RBAC)</h1>
                <p>Manage corporate staff roles: Super Admin, Admin, Verification Executive, and Reviewer.</p>
              </div>
              {['super_admin', 'admin'].includes(userRole) && (
                <button className="btn btn-primary" onClick={() => setShowAddStaffModal(true)}>
                  <Users size={14} /> Add Staff Account
                </button>
              )}
            </div>

            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Assigned Applications</th>
                    <th>Account Status</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.full_name}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge badge-navy" style={{ textTransform: 'capitalize' }}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{u.assigned_applications} applications</td>
                      <td>
                        <span className={`status-pill ${u.active ? 'status-Approved' : 'status-Rejected'}`}>
                          {u.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>{u.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal: Add Staff Account */}
            {showAddStaffModal && (
              <div className="drawer-backdrop" onClick={() => setShowAddStaffModal(false)}>
                <div className="wizard-form-card" style={{ maxWidth: '500px', margin: 'auto' }} onClick={e => e.stopPropagation()}>
                  <div className="wizard-step-header">
                    <h2>Add Staff Account</h2>
                    <p>Assign administrative or verification roles to corporate personnel.</p>
                  </div>
                  <form onSubmit={handleCreateStaff}>
                    <div className="form-field" style={{ marginBottom: '14px' }}>
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newStaffData.full_name}
                        onChange={e => setNewStaffData({ ...newStaffData, full_name: e.target.value })}
                        className="form-control"
                        placeholder="e.g. Vikram Malhotra"
                      />
                    </div>
                    <div className="form-field" style={{ marginBottom: '14px' }}>
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        required
                        value={newStaffData.email}
                        onChange={e => setNewStaffData({ ...newStaffData, email: e.target.value })}
                        className="form-control"
                        placeholder="vikram@rebco.com"
                      />
                    </div>
                    <div className="form-field" style={{ marginBottom: '14px' }}>
                      <label className="form-label">Password (Min 8 Chars)</label>
                      <input
                        type="password"
                        required
                        value={newStaffData.password}
                        onChange={e => setNewStaffData({ ...newStaffData, password: e.target.value })}
                        className="form-control"
                        placeholder="Temporary password"
                      />
                    </div>
                    <div className="form-field" style={{ marginBottom: '24px' }}>
                      <label className="form-label">Role</label>
                      <select
                        value={newStaffData.role}
                        onChange={e => setNewStaffData({ ...newStaffData, role: e.target.value })}
                        className="form-control"
                      >
                        <option value="verification_executive">Verification Executive (Underwriting & KYC)</option>
                        <option value="admin">Administrator (Full application & report management)</option>
                        <option value="reviewer">Reviewer (Read-only observation)</option>
                        <option value="super_admin">Super Admin (Unrestricted)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAddStaffModal(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary">Create Account</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 6: PLAN CONFIGURATION
           ------------------------------------------------------------- */}
        {activeTab === 'plans' && (
          <div>
            <div className="workspace-page-header">
              <div>
                <h1>Commercial Plan Terms Configuration</h1>
                <p>Modify active rates, repayment windows, and benefit limits directly stored in the backend.</p>
              </div>
            </div>

            <div className="plan-single-container">
              {planConfigs.map(p => (
                <div key={p.code} className="plan-card-fullwidth" style={{ cursor: 'default' }}>
                  <div className="plan-fullwidth-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span className="badge badge-gold">{p.code.toUpperCase()}</span>
                        <span className="badge badge-navy">Active Institutional Plan</span>
                        <span className="plan-popular-tag">Active Coverage</span>
                      </div>
                      <h3 className="plan-card-title" style={{ fontSize: '22px', margin: '4px 0' }}>{p.name}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>{p.description}</p>
                    </div>
                  </div>

                  <div className="form-grid-3" style={{ marginBottom: '22px', gap: '18px 24px' }}>
                    <div className="form-field">
                      <label className="form-label">Subscription Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={p.fee_percentage}
                        onChange={e => handleUpdatePlan(p.code, 'fee_percentage', e.target.value)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Repayment Window (Days)</label>
                      <input
                        type="number"
                        value={p.repayment_period_days}
                        onChange={e => handleUpdatePlan(p.code, 'repayment_period_days', e.target.value)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Benefit Times / Year</label>
                      <input
                        type="number"
                        value={p.avail_benefit_times}
                        onChange={e => handleUpdatePlan(p.code, 'avail_benefit_times', e.target.value)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Activation Waiting (Days)</label>
                      <input
                        type="number"
                        value={p.activation_period_days}
                        onChange={e => handleUpdatePlan(p.code, 'activation_period_days', e.target.value)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Activation Service Charge</label>
                      <input
                        type="text"
                        value={p.activation_service_charge || 'Nil'}
                        onChange={e => handleUpdatePlan(p.code, 'activation_service_charge', e.target.value)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Monthly Default Interest (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={p.default_interest_monthly || 1.5}
                        onChange={e => handleUpdatePlan(p.code, 'default_interest_monthly', e.target.value)}
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div className="plan-fullwidth-calc-bar">
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Last Updated: {p.updated_at?.slice(0, 10)} · Automatically applies to new enrollments
                    </span>
                    <span className="badge badge-navy">18.99% Annual Shield</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 7: AUDIT TRAIL
           ------------------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div>
            <div className="workspace-page-header">
              <div>
                <h1>Compliance & Security Audit Trail</h1>
                <p>Immutable record of all operational logins, status transitions, unmasking events, and document downloads.</p>
              </div>
            </div>

            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Application Ref</th>
                    <th>IP Address</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogsList.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="table-primary-text">{log.created_at?.slice(0, 10)}</span>
                        <span className="table-sub-text">{log.created_at?.slice(11, 19)} UTC</span>
                      </td>
                      <td>
                        <span className="badge badge-gold">{log.action}</span>
                      </td>
                      <td>
                        {log.application_id ? `#${log.application_id}` : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{log.ip_address || 'Internal / Proxy'}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12.5px', color: 'var(--color-text-main)' }}>{log.detail}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------
          APPLICATION DETAILS DRAWER / MODAL
         ------------------------------------------------------------- */}
      {selectedApp && (
        <div className="drawer-backdrop" onClick={() => setSelectedApp(null)}>
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2>{selectedApp.full_name}</h2>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Application {selectedApp.application_no} · Submitted {selectedApp.created_at?.slice(0, 10)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`status-pill status-${selectedApp.status.replace(' ', '')}`}>{selectedApp.status}</span>
                <button className="action-icon-btn" onClick={() => setSelectedApp(null)} title="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {/* LEFT COLUMN: DOSSIER */}
              <div>
                {/* 1. Borrower Demographics */}
                <div className="dossier-section">
                  <h3><Users size={16} /> Borrower & Contact Details</h3>
                  <div className="dossier-grid-2">
                    <div className="dossier-kv"><small>Full Name</small><strong>{selectedApp.full_name}</strong></div>
                    <div className="dossier-kv"><small>Gender</small><strong>{selectedApp.gender}</strong></div>
                    <div className="dossier-kv"><small>Email</small><strong>{selectedApp.email}</strong></div>
                    <div className="dossier-kv"><small>Contact Phone</small><strong>{selectedApp.contact_no}</strong></div>
                    <div className="dossier-kv"><small>Occupation</small><strong>{selectedApp.occupation}</strong></div>
                    <div className="dossier-kv"><small>Employer / Org</small><strong>{selectedApp.organization || 'Not provided'}</strong></div>
                    <div className="dossier-kv"><small>Gross Monthly Income</small><strong>{formatINR(selectedApp.monthly_income)}</strong></div>
                    <div className="dossier-kv"><small>Existing Monthly EMIs</small><strong>{formatINR(selectedApp.existing_emis)}</strong></div>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Current Residence</small>
                    <p style={{ fontSize: '13px', marginTop: '2px' }}>{selectedApp.current_address}</p>
                  </div>
                </div>

                {/* 2. Sensitive KYC (PAN & Aadhaar) */}
                <div className="dossier-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}><Lock size={16} /> Encrypted KYC (AES-GCM)</h3>
                    {['super_admin', 'admin'].includes(userRole) && !unmaskedData && (
                      <button className="unmask-btn" onClick={() => handleUnmask(selectedApp.id)}>
                        <Unlock size={12} /> View Unmasked (Audited)
                      </button>
                    )}
                  </div>
                  <div className="dossier-grid-2">
                    <div className="dossier-kv">
                      <small>Permanent Account Number (PAN)</small>
                      <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        {unmaskedData ? unmaskedData.pan : selectedApp.pan}
                      </strong>
                    </div>
                    <div className="dossier-kv">
                      <small>Aadhaar Number</small>
                      <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        {unmaskedData ? (unmaskedData.aadhaar || 'Not provided') : (selectedApp.aadhaar || 'Not provided')}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 3. Primary Loan Information */}
                <div className="dossier-section">
                  <h3><Building size={16} /> Primary Loan Details</h3>
                  <div className="dossier-grid-2">
                    <div className="dossier-kv"><small>Lending Institution</small><strong>{selectedApp.lender}</strong></div>
                    <div className="dossier-kv"><small>Loan Account Number</small><strong>{selectedApp.loan_account}</strong></div>
                    <div className="dossier-kv"><small>Sanctioned Amount</small><strong>{formatINR(selectedApp.sanctioned_amount)}</strong></div>
                    <div className="dossier-kv"><small>Outstanding Principal</small><strong>{formatINR(selectedApp.outstanding_balance)}</strong></div>
                    <div className="dossier-kv"><small>Monthly EMI Obligation</small><strong>{formatINR(selectedApp.emi_amount)}</strong></div>
                    <div className="dossier-kv"><small>EMI Due Date</small><strong>{selectedApp.emi_due_date} of every month</strong></div>
                    <div className="dossier-kv"><small>Remaining Tenure</small><strong>{selectedApp.remaining_tenure} months</strong></div>
                  </div>
                </div>

                {/* 4. Plan & Terms */}
                <div className="dossier-section">
                  <h3><ShieldCheck size={16} /> Subscribed Protection Plan</h3>
                  <div className="dossier-grid-2">
                    <div className="dossier-kv"><small>Plan Selected</small><strong>{selectedApp.plan_name}</strong></div>
                    <div className="dossier-kv"><small>Plan Rate</small><strong>{selectedApp.plan_rate}%</strong></div>
                    <div className="dossier-kv"><small>Repayment Buffer Window</small><strong>{selectedApp.repayment_period_days} Days</strong></div>
                    <div className="dossier-kv"><small>Annual Subscription Fee</small><strong>{formatINR(selectedApp.annual_subscription_fee)}</strong></div>
                  </div>
                  {selectedApp.financial_notes && (
                    <div style={{ marginTop: '12px' }}>
                      <small style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Financial Notes</small>
                      <p style={{ fontSize: '13px' }}>{selectedApp.financial_notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: ACTION & UNDERWRITING STATION */}
              <div>
                {/* 1. Status & Assignment */}
                <div className="action-box">
                  <h3>Underwriting Decision & Desk Assignment</h3>
                  <div className="form-field" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Application Status</label>
                    <select
                      className="form-control"
                      value={selectedApp.status}
                      onChange={e => handleUpdateStatus(selectedApp.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Documents Required">Documents Required</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="form-field" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Assigned Executive</label>
                    <select
                      className="form-control"
                      value={selectedApp.assigned_to_id || ''}
                      onChange={e => handleAssignExecutive(selectedApp.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {executives.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.full_name} ({ex.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Verification Checklist */}
                <div className="action-box">
                  <h3>Verification Checklist</h3>
                  <div className="checklist-group">
                    {[
                      { key: 'identity_verified', label: 'Borrower KYC & Identity Matched' },
                      { key: 'pan_verified', label: 'Income Tax PAN Authenticated' },
                      { key: 'loan_sanction_verified', label: 'Lender Sanction Letter Verified' },
                      { key: 'income_proof_verified', label: 'Income Proof / Salary Slip Verified' },
                      { key: 'bank_statement_verified', label: 'Bank Account & EMI Debits Confirmed' },
                      { key: 'address_verified', label: 'Residential Address Confirmed' }
                    ].map(chk => (
                      <label key={chk.key} className="checklist-item">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedApp.verification_checklist?.[chk.key])}
                          onChange={() => handleChecklistToggle(chk.key)}
                        />
                        <span>{chk.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 3. Uploaded Documents List */}
                <div className="action-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>Uploaded Documents ({selectedApp.documents?.length || 0})</h3>
                    <label className="upload-btn-label" style={{ fontSize: '11px' }}>
                      <Upload size={12} /> Upload Extra
                      <input
                        type="file"
                        hidden
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const fd = new FormData();
                            fd.append('file', e.target.files[0]);
                            fd.append('category', 'other');
                            await apiCall(`/admin/applications/${selectedApp.id}/documents`, { method: 'POST', body: fd });
                            openAppDetails(selectedApp.id);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(selectedApp.documents || []).map(doc => (
                      <div
                        key={doc.id}
                        style={{
                          background: 'var(--color-bg-warm)',
                          border: '1px solid var(--color-border-beige)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '12.5px', color: 'var(--color-primary-navy)' }}>{doc.name}</strong>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                            <span className="badge badge-gold" style={{ fontSize: '9px', textTransform: 'capitalize' }}>{doc.category}</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{Math.round(doc.size / 1024)} KB</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <a href={`${API}/admin/documents/${doc.id}`} target="_blank" rel="noreferrer" className="action-icon-btn" title="Download">
                            <Download size={14} />
                          </a>
                          <button
                            className="action-icon-btn"
                            style={{ color: 'var(--color-success)' }}
                            onClick={() => handleVerifyDocument(doc.id, 'approved')}
                            title="Approve"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="action-icon-btn"
                            style={{ color: 'var(--color-error)' }}
                            onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                            title="Reject"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!selectedApp.documents?.length && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-subtle)' }}>No documents uploaded for this application yet.</span>
                    )}
                  </div>
                </div>

                {/* 4. Application Status Timeline */}
                <div className="action-box">
                  <h3>Application Audit Timeline</h3>
                  <div className="timeline-list">
                    {(selectedApp.timeline || []).map(t => (
                      <div key={t.id} className="timeline-item">
                        <span className="timeline-title">
                          {t.previous_status ? `${t.previous_status} → ${t.new_status}` : t.new_status}
                        </span>
                        <span className="timeline-meta">
                          {t.user_email || 'System'} · {t.created_at?.slice(0, 16).replace('T', ' ')}
                        </span>
                        {t.remarks && <p className="timeline-remarks">{t.remarks}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// MAIN ROUTER DISPATCHER
// =========================================================================
function App() {
  const isEnroll = window.location.pathname === '/enroll';
  return isEnroll ? <CustomerEnrollment /> : <AdminPortal />;
}

createRoot(document.getElementById('root')).render(<App />);
