// === CONFIG: Your Apps Script Web App URL ===
const APPS_SCRIPT_URL =
  "https://script.google.com/a/macros/burmaburma.in/s/AKfycbyKyn2FIoz6sCzr5tscplB2ZNVZK8dpog_mw4yjnTsk9FTV1FpfJ1-oX0eyOaBRDh02Rw/exec";

let currentStep = 1;
let deptMap = {};
let departments = [];

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

  // panes
  for (let i = 1; i <= 3; i++) {
    const pane = $("step-" + i);
    pane.classList.toggle("d-none", i !== step);
  }

  // stepper UI
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

async function loadMeta() {
  const deptSelect = $("department");
  const desigSelect = $("designation");
  const deptHint = $("deptHint");

  deptSelect.innerHTML = '<option value="">Loading departments...</option>';
  desigSelect.innerHTML = '<option value="">Select Department first</option>';
  desigSelect.disabled = true;

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=meta");
    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Failed to load metadata");
    }

    departments = json.departments || [];
    deptMap = json.deptMap || {};

    deptSelect.innerHTML = '<option value="">Select Department</option>';
    departments.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      deptSelect.appendChild(opt);
    });

    if (deptHint) {
      deptHint.textContent = "";
    }
  } catch (err) {
    console.error(err);
    deptSelect.innerHTML = '<option value="">Error loading departments</option>';
    if (deptHint) {
      deptHint.textContent = "";
    }
    showAlert(
      "Error loading Departments from sheet. Please refresh and try again.",
      "danger"
    );
  }
}

function onDepartmentChange() {
  const dept = $("department").value;
  const desigSelect = $("designation");
  desigSelect.innerHTML = "";

  if (!dept || !deptMap[dept] || deptMap[dept].length === 0) {
    desigSelect.disabled = true;
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = dept ? "No designations found" : "Select Department first";
    desigSelect.appendChild(opt);
    return;
  }

  desigSelect.disabled = false;
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Select Designation";
  desigSelect.appendChild(emptyOpt);

  deptMap[dept].forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    desigSelect.appendChild(opt);
  });
}

function validateStep1() {
  const empId         = $("empId").value.trim();
  const employeeName  = $("employeeName").value.trim();
  const employeeEmail = $("employeeEmail").value.trim();
  const department    = $("department").value.trim();
  const designation   = $("designation").value.trim();
  const queryType     = $("queryType").value.trim();

  if (!empId || !employeeName || !employeeEmail || !department || !designation || !queryType) {
    showAlert("Please fill in all fields before proceeding.", "danger");
    return false;
  }

  // very simple email check
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(employeeEmail)) {
    showAlert("Please enter a valid email address.", "danger");
    return false;
  }

  hideAlert();
  return true;
}

// === SUBMIT STEP ===
async function submitForm() {
  const queryDetails = $("queryDetails").value.trim();
  if (!queryDetails) {
    showAlert("Please provide details about your query.", "danger");
    return;
  }

  hideAlert();
  const btnSubmit = $("btnSubmit");
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Submitting...";

  // File (optional)
  const fileInput = $("fileInput");
  const file =
    fileInput && fileInput.files && fileInput.files[0]
      ? fileInput.files[0]
      : null;

  let bytes = null;
  let filename = "";
  let mimeType = "";

  try {
    if (file) {
      const buffer = await file.arrayBuffer();
      bytes = Array.from(new Int8Array(buffer));
      filename = file.name;
      mimeType = file.type || "application/octet-stream";

      // simple size guard: 10 MB max
      const maxSizeBytes = 10 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error("File is larger than 10MB. Please upload a smaller file.");
      }
    }

    const payload = {
      empId: $("empId").value.trim(),
      employeeName: $("employeeName").value.trim(),
      department: $("department").value.trim(),
      designation: $("designation").value.trim(),
      queryType: $("queryType").value.trim(),
      queryDetails: queryDetails,
      employeeEmail:  $("employeeEmail").value.trim(),  // send from UI
      filename,
      mimeType,
      bytes
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      // IMPORTANT: no custom headers → browser uses text/plain, no CORS preflight
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || "Submission failed");
    }

    const ref =
      data.refId || "QRMS-" + Date.now().toString().slice(-8);
    $("refCode").textContent = ref;

    setStep(3);
  } catch (err) {
    console.error(err);
    showAlert(
      err.message || "Error submitting query. Please try again.",
      "danger"
    );
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Submit";
  }
}

// === INIT ===
function init() {
  loadMeta();

  $("department").addEventListener("change", onDepartmentChange);

  $("btnNext1").addEventListener("click", () => {
    if (!validateStep1()) return;
    const qt = $("queryType").value.trim() || "–";
    $("queryTypeTag").textContent = "Query Type: " + qt;
    setStep(2);
  });

  $("btnBack2").addEventListener("click", () => {
    setStep(1);
  });

  $("btnSubmit").addEventListener("click", submitForm);
}

document.addEventListener("DOMContentLoaded", init);
