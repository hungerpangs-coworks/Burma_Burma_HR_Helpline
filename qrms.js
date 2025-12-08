// =======================
// CONFIG
// =======================
const APPS_SCRIPT_URL =
  "https://script.google.com/a/macros/burmaburma.in/s/AKfycbyKyn2FIoz6sCzr5tscplB2ZNVZK8dpog_mw4yjnTsk9FTV1FpfJ1-oX0eyOaBRDh02Rw/exec";

let currentStep = 1;
let locations = [];
let selectedDatesList = []; // store multiple dates

// Quick DOM helper
const $ = (id) => document.getElementById(id);

// =======================
// ALERT HANDLING
// =======================
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

// =======================
// STEP HANDLING
// =======================
function setStep(step) {
  currentStep = step;

  for (let i = 1; i <= 3; i++) {
    $("step-" + i).classList.toggle("d-none", i !== step);
  }

  document.querySelectorAll(".stepper-item").forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.remove("active", "completed");
    if (s === step) el.classList.add("active");
    if (s < step) el.classList.add("completed");
  });

  document.querySelectorAll(".step-line").forEach((line, idx) => {
    line.classList.toggle("completed", idx + 1 < step);
  });

  hideAlert();
}

// =======================
// LOAD JOB LOCATIONS
// =======================
async function loadMeta() {
  const locSelect = $("jobLocation");
  locSelect.innerHTML = '<option value="">Loading locations...</option>';

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=meta");
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || "Meta error");

    locations = json.locations || [];

    locSelect.innerHTML = '<option value="">Select Job Location</option>';

    locations.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      locSelect.appendChild(opt);
    });

  } catch (err) {
    console.error(err);
    locSelect.innerHTML = '<option value="">Error loading locations</option>';
    showAlert("Unable to load Job Locations. Please refresh the page.");
  }
}

// =======================
// STEP 1 VALIDATION
// =======================
function validateStep1() {
  const empId = $("empId").value.trim();
  const name = $("employeeName").value.trim();
  const location = $("jobLocation").value.trim();
  const queryType = $("queryType").value.trim();

  if (!empId || !name || !location || !queryType) {
    showAlert("Please fill all fields to continue.");
    return false;
  }

  hideAlert();
  return true;
}

// =======================
// MULTI-DATE UI HANDLING
// =======================
function renderSelectedDates() {
  const container = $("selectedDatesContainer");
  container.innerHTML = "";

  if (selectedDatesList.length === 0) {
    $("selectedDates").value = "";
    return;
  }

  selectedDatesList.forEach((dateStr) => {
    const pill = document.createElement("span");
    pill.className = "badge bg-light text-dark border me-2 mb-2";
    pill.style.cursor = "default";
    pill.innerHTML = `
      ${dateStr}
      <button type="button" class="btn-close btn-close-sm ms-1" aria-label="Remove" data-date="${dateStr}"></button>
    `;
    container.appendChild(pill);
  });

  // store comma-separated list for debugging/inspection
  $("selectedDates").value = selectedDatesList.join(", ");
}

function addDateFromPicker() {
  const picker = $("datePicker");
  const value = picker.value;

  if (!value) {
    showAlert("Please select a date before adding.", "warning");
    return;
  }

  if (!selectedDatesList.includes(value)) {
    selectedDatesList.push(value);
    selectedDatesList.sort(); // keep sorted
    renderSelectedDates();
  }

  picker.value = "";
  hideAlert();
}

function handleDatePillClick(e) {
  const btn = e.target;
  if (btn.matches("button[data-date]")) {
    const dateStr = btn.getAttribute("data-date");
    selectedDatesList = selectedDatesList.filter((d) => d !== dateStr);
    renderSelectedDates();
  }
}

// =======================
// SUBMIT HANDLER (QUERY OR CALLBACK)
// =======================
function submitForm(mode) {
  const queryDetails = $("queryDetails").value.trim();
  const fileInput = $("fileInput");
  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

  if (!queryDetails && mode === "query") {
    showAlert("Please enter your query details.", "danger");
    return;
  }

  hideAlert();

  const payloadBase = {
    empId: $("empId").value.trim(),
    employeeName: $("employeeName").value.trim(),
    jobLocation: $("jobLocation").value.trim(),
    queryType: $("queryType").value.trim(),
    queryDetails: queryDetails,
    submissionType: mode === "callback" ? "Request Callback" : "Submit Query",
    relevantDates: selectedDatesList.join(", "), // NEW: multiple dates as CSV
    filename: file ? file.name : "",
    mimeType: file ? file.type : "",
    bytes: ""
  };

  // If there's a file, read it as base64; otherwise send directly
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      payloadBase.bytes = base64;
      sendToServer(payloadBase);
    };
    reader.readAsDataURL(file);
  } else {
    sendToServer(payloadBase);
  }
}

// =======================
// SEND DATA USING HIDDEN FORM (NO CORS ISSUES)
// =======================
function sendToServer(payload) {
  const form = document.createElement("form");
  form.style.display = "none";
  form.method = "POST";
  form.action = APPS_SCRIPT_URL;
  form.target = "hidden_iframe";

  Object.entries(payload).forEach(([k, v]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = v;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();

  // short delay for UX, then show Thank You step
  setTimeout(() => {
    $("refCode").textContent = "QRMS-" + Date.now().toString().slice(-8);
    setStep(3);
    document.body.removeChild(form);
  }, 400);
}

// =======================
// INITIALIZE
// =======================
document.addEventListener("DOMContentLoaded", () => {
  loadMeta();

  $("btnNext1").addEventListener("click", () => {
    if (!validateStep1()) return;
    $("queryTypeTag").textContent = "Query Type: " + ($("queryType").value.trim() || "–");
    setStep(2);
  });

  $("btnBack2").addEventListener("click", () => setStep(1));

  // two submission modes
  $("btnSubmitQuery").addEventListener("click", () => submitForm("query"));
  $("btnCallback").addEventListener("click", () => submitForm("callback"));

  // date handling
  $("btnAddDate").addEventListener("click", addDateFromPicker);
  $("selectedDatesContainer").addEventListener("click", handleDatePillClick);
});
