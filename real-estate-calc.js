// ── Config ──
const STORAGE_KEY = "real_estate_calc_data";

// ── Supabase ──
const SUPABASE_URL = "https://oieqfraejbnaliflhate.supabase.co";
const SUPABASE_KEY = "sb_publishable_doZWKR_IStO3u488bkVQ3g_VxsEswV3";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const DOC_ID = "default"; // single-document storage

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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "התחבר";

  if (error) {
    errorEl.textContent = "אימייל או סיסמה שגויים";
    return;
  }

  showApp();
  await initApp();
}

async function handleLogout() {
  await supabase.auth.signOut();
  showLogin();
}

async function checkSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
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
  d.textContent = str;
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
  if (amount === 0 || annualRate === 0 || months === 0) return 0;
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
  loans.forEach((loan) => {
    addLoanRowWithData(loan.description, loan.amount, loan.rate, loan.months);
  });
}

// ── Calculations ──
function calculateSum(containerId) {
  const inputs = document.querySelectorAll(`#${containerId} .amount`);
  let sum = 0;
  inputs.forEach((input) => (sum += parseFloat(input.value) || 0));
  return sum;
}

function calculateMortgage() {
  const P = parseFloat(document.getElementById("m_amount").value) || 0;
  const annualRate = parseFloat(document.getElementById("m_rate").value) || 0;
  const years = parseFloat(document.getElementById("m_years").value) || 0;

  if (P === 0 || annualRate === 0 || years === 0) return 0;

  const r = annualRate / 100 / 12;
  const n = years * 12;

  // נוסחת שפיצר
  const monthly = (P * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  return monthly;
}

function updateAll() {
  const purchaseSum = calculateSum("purchase-list");
  const renoSum = calculateSum("renovation-list");
  const equitySum = calculateSum("equity-list");
  const mortgageSum =
    parseFloat(document.getElementById("m_amount").value) || 0;

  // מחיר הדירה = השורה הראשונה ברשימת הרכישה
  const apartmentPrice =
    parseFloat(
      document.querySelector("#purchase-list .row-item .amount")?.value,
    ) || 0;

  const brokerFee = apartmentPrice * 0.02 * 1.18;
  // ── Purchase tax estimate (דירה יחידה, מדרגות 2024-2028) ──
  const purchaseTax = calcPurchaseTax(apartmentPrice);

  const totalCost = purchaseSum + renoSum + brokerFee + purchaseTax;
  const totalSources = equitySum + mortgageSum;

  // ── Sum of all loan principal amounts ──
  let totalLoanAmounts = 0;
  document.querySelectorAll("#loans-list .loan-row").forEach((row) => {
    totalLoanAmounts +=
      parseFloat(row.querySelector(".loan-amount")?.value) || 0;
  });

  // ── Bank limits: LTV is on apartment price, NOT total cost ──
  const maxMortgage = apartmentPrice * 0.75;
  const minEquityForBank = apartmentPrice * 0.25;
  const extraCosts = totalCost - apartmentPrice;
  const totalCashNeeded = minEquityForBank + extraCosts - totalLoanAmounts;

  // יתרת מזומן = הון עצמי שיש לך - מזומן שאתה צריך להביא בפועל
  const balance = equitySum - totalCashNeeded;

  // LTV check
  const currentLTV =
    apartmentPrice > 0 ? (mortgageSum / apartmentPrice) * 100 : 0;
  const ltvOk = currentLTV <= 75;

  const fmt = (n) => Math.round(n).toLocaleString() + " ₪";
  const fmtShort = (n) => Math.round(n).toLocaleString();

  // ── Section totals in card headers ──
  setText("purchase-total", fmt(purchaseSum));
  setText("renovation-total", fmt(renoSum));
  setText("equity-total", fmt(equitySum));

  // ── Summary panel: costs ──
  setText("sum_purchase", fmt(purchaseSum));
  setText("sum_renovation", fmt(renoSum));
  setText("broker_fee", fmt(brokerFee));
  setText("purchase_tax", fmt(purchaseTax));
  setText("total_cost", fmt(totalCost));

  // ── Key figures (bank perspective — based on apartment price) ──
  setText("apartment_price_display", fmt(apartmentPrice));
  setText("min_equity_needed", fmt(minEquityForBank));
  setText("min_equity_needed_2", fmt(minEquityForBank));
  setText("total_mortgage", fmt(maxMortgage));
  setText("extra_costs", fmt(extraCosts));
  setText("loan_deduction", fmt(totalLoanAmounts));
  setText("total_cash_needed", fmt(totalCashNeeded));

  // LTV display
  setText("ltv_display", currentLTV.toFixed(1) + "%");
  const ltvEl = document.getElementById("ltv_display");
  if (ltvEl) {
    ltvEl.className = "num " + (ltvOk ? "" : "num-warn");
  }
  // LTV warning
  const ltvWarn = document.getElementById("ltv-warning");
  if (ltvWarn) {
    ltvWarn.style.display = ltvOk ? "none" : "flex";
  }

  // ── Summary panel: funding ──
  setText("sum_equity", fmt(equitySum));
  setText("sum_mortgage", fmt(mortgageSum));
  setText("sum_sources", fmt(totalSources));

  // ── Equity gauge (against totalCashNeeded, not just 25%) ──
  const equityPct =
    totalCashNeeded > 0
      ? Math.min((equitySum / totalCashNeeded) * 100, 100)
      : 0;
  setText("equity-pct", Math.round(equityPct) + "%");
  const fillEl = document.getElementById("equity-fill");
  if (fillEl) fillEl.style.width = equityPct + "%";
  setText("equity-have", fmt(equitySum));
  setText("equity-need", "מתוך " + fmt(totalCashNeeded));

  // Gauge color based on coverage
  if (fillEl) {
    fillEl.style.background =
      equityPct >= 100
        ? "linear-gradient(90deg, var(--green), var(--teal))"
        : equityPct >= 60
          ? "linear-gradient(90deg, var(--teal), var(--teal-surface))"
          : "linear-gradient(90deg, var(--red), var(--accent))";
  }

  // ── Balance ──
  setText("final_balance", fmt(balance));
  const balanceBox = document.getElementById("balance-box");
  balanceBox.className =
    "balance-box " + (balance >= 0 ? "positive" : "negative");
  setText("balance-badge", balance >= 0 ? "+" : "−");

  // ── Mortgage results ──
  const monthly = calculateMortgage();
  const years = parseFloat(document.getElementById("m_years").value) || 0;
  const totalRepay = monthly * years * 12;
  const totalInterest = totalRepay - mortgageSum;

  setText("monthly_return", fmtShort(Math.round(monthly)));
  setText(
    "total_interest",
    fmtShort(Math.round(totalInterest > 0 ? totalInterest : 0)),
  );
  setText("total_repayment", fmtShort(Math.round(totalRepay)));

  // ── Loan results ──
  let totalLoanMonthly = 0;
  document.querySelectorAll("#loans-list .loan-row").forEach((row) => {
    const lAmount = parseFloat(row.querySelector(".loan-amount")?.value) || 0;
    const lRate = parseFloat(row.querySelector(".loan-rate")?.value) || 0;
    const lMonths = parseFloat(row.querySelector(".loan-months")?.value) || 0;
    const payment = calculateLoanPayment(lAmount, lRate, lMonths);
    const paymentEl = row.querySelector(".loan-payment");
    if (paymentEl) paymentEl.textContent = fmt(Math.round(payment));
    totalLoanMonthly += payment;
  });
  setText(
    "loans-monthly-total",
    fmtShort(Math.round(totalLoanMonthly)) + " ₪/חודש",
  );

  // ── Monthly obligations summary ──
  setText("mortgage_monthly_summary", fmt(Math.round(monthly)));
  setText("loans_monthly_summary", fmt(Math.round(totalLoanMonthly)));
  setText(
    "total_monthly_obligations",
    fmt(Math.round(monthly + totalLoanMonthly)),
  );
}

// ── Purchase tax calculation (דירה יחידה, מדרגות 16.1.2024–15.1.2028) ──
function calcPurchaseTax(price) {
  // Brackets for "דירה יחידה"
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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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
  };
}

function restoreSection(containerId, rows) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  rows.forEach((row, i) => {
    addRowWithData(containerId, row.description, row.amount, i > 0);
  });
}

function restoreData(data) {
  if (!data) return;

  if (data.purchase) restoreSection("purchase-list", data.purchase);
  if (data.renovation) restoreSection("renovation-list", data.renovation);
  if (data.equity) restoreSection("equity-list", data.equity);

  if (data.mortgage) {
    document.getElementById("m_amount").value = data.mortgage.amount;
    document.getElementById("m_rate").value = data.mortgage.rate;
    document.getElementById("m_years").value = data.mortgage.years;
  }

  if (data.loans) restoreLoanSection(data.loans);

  updateAll();
}

// ── Persistence: server + localStorage fallback ──

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      restoreData(JSON.parse(raw));
      return true;
    }
  } catch {}
  return false;
}

async function loadFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("calculator_data")
      .select("data")
      .eq("id", DOC_ID)
      .single();
    if (error) {
      console.error("loadFromSupabase error:", error);
      return false;
    }
    if (data && data.data) {
      restoreData(data.data);
      return true;
    }
  } catch (e) {
    console.error("loadFromSupabase failed:", e);
  }
  return false;
}

async function saveToFile() {
  const calcData = collectData();
  try {
    const { error } = await supabase
      .from("calculator_data")
      .upsert(
        { id: DOC_ID, data: calcData, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (!error) {
      showSaveStatus("נשמר ✓");
    } else {
      console.error("Save error:", error);
      showSaveStatus("שגיאה בשמירה ✗");
    }
  } catch {
    showSaveStatus("שגיאה בשמירה ✗");
  }
}

async function loadFromFile() {
  try {
    const loaded = await loadFromSupabase();
    if (loaded) {
      showSaveStatus("נטען ✓");
    } else {
      showSaveStatus("אין נתונים שמורים");
    }
  } catch {
    showSaveStatus("שגיאה בטעינה ✗");
  }
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
  const loaded = await loadFromSupabase();
  if (!loaded) {
    if (!loadFromLocalStorage()) {
      updateAll();
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if already logged in
  const hasSession = await checkSession();
  if (hasSession) {
    showApp();
    await initApp();
  } else {
    showLogin();
  }
});
