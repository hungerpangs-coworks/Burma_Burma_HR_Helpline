// ====== CONFIG: Apps Script Web App URL ======
const APPS_SCRIPT_URL =
  "https://script.google.com/a/macros/burmaburma.in/s/AKfycbyKyn2FIoz6sCzr5tscplB2ZNVZK8dpog_mw4yjnTsk9FTV1FpfJ1-oX0eyOaBRDh02Rw/exec";

// Stored selected dates (ISO strings)
let selectedDates = [];

// Small helpers
const $ = (id) => document.getElementById(id);

function showAlert(msg, type = "danger") {
  const container = $("alertContainer");
  const text = $("alertText");
  if (!container || !text) return;
  container.className = `alert alert-${type}`;
  text.textContent = msg;
  container.classList.remove("d-none");
}

function hideAlert() {
  const container = $("alertContainer");
  if (!container) return;
  container.classList.add("d-none");
}

// ========== JOB LOCATIONS ==========

async function loadJobLocations() {
  const select = $("jobLocation");
  if (!select) return;

  select.innerHTML = `<option value="">Loading job locations...</option>`;

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=meta`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Failed to load metadata");

    const locations = json.jobLocations || [];
    if (!locations.length) {
      throw new Error("No job locations found in sheet");
    }

    select.innerHTML = `<option value="">Select Job Location</option>`;
    locations.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    select.innerHTML = `<option value="">Error loading locations</option>`;
    showAlert("Unable to load Job Locations. Please refresh the page.", "danger");
  }
}

// ========== QUERY TYPE & SUB QUERY TYPE ==========

function setupQueryTypeLogic() {
  const queryTypeSelect = $("queryType");
  const subQuerySelect = $("subQueryType");

  if (!queryTypeSelect || !subQuerySelect) return;

  function updateSubQueryState() {
    const qt = queryTypeSelect.value;
    if (qt === "Salary") {
      subQuerySelect.disabled = false;
    } else {
      subQuerySelect.disabled = true;
      subQuerySelect.value = "";
    }
  }

  queryTypeSelect.addEventListener("change", updateSubQueryState);
  updateSubQueryState(); // initial
}

// ========== DATE LOGIC ==========

function formatForInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatForDisplay(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mmm = monthNames[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} ${mmm} ${yyyy}`;
}

/**
 * Limit date selection:
 *  If today = 9 Dec, allowed range = 1 Nov to 8 Dec (yesterday).
 */
function setupDateLimits() {
  const input = $("dateInput");
  if (!input) return;

  const today = new Date();
  const max = new Date(today);
  max.setDate(max.getDate() - 1); // yesterday

  const firstPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  input.min = formatForInput(firstPrevMonth);
  input.max = formatForInput(max);
}

function renderSelectedDates() {
  const container = $("selectedDates");
  if (!container) return;

  container.innerHTML = "";
  if (!selectedDates.length) {
    container.textContent = "No dates selected yet.";
    return;
  }

  selectedDates
    .map((iso) => new Date(iso))
    .sort((a, b) => a - b)
    .forEach((d) => {
      const span = document.createElement("span");
      span.className = "badge rounded-pill bg-primary me-1 mb-1";
      span.textContent = formatForDisplay(d);
      container.appendChild(span);
    });
}

function setupDateSelection() {
  const input = $("dateInput");
  const btnAdd = $("btnAddDate");
  if (!input || !btnAdd) return;

  setupDateLimits();
  renderSelectedDates();

  btnAdd.addEventListener("click", () => {
    const value = input.value;
    if (!value) {
      showAlert("Please choose a date before adding.", "danger");
      return;
    }

    // avoid duplicates
    if (!selectedDates.includes(value)) {
      selectedDates.push(value);
      renderSelectedDates();
    }

    input.value = "";
  });
}

// ========== VALIDATION ==========

function validateCommonFields() {
  const empId        = $("empId")?.value.trim() || "";
  const employeeName = $("employeeName")?.value.trim() || "";
  const jobLocation  = $("jobLocation")?.value.trim() || "";
  const queryType    = $("queryType")?.value.trim() || "";
  const subQueryType = $("subQueryType")?.value.trim() || "";

  if (!empId || !employeeName || !jobLocation || !queryType) {
    showAlert("Please fill in Employee ID, Name, Job Location and Query Type.", "danger");
    return null;
  }

  if (queryType === "Salary" && !subQueryType) {
    showAlert("Please select a Sub Query Type for Salary queries.", "danger");
    return null;
  }

  if (!selectedDates.length) {
    showAlert("Please add at least one relevant date.", "danger");
    return null;
  }

  hideAlert();

  return {
    empId,
    employeeName,
    jobLocation,
    queryType,
    subQueryType: queryType === "Salary" ? subQueryType : ""
  };
}

// ========== SUBMISSION ==========

async function submitForm(submissionType, callbackPhone) {
  const common = validateCommonFields();
  if (!common) return;

  if (submissionType === "Request Callback") {
    const phone = (callbackPhone || "").trim();
    if (!/^\d{10}$/.test(phone)) {
      showAlert("Please enter a valid 10-digit phone number for callback.", "danger");
      return;
    }
  }

  const employeeEmail = $("employeeEmail")?.value.trim() || "";

  // Build dates text in dd mmm yyyy
  const dateText = selectedDates
    .map((iso) => formatForDisplay(new Date(iso)))
    .sort()
    .join(", ");

  const payload = {
    empId: common.empId,
    employeeName: common.employeeName,
    employeeEmail: employeeEmail,
    jobLocation: common.jobLocation,
    queryType: common.queryType,
    subQueryType: common.subQueryType,
    relevantDates: dateText,
    submissionType: submissionType,
    callbackPhone: submissionType === "Request Callback" ? (callbackPhone || "").trim() : ""
  };

  const btnSubmit = $("btnSubmitQuery");
  const btnReqCb  = $("btnRequestCallback");
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnReqCb)  btnReqCb.disabled  = true;

  try {
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => body.append(k, v));

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || "Submission failed");
    }

    const ref = data.refId || "HR-UNKNOWN";
    showThankYou(ref);
  } catch (err) {
    console.error(err);
    showAlert(err.message || "Error submitting your request. Please try again.", "danger");
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnReqCb)  btnReqCb.disabled  = false;
  }
}

// ========== THANK-YOU VIEW ==========

function showThankYou(refId) {
  hideAlert();

  const formSection    = $("formSection");
  const thankSection   = $("thankYouSection");
  const thankRefSpan   = $("thankRef");

  if (thankRefSpan) {
    thankRefSpan.textContent = refId;
  }

  if (formSection)    formSection.classList.add("d-none");
  if (thankSection)   thankSection.classList.remove("d-none");
}

// ========== CALLBACK PANEL ==========

function setupCallbackPanel() {
  const panel          = $("callbackPanel");
  const btnRequest     = $("btnRequestCallback");
  const btnSubmitQuery = $("btnSubmitQuery");
  const btnConfirm     = $("btnConfirmCallback");
  const btnCancel      = $("btnCancelCallback");
  const phoneInput     = $("callbackPhone");

  if (!btnRequest || !btnSubmitQuery || !panel) return;

  // Show panel when clicking "Request a Callback"
  btnRequest.addEventListener("click", () => {
    hideAlert();
    panel.classList.remove("d-none");
    phoneInput && phoneInput.focus();
  });

  // Hide panel on cancel
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      panel.classList.add("d-none");
      if (phoneInput) phoneInput.value = "";
    });
  }

  // Confirm callback submission
  if (btnConfirm) {
    btnConfirm.addEventListener("click", () => {
      const phone = phoneInput ? phoneInput.value : "";
      submitForm("Request Callback", phone);
    });
  }

  // Direct submit (no callback)
  btnSubmitQuery.addEventListener("click", () => {
    panel.classList.add("d-none");
    submitForm("Submit Query", "");
  });
}

// ========== INIT ==========

document.addEventListener("DOMContentLoaded", () => {
  loadJobLocations();
  setupQueryTypeLogic();
  setupDateSelection();
  setupCallbackPanel();
});
