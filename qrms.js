// === CONFIG – your Apps Script Web App URL ===
const APPS_SCRIPT_URL =
  "https://script.google.com/a/macros/burmaburma.in/s/AKfycbyKyn2FIoz6sCzr5tscplB2ZNVZK8dpog_mw4yjnTsk9FTV1FpfJ1-oX0eyOaBRDh02Rw/exec";

let selectedDatesArr = [];

const $ = (id) => document.getElementById(id);

function showAlert(message, type = "danger") {
  const container = $("alert-container");
  const alert = $("alert");
  alert.className = "alert alert-" + type + " mb-0";
  alert.textContent = message;
  container.style.display = "block";
}

function hideAlert() {
  $("alert-container").style.display = "none";
}

// =============== DATE RANGE HELPERS ===============

// Convert Date → "YYYY-MM-DD"
function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Format "YYYY-MM-DD" → "dd MMM yyyy"
function formatDateLabel(iso) {
  if (!iso) return "";
  const s = iso.substring(0, 10);
  const [y, m, d] = s.split("-");
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  return dateObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }); // e.g. 01 Nov 2025
}

// Set min/max on datePicker to: 1st of previous month → yesterday
function setDateConstraints() {
  const picker = $("datePicker");
  if (!picker) return;

  const today = new Date();

  // max = yesterday
  const max = new Date(today);
  max.setDate(max.getDate() - 1);

  // min = 1st of previous month
  const min = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  picker.min = toIsoDate(min);
  picker.max = toIsoDate(max);

  // (Optional) you could update a helper text here if you want to show the range
  // e.g. "You can select dates from 01 Nov 2025 to 08 Dec 2025"
}

// =============== LOAD JOB LOCATIONS ===============
async function loadJobLocations() {
  const jobSel = $("jobLocation");

  jobSel.innerHTML = '<option value="">Loading locations...</option>';

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=meta");
    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Failed to load metadata");
    }

    const locations = json.jobLocations || json.locations || [];
    jobSel.innerHTML = '<option value="">Select Job Location</option>';
    locations.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      jobSel.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    jobSel.innerHTML = '<option value="">Error loading locations</option>';
    showAlert(
      "Unable to load Job Locations. Please refresh the page.",
      "danger"
    );
  }
}

// =============== QUERY TYPE / SUB QUERY TYPE ===============
function onQueryTypeChange() {
  const queryType = $("queryType").value;
  const subSel = $("subQueryType");

  if (queryType === "Salary") {
    subSel.disabled = false;
    if (!subSel.value) subSel.value = "";
  } else {
    subSel.disabled = true;
    subSel.value = "";
  }
}

function validateMainFields() {
  const empId = $("empId").value.trim();
  const employeeName = $("employeeName").value.trim();
  const jobLocation = $("jobLocation").value.trim();
  const queryType = $("queryType").value.trim();
  const subQueryType = $("subQueryType").value.trim();

  if (!empId || !employeeName || !jobLocation || !queryType) {
    showAlert("Please fill in all mandatory fields.", "danger");
    return false;
  }

  if (queryType === "Salary" && !subQueryType) {
    showAlert("Please select a Sub Query Type for Salary queries.", "danger");
    return false;
  }

  hideAlert();
  return true;
}

// =============== DATES: ADD / RENDER / VALIDATE ===============
function renderSelectedDates() {
  const container = $("selectedDatesContainer");
  container.innerHTML = "";

  selectedDatesArr.forEach((iso) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = formatDateLabel(iso); // show dd MMM yyyy

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "×";
    btn.onclick = () => {
      selectedDatesArr = selectedDatesArr.filter((x) => x !== iso);
      renderSelectedDates();
    };

    chip.appendChild(btn);
    container.appendChild(chip);
  });

  // keep underlying value as ISO dates, CSV
  $("selectedDates").value = selectedDatesArr.join(", ");
}

function addDate() {
  const picker = $("datePicker");
  const value = picker.value;

  if (!value) {
    showAlert("Please select a date before adding.", "danger");
    return;
  }

  // Extra safety: enforce range in JS also
  if (picker.min && value < picker.min) {
    showAlert(
      `You can only select dates from ${formatDateLabel(
        picker.min
      )} to ${formatDateLabel(picker.max)}.`,
      "danger"
    );
    return;
  }
  if (picker.max && value > picker.max) {
    showAlert(
      `You can only select dates from ${formatDateLabel(
        picker.min
      )} to ${formatDateLabel(picker.max)}.`,
      "danger"
    );
    return;
  }

  if (!selectedDatesArr.includes(value)) {
    selectedDatesArr.push(value);
    selectedDatesArr.sort();
  }
  renderSelectedDates();
  hideAlert();
}

function validateDates() {
  if (!selectedDatesArr.length) {
    showAlert("Please add at least one relevant date.", "danger");
    return false;
  }
  return true;
}

// =============== REFERENCE ID GENERATOR ===============
function generateRefId() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900) + 100; // 100–999
  return `QRMS-${yy}${MM}${dd}${hh}${mm}${ss}${rand}`;
}

// =============== SUBMISSION TO APPS SCRIPT ===============
function submitToAppsScript(payload) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = APPS_SCRIPT_URL;
  form.target = "hidden_iframe";

  Object.entries(payload).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value == null ? "" : String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

// mode = "callback" | "query"
function submitForm(mode, callbackPhone) {
  if (!validateMainFields()) return;
  if (!validateDates()) return;

  const empId = $("empId").value.trim();
  const employeeName = $("employeeName").value.trim();
  const jobLocation = $("jobLocation").value.trim();
  const queryType = $("queryType").value.trim();
  const subQueryType =
    queryType === "Salary" ? $("subQueryType").value.trim() : "";

  const refId = generateRefId();

  const payload = {
    refId,
    empId,
    employeeName,
    jobLocation,
    queryType,
    subQueryType,
    relevantDates: selectedDatesArr.join(", "),
    submissionType: mode === "callback" ? "Request Callback" : "Submit Query",
    callbackPhone: mode === "callback" ? callbackPhone : "",
  };

  submitToAppsScript(payload);

  $("refCode").textContent = refId;
  const successBox = document.getElementById("successBox");
  if (successBox) successBox.style.display = "block";

  showAlert("Your request has been submitted successfully.", "success");
}

// =============== CALLBACK MODAL ===============
function openCallbackModal() {
  const modalEl = document.getElementById("callbackModal");
  const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  $("callbackPhone").value = "";
  $("callbackPhoneError").style.display = "none";
  bsModal.show();
}

function confirmCallback() {
  const phone = $("callbackPhone").value.trim();
  const errEl = $("callbackPhoneError");

  if (!/^\d{10}$/.test(phone)) {
    errEl.textContent = "Please enter a valid 10-digit phone number.";
    errEl.style.display = "block";
    return;
  }

  errEl.style.display = "none";

  const modalEl = document.getElementById("callbackModal");
  const bsModal = bootstrap.Modal.getInstance(modalEl);
  bsModal.hide();

  submitForm("callback", phone);
}

// =============== INIT ===============
document.addEventListener("DOMContentLoaded", () => {
  loadJobLocations();
  setDateConstraints(); // 🔐 limit date range to last month window

  $("queryType").addEventListener("change", onQueryTypeChange);
  $("btnAddDate").addEventListener("click", addDate);

  $("btnCallback").addEventListener("click", () => {
    if (!validateMainFields() || !validateDates()) return;
    openCallbackModal();
  });

  $("confirmCallbackBtn").addEventListener("click", confirmCallback);

  $("btnSubmitQuery").addEventListener("click", () => {
    submitForm("query", "");
  });
});
