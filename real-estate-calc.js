// ── Config ──
const STORAGE_KEY = "real_estate_calc_apartments";

// ── Supabase ──
const SUPABASE_URL = "https://oieqfraejbnaliflhate.supabase.co";
const SUPABASE_KEY = "sb_publishable_doZWKR_IStO3u488bkVQ3g_VxsEswV3";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Apartment state (multi-scenario) ──
let apartments = []; // [{ id, name, data }]
let currentId = null;

function genId() {
  return "apt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}
function currentApartment() {
  return apartments.find((a) => a.id === currentId);
}
function blankData() {
  return {
    purchase: [{ description: "מחיר דירה (חוזה)", amount: 0 }],
    renovation: [{ description: "שיפוץ", amount: 0 }],
    equity: [{ description: "חיסכון", amount: 0 }],
    mortgage: { amount: 0, rate: 4.5, years: 30 },
    loans: [],
    brokerEnabled: true,
  };
}

// ── Auth ──
function showApp() {
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("app-shell").style.display = "";
}
function showLogin() {
  document.getElementById("login-overlay").style.display = "";
  document.getElementById("app-shell").style.display = "none";
}
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");

  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "מתחבר...";

  const { error } = await sb.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "התחבר";

  if (error) {
    console.error("Login error:", error);
    errorEl.textContent = "אימייל או סיסמה שגויים";
    return;
  }
  showApp();
  await initApp();
}
async function handleLogout() {
  await sb.auth.signOut();
  showLogin();
}
async function checkSession() {
  const {
    data: { session },
  } = await sb.auth.getSession();
  return !!session;
}

// ── Row helpers ──
function addRow(containerId) {
  const container = document.getElementById(containerId);
  const div = document.createElement("div");
  div.className = "row-item";
  div.innerHTML = `
    <input type="text" placeholder="סעיף חדש">
    <div class="amount-wrap">
      <input type="number" class="amount" value="0" oninput="updateAll()">
      <span class="currency-tag">₪</span>
    </div>
    <div class="row-actions">
      <button class="btn-move" onclick="moveRow(this,-1)" title="הזז למעלה">▲</button>
      <button class="btn-move" onclick="moveRow(this,1)" title="הזז למטה">▼</button>
      <button class="btn-del" onclick="this.closest('.row-item').remove(); updateAll();">×</button>
    </div>
  `;
  container.appendChild(div);
  updateAll();
}

function addRowWithData(containerId, description, amount, deletable) {
  const container = document.getElementById(containerId);
  const div = document.createElement("div");
  div.className = "row-item";
  const deleteHtml = deletable
    ? `<button class="btn-del" onclick="this.closest('.row-item').remove(); updateAll();">×</button>`
    : `<span class="row-action-placeholder"></span>`;
  div.innerHTML = `
    <input type="text" placeholder="תיאור" value="${escapeHtml(description)}">
    <div class="amount-wrap">
      <input type="number" class="amount" value="${amount}" oninput="updateAll()">
      <span class="currency-tag">₪</span>
    </div>
    <div class="row-actions">
      <button class="btn-move" onclick="moveRow(this,-1)" title="הזז למעלה">▲</button>
      <button class="btn-move" onclick="moveRow(this,1)" title="הזז למטה">▼</button>
      ${deleteHtml}
    </div>
  `;
  container.appendChild(div);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

// ── Row reorder ──
function moveRow(btn, direction) {
  const row = btn.closest(".row-item");
  if (!row) return;
  const container = row.parentElement;
  if (direction === -1 && row.previousElementSibling) {
    container.insertBefore(row, row.previousElementSibling);
  } else if (direction === 1 && row.nextElementSibling) {
    container.insertBefore(row, row.nextElementSibling.nextElementSibling);
  }
  updateAll();
}

// ── Loan helpers ──
function addLoanRow() {
  addLoanRowWithData("", 0, 4.5, 60);
  updateAll();
}

function addLoanRowWithData(description, amount, rate, months) {
  const container = document.getElementById("loans-list");
  const div = document.createElement("div");
  div.className = "loan-row";
  div.innerHTML = `
    <div class="loan-row-header">
      <input type="text" class="loan-desc" placeholder="תיאור הלוואה" value="${escapeHtml(description)}">
      <button class="btn-del" onclick="this.closest('.loan-row').remove(); updateAll();">×</button>
    </div>
    <div class="loan-row-fields">
      <div class="loan-field">
        <label>סכום</label>
        <div class="amount-wrap">
          <input type="number" class="loan-amount" value="${amount}" oninput="updateAll()">
          <span class="currency-tag">₪</span>
        </div>
      </div>
      <div class="loan-field">
        <label>ריבית שנתית</label>
        <div class="amount-wrap">
          <input type="number" class="loan-rate" value="${rate}" step="0.1" oninput="updateAll()">
          <span class="currency-tag">%</span>
        </div>
      </div>
      <div class="loan-field">
        <label>חודשים</label>
        <div class="amount-wrap">
          <input type="number" class="loan-months" value="${months}" oninput="updateAll()">
          <span class="currency-tag">חודש</span>
        </div>
      </div>
      <div class="loan-field loan-result-field">
        <label>החזר חודשי</label>
        <span class="loan-payment">0 ₪</span>
      </div>
    </div>
  `;
  container.appendChild(div);
}

function calculateLoanPayment(amount, annualRate, months) {
  if (!amount || !annualRate || !months) return 0;
  const r = annualRate / 100 / 12;
  const n = months;
  return (amount * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

function collectLoanRows() {
  const rows = document.querySelectorAll("#loans-list .loan-row");
  const data = [];
  rows.forEach((row) => {
    data.push({
      description: row.querySelector(".loan-desc")?.value || "",
      amount: parseFloat(row.querySelector(".loan-amount")?.value) || 0,
      rate: parseFloat(row.querySelector(".loan-rate")?.value) || 0,
      months: parseFloat(row.querySelector(".loan-months")?.value) || 0,
    });
  });
  return data;
}

function restoreLoanSection(loans) {
  const container = document.getElementById("loans-list");
  container.innerHTML = "";
  (loans || []).forEach((loan) => {
    addLoanRowWithData(loan.description, loan.amount, loan.rate, loan.months);
  });
}

// ── Purchase tax (דירה יחידה, מדרגות 16.1.2024–15.1.2028) ──
function calcPurchaseTax(price) {
  const brackets = [
    { upto: 1978745, rate: 0 },
    { upto: 2347040, rate: 0.035 },
    { upto: 6055070, rate: 0.05 },
    { upto: 20183565, rate: 0.08 },
    { upto: Infinity, rate: 0.1 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (price <= prev) break;
    const taxable = Math.min(price, b.upto) - prev;
    tax += taxable * b.rate;
    prev = b.upto;
  }
  return tax;
}

// ── Pure metrics: single source of truth for live view AND compare ──
function computeMetrics(data) {
  data = data || {};
  const sumArr = (arr) => (arr || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const purchaseSum = sumArr(data.purchase);
  const renoSum = sumArr(data.renovation);
  const equitySum = sumArr(data.equity);

  const mortgage = data.mortgage || {};
  const mortgageSum = parseFloat(mortgage.amount) || 0;
  const mRate = parseFloat(mortgage.rate) || 0;
  const mYears = parseFloat(mortgage.years) || 0;

  const apartmentPrice = parseFloat(data.purchase && data.purchase[0] && data.purchase[0].amount) || 0;
  const brokerEnabled = data.brokerEnabled !== false; // default ON
  const brokerFee = brokerEnabled ? apartmentPrice * 0.02 * 1.18 : 0;
  const purchaseTax = calcPurchaseTax(apartmentPrice);

  const totalCost = purchaseSum + renoSum + brokerFee + purchaseTax;
  const totalSources = equitySum + mortgageSum;
  const totalLoanAmounts = sumArr(data.loans);

  const maxMortgage = apartmentPrice * 0.75;
  const minEquityForBank = apartmentPrice * 0.25;
  const extraCosts = totalCost - apartmentPrice;
  const totalCashNeeded = minEquityForBank + extraCosts - totalLoanAmounts;
  const balance = equitySum - totalCashNeeded;

  const currentLTV = apartmentPrice > 0 ? (mortgageSum / apartmentPrice) * 100 : 0;
  const ltvOk = currentLTV <= 75;

  const monthlyMortgage = calculateLoanPayment(mortgageSum, mRate, mYears * 12);
  const totalRepay = monthlyMortgage * mYears * 12;
  const totalInterest = Math.max(totalRepay - mortgageSum, 0);

  let totalLoanMonthly = 0;
  (data.loans || []).forEach((l) => {
    totalLoanMonthly += calculateLoanPayment(
      parseFloat(l.amount) || 0,
      parseFloat(l.rate) || 0,
      parseFloat(l.months) || 0,
    );
  });
  const totalMonthly = monthlyMortgage + totalLoanMonthly;

  return {
    purchaseSum, renoSum, equitySum, mortgageSum, apartmentPrice,
    brokerFee, purchaseTax, totalCost, totalSources, totalLoanAmounts,
    maxMortgage, minEquityForBank, extraCosts, totalCashNeeded, balance,
    currentLTV, ltvOk, monthlyMortgage, totalInterest, totalRepay,
    totalLoanMonthly, totalMonthly,
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Render live view from current DOM ──
function updateAll() {
  const data = collectData();
  const m = computeMetrics(data);
  const fmt = (n) => Math.round(n).toLocaleString() + " ₪";
  const fmtShort = (n) => Math.round(n).toLocaleString();

  setText("purchase-total", fmt(m.purchaseSum));
  setText("renovation-total", fmt(m.renoSum));
  setText("equity-total", fmt(m.equitySum));

  setText("sum_purchase", fmt(m.purchaseSum));
  setText("sum_renovation", fmt(m.renoSum));
  setText("broker_fee", fmt(m.brokerFee));
  setText("purchase_tax", fmt(m.purchaseTax));
  setText("total_cost", fmt(m.totalCost));

  setText("apartment_price_display", fmt(m.apartmentPrice));
  setText("min_equity_needed", fmt(m.minEquityForBank));
  setText("min_equity_needed_2", fmt(m.minEquityForBank));
  setText("total_mortgage", fmt(m.maxMortgage));
  setText("extra_costs", fmt(m.extraCosts));
  setText("loan_deduction", fmt(m.totalLoanAmounts));
  setText("total_cash_needed", fmt(m.totalCashNeeded));

  setText("ltv_display", m.currentLTV.toFixed(1) + "%");
  const ltvEl = document.getElementById("ltv_display");
  if (ltvEl) ltvEl.className = "num " + (m.ltvOk ? "" : "num-warn");
  const ltvWarn = document.getElementById("ltv-warning");
  if (ltvWarn) ltvWarn.style.display = m.ltvOk ? "none" : "flex";

  setText("sum_equity", fmt(m.equitySum));
  setText("sum_mortgage", fmt(m.mortgageSum));
  setText("sum_sources", fmt(m.totalSources));

  const equityPct = m.totalCashNeeded > 0 ? Math.min((m.equitySum / m.totalCashNeeded) * 100, 100) : 0;
  setText("equity-pct", Math.round(equityPct) + "%");
  const fillEl = document.getElementById("equity-fill");
  if (fillEl) fillEl.style.width = equityPct + "%";
  setText("equity-have", fmt(m.equitySum));
  setText("equity-need", "מתוך " + fmt(m.totalCashNeeded));
  if (fillEl) {
    fillEl.style.background =
      equityPct >= 100
        ? "linear-gradient(90deg, var(--green), var(--teal))"
        : equityPct >= 60
          ? "linear-gradient(90deg, var(--teal), var(--teal-surface))"
          : "linear-gradient(90deg, var(--red), var(--accent))";
  }

  setText("final_balance", fmt(m.balance));
  const balanceBox = document.getElementById("balance-box");
  if (balanceBox) {
    balanceBox.className = "balance-box " + (m.balance >= 0 ? "positive" : "negative");
    setText("balance-badge", m.balance >= 0 ? "+" : "−");
  }

  setText("monthly_return", fmtShort(Math.round(m.monthlyMortgage)));
  setText("total_interest", fmtShort(Math.round(m.totalInterest)));
  setText("total_repayment", fmtShort(Math.round(m.totalRepay)));

  document.querySelectorAll("#loans-list .loan-row").forEach((row) => {
    const lAmount = parseFloat(row.querySelector(".loan-amount")?.value) || 0;
    const lRate = parseFloat(row.querySelector(".loan-rate")?.value) || 0;
    const lMonths = parseFloat(row.querySelector(".loan-months")?.value) || 0;
    const payment = calculateLoanPayment(lAmount, lRate, lMonths);
    const paymentEl = row.querySelector(".loan-payment");
    if (paymentEl) paymentEl.textContent = fmt(Math.round(payment));
  });
  setText("loans-monthly-total", fmtShort(Math.round(m.totalLoanMonthly)) + " ₪/חודש");

  setText("mortgage_monthly_summary", fmt(Math.round(m.monthlyMortgage)));
  setText("loans_monthly_summary", fmt(Math.round(m.totalLoanMonthly)));
  setText("total_monthly_obligations", fmt(Math.round(m.totalMonthly)));
}

// ── Collect / Restore data ──
function collectSectionRows(containerId) {
  const rows = document.querySelectorAll(`#${containerId} .row-item`);
  const data = [];
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    if (inputs.length >= 2) {
      data.push({
        description: inputs[0].value,
        amount: parseFloat(inputs[1].value) || 0,
      });
    }
  });
  return data;
}

function collectData() {
  const brokerToggle = document.getElementById("broker-toggle");
  return {
    purchase: collectSectionRows("purchase-list"),
    renovation: collectSectionRows("renovation-list"),
    equity: collectSectionRows("equity-list"),
    mortgage: {
      amount: parseFloat(document.getElementById("m_amount").value) || 0,
      rate: parseFloat(document.getElementById("m_rate").value) || 0,
      years: parseFloat(document.getElementById("m_years").value) || 0,
    },
    loans: collectLoanRows(),
    brokerEnabled: brokerToggle ? brokerToggle.checked : true,
  };
}

function restoreSection(containerId, rows) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  (rows || []).forEach((row, i) => {
    addRowWithData(containerId, row.description, row.amount, i > 0);
  });
}

function restoreData(data) {
  data = data || {};

  restoreSection("purchase-list", data.purchase && data.purchase.length ? data.purchase : blankData().purchase);
  restoreSection("renovation-list", data.renovation || []);
  restoreSection("equity-list", data.equity || []);

  const mortgage = data.mortgage || {};
  document.getElementById("m_amount").value = mortgage.amount || 0;
  document.getElementById("m_rate").value = mortgage.rate || 0;
  document.getElementById("m_years").value = mortgage.years || 0;

  restoreLoanSection(data.loans || []);

  const bt = document.getElementById("broker-toggle");
  if (bt) bt.checked = data.brokerEnabled !== false;

  updateAll();
}

// ── Apartment persistence (Supabase rows) ──
function saveCurrentToMemory() {
  const ap = currentApartment();
  if (ap) ap.data = collectData();
}

async function loadApartments() {
  try {
    const { data, error } = await sb
      .from("calculator_data")
      .select("id,name,data")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("loadApartments error:", error);
      return false;
    }
    apartments = (data || []).map((r) => ({
      id: r.id,
      name: r.name || "דירה",
      data: r.data || {},
    }));
    mirrorToLocalStorage();
    return true;
  } catch (e) {
    console.error("loadApartments failed:", e);
    return false;
  }
}

async function saveApartment(ap) {
  try {
    const { error } = await sb.from("calculator_data").upsert(
      { id: ap.id, name: ap.name, data: ap.data, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    mirrorToLocalStorage();
    return !error;
  } catch {
    return false;
  }
}

async function deleteApartmentRow(id) {
  try {
    const { error } = await sb.from("calculator_data").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

function mirrorToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apartments));
  } catch {}
}
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        apartments = parsed;
        return true;
      }
    }
  } catch {}
  return false;
}

// ── Tabs ──
function renderTabs() {
  const bar = document.getElementById("apartment-tabs");
  if (!bar) return;
  bar.innerHTML = "";
  apartments.forEach((ap) => {
    const tab = document.createElement("div");
    tab.className = "apt-tab" + (ap.id === currentId ? " active" : "");
    tab.innerHTML = `
      <button class="apt-tab-name" onclick="switchApartment('${ap.id}')" ondblclick="renameApartment('${ap.id}')" title="לחיצה כפולה לשינוי שם">${escapeHtml(ap.name)}</button>
      <button class="apt-tab-edit" onclick="renameApartment('${ap.id}')" title="שנה שם">✎</button>
      <button class="apt-tab-del" onclick="deleteApartment('${ap.id}')" title="מחק דירה">×</button>
    `;
    bar.appendChild(tab);
  });
  const addBtn = document.createElement("button");
  addBtn.className = "apt-tab-add";
  addBtn.textContent = "+ דירה";
  addBtn.onclick = addApartment;
  bar.appendChild(addBtn);
}

async function switchApartment(id) {
  if (id === currentId) return;
  saveCurrentToMemory();
  await saveApartment(currentApartment());
  currentId = id;
  renderTabs();
  restoreData(currentApartment().data);
}

async function addApartment() {
  saveCurrentToMemory();
  await saveApartment(currentApartment());
  const ap = { id: genId(), name: "דירה " + (apartments.length + 1), data: blankData() };
  apartments.push(ap);
  currentId = ap.id;
  await saveApartment(ap);
  renderTabs();
  restoreData(ap.data);
  showSaveStatus("נוספה דירה ✓");
}

function renameApartment(id) {
  const ap = apartments.find((a) => a.id === id);
  if (!ap) return;
  const name = prompt("שם הדירה:", ap.name);
  if (name && name.trim()) {
    ap.name = name.trim();
    saveApartment(ap);
    renderTabs();
  }
}

async function deleteApartment(id) {
  if (apartments.length <= 1) {
    alert("חייבת להישאר לפחות דירה אחת.");
    return;
  }
  const ap = apartments.find((a) => a.id === id);
  if (!ap) return;
  if (!confirm('למחוק את "' + ap.name + '"? פעולה זו אינה ניתנת לביטול.')) return;
  await deleteApartmentRow(id);
  apartments = apartments.filter((a) => a.id !== id);
  mirrorToLocalStorage();
  if (currentId === id) {
    currentId = apartments[0].id;
    restoreData(currentApartment().data);
  }
  renderTabs();
  showSaveStatus("נמחקה דירה ✓");
}

// ── Compare view ──
function openCompare() {
  saveCurrentToMemory();
  const overlay = document.getElementById("compare-overlay");
  const body = document.getElementById("compare-body");
  if (!overlay || !body) return;

  if (apartments.length < 2) {
    body.innerHTML = '<p class="compare-empty">יש להוסיף לפחות שתי דירות כדי להשוות.</p>';
    overlay.style.display = "flex";
    return;
  }

  const metrics = apartments.map((a) => ({ name: a.name, m: computeMetrics(a.data) }));
  const fmt = (n) => Math.round(n).toLocaleString() + " ₪";

  const rows = [
    { label: "מחיר דירה", key: "apartmentPrice", better: "low" },
    { label: "מס רכישה", key: "purchaseTax", better: "low" },
    { label: "תיווך", key: "brokerFee", better: "low" },
    { label: "סה״כ עלות הפרויקט", key: "totalCost", better: "low" },
    { label: "הון עצמי", key: "equitySum", better: "high" },
    { label: "משכנתא", key: "mortgageSum", better: null },
    { label: "מקס׳ משכנתא (75%)", key: "maxMortgage", better: null },
    { label: "סה״כ מזומן נדרש", key: "totalCashNeeded", better: "low" },
    { label: "יתרת מזומן בסיום", key: "balance", better: "high" },
    { label: "החזר משכנתא חודשי", key: "monthlyMortgage", better: "low" },
    { label: "החזרי הלוואות חודשי", key: "totalLoanMonthly", better: "low" },
    { label: "סה״כ החזר חודשי", key: "totalMonthly", better: "low" },
    { label: "LTV", key: "currentLTV", better: null, pct: true },
  ];

  const showDiff = metrics.length === 2;

  let html = '<div class="compare-scroll"><table class="compare-table"><thead><tr><th>מדד</th>';
  metrics.forEach((x) => (html += `<th>${escapeHtml(x.name)}</th>`));
  if (showDiff) html += '<th class="diff-col">הפרש</th>';
  html += "</tr></thead><tbody>";

  rows.forEach((r) => {
    const vals = metrics.map((x) => x.m[r.key]);
    let bestIdx = -1;
    if (r.better === "low") bestIdx = vals.indexOf(Math.min(...vals));
    else if (r.better === "high") bestIdx = vals.indexOf(Math.max(...vals));

    html += `<tr><td class="metric-label">${r.label}</td>`;
    vals.forEach((v, i) => {
      const isBest = i === bestIdx && r.better;
      const disp = r.pct ? v.toFixed(1) + "%" : fmt(v);
      html += `<td class="${isBest ? "best" : ""}">${disp}</td>`;
    });
    if (showDiff) {
      const d = vals[1] - vals[0];
      let disp;
      if (r.pct) disp = (d >= 0 ? "+" : "") + d.toFixed(1) + "%";
      else disp = (d > 0 ? "+" : d < 0 ? "−" : "") + fmt(Math.abs(d));
      const dcls = d === 0 ? "" : d > 0 ? "diff-up" : "diff-down";
      html += `<td class="diff-col ${dcls}">${disp}</td>`;
    }
    html += "</tr>";
  });

  html += "</tbody></table></div>";
  if (showDiff) {
    html +=
      '<p class="compare-note">עמודת ההפרש = ' +
      escapeHtml(metrics[1].name) +
      " פחות " +
      escapeHtml(metrics[0].name) +
      ". ירוק = הדירה הזולה/עדיפה במדד.</p>";
  } else {
    html += '<p class="compare-note">ירוק = הערך העדיף בכל שורה.</p>';
  }

  body.innerHTML = html;
  overlay.style.display = "flex";
}

function closeCompare() {
  const overlay = document.getElementById("compare-overlay");
  if (overlay) overlay.style.display = "none";
}

// ── Manual save / load buttons ──
async function saveToFile() {
  saveCurrentToMemory();
  const ap = currentApartment();
  if (!ap) return;
  const ok = await saveApartment(ap);
  showSaveStatus(ok ? "נשמר ✓" : "שגיאה בשמירה ✗");
}

async function loadFromFile() {
  const ok = await loadApartments();
  if (!ok || apartments.length === 0) {
    showSaveStatus("שגיאה בטעינה ✗");
    return;
  }
  if (!apartments.find((a) => a.id === currentId)) currentId = apartments[0].id;
  renderTabs();
  if (currentApartment()) restoreData(currentApartment().data);
  showSaveStatus("נטען ✓");
}

function showSaveStatus(msg) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => {
    el.textContent = "";
  }, 3000);
}

// ── Init ──
async function initApp() {
  const ok = await loadApartments();
  if (!ok || apartments.length === 0) {
    // fall back to localStorage cache
    if (!loadFromLocalStorage()) {
      const ap = { id: "default", name: "דירה 1", data: blankData() };
      apartments = [ap];
      await saveApartment(ap);
    }
  }
  if (apartments.length === 0) {
    const ap = { id: "default", name: "דירה 1", data: blankData() };
    apartments = [ap];
    await saveApartment(ap);
  }
  currentId = apartments[0].id;
  renderTabs();
  restoreData(currentApartment().data);
}

document.addEventListener("DOMContentLoaded", async () => {
  const hasSession = await checkSession();
  if (hasSession) {
    showApp();
    await initApp();
  } else {
    showLogin();
  }
});
