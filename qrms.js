// === CONFIG: your Apps Script Web App URL ===
const APPS_SCRIPT_URL =
  "https://script.google.com/a/macros/burmaburma.in/s/AKfycbyKyn2FIoz6sCzr5tscplB2ZNVZK8dpog_mw4yjnTsk9FTV1FpfJ1-oX0eyOaBRDh02Rw/exec";

const $ = (id) => document.getElementById(id);

let selectedDatesArr = [];
let callbackModal;

// ---- ALERT HELPERS ----
function showAlert(msg, type = "danger") {
  const container = $("alert-container");
  const alert = $("alert");
  alert.className = "alert alert-" + type + " mb-0";
  alert.textContent = msg;
  container.style.display = "block";
}

function hideAlert() {
  $("alert-container").style.display = "none";
}

// ---- DATE HELPERS ----
function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDisplayDate(d) {
  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = monthNames[d.getMonth()];
  const y = d.getFullYear();
  return `${day} ${mon} ${y}`;
}

function initDateRange() {
  const dp = $("datePicker");
  const today = new Date();

  // max = yesterday
  const max = new Date(today);
  max.setDate(today.getDate() - 1);

  // min = first day of previous month
  const min = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  dp.min = toInputDate(min);
  dp.max = toInputDate(max);
  dp.value = "";

  $("dateRangeHint").textContent =
    `You can select dates from ${toDisplayDate(min)} to ${toDisplayDate(max)}.`;
}

// ---- JOB LOCATION META LOAD ----
async function loadJobLocations() {
  const select = $("jobLocation");
  select.innerHTML = '<option value="">Loading locations...</option>';

  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=meta");
    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Failed to load locations");
    }

    const locations = json.jobLocations || [];
    select.innerHTML = '<option value="">Select Job Location</option>';
    locations.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="">Error loading locations</option>';
    showAlert("Unable to load Job Locations. Please refresh the page.");
  }
}

// ---- SUB QUERY ENABLE/DISABLE ----
function handleQueryTypeChange() {
  const qType = $("queryType").value;
  const sub = $("subQueryType");
  if (qType === "Salary") {
    sub.disabled = false;
  } else {
    sub.disabled = true;
    sub.value = "";
  }
}

// ---- DATES: ADD/REMOVE ----
function renderDateChips() {
  const container = $("selectedDatesContainer");
  container.innerHTML = "";
  selectedDatesArr.forEach((dateStr) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = dateStr;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "×";
    btn.onclick = () => {
      selectedDatesArr = selectedDatesArr.filter((d) => d !== dateStr);
      $("selectedDates").value = selectedDatesArr.join(", ");
      renderDateChips();
    };

    chip.appendChild(btn);
    container.appendChild(chip);
  });
}

function addSelectedDate() {
  hideAlert();
  const dp = $("datePicker");
  if (!dp.value) {
    showAlert("Please select a date first.");
    return;
  }

  const d = new Date(dp.value + "T00:00:00");
  const display = toDisplayDate(d);

  if (!selectedDatesArr.includes(display)) {
    selectedDatesArr.push(display);
    $("selectedDates").value = selectedDatesArr.join(", ");
    renderDateChips();
  }
}

// ---- VALIDATION ----
function validateForm(requestType, phoneNumber) {
  const empId = $("empId").value.trim();
  const empName = $("employeeName").value.trim();
  const jobLoc = $("jobLocation").value;
  const qType = $("queryType").value;
  const subQ = $("subQueryType").value;

  if (!empId || !empName || !jobLoc || !qType) {
    return "Please fill all mandatory fields (Employee ID, Employee Name, Job Location, Query Type).";
  }

  if (qType === "Salary" && !subQ) {
    return "Please select a Sub Query Type for Salary.";
  }

  if (selectedDatesArr.length === 0) {
    return "Please add at least one relevant date.";
  }

  if (requestType === "Callback") {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phoneNumber || "")) {
      return "Please enter a valid 10-digit phone number.";
    }
  }

  return null;
}

// ---- SUBMISSION ----
async function submitToBackend(requestType, phoneNumber) {
  const errorMsg = validateForm(requestType, phoneNumber);
  if (errorMsg) {
    showAlert(errorMsg);
    return;
  }

  hideAlert();

  const payload = {
    empId: $("empId").value.trim(),
    employeeName: $("employeeName").value.trim(),
    jobLocation: $("jobLocation").value,
    queryType: $("queryType").value,
    subQueryType: $("subQueryType").disabled ? "" : $("subQueryType").value,
    selectedDates: selectedDatesArr.join(", "),
    requestType: requestType,
    callbackPhone: requestType === "Callback" ? phoneNumber : ""
  };

  const disableButtons = (state) => {
    $("btnSubmitQuery").disabled = state;
    $("btnCallback").disabled = state;
    const cbBtn = $("confirmCallbackBtn");
    if (cbBtn) cbBtn.disabled = state;
  };

  disableButtons(true);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload) // no custom headers → avoids CORS preflight
    });

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || "Submission failed");
    }

    const ref = json.refId || "HR-XXXX";
    $("refCode").textContent = ref;

    // show thank-you, hide form
    $("formSection").style.display = "none";
    $("thankYouSection").style.display = "block";

    if (callbackModal && requestType === "Callback") {
      callbackModal.hide();
    }
  } catch (err) {
    console.error(err);
    showAlert(err.message || "Error submitting request. Please try again.");
  } finally {
    disableButtons(false);
  }
}

// ---- DOM READY ----
document.addEventListener("DOMContentLoaded", () => {
  callbackModal = new bootstrap.Modal(document.getElementById("callbackModal"));

  initDateRange();
  loadJobLocations();

  $("queryType").addEventListener("change", handleQueryTypeChange);
  $("btnAddDate").addEventListener("click", addSelectedDate);

  $("btnSubmitQuery").addEventListener("click", () => {
    submitToBackend("Query", "");
  });

  $("btnCallback").addEventListener("click", () => {
    $("callbackPhone").value = "";
    $("callbackPhoneError").style.display = "none";
    callbackModal.show();
  });

  $("confirmCallbackBtn").addEventListener("click", () => {
    const phone = $("callbackPhone").value.trim();
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      const errDiv = $("callbackPhoneError");
      errDiv.textContent = "Please enter a valid 10-digit phone number.";
      errDiv.style.display = "block";
      return;
    }
    $("callbackPhoneError").style.display = "none";
    submitToBackend("Callback", phone);
  });

  $("btnNewRequest").addEventListener("click", () => {
    // quick reset for a new request
    $("formSection").style.display = "block";
    $("thankYouSection").style.display = "none";
    $("empId").value = "";
    $("employeeName").value = "";
    $("jobLocation").value = "";
    $("queryType").value = "";
    handleQueryTypeChange();
    selectedDatesArr = [];
    $("selectedDates").value = "";
    renderDateChips();
    $("datePicker").value = "";
    hideAlert();
  });
});
