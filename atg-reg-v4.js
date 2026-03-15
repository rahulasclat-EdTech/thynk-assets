// ATGenius Registration v4 - Clean Rewrite
// Cashfree + Razorpay | thynksuccess.com/registration/

var CFG = {
  sheetsURL:     'https://script.google.com/macros/s/AKfycbxTgJIE4XAqFhQ_SHd0TfBx_bYm4htRlWoWq3ENxSfmVtIFaaUw9YxMy3HCZpg94BpH-Q/exec',
  razorpayKeyId: 'rzp_live_SQTJFYmQGDno59',
  baseAmount:    1200,
  program:       'ATGenius Coaching Program',
  orgName:       'Thynk Success',
  redirectURL:   'https://thynksuccess.com'
};

// ── HELPERS ──────────────────────────────────────────────────────
function el(id)  { return document.getElementById(id); }
function g(id)   { return el(id) ? el(id).value.trim() : ''; }
function esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n)  { var x = parseFloat(String(n).replace(/,/g,'')); return isNaN(x) ? '0' : x.toLocaleString('en-IN'); }
function show(id, v) { if(el(id)) el(id).style.display = v ? 'block' : 'none'; }

function showLoader(t) {
  if(el('ltxt')) el('ltxt').textContent = t || 'Please wait...';
  if(el('loader')) el('loader').classList.add('show');
}
function hideLoader() {
  if(el('loader')) el('loader').classList.remove('show');
}

var _tt;
function showToast(msg, type) {
  var t = el('toast');
  if(!t) return;
  t.textContent = (type==='ok' ? '✅ ' : type==='err' ? '❌ ' : 'ℹ️ ') + msg;
  t.className = 'toast show' + (type==='ok' ? ' tok' : type==='err' ? ' terr' : '');
  clearTimeout(_tt);
  _tt = setTimeout(function(){ t.classList.remove('show'); }, 4500);
}

// ── STATE ────────────────────────────────────────────────────────
var fd       = {};
var selGW    = '';
var discCode = '';
var discAmt  = 0;
var finalAmt = CFG.baseAmount;

var GATEWAY_SEQUENCE = ['cf', 'rzp'];
var GATEWAY_LABELS = {
  cf:  { name: 'Cashfree', color: '#2563eb', selClass: 'sel-cf' },
  rzp: { name: 'Razorpay', color: '#2563eb', selClass: 'sel-rzp' }
};

// ── VALIDATION ───────────────────────────────────────────────────
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
    var inp = el(id);
    if(!inp) return;
    var pass = rules[id](inp.value);
    inp.classList.toggle('err', !pass);
    var errEl = el('e-' + id);
    if(errEl) errEl.classList.toggle('show', !pass);
    if(!pass) ok = false;
  });
  return ok;
}

// ── STEP NAVIGATION ──────────────────────────────────────────────
function goToPayment() {
  if (!validate()) { showToast('Please fill all fields correctly.', 'err'); return; }
  fd = {
    studentName:  g('studentName'),  classGrade:   g('classGrade'),
    gender:       g('gender'),       schoolName:   g('schoolName'),
    city:         g('city'),         parentName:   g('parentName'),
    contactPhone: g('contactPhone'), contactEmail: g('contactEmail'),
    program:      CFG.program,       baseAmount:   CFG.baseAmount
  };
  var rb = el('reviewBox');
  if(rb) rb.innerHTML =
    '<div class="orow"><span class="olbl">Student</span><span class="oval">' + esc(fd.studentName) + ' - ' + esc(fd.classGrade) + '</span></div>'
  + '<div class="orow"><span class="olbl">School</span><span class="oval">' + esc(fd.schoolName) + ', ' + esc(fd.city) + '</span></div>'
  + '<div class="orow"><span class="olbl">Parent</span><span class="oval">' + esc(fd.parentName) + '</span></div>'
  + '<div class="orow"><span class="olbl">Phone</span><span class="oval">' + esc(fd.contactPhone) + '</span></div>'
  + '<div class="orow" style="border-bottom:none"><span class="olbl">Email</span><span class="oval">' + esc(fd.contactEmail) + '</span></div>';
  show('step1', false); show('step2', true); setStep(2);
  renderGateways();
  updateAmountDisplay();
}

function goBack() { show('step2', false); show('step1', true); setStep(1); }
function retryPayment() { window.location.href = 'https://thynksuccess.com/registration/'; }

function setStep(n) {
  [1,2,3].forEach(function(i){
    var d = el('sd'+i), sn = el('sn'+i);
    if(!d) return;
    d.classList.remove('active','done');
    if (i < n)      { d.classList.add('done'); if(sn) sn.textContent = '✓'; }
    else if(i === n)  d.classList.add('active');
    else              { if(sn) sn.textContent = String(i); }
  });
}

function updateAmountDisplay() {
  if(el('totalAmt')) el('totalAmt').textContent = 'Rs.' + fmt(finalAmt);
  if(selGW) selectGW(selGW);
}

// ── GATEWAY RENDER ───────────────────────────────────────────────
function renderGateways() {
  var container = el('gwContainer');
  if(!container) return;
  container.innerHTML = '';
  GATEWAY_SEQUENCE.forEach(function(gw) {
    var info = GATEWAY_LABELS[gw];
    if(!info) return;
    var div = document.createElement('div');
    div.className = 'gw-btn';
    div.id = 'gw' + gw.charAt(0).toUpperCase() + gw.slice(1);
    div.onclick = function(){ selectGW(gw); };
    div.innerHTML = '<div class="gw-info"><div class="gw-name">' + info.name + '</div><div class="gw-sub">UPI, Cards, Wallets</div></div><div class="gw-tick">&#10003;</div>';
    container.appendChild(div);
  });
}

function selectGW(gw) {
  selGW = gw;
  GATEWAY_SEQUENCE.forEach(function(g) {
    var btn = el('gw' + g.charAt(0).toUpperCase() + g.slice(1));
    if(btn) btn.className = 'gw-btn' + (gw === g ? ' ' + GATEWAY_LABELS[g].selClass : '');
  });
  var info = GATEWAY_LABELS[gw] || { name: gw, color: '#2563eb' };
  var btn = el('payBtn');
  if(btn) {
    btn.disabled = false;
    btn.className = 'btn-next';
    btn.style.background = info.color;
    btn.textContent = 'Pay Rs.' + fmt(finalAmt) + ' via ' + info.name;
  }
  if(el('gwLabel')) el('gwLabel').textContent = info.name;
}

// ── DISCOUNT ─────────────────────────────────────────────────────
async function applyDiscount() {
  var code = el('discCode') ? el('discCode').value.trim().toUpperCase() : '';
  var inp  = el('discCode');
  var msg  = el('discMsg');
  if(!code) { if(msg){ msg.className='disc-msg fail'; msg.textContent='Please enter a code.'; } return; }
  showLoader('Validating code...');
  try {
    var res  = await fetch(CFG.sheetsURL + '?action=discount&code=' + encodeURIComponent(code) + '&_t=' + Date.now());
    var data = await res.json();
    hideLoader();
    if(data.valid) {
      discCode = code; discAmt = data.discount; finalAmt = data.finalAmount;
      if(inp) inp.className = 'disc-ok';
      if(msg){ msg.className='disc-msg ok'; msg.textContent = data.message; }
      if(el('discRow')) el('discRow').style.display = 'flex';
      if(el('discAmt')) el('discAmt').textContent = '- Rs.' + fmt(discAmt);
      if(el('totalAmt')) el('totalAmt').textContent = 'Rs.' + fmt(finalAmt);
      if(selGW) selectGW(selGW);
      showToast('Discount applied! Saving Rs.' + fmt(discAmt), 'ok');
    } else {
      if(inp) inp.className = 'disc-err';
      if(msg){ msg.className='disc-msg fail'; msg.textContent = data.message; }
      discCode=''; discAmt=0; finalAmt=CFG.baseAmount;
      if(el('discRow')) el('discRow').style.display = 'none';
      if(el('totalAmt')) el('totalAmt').textContent = 'Rs.' + fmt(finalAmt);
      if(selGW) selectGW(selGW);
    }
  } catch(e) {
    hideLoader();
    if(msg){ msg.className='disc-msg fail'; msg.textContent='Could not validate. Try again.'; }
  }
}

// ── SAVE TO SHEET ────────────────────────────────────────────────
async function saveToSheet(d) {
  try {
    var payload = btoa(unescape(encodeURIComponent(JSON.stringify(d))));
    await fetch(CFG.sheetsURL + '?action=save&data=' + encodeURIComponent(payload) + '&_t=' + Date.now());
  } catch(e) {
    console.log('saveToSheet error:', e.message);
  }
}

// ── PAYMENT ROUTER ───────────────────────────────────────────────
function startPayment() {
  if(!selGW) { showToast('Please select a payment method.', 'err'); return; }
  if(selGW === 'rzp') startRazorpay();
  else if(selGW === 'cf') startCashfree();
}

// ── RAZORPAY ─────────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise(function(resolve) {
    if(window.Razorpay) { resolve(); return; }
    var s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve; s.onerror = resolve;
    document.head.appendChild(s);
  });
}

async function startRazorpay() {
  if(el('payBtn')) el('payBtn').disabled = true;
  await loadRazorpay();
  try {
    var rzp = new window.Razorpay({
      key:         CFG.razorpayKeyId,
      amount:      finalAmt * 100,
      currency:    'INR',
      name:        CFG.orgName,
      description: CFG.program,
      prefill:     { name: fd.studentName, email: fd.contactEmail, contact: fd.contactPhone },
      notes: {
        student_name: fd.studentName, parent_name:  fd.parentName,
        school:       fd.schoolName,  city:          fd.city,
        class_grade:  fd.classGrade,  gender:        fd.gender
      },
      theme: { color: '#2563eb' },
      handler: async function(response) {
        showLoader('Saving registration...');
        await saveToSheet({
          studentName: fd.studentName, parentName: fd.parentName,
          contactPhone: fd.contactPhone, contactEmail: fd.contactEmail,
          schoolName: fd.schoolName, city: fd.city,
          classGrade: fd.classGrade, gender: fd.gender,
          gateway: 'Razorpay', status: 'Paid',
          baseAmount: CFG.baseAmount, discountCode: discCode,
          discountAmt: discAmt, finalAmount: finalAmt,
          paymentId: response.razorpay_payment_id, program: CFG.program
        });
        hideLoader();
        showSuccessScreen({
          studentName: fd.studentName, gateway: 'Razorpay',
          paymentId: response.razorpay_payment_id, finalAmount: finalAmt,
          classGrade: fd.classGrade, schoolName: fd.schoolName,
          city: fd.city, discountCode: discCode, discountAmt: discAmt
        });
      },
      modal: { ondismiss: async function() {
        await saveToSheet({
          studentName: fd.studentName, gateway: 'Razorpay', status: 'Cancelled',
          baseAmount: CFG.baseAmount, discountCode: discCode,
          discountAmt: discAmt, finalAmount: finalAmt,
          paymentId: '', program: CFG.program
        });
        if(el('payBtn')) el('payBtn').disabled = false;
        showToast('Payment cancelled. Please try again.', 'err');
      }}
    });
    rzp.on('payment.failed', async function(resp) {
      await saveToSheet({
        studentName: fd.studentName, gateway: 'Razorpay', status: 'Failed',
        baseAmount: CFG.baseAmount, discountCode: discCode,
        discountAmt: discAmt, finalAmount: finalAmt,
        paymentId: (resp.error.metadata && resp.error.metadata.payment_id) || '',
        program: CFG.program
      });
      if(el('payBtn')) el('payBtn').disabled = false;
      showToast('Payment failed. Please try again.', 'err');
    });
    rzp.open();
  } catch(e) {
    if(el('payBtn')) el('payBtn').disabled = false;
    showToast('Could not open Razorpay. Please refresh and try again.', 'err');
  }
}

// ── CASHFREE ─────────────────────────────────────────────────────
function loadCashfree() {
  return new Promise(function(resolve) {
    if(window.Cashfree) { resolve(); return; }
    var s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = resolve; s.onerror = resolve;
    document.head.appendChild(s);
  });
}

async function startCashfree() {
  if(el('payBtn')) el('payBtn').disabled = true;
  showLoader('Preparing Cashfree payment...');
  try {
    var amt   = finalAmt.toFixed(2);
    var txnid = 'ATG' + Date.now();

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

    var resp = await fetch(CFG.sheetsURL
      + '?action=cfinit'
      + '&txnid='     + encodeURIComponent(txnid)
      + '&amount='    + encodeURIComponent(amt)
      + '&firstname=' + encodeURIComponent(fd.studentName  || '')
      + '&email='     + encodeURIComponent(fd.contactEmail || '')
      + '&phone='     + encodeURIComponent(fd.contactPhone || '')
      + '&udf1='      + encodeURIComponent(fd.parentName   || '')
      + '&udf2='      + encodeURIComponent(fd.schoolName   || '')
      + '&udf3='      + encodeURIComponent(fd.city         || '')
      + '&udf4='      + encodeURIComponent(fd.classGrade   || '')
      + '&udf5='      + encodeURIComponent(fd.gender       || '')
      + '&_t='        + Date.now()
    );
    var result = await resp.json();

    if(!result.success || !result.payment_session_id) {
      hideLoader();
      if(el('payBtn')) el('payBtn').disabled = false;
      showToast('Cashfree error: ' + (result.error || 'Could not initiate payment'), 'err');
      return;
    }

    await loadCashfree();
    hideLoader();

    // Save form data before redirect so we can restore on return
    try {
      sessionStorage.setItem('atg_fd', JSON.stringify(fd));
      sessionStorage.setItem('atg_finalAmt', String(finalAmt));
    } catch(e) {}

    var cashfree = window.Cashfree({ mode: 'production' });
    cashfree.checkout({
      paymentSessionId: result.payment_session_id,
      redirectTarget:   '_self'
    });

  } catch(e) {
    hideLoader();
    if(el('payBtn')) el('payBtn').disabled = false;
    showToast('Cashfree error: ' + e.message, 'err');
  }
}

// ── SUCCESS SCREEN ───────────────────────────────────────────────
function showSuccessScreen(d) {
  show('step1', false); show('step2', false); show('step3', true); setStep(3);
  var sc = el('successContent');
  if(!sc) return;
  sc.innerHTML =
    '<div style="text-align:center;padding:24px">'
  + '<div style="font-size:56px">🎉</div>'
  + '<h2 style="color:#059669;margin:12px 0">Registration Confirmed!</h2>'
  + '<p style="color:#64748b">Welcome to ATGenius Coaching Program</p>'
  + '<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">'
  + '<tr style="background:#f8faff"><td style="padding:10px;color:#64748b">Student</td><td style="padding:10px;font-weight:600;text-align:right">' + esc(d.studentName||'') + '</td></tr>'
  + '<tr><td style="padding:10px;color:#64748b">Gateway</td><td style="padding:10px;font-weight:600;text-align:right">' + esc(d.gateway||'') + '</td></tr>'
  + '<tr style="background:#f8faff"><td style="padding:10px;color:#64748b">Amount Paid</td><td style="padding:10px;font-weight:700;color:#059669;text-align:right">Rs.' + fmt(d.finalAmount||0) + '</td></tr>'
  + '<tr><td style="padding:10px;color:#64748b">Payment ID</td><td style="padding:10px;font-size:12px;color:#94a3b8;text-align:right">' + esc(d.paymentId||'-') + '</td></tr>'
  + '</table>'
  + '<p style="margin-top:20px;font-size:14px;color:#64748b">Our team will call you within <strong>24 hours</strong> with program details.</p>'
  + '</div>';
}

// ── CASHFREE RETURN HANDLER ──────────────────────────────────────
function handleCashfreeReturn() {
  var params  = new URLSearchParams(window.location.search);
  var cfOid   = params.get('cf_oid') || '';
  var txnid   = params.get('txnid')  || '';
  var name    = params.get('name')   || '';
  var amount  = parseFloat(params.get('amount') || CFG.baseAmount) || CFG.baseAmount;

  if(!cfOid && !txnid) return;

  // Restore fd from sessionStorage if available
  try {
    var savedFd  = sessionStorage.getItem('atg_fd');
    var savedAmt = sessionStorage.getItem('atg_finalAmt');
    if(savedFd)  fd = JSON.parse(savedFd);
    if(savedAmt) finalAmt = parseFloat(savedAmt) || amount;
    else finalAmt = amount;
  } catch(e) { finalAmt = amount; }

  window.history.replaceState({}, '', window.location.pathname);
  var verifyId = txnid || cfOid;

  // Show step2 immediately so user sees payment page while verifying
  // First make sure step1 is hidden and step2 visible
  show('step1', false);
  show('step2', true);
  show('step3', false);
  setStep(2);
  renderGateways();
  updateAmountDisplay();

  // Populate reviewBox with name from URL params
  var rb = el('reviewBox');
  if(rb && name) {
    rb.innerHTML = '<div class="orow"><span class="olbl">Student</span><span class="oval">' + esc(name) + '</span></div>'
      + '<div class="orow" style="border-bottom:none"><span class="olbl">Amount</span><span class="oval">Rs.' + fmt(amount) + '</span></div>';
  }

  showLoader('Verifying payment...');

  fetch(CFG.sheetsURL + '?action=cfverify&txnid=' + encodeURIComponent(verifyId) + '&_t=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(res) {
      hideLoader();
      if(res.status === 'PAID') {
        saveToSheet({
          studentName: name, gateway: 'Cashfree', status: 'Paid',
          paymentId: res.cf_payment_id || verifyId,
          finalAmount: amount, program: CFG.program
        });
        showSuccessScreen({
          studentName: name, gateway: 'Cashfree',
          paymentId: res.cf_payment_id || verifyId,
          finalAmount: amount
        });
      } else {
        saveToSheet({
          studentName: name, gateway: 'Cashfree', status: 'Cancelled',
          paymentId: verifyId, finalAmount: amount, program: CFG.program
        });
        showToast('Payment cancelled. Please select a gateway and try again.', 'err');
      }
    })
    .catch(function() {
      hideLoader();
      showToast('Could not verify payment. Please try again.', 'err');
    });
}

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Scope input listeners to registration card only
  var card = el('atgCard');
  if(card) {
    card.querySelectorAll('input, select').forEach(function(inp) {
      inp.addEventListener('input', function() {
        inp.classList.remove('err');
        var errEl = el('e-' + inp.id);
        if(errEl) errEl.classList.remove('show');
      });
    });
  }
  // Handle Cashfree return
  handleCashfreeReturn();
});

// If DOM already loaded, run immediately
if(document.readyState !== 'loading') {
  handleCashfreeReturn();
}

// ── EXPOSE TO HTML onclick= HANDLERS ────────────────────────────
window.goToPayment   = goToPayment;
window.goBack        = goBack;
window.selectGW      = selectGW;
window.applyDiscount = applyDiscount;
window.startPayment  = startPayment;
window.retryPayment  = retryPayment;
window.startCashfree = startCashfree;

console.log('[ATG] Registration script loaded. startCashfree:', typeof startCashfree);
