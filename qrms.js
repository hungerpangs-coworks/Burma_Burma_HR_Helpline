// === CONFIG – your Apps Script Web App URL ===
const APPS_SCRIPT_URL =
  "https://script.google.com/a/macros/burmaburma.in/s/AKfycbyKyn2FIoz6sCzr5tscplB2ZNVZK8dpog_mw4yjnTsk9FTV1FpfJ1-oX0eyOaBRDh02Rw/exec";

let currentStep = 1;
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

function setStep(step) {
  currentStep = step;
  for (let i = 1; i <= 3; i++) {
    const pane = $("step-" + i);
    pane.classList.toggle("d-none", i !== step);
  }

  document.querySelectorAll(".stepper-item").forEach((el) => {
    const s = parseInt(el.getAttribute("data-step"), 10);
    el.classList.remove("active", "completed");
    if (s === step) el.classList.add("active");
    if (s < step) el.classList.add("completed");
  });

  document.querySelectorAll(".step-line").forEach((line, idx) => {
    const s = idx + 1;
    line.classList.toggle("completed", s < step);
  });

  hideAlert();
}

// --- Load job locations from Apps Script meta ---
async function loadJobLocations() {
  const jobSel = $("jobLocation");

  jobSel.innerHTML = '<option value="">Loading locations...</option>';

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=meta");
    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Failed to load metadata");
    }

    const locations = json.jobLocations || json.departments || [];
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

// --- Query type / sub-query type behaviour ---
function onQueryTypeChange() {
  const queryType = $("queryType").value;
  const subSel = $("subQueryType");

  if (queryType === "Salary") {
    subSel.disabled = false;
    if (!subSel.value) {
      subSel.value = "";
    }
  } else {
    // For Service Charge or empty → disable & clear
    subSel.disabled = true;
    subSel.value = "";
    subSel.innerHTML = `
      <option value="">
        ${queryType ? "Not applicable for this query type" : "Select Query Type first"}
      </option>
      <option value="Leave related">Leave related</option>
      <option value="Weekly off related">Weekly off related</option>
      <option value="Attendance related">Attendance related</option>
      <option value="Swipe related">Swipe related</option>
    `;
    // keep the options so that when Salary is chosen we just enable
  }
}

function validateStep1() {
  const empId = $("empId").value.trim();
  const employeeName = $("employeeName").value.trim();
  const jobLocation = $("jobLocation").value.trim();
  const queryType = $("queryType").value.trim();
  const subQueryType = $("subQueryType").value.trim();

  if (!empId || !employeeName || !jobLocation || !queryType) {
    showAlert("Please fill in all mandatory fields before proceeding.");
    return false;
  }

  if (queryType === "Salary" && !subQueryType) {
    showAlert("Please select a Sub Query Type for Salary queries.");
    return false;
  }

  hideAlert();
  return true;
}

// --- Dates handling ---
function renderSelectedDates() {
  const container = $("selectedDatesContainer");
  container.innerHTML = "";

  selectedDatesArr.forEach((d) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = d;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "×";
    btn.onclick = () => {
      selectedDatesArr = selectedDatesArr.filter((x) => x !== d);
      renderSelectedDates();
    };

    chip.appendChild(btn);
    container.appendChild(chip);
  });

  $("selectedDates").value = selectedDatesArr.join(", ");
}

function addDate() {
  const value = $("datePicker").value;
  if (!value) {
    showAlert("Please select a date before adding.", "danger");
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

// --- Submission helper via hidden form/iframe (no CORS issues) ---
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

// main submit (mode = "callback" | "query")
function submitForm(mode, callbackPhone) {
  if (!validateDates()) return;

  const empId = $("empId").value.trim();
  const employeeName = $("employeeName").value.trim();
  const jobLocation = $("jobLocation").value.trim();
  const queryType = $("queryType").value.trim();
  const subQueryType =
    queryType === "Salary" ? $("subQueryType").value.trim() : "";

  const ref = "QRMS-" + Date.now().toString().slice(-8);

  const payload = {
    empId,
    employeeName,
    jobLocation,
    queryType,
    subQueryType,
    relevantDates: selectedDatesArr.join(", "),
    submissionType: mode === "callback" ? "Request Callback" : "Submit Query",
    callbackPhone: mode === "callback" ? callbackPhone : "",
    // backend can still try to auto-capture email (Session.getActiveUser)
  };

  submitToAppsScript(payload);

  $("refCode").textContent = ref;
  setStep(3);
}

// --- Callback modal logic ---
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

// --- Event wiring ---
document.addEventListener("DOMContentLoaded", () => {
  loadJobLocations();

  $("queryType").addEventListener("change", onQueryTypeChange);

  $("btnNext1").addEventListener("click", () => {
    if (!validateStep1()) return;

    const q = $("queryType").value.trim() || "–";
    const sq = $("subQueryType").value.trim();
    $("queryTypeTag").textContent =
      "Query Type: " + q + (sq ? " • " + sq : "");

    setStep(2);
  });

  $("btnBack2").addEventListener("click", () => {
    setStep(1);
  });

  $("btnAddDate").addEventListener("click", addDate);

  $("btnCallback").addEventListener("click", () => {
    if (!validateDates()) return;
    openCallbackModal();
  });

  $("confirmCallbackBtn").addEventListener("click", confirmCallback);

  $("btnSubmitQuery").addEventListener("click", () => {
    if (!validateDates()) return;
    submitForm("query", "");
  });
});
