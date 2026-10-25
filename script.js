(() => {
  "use strict";

  // When the page is served by FastAPI (port 8000) the page and API share an origin.
  // From anywhere else (Live Server on :5500, a file:// path) call the local FastAPI server.
  const API_BASE = window.location.port === "8000" ? "" : "https://stress-level-analyzer-system.onrender.com";
  const REQUEST_TIMEOUT_MS = 20000;

  // Mirrors the backend validation (main.py). The server remains the final authority.
  const FIELDS = {
    Age:                     { type: "int",    min: 10, max: 100,  label: "Age" },
    Gender:                  { type: "select", label: "Gender" },
    Country:                 { type: "select", label: "Country" },
    Academic_Level:          { type: "select", label: "Academic level" },
    Most_Used_Platform:      { type: "select", label: "Most used platform" },
    Purpose_Of_Use:          { type: "select", label: "Purpose of use" },
    Avg_Daily_Usage_Hours:   { type: "float",  min: 0, max: 24,   label: "Average daily usage" },
    Daily_Unlocks:           { type: "int",    min: 0, max: 2000, label: "Phone unlocks" },
    Study_Hours:             { type: "float",  min: 0, max: 24,   label: "Study hours" },
    Physical_Activity_Hours: { type: "float",  min: 0, max: 24,   label: "Physical activity hours" },
    Sleep_Hours_Per_Night:   { type: "float",  min: 0, max: 24,   label: "Sleep hours" },
    Stress_Level:            { type: "select", label: "Stress level" },
  };

  const form = document.getElementById("predictForm");
  const submitBtn = document.getElementById("submitBtn");
  const formAlert = document.getElementById("formAlert");
  const resultCard = document.getElementById("resultCard");
  const statusPill = document.getElementById("statusPill");
  const gaugeBar = document.getElementById("gaugeBar");
  const scoreValue = document.getElementById("scoreValue");
  const gaugeSub = document.getElementById("gaugeSub");
  const scaleMarker = document.getElementById("scaleMarker");
  const resultText = document.getElementById("resultText");
  const newBtn = document.getElementById("newBtn");
  const retryBtn = document.getElementById("retryBtn");
  document.getElementById("scaleMin").textContent = "3.6";
  document.getElementById("scaleMax").textContent = "9.4";

  // Lowest and highest values the saved RandomForest can output (min/max over all
  // tree leaves in Model.pkl). The gauge shows where a prediction falls inside this
  // range. It does not say whether a higher or lower score is better.
  const SCORE_MIN = 3.6;
  const SCORE_MAX = 9.4;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let animationFrame = null;
  let successTimer = null;

  let isSubmitting = false;

  /* ---------- Mobile navigation ---------- */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- Helpers ---------- */
  const STATES = {
    empty:   { pill: "Waiting for input", text: "Complete the form and press Predict score.", sub: "model score" },
    loading: { pill: "Running…",          text: "Running the model…",                        sub: "model score" },
    result:  { pill: "Prediction ready",  text: "",                                          sub: "model score" },
    error:   { pill: "Request failed",    text: "",                                          sub: "" },
  };

  function showState(name, textOverride) {
    const cfg = STATES[name];
    cancelAnimationFrame(animationFrame);
    clearTimeout(successTimer);
    resultCard.classList.remove("is-success");
    resultCard.dataset.state = name;
    statusPill.textContent = cfg.pill;
    gaugeSub.textContent = cfg.sub;
    resultText.textContent = textOverride !== undefined ? textOverride : cfg.text;
    newBtn.hidden = name !== "result";
    retryBtn.hidden = name !== "error";
    if (name !== "result") {
      gaugeBar.style.strokeDashoffset = "";
      scaleMarker.style.left = "0%";
      scoreValue.textContent = name === "empty" ? "–" : "";
    }
  }

  function showResult(score) {
    const clamped = Math.min(Math.max(score, SCORE_MIN), SCORE_MAX);
    const fraction = (clamped - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
    const pct = Math.round(fraction * 100);

    showState("result", `Model output: ${score.toFixed(2)}. This sits about ${pct}% of the way across the range the model can output (${SCORE_MIN} to ${SCORE_MAX}). It is a model estimate, not an assessment of your wellbeing.`);

    // Start from the empty ring, then animate to the real value.
    gaugeBar.style.transition = "none";
    gaugeBar.style.strokeDashoffset = "100";
    scaleMarker.style.transition = "none";
    scaleMarker.style.left = "0%";
    void gaugeBar.getBoundingClientRect();
    gaugeBar.style.transition = "";
    scaleMarker.style.transition = "";

    const duration = REDUCED_MOTION ? 0 : 1200;
    requestAnimationFrame(() => {
      gaugeBar.style.strokeDashoffset = String(100 - fraction * 100);
      scaleMarker.style.left = (fraction * 100) + "%";
    });

    // Count up from the bottom of the range to the returned score.
    const t0 = performance.now();
    const tick = (now) => {
      const t = duration === 0 ? 1 : Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      scoreValue.textContent = (SCORE_MIN + (score - SCORE_MIN) * eased).toFixed(2);
      if (t < 1) animationFrame = requestAnimationFrame(tick);
      else scoreValue.textContent = score.toFixed(2);
    };
    animationFrame = requestAnimationFrame(tick);

    if (!REDUCED_MOTION) {
      resultCard.classList.add("is-success");
      successTimer = setTimeout(() => resultCard.classList.remove("is-success"), 1400);
    }
    if (window.matchMedia("(max-width: 960px)").matches) {
      resultCard.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
    }
  }

  function setFieldError(name, message) {
    const input = document.getElementById(name);
    const err = document.getElementById("err-" + name);
    if (!input || !err) return;
    err.textContent = message || "";
    input.closest(".field").classList.toggle("invalid", Boolean(message));
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function clearErrors() {
    Object.keys(FIELDS).forEach((n) => setFieldError(n, ""));
    formAlert.hidden = true;
    formAlert.textContent = "";
  }

  function showAlert(message) {
    formAlert.textContent = message;
    formAlert.hidden = false;
  }

  function setLoading(loading) {
    isSubmitting = loading;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("is-loading", loading);
    submitBtn.querySelector(".btn__label").textContent = loading ? "Predicting…" : "Predict score";
  }

  /* ---------- Validation ---------- */
  function validate() {
    const payload = {};
    const errors = {};

    for (const [name, rule] of Object.entries(FIELDS)) {
      const el = document.getElementById(name);
      const raw = el.value.trim();

      if (raw === "") {
        errors[name] = rule.type === "select" ? "Please choose an option." : "This field is required.";
        continue;
      }
      if (rule.type === "select") {
        payload[name] = raw;
        continue;
      }

      const num = Number(raw);
      if (!Number.isFinite(num)) {
        errors[name] = "Enter a valid number.";
      } else if (rule.type === "int" && !Number.isInteger(num)) {
        errors[name] = "Enter a whole number.";
      } else if (num < rule.min || num > rule.max) {
        errors[name] = `${rule.label} must be between ${rule.min} and ${rule.max}.`;
      } else {
        payload[name] = num;
      }
    }

    // Cross-field rule, same as the backend.
    if (!errors.Study_Hours && !errors.Physical_Activity_Hours && !errors.Sleep_Hours_Per_Night) {
      const total = payload.Study_Hours + payload.Physical_Activity_Hours + payload.Sleep_Hours_Per_Night;
      if (total > 24) {
        errors.Sleep_Hours_Per_Night = "Study, activity and sleep hours together cannot exceed 24.";
      }
    }
    return { payload, errors };
  }

  /* ---------- Backend error parsing ---------- */
  async function readError(response) {
    let body = null;
    try { body = await response.json(); } catch (_) { /* not JSON */ }

    // FastAPI validation errors: { detail: [ { loc: ["body", "Age"], msg: "..." } ] }
    if (response.status === 422 && body && Array.isArray(body.detail)) {
      const fieldErrors = {};
      const general = [];
      body.detail.forEach((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
        const msg = (d.msg || "Invalid value").replace(/^Value error, /, "");
        if (field && FIELDS[field]) fieldErrors[field] = msg;
        else general.push(msg);
      });
      return { fieldErrors, message: general.join(" ") || "Some answers were rejected. Please check the highlighted fields." };
    }
    if (body && typeof body.detail === "string") return { message: body.detail };
    if (response.status >= 500) return { message: "The server ran into a problem. Please try again shortly." };
    return { message: `Unexpected response from the server (HTTP ${response.status}).` };
  }

  /* ---------- Submit ---------- */
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return; // prevent duplicate submissions

    clearErrors();
    const { payload, errors } = validate();

    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([n, m]) => setFieldError(n, m));
      showAlert("Please fix the highlighted fields and try again.");
      const first = Object.keys(errors)[0];
      document.getElementById(first).focus();
      return;
    }

    setLoading(true);
    showState("loading");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await readError(response);
        if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([n, m]) => setFieldError(n, m));
        const failure = new Error(err.message);
        failure.hasFieldErrors = Boolean(err.fieldErrors);
        throw failure;
      }

      const data = await response.json();
      const score = data.predicted_mental_health_score;
      if (typeof score !== "number" || !Number.isFinite(score)) {
        throw new Error("The server returned an unexpected response.");
      }

      showResult(score);
    } catch (err) {
      let message;
      if (err.name === "AbortError") {
        message = "The request timed out. Check that the server is running and try again.";
      } else if (err instanceof TypeError) {
        message = "Could not reach the server. Make sure it is running (uvicorn main:app) and try again.";
      } else {
        message = err.message || "Something went wrong. Please try again.";
      }
      if (err.hasFieldErrors) {
        showState("empty");
        showAlert(message);
      } else {
        showState("error", message);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  });

  /* ---------- Reset, new assessment, retry ---------- */
  form.addEventListener("reset", () => {
    clearErrors();
    showState("empty");
  });

  newBtn.addEventListener("click", () => {
    form.reset();
    document.getElementById("assessment").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth" });
    document.getElementById("Age").focus({ preventScroll: true });
  });

  retryBtn.addEventListener("click", () => {
    if (!isSubmitting) form.requestSubmit();
  });

  showState("empty");

  form.addEventListener("input", (e) => {
    if (e.target.id && FIELDS[e.target.id]) setFieldError(e.target.id, "");
  });
})();
