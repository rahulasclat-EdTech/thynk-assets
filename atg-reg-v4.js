// ATG Registration v4 — Cashfree + Gateway Sequence — 2026-03-15
// ========================================
// EMBEDDING-SAFE IIFE &mdash; wraps ALL code so nothing leaks into the
// parent page's global scope. Fixes 4 embedding-specific bugs:
//
// EMBED BUG 1: Global variables (fd, selGW, discCode, etc.) clash
//   with variables on the parent page &#8594; wrong values, silent errors.
//   FIX: everything is inside this IIFE, zero globals exposed.
//
// EMBED BUG 2: DOMContentLoaded fires BEFORE this script runs when
//   embedded &mdash; the event is already past, listener never triggers,
//   so Easebuzz return URL is never detected after payment.
//   FIX: check readyState first; run immediately if already loaded.
//
// EMBED BUG 3: document.body.appendChild(form) + form.submit() for
//   Easebuzz appends the hidden form to the PARENT page's <body>,
//   which can be blocked by parent page's CSP or JS event listeners.
//   FIX: use the wrapper div as the form target container instead.
//
// EMBED BUG 4: document.querySelectorAll('input, select') selects
//   ALL inputs on the parent page too &mdash; adds error-clearing handlers
//   to unrelated fields, and can cause JS errors if those fields
//   don't have matching 'e-{id}' error divs.
//   FIX: scope querySelector to the registration card only.
//
// SHEET BUG: saveToSheet used GET &#8594; cached by Google CDN &#8594; script
//   never ran again after first hit &#8594; sheet stayed empty.
//   AND: POST with application/json triggers CORS preflight &#8594;
//   Apps Script ignores OPTIONS &#8594; browser blocks POST.
//   FIX: POST with Content-Type: text/plain (no preflight, no cache).
// ================================================================
function loadRazorpay() {
  return new Promise(function(resolve) {
    if (window.Razorpay) { resolve(); return; }
    var s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve; s.onerror = resolve;
    document.head.appendChild(s);
  });
}
(function() {
'use strict';

// ── CONFIG ───────────────────────────────────────────────────
var CFG = {
  razorpayKeyId: 'rzp_live_SQTJFYmQGDno59',
  sheetsURL:     'https://script.google.com/macros/s/AKfycbws3wYyJptTDscu3s8X9VBCiW2fmcLkJmvmVNXm1n7YQb6WzQIaJlghNIDqt_p4PJUDxg/exec',
  baseAmount:    1200,
  program:       'ATGenius Coaching Program',
  orgName:       'Thynk Success',
  redirectURL:   'https://thynksuccess.com'
};

// ── GATEWAY SEQUENCE ─────────────────────────────────────────────
// Change the order below to reprioritize gateways.
// Remove a gateway from the list to hide it completely.
// Options: 'cf' (Cashfree), 'rzp' (Razorpay), 'eb' (Easebuzz)
// ─────────────────────────────────────────────────────────────────
var GATEWAY_SEQUENCE = ['cf', 'rzp', 'eb'];

var GATEWAY_LABELS = {
  cf:  { name: 'Cashfree',  color: '#2563eb', selClass: 'sel-cf'  },
  rzp: { name: 'Razorpay',  color: '#2563eb', selClass: 'sel-rzp' },
  eb:  { name: 'Easebuzz',  color: '#f97316', selClass: 'sel-eb'  }
};

// ── STATE (private to this IIFE &mdash; no global pollution) ───────
var fd       = {};
var selGW    = '';
var discCode = '';
var discAmt  = 0;
var finalAmt = CFG.baseAmount;
var _tt;

// ── EMBED BUG 2 FIX: DOMContentLoaded may already be done ────
// When script is embedded mid-page, 'DOMContentLoaded' has
// already fired. readyState check ensures init always runs.
function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn(); // DOM already ready &mdash; run immediately
  }
}

onReady(function() {
  // ── HANDLE EASEBUZZ RETURN (after payment redirect back) ───
  var params  = new URLSearchParams(window.location.search);
  var payment = params.get('payment');
  var gw      = params.get('gw');
  var txnid   = params.get('txnid') || '';
  var name    = params.get('name')  || '';
  var amount  = params.get('amount')|| '1200';

  // Update Easebuzz cancelled/failed row in sheet
  if (gw === 'eb' && (payment === 'failed' || payment === 'cancelled')) {
    saveToSheet({
      studentName: name, gateway: 'Easebuzz',
      status: 'Cancelled', paymentId: txnid,
      finalAmount: Number(amount) || CFG.baseAmount,
      program: CFG.program
    });
  }


  // ── EMBED BUG 4 FIX: scope input listeners to card only ───
  var card = el('atgCard');
  if (card) {
    card.querySelectorAll('input, select').forEach(function(inp) {
      inp.addEventListener('input', function() {
        inp.classList.remove('err');
        var errEl = document.getElementById('e-' + inp.id);
        if (errEl) errEl.classList.remove('show');
      });
    });
  }
}

  // Handle Cashfree return
  if (gw === 'cf' && payment === 'success') {
    saveToSheet({
      studentName: name, gateway: 'Cashfree',
      status: 'Paid', paymentId: txnid,
      finalAmount: Number(amount) || CFG.baseAmount,
      program: CFG.program
    });
  }
  if (gw === 'cf' && (payment === 'failed' || payment === 'cancelled')) {
    saveToSheet({
      studentName: name, gateway: 'Cashfree',
      status: 'Cancelled', paymentId: txnid,
      finalAmount: Number(amount) || CFG.baseAmount,
      program: CFG.program
    });
  });

// ── HELPERS ──────────────────────────────────────────────────
function el(id)  { return document.getElementById(id); }
function g(id)   { return el(id).value.trim(); }
function fmt(n)  { return Number(n).toLocaleString('en-IN'); }
function esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function row(lbl, val, last) {
  return '<div class="sdrow"' + (last ? ' style="border-bottom:none"' : '') + '>'
       + '<span class="sdlbl">' + lbl + '</span>'
       + '<span class="sdval">' + val + '</span></div>';
}
function showLoader(t) { el('ltxt').textContent = t || 'Please wait&#8230;'; el('loader').classList.add('show'); }
function hideLoader()  { el('loader').classList.remove('show'); }
function showToast(msg, type) {
  var t = el('toast');
  t.textContent = (type==='ok' ? '&#9989; ' : type==='err' ? '⚠️ ' : 'ℹ️ ') + msg;
  t.className   = 'toast show' + (type==='ok' ? ' tok' : type==='err' ? ' terr' : '');
  clearTimeout(_tt);
  _tt = setTimeout(function(){ t.classList.remove('show'); }, 4500);
}

// ── VALIDATION ───────────────────────────────────────────────
var rules = {
  studentName:  function(v){ return v.trim().length >= 2; },
  classGrade:   function(v){ return v !== ''; },
  gender:       function(v){ return v !== ''; },
  schoolName:   function(v){ return v.trim().length >= 2; },
  city:         function(v){ return v.trim().length >= 2; },
  parentName:   function(v){ return v.trim().length >= 2; },
  contactPhone: function(v){ return /^[6-9]\d{9}$/.test(v.trim()); },
  contactEmail: function(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
};

function validate() {
  var ok = true;
  Object.keys(rules).forEach(function(id) {
    var inp  = el(id);
    var pass = rules[id](inp.value);
    inp.classList.toggle('err', !pass);
    el('e-' + id).classList.toggle('show', !pass);
    if (!pass) ok = false;
  });
  return ok;
}

// ── STEP NAVIGATION ──────────────────────────────────────────
function goToPayment() {
  if (!validate()) { showToast('Please fill all fields correctly.', 'err'); return; }
  fd = {
    studentName:  g('studentName'),  classGrade:   g('classGrade'),
    gender:       g('gender'),       schoolName:   g('schoolName'),
    city:         g('city'),         parentName:   g('parentName'),
    contactPhone: g('contactPhone'), contactEmail: g('contactEmail'),
    program:      CFG.program,       baseAmount:   CFG.baseAmount
  };
  el('reviewBox').innerHTML =
    '<div class="orow"><span class="olbl">Student</span><span class="oval">' + esc(fd.studentName) + ' · ' + esc(fd.classGrade) + '</span></div>'
  + '<div class="orow"><span class="olbl">School</span><span class="oval">'  + esc(fd.schoolName)  + ', ' + esc(fd.city) + '</span></div>'
  + '<div class="orow"><span class="olbl">Parent</span><span class="oval">'  + esc(fd.parentName)  + '</span></div>'
  + '<div class="orow"><span class="olbl">Phone</span><span class="oval">'   + esc(fd.contactPhone) + '</span></div>'
  + '<div class="orow" style="border-bottom:none"><span class="olbl">Email</span><span class="oval">' + esc(fd.contactEmail) + '</span></div>';
  show('step1', false); show('step2', true); setStep(2);
}

function goBack()        { show('step2',false); show('step1',true); setStep(1); }
function retryPayment()  { window.location.href = 'https://thynksuccess.com/registration/'; }

function show(id, v) { el(id).style.display = v ? 'block' : 'none'; }

function setStep(n) {
  [1,2,3].forEach(function(i){
    var d = el('sd'+i), sn = el('sn'+i);
    d.classList.remove('active','done');
    if (i < n)       { d.classList.add('done');   sn.textContent = '&#10003;'; }
    else if (i === n)  d.classList.add('active');
    else               sn.textContent = i;
  });
}

// ── GATEWAY SELECT ───────────────────────────────────────────
function selectGW(gw) {
  selGW = gw;
  // Update all gateway buttons based on GATEWAY_SEQUENCE
  GATEWAY_SEQUENCE.forEach(function(g) {
    var btn = el('gw' + g.charAt(0).toUpperCase() + g.slice(1));
    if (btn) btn.className = 'gw-btn' + (gw === g ? ' ' + GATEWAY_LABELS[g].selClass : '');
  });
  var info = GATEWAY_LABELS[gw] || { name: gw, color: '#2563eb' };
  var btn = el('payBtn');
  btn.disabled  = false;
  btn.className = 'btn-next';
  btn.style.background = info.color;
  btn.textContent = 'Pay Rs.' + fmt(finalAmt) + ' via ' + info.name;
  el('gwLabel').textContent = info.name;
}

// ── DISCOUNT ─────────────────────────────────────────────────
async function applyDiscount() {
  var code = el('discCode').value.trim().toUpperCase();
  var inp  = el('discCode');
  var msg  = el('discMsg');
  if (!code) { msg.className='disc-msg fail'; msg.textContent='Please enter a code.'; return; }
  showLoader('Validating code&#8230;');
  try {
    var res  = await fetch(CFG.sheetsURL + '?action=discount&code=' + encodeURIComponent(code));
    var data = await res.json();
    hideLoader();
    if (data.valid) {
      discCode = code; discAmt = data.discount; finalAmt = data.finalAmount;
      inp.className = 'disc-ok';
      msg.className = 'disc-msg ok';
      msg.textContent = '&#9989; ' + data.message;
      el('discRow').style.display = 'flex';
      el('discAmt').textContent   = '&mdash; Rs.' + fmt(discAmt);
      el('totalAmt').textContent  = 'Rs.' + fmt(finalAmt);
      if (selGW) selectGW(selGW);
      showToast('Discount applied! Saving Rs.' + fmt(discAmt), 'ok');
    } else {
      inp.className = 'disc-err';
      msg.className = 'disc-msg fail';
      msg.textContent = '&#10060; ' + data.message;
      discCode=''; discAmt=0; finalAmt=CFG.baseAmount;
      el('discRow').style.display = 'none';
      el('totalAmt').textContent  = 'Rs.' + fmt(finalAmt);
      if (selGW) selectGW(selGW);
    }
  } catch(e) {
    hideLoader();
    msg.className = 'disc-msg fail';
    msg.textContent = '&#10060; Could not validate. Try again.';
  }
}

// ── PAYMENT ROUTER ───────────────────────────────────────────
function startPayment() {
  if (!selGW) { showToast('Please select a payment method.', 'err'); return; }
  if (selGW === 'rzp') startRazorpay();
  else if (selGW === 'cf') startCashfree();
  else startEasebuzz();
}

// ── RAZORPAY ─────────────────────────────────────────────────
async function startRazorpay() {
  el('payBtn').disabled = true;
  await loadRazorpay();
  try {
    var rzp = new Razorpay({
      key:         CFG.razorpayKeyId,
      amount:      finalAmt * 100,
      currency:    'INR',
      name:        CFG.orgName,
      description: CFG.program,
      prefill:     { name: fd.studentName, email: fd.contactEmail, contact: fd.contactPhone },
      notes: {
        student_name: fd.studentName, parent_name: fd.parentName,
        school: fd.schoolName, city: fd.city,
        class_grade: fd.classGrade, gender: fd.gender
      },
      theme: { color: '#2563eb' },
      handler: async function(response) {
        fd.status='Paid'; fd.paymentId=response.razorpay_payment_id;
        fd.gateway='Razorpay'; fd.discountCode=discCode;
        fd.discountAmt=discAmt; fd.finalAmount=finalAmt;
        showLoader('Saving registration&#8230;');
        await saveToSheet(fd);
        hideLoader();
        showSuccessScreen(fd);
      },
      modal: { ondismiss: async function() {
        fd.status='Cancelled'; fd.gateway='Razorpay';
        fd.paymentId=''; fd.discountCode=discCode;
        fd.discountAmt=discAmt; fd.finalAmount=finalAmt;
        await saveToSheet(fd);
        el('payBtn').disabled = false;
        showToast('Payment cancelled.', 'err');
      }}
    });
    rzp.on('payment.failed', async function(resp) {
      fd.status='Failed'; fd.gateway='Razorpay';
      fd.paymentId=(resp.error.metadata && resp.error.metadata.payment_id) || '';
      fd.discountCode=discCode; fd.discountAmt=discAmt; fd.finalAmount=finalAmt;
      await saveToSheet(fd);
      el('payBtn').disabled = false;
      showToast('Payment failed. Please try again.', 'err');
    });
    rzp.open();
  } catch(e) {
    el('payBtn').disabled = false;
    showToast('Could not open Razorpay. Refresh and try again.', 'err');
  }
}



// ── CASHFREE ─────────────────────────────────────────────────────
function loadCashfree() {
  return new Promise(function(resolve) {
    if (window.Cashfree) { resolve(); return; }
    var s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = resolve; s.onerror = resolve;
    document.head.appendChild(s);
  });
}

async function startCashfree() {
  el('payBtn').disabled = true;
  showLoader('Preparing Cashfree payment&#8230;');
  try {
    var amt   = finalAmt.toFixed(2);
    var txnid = 'ATG' + Date.now();

    // Save initiated row to sheet
    await saveToSheet({
      studentName: fd.studentName, parentName: fd.parentName,
      contactPhone: fd.contactPhone, contactEmail: fd.contactEmail,
      schoolName: fd.schoolName, city: fd.city,
      classGrade: fd.classGrade, gender: fd.gender,
      gateway: 'Cashfree', status: 'Initiated',
      baseAmount: CFG.baseAmount, discountCode: discCode,
      discountAmt: discAmt, finalAmount: finalAmt,
      paymentId: txnid, program: CFG.program
    });

    // Get payment_session_id from Apps Script (server-to-server)
    var params = '?action=cfinit'
      + '&txnid='     + encodeURIComponent(txnid)
      + '&amount='    + encodeURIComponent(amt)
      + '&firstname=' + encodeURIComponent(fd.studentName  || '')
      + '&email='     + encodeURIComponent(fd.contactEmail || '')
      + '&phone='     + encodeURIComponent(fd.contactPhone || '')
      + '&_t='        + Date.now();

    var resp   = await fetch(CFG.sheetsURL + params);
    var result = await resp.json();

    if (!result.success || !result.payment_session_id) {
      hideLoader();
      el('payBtn').disabled = false;
      showToast('Cashfree error: ' + (result.error || 'Could not initiate payment'), 'err');
      return;
    }

    // Load Cashfree SDK and open payment
    await loadCashfree();
    hideLoader();

    var cashfree = window.Cashfree({ mode: 'production' });
    cashfree.checkout({
      paymentSessionId: result.payment_session_id,
      returnUrl: CFG.sheetsURL.replace('/exec', '') + '?dummy=1',
      redirectTarget: '_top'
    }).then(function(res) {
      if (res && res.error) {
        el('payBtn').disabled = false;
        showToast('Payment failed: ' + res.error.message, 'err');
      }
    }).catch(function(e) {
      el('payBtn').disabled = false;
      showToast('Cashfree error: ' + e.message, 'err');
    });

  } catch(e) {
    hideLoader();
    el('payBtn').disabled = false;
    showToast('Cashfree error: ' + e.message, 'err');
  }
}

// ── EASEBUZZ ─────────────────────────────────────────────────
async function startEasebuzz() {
  el('payBtn').disabled = true;
  showLoader('Preparing Easebuzz payment&#8230;');
  try {
    var amt = finalAmt.toFixed(2);
    var txnid = 'ATG' + Date.now();

    // Save initiated row to sheet first
    await saveToSheet({
      studentName: fd.studentName, parentName: fd.parentName,
      contactPhone: fd.contactPhone, contactEmail: fd.contactEmail,
      schoolName: fd.schoolName, city: fd.city,
      classGrade: fd.classGrade, gender: fd.gender,
      gateway: 'Easebuzz', status: 'Initiated',
      baseAmount: CFG.baseAmount, discountCode: discCode,
      discountAmt: discAmt, finalAmount: finalAmt,
      paymentId: txnid, program: CFG.program
    });

    // Call Apps Script to get Easebuzz access_key (server-to-server, no CORS)
    var params = '?action=ebinit'
      + '&txnid='       + encodeURIComponent(txnid)
      + '&amount='      + encodeURIComponent(amt)
      + '&productinfo=' + encodeURIComponent(CFG.program)
      + '&firstname='   + encodeURIComponent(fd.studentName   || '')
      + '&email='       + encodeURIComponent(fd.contactEmail  || '')
      + '&phone='       + encodeURIComponent(fd.contactPhone  || '')
      + '&udf1='        + encodeURIComponent(fd.parentName    || '')
      + '&udf2='        + encodeURIComponent(fd.schoolName    || '')
      + '&udf3='        + encodeURIComponent(fd.city          || '')
      + '&udf4='        + encodeURIComponent(fd.classGrade    || '')
      + '&udf5='        + encodeURIComponent(fd.gender        || '')
      + '&_t='          + Date.now();

    var resp   = await fetch(CFG.sheetsURL + params);
    var result = await resp.json();
    hideLoader();

    if (!result.success || !result.access_key) {
      el('payBtn').disabled = false;
      showToast('Easebuzz error: ' + (result.error || 'Could not initiate payment'), 'err');
      return;
    }

    // POST form to Easebuzz with access_key (GET redirect returns 404)
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://pay.easebuzz.in/pay/init';
    form.target = '_top';
    form.style.display = 'none';
    var inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = 'access_key';
    inp.value = result.access_key;
    form.appendChild(inp);
    document.body.appendChild(form);
    form.submit();

  } catch(e) {
    hideLoader();
    el('payBtn').disabled = false;
    showToast('Easebuzz error: ' + e.message, 'err');
  }
}

// ── SAVE TO SHEET ────────────────────────────────────────────
// POST with Content-Type: text/plain &mdash; the only CORS-safe write method:
//   &#8226; GET  &#8594; cached by Google CDN &#8594; script never reruns &#8594; sheet empty
//   &#8226; POST application/json &#8594; triggers CORS preflight &#8594; Apps Script
//     ignores OPTIONS &#8594; browser blocks request &#8594; sheet empty
//   &#8226; POST text/plain &#8594; "simple request" per CORS spec &#8594; no preflight
//     &#8594; goes straight through &#8594; Apps Script JSON.parses body &#8594; &#9989; works
async function saveToSheet(data) {
  // POST with Content-Type: text/plain = "simple request" per CORS spec.
  // No preflight. Apps Script receives it via doPost(e).
  // mode: 'no-cors' means we can't read the response - that's fine for saves.
  // We only need fire-and-forget for sheet writes.
  try {
    await fetch(CFG.sheetsURL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    return { success: true };
  } catch(e) {
    console.error('saveToSheet fetch error:', e);
    return { success: false };
  }
}

// ── SUCCESS SCREEN ───────────────────────────────────────────
function showSuccessScreen(d) {
  show('step2', false);
  el('step3').classList.add('show');
  setStep(3);
  el('sdetail').innerHTML =
    row('Student',    esc(d.studentName))
  + row('Class',      esc(d.classGrade))
  + row('School',     esc(d.schoolName) + ', ' + esc(d.city))
  + row('Parent',     esc(d.parentName))
  + row('Amount Paid','<span style="color:var(--green)">Rs.' + fmt(d.finalAmount) + ' &#10003;</span>')
  + (d.discountCode ? row('Discount','<span style="color:var(--green)">' + esc(d.discountCode) + ' (Rs.' + fmt(d.discountAmt) + ' saved)</span>') : '')
  + row('Via',        esc(d.gateway))
  + row('Payment ID', '<span style="font-size:12px;color:var(--m)">' + esc(d.paymentId) + '</span>', true);
  showToast('Registration confirmed! &#9989;', 'ok');
  startRedirectTimer();
}

function startRedirectTimer() {
  var count = 5, rc = el('rcount');
  var t = setInterval(function(){
    count--; rc.textContent = count;
    if (count <= 0) { clearInterval(t); window.location.href = CFG.redirectURL; }
  }, 1000);
}

// ── EXPOSE to onclick= handlers in HTML (must be on window) ──
// Since everything is in an IIFE, onclick="goToPayment()" in the HTML
// won't find the function unless we explicitly attach to window.
window.goToPayment  = goToPayment;
window.goBack       = goBack;
window.selectGW     = selectGW;
window.applyDiscount= applyDiscount;
window.startPayment = startPayment;
window.retryPayment = retryPayment;

})(); // end IIFE