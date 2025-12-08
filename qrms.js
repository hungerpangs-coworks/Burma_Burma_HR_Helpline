// =======================
// CONFIG
// =======================
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyKyn2FIoz6sCzr5tscplB2ZNVZK8dpog_mw4yjnTsk9FTV1FpfJ1-oX0eyOaBRDh02Rw/exec"; 
// Example: https://script.google.com/macros/s/AKfycbxxxxx/exec

let currentStep = 1;
let locations = [];

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
// SET ACTIVE STEP
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
  locSelect.innerHTML = '<option value="">Loading...</option>';

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=meta");
    const json = await res.json();

    if (!json.ok) throw new Error(json.error);

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
// SUBMIT HANDLER (QUERY OR CALLBACK)
// =======================
function submitForm(mode) {
  const queryDetails = $("queryDetails").value.trim();
  const fileInput = $("fileInput");
  const file = fileInput.files?.[0] || null;

  if (!queryDetails && mode === "query") {
    showAlert("Please enter your query details.");
    return;
  }

  hideAlert();

  const payload = {
    empId: $("empId").value.trim(),
    employeeName: $("employeeName").value.trim(),
    jobLocation: $("jobLocation").value.trim(),
    queryType: $("queryType").value.trim(),
    queryDetails: queryDetails,
    submissionType: mode === "callback" ? "Request Callback" : "Submit Query",
    filename: file ? file.name : "",
    mimeType: file ? file.type : "",
    bytes: ""
  };

  // Read file if present
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      payload.bytes = base64;
      sendToServer(payload);
    };
    reader.readAsDataURL(file);
  } else {
    sendToServer(payload);
  }
}

// =======================
// SEND DATA USING HIDDEN FORM (BYPASSES CORS)
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

  // Artificial short delay for UX
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
    $("queryTypeTag").textContent = "Query Type: " + $("queryType").value.trim();
    setStep(2);
  });

  $("btnBack2").addEventListener("click", () => setStep(1));

  $("btnSubmitQuery").addEventListener("click", () => submitForm("query"));

  $("btnCallback").addEventListener("click", () => submitForm("callback"));
});
