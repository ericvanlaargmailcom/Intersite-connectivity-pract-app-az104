const state = {
  config: null,
  placements: {},
  revealChecks: {},
  selectedParticipantId: null,
  selectedServiceId: null,
  trainerKey: localStorage.getItem("az104TrainerKey") || "",
  recapMode: "consensus"
};

const app = document.querySelector("#app");
let cancelActiveDrag = null;

init().catch((error) => renderError(error));

async function init() {
  state.config = await api("/api/config");
  await renderRoute();
}

async function renderRoute() {
  const path = window.location.pathname;

  if (path === "/" || path === "/join" || path === "/j") {
    renderJoin();
    return;
  }

  if (path.startsWith("/play/")) {
    await renderPlay(path.split("/").pop());
    return;
  }

  if (path.startsWith("/recap/")) {
    await renderRecap(path.split("/").pop());
    return;
  }

  if (path === "/trainer") {
    await renderTrainer();
    return;
  }

  renderJoin();
}

function renderJoin() {
  app.innerHTML = `
    <section class="join-layout">
      <div class="join-copy">
        <p class="eyebrow">AZ-104 classroom practice</p>
        <h1>Join the connectivity challenge</h1>
        <p class="lead">Enter the session code from the trainer screen, then place the Azure networking services on the architecture diagram.</p>
      </div>
      <form id="joinForm" class="join-panel">
        <label>
          <span>Your name</span>
          <input id="joinName" autocomplete="name" placeholder="e.g. Eric" required />
        </label>
        <label>
          <span>Session code</span>
          <input id="joinCode" autocomplete="off" inputmode="text" placeholder="e.g. A1B2C3" required />
        </label>
        <button class="button primary" type="submit">Start challenge</button>
      </form>
    </section>
  `;

  document.querySelector("#joinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#joinName").value.trim();
    const sessionId = normalizeSessionCode(document.querySelector("#joinCode").value);
    if (!sessionId) {
      return;
    }
    localStorage.setItem(`az104Name:${sessionId}`, name);
    window.location.href = `/play/${sessionId}`;
  });
}

async function renderTrainer() {
  const sessionsResult = await trainerApi("/api/sessions").catch(() => ({ sessions: [] }));
  app.innerHTML = `
    <section class="trainer-layout">
      <header class="topbar">
        <div>
          <p class="eyebrow">Trainer console</p>
          <h1>Session control</h1>
        </div>
        <label class="key-field">
          <span>Trainer key</span>
          <input id="trainerKey" type="password" value="${escapeHtml(state.trainerKey)}" placeholder="Optional" />
        </label>
      </header>

      <section class="control-panel">
        <label>
          <span>Session title</span>
          <input id="sessionTitle" value="AZ-104 networking group" />
        </label>
        <button class="button primary" id="createSession">New session</button>
      </section>

      <section class="session-list">
        <h2>Sessions</h2>
        <div class="sessions">
          ${(sessionsResult.sessions || []).map(renderSessionCard).join("") || "<p>No sessions yet.</p>"}
        </div>
      </section>
    </section>
  `;

  document.querySelector("#trainerKey").addEventListener("input", (event) => {
    state.trainerKey = event.target.value;
    localStorage.setItem("az104TrainerKey", state.trainerKey);
  });

  document.querySelector("#createSession").addEventListener("click", async () => {
    const title = document.querySelector("#sessionTitle").value;
    const result = await trainerApi("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title })
    });
    history.pushState(null, "", `/recap/${result.session.sessionId}`);
    await renderRoute();
  });

  document.querySelectorAll("[data-reset-session]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.resetSession;
      await trainerApi(`/api/sessions/${sessionId}/reset`, { method: "POST" });
      await renderTrainer();
    });
  });
}

function renderSessionCard(session) {
  const joinUrl = `${window.location.origin}/j`;
  return `
    <article class="session-card">
      <div class="session-main">
        <h3>${escapeHtml(session.title)}</h3>
        <p>Student URL <strong>${escapeHtml(joinUrl)}</strong></p>
        <div class="session-code">${session.sessionId}</div>
      </div>
      <div class="session-actions">
        <a class="button" href="/j">Student join</a>
        <a class="button primary" href="/recap/${session.sessionId}">Recap</a>
        <button class="button danger" data-reset-session="${session.sessionId}">Reset</button>
      </div>
    </article>
  `;
}

async function renderPlay(sessionId) {
  const sessionResult = await api(`/api/sessions/${sessionId}`);
  const participantName = localStorage.getItem(`az104Name:${sessionId}`) || "";

  app.innerHTML = `
    <section class="play-layout">
      <header class="player-header">
        <div>
          <p class="eyebrow">${escapeHtml(sessionResult.session.title)}</p>
          <h1>Place the services</h1>
        </div>
        <form id="playerForm" class="player-form">
          <input id="participantName" autocomplete="name" value="${escapeHtml(participantName)}" placeholder="Your name" required />
          <button class="button primary" type="submit">Submit</button>
        </form>
      </header>
      <div class="game-board">
        <section class="diagram-panel play-diagram-panel">
          ${renderInteractiveDiagram()}
        </section>
        <section class="service-bank-panel">
          <div class="tray-heading">
            <h2>Drag a service to the right place</h2>
            <p>One service is intentionally left unused.</p>
          </div>
          <div id="serviceBank" class="service-bank"></div>
        </section>
      </div>
    </section>
  `;

  renderServiceBank();
  wirePlacementInteractions();

  document.querySelector("#playerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.querySelector("#participantName").value.trim();
    localStorage.setItem(`az104Name:${sessionId}`, name);
    await api(`/api/sessions/${sessionId}/submissions`, {
      method: "POST",
      body: JSON.stringify({
        participantName: name,
        participantId: getParticipantId(sessionId, name),
        placements: state.placements
      })
    });
    renderSubmitted(sessionResult.session.title);
  });
}

function renderSubmitted(title) {
  app.innerHTML = `
    <section class="submitted">
      <p class="eyebrow">${escapeHtml(title)}</p>
      <h1>Submission received</h1>
      <p>Your answer is saved. The trainer will reveal the group recap on the shared screen.</p>
    </section>
  `;
}

async function renderRecap(sessionId) {
  const result = await trainerApi(`/api/sessions/${sessionId}/recap`);
  const selectedParticipant = result.participants.find((item) => item.participantId === state.selectedParticipantId) || null;
  if (state.selectedParticipantId && !selectedParticipant) {
    state.selectedParticipantId = null;
  }
  const isParticipantMode = Boolean(selectedParticipant);
  const isRevealMode = state.recapMode === "solution" && !isParticipantMode;
  const recapTitle = isParticipantMode
    ? `${selectedParticipant.participantName}'s choices`
    : isRevealMode
      ? "Reveal the solution"
      : "Group consensus";

  app.innerHTML = `
    <section class="recap-layout">
      <header class="recap-header">
        <div>
          <p class="eyebrow">${escapeHtml(result.session.title)} · ${result.submissionCount} submissions</p>
          <h1>${escapeHtml(recapTitle)}</h1>
        </div>
        <div class="recap-actions">
          <button class="button" id="refreshRecap">Refresh</button>
          <button class="button primary" id="toggleSolution">${isRevealMode ? "Show consensus" : "Reveal solution"}</button>
          <button class="button danger" id="resetSession">Reset</button>
        </div>
      </header>
      <div class="recap-grid ${isRevealMode ? "reveal-grid" : ""}">
        ${isRevealMode ? renderRevealServicePanel() : ""}
        <section class="diagram-panel recap-diagram">
          ${isParticipantMode ? renderParticipantDiagram(selectedParticipant) : renderStaticDiagram(result, { mode: state.recapMode })}
        </section>
        <aside class="recap-side">
          <div class="session-code recap-code">${sessionId}</div>
          <h2>Participants</h2>
          ${isParticipantMode ? `<button class="button participant-back" id="showConsensus" type="button">Show group consensus</button>` : ""}
          <div class="participant-list">
            ${result.participants.map((item) => `<button class="participant-pill ${item.participantId === state.selectedParticipantId ? "active" : ""}" data-participant-id="${escapeHtml(item.participantId)}" type="button">${escapeHtml(item.participantName)}</button>`).join("") || "<p>No submissions yet.</p>"}
          </div>
        </aside>
      </div>
    </section>
  `;

  document.querySelector("#refreshRecap").addEventListener("click", () => renderRecap(sessionId));
  document.querySelector("#toggleSolution").addEventListener("click", () => {
    state.selectedParticipantId = null;
    state.recapMode = state.recapMode === "solution" ? "consensus" : "solution";
    state.revealChecks = {};
    renderRecap(sessionId);
  });
  document.querySelector("#resetSession").addEventListener("click", async () => {
    await trainerApi(`/api/sessions/${sessionId}/reset`, { method: "POST" });
    state.selectedParticipantId = null;
    state.recapMode = "consensus";
    state.revealChecks = {};
    await renderRecap(sessionId);
  });
  document.querySelector("#showConsensus")?.addEventListener("click", () => {
    state.selectedParticipantId = null;
    state.recapMode = "consensus";
    renderRecap(sessionId);
  });
  document.querySelectorAll(".participant-pill").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedParticipantId = button.dataset.participantId;
      state.recapMode = "consensus";
      state.revealChecks = {};
      renderRecap(sessionId);
    });
  });

  if (isRevealMode) {
    wireRevealInteractions(result, sessionId);
  }
}

function renderRevealServicePanel() {
  return `
    <aside class="service-bank-panel reveal-bank-panel">
      <div class="tray-heading">
        <h2>Reveal services</h2>
        <p>Drag a service to test the group consensus.</p>
      </div>
      <div class="service-bank reveal-service-bank">
        ${state.config.services
          .filter((service) => !service.distractor)
          .map((service) => renderServiceCard(service))
          .join("")}
      </div>
    </aside>
  `;
}

function renderInteractiveDiagram() {
  return `
    <div class="diagram">
      ${renderDiagramBackdrop()}
      ${state.config.slots
        .map((slot) => `<button class="drop-slot" data-slot-id="${slot.id}" style="left:${slot.x}%;top:${slot.y}%"><span>${escapeHtml(slot.label)}</span><small>${escapeHtml(slot.hint)}</small></button>`)
        .join("")}
    </div>
  `;
}

function renderStaticDiagram(result = {}, options = {}) {
  const mode = options.mode || "empty";
  const consensusBySlot = new Map((result.consensus || []).map((item) => [item.slotId, item]));
  const serviceById = getServiceMap();

  return `
    <div class="diagram ${options.compact ? "compact" : ""}">
      ${renderDiagramBackdrop()}
      ${state.config.slots
        .map((slot) => {
          const consensus = consensusBySlot.get(slot.id);
          const revealCheck = mode === "solution" ? state.revealChecks[slot.id] : null;
          const serviceId = mode === "solution" ? revealCheck?.serviceId : consensus?.topChoice?.serviceId;
          const service = serviceById.get(serviceId);
          const meta = mode === "solution"
            ? revealCheck
              ? (revealCheck.isCorrect ? "Correct" : "Try another place")
              : ""
            : consensus?.topChoice
              ? `${consensus.topChoice.percentage}% · ${formatVoteCount(consensus.topChoice.count, result.submissionCount)}`
              : "No votes";
          return `<div class="drop-slot static ${mode === "solution" ? "reveal-slot" : ""}" data-slot-id="${slot.id}" style="left:${slot.x}%;top:${slot.y}%"><span>${escapeHtml(slot.label)}</span>${service ? renderPlacedService(service, meta, revealCheck ? slot.id : "", getRevealStatusClass(revealCheck)) : `<small>${escapeHtml(slot.hint)}</small>`}</div>`;
        })
        .join("")}
    </div>
  `;
}

function renderParticipantDiagram(participant) {
  const serviceById = getServiceMap();

  return `
    <div class="diagram">
      ${renderDiagramBackdrop()}
      ${state.config.slots
        .map((slot) => {
          const service = serviceById.get(participant.placements?.[slot.id]);
          return `<div class="drop-slot static" style="left:${slot.x}%;top:${slot.y}%"><span>${escapeHtml(slot.label)}</span>${service ? renderPlacedService(service, "Submitted choice") : `<small>${escapeHtml(slot.hint)}</small>`}</div>`;
        })
        .join("")}
    </div>
  `;
}

function getRevealStatusClass(revealCheck) {
  if (!revealCheck) return "";
  return revealCheck.isCorrect ? "is-correct" : "is-incorrect";
}

function renderDiagramBackdrop() {
  return `
    <div class="zone zone-users">Remote users</div>
    <div class="zone zone-onprem">On-premises</div>
    <div class="zone zone-internet">Internet / carrier</div>
    <div class="zone zone-hub">Hub VNet</div>
    <div class="zone zone-spoke">Spoke VNet</div>
    <div class="zone zone-paas">Azure PaaS</div>
    <div class="diagram-resource-group vm-cluster" aria-label="Virtual machines behind the load balancer">
      ${[1, 2, 3].map((number) => `
        <div class="diagram-resource compact">
          <img src="/assets/icons/virtual-machine.svg" alt="" />
          <span>VM ${number}</span>
        </div>
      `).join("")}
    </div>
    <div class="diagram-resource-group web-vm-cluster" aria-label="Web server virtual machines behind the application gateway">
      ${[1, 2].map((number) => `
        <div class="diagram-resource compact web-vm">
          <div class="web-vm-icon">
            <img src="/assets/icons/virtual-machine.svg" alt="" />
            <span class="web-badge">WEB</span>
          </div>
          <span>Web VM ${number}</span>
        </div>
      `).join("")}
    </div>
    <div class="diagram-resource-group paas-resources" aria-label="Azure PaaS resources">
      <div class="diagram-resource">
        <img src="/assets/icons/storage-account.svg" alt="" />
        <span>Storage</span>
      </div>
      <div class="diagram-resource">
        <img src="/assets/icons/app-service.svg" alt="" />
        <span>Web App</span>
      </div>
    </div>
    <svg class="network-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M10 20 C25 21, 31 41, 42 53" />
      <path d="M18 45 C28 45, 34 49, 42 53" />
      <path d="M18 80 C30 79, 34 66, 42 53" />
      <path d="M24 76 C31 76, 36 70, 42 65" />
      <path d="M47 53 C53 44, 56 42, 60 44" />
      <path d="M60 44 C66 46, 70 49, 75 52" />
      <path d="M86 22 C86 24, 86 25, 86 27" />
      <path d="M86 48 C86 49, 86 50, 86 51" />
      <path d="M76 70 C68 72, 58 78, 48 85" />
      <path d="M76 84 C70 84, 64 84, 58 85" />
    </svg>
  `;
}

function renderServiceBank() {
  const bank = document.querySelector("#serviceBank");
  const placedIds = new Set(Object.values(state.placements));
  bank.innerHTML = state.config.services
    .filter((service) => !placedIds.has(service.id))
    .map((service) => renderServiceCard(service))
    .join("");
  refreshSlots();
}

function renderServiceCard(service) {
  return `
    <button class="service-card ${service.distractor ? "distractor" : ""}" data-service-id="${service.id}" type="button">
      ${renderServiceIcon(service)}
      <span>${escapeHtml(service.name)}</span>
    </button>
  `;
}

function renderPlacedService(service, meta = "", slotId = "", extraClass = "") {
  return `
    <div class="placed-service ${extraClass}" data-service-id="${service.id}" ${slotId ? `data-source-slot-id="${slotId}"` : ""}>
      ${renderServiceIcon(service)}
      <span>${escapeHtml(service.shortName)}</span>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
    </div>
  `;
}

function renderServiceIcon(service) {
  if (service.iconPath) {
    return `<span class="azure-icon"><img src="${escapeHtml(service.iconPath)}" alt="" loading="lazy" /></span>`;
  }

  return `<strong>${escapeHtml(service.icon)}</strong>`;
}

function wirePlacementInteractions() {
  document.querySelectorAll(".drop-slot").forEach((slot) => {
    slot.addEventListener("click", () => {
      const slotId = slot.dataset.slotId;
      if (state.selectedServiceId) {
        placeService(slotId, state.selectedServiceId);
      } else if (state.placements[slotId]) {
        delete state.placements[slotId];
        renderServiceBank();
      }
    });
  });
}

function wireServiceCards() {
  document.querySelectorAll(".service-card:not([data-reveal-card])").forEach((card) => {
    card.addEventListener("click", () => selectService(card.dataset.serviceId));
    card.addEventListener("pointerdown", startPointerDrag);
  });
  document.querySelectorAll(".placed-service[data-source-slot-id]").forEach((card) => {
    card.addEventListener("pointerdown", startPointerDrag);
  });
}

function wireRevealInteractions(result, sessionId) {
  document.querySelectorAll(".reveal-bank-panel .service-card").forEach((card) => {
    card.dataset.revealCard = "true";
    card.addEventListener("pointerdown", (event) => startRevealDrag(event, result, sessionId));
  });
  document.querySelectorAll(".reveal-slot .placed-service[data-source-slot-id]").forEach((card) => {
    card.addEventListener("pointerdown", (event) => startRevealDrag(event, result, sessionId));
  });
}

function selectService(serviceId) {
  state.selectedServiceId = state.selectedServiceId === serviceId ? null : serviceId;
  document.querySelectorAll(".service-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.serviceId === state.selectedServiceId);
  });
}

function placeService(slotId, serviceId, sourceSlotId = null) {
  if (sourceSlotId) {
    if (sourceSlotId === slotId) return;

    const replacedServiceId = state.placements[slotId];
    state.placements[slotId] = serviceId;
    if (replacedServiceId) {
      state.placements[sourceSlotId] = replacedServiceId;
    } else {
      delete state.placements[sourceSlotId];
    }
    state.selectedServiceId = null;
    renderServiceBank();
    return;
  }

  for (const [existingSlotId, existingServiceId] of Object.entries(state.placements)) {
    if (existingServiceId === serviceId) {
      delete state.placements[existingSlotId];
    }
  }
  state.placements[slotId] = serviceId;
  state.selectedServiceId = null;
  renderServiceBank();
}

function refreshSlots() {
  const serviceById = getServiceMap();
  document.querySelectorAll(".drop-slot[data-slot-id]").forEach((slot) => {
    const slotConfig = state.config.slots.find((item) => item.id === slot.dataset.slotId);
    const service = serviceById.get(state.placements[slot.dataset.slotId]);
    slot.innerHTML = service
      ? renderPlacedService(service, "Drag to move · Click to remove", slot.dataset.slotId)
      : `<span>${escapeHtml(slotConfig.label)}</span><small>${escapeHtml(slotConfig.hint)}</small>`;
  });
  wireServiceCards();
}

function startPointerDrag(event) {
  if (event.button !== 0) return;
  event.preventDefault();

  cancelActiveDrag?.();

  const source = event.currentTarget;
  const serviceId = source.dataset.serviceId;
  const sourceSlotId = source.dataset.sourceSlotId || null;
  const ghost = source.cloneNode(true);
  ghost.classList.add("drag-ghost");
  document.body.appendChild(ghost);
  source.setPointerCapture(event.pointerId);
  moveGhost(ghost, event.clientX, event.clientY);

  const onMove = (moveEvent) => moveGhost(ghost, moveEvent.clientX, moveEvent.clientY);
  let finished = false;
  const cleanupTimer = window.setTimeout(() => finishDrag(), 5000);

  const finishDrag = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(cleanupTimer);
    source.removeEventListener("pointermove", onMove);
    source.removeEventListener("pointerup", onUp);
    source.removeEventListener("pointercancel", onCancel);
    source.removeEventListener("lostpointercapture", onCancel);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("blur", onCancel);
    ghost.remove();
    if (cancelActiveDrag === finishDrag) cancelActiveDrag = null;
  };

  const onUp = (upEvent) => {
    const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".drop-slot");
    finishDrag();
    if (target?.dataset.slotId) {
      placeService(target.dataset.slotId, serviceId, sourceSlotId);
    }
  };

  const onCancel = () => finishDrag();
  cancelActiveDrag = finishDrag;

  source.addEventListener("pointermove", onMove);
  source.addEventListener("pointerup", onUp);
  source.addEventListener("pointercancel", onCancel);
  source.addEventListener("lostpointercapture", onCancel);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("blur", onCancel);
}

function startRevealDrag(event, result, sessionId) {
  if (event.button !== 0) return;
  event.preventDefault();

  cancelActiveDrag?.();

  const source = event.currentTarget;
  const serviceId = source.dataset.serviceId;
  const sourceSlotId = source.dataset.sourceSlotId || null;
  const ghost = source.cloneNode(true);
  ghost.classList.add("drag-ghost");
  document.body.appendChild(ghost);
  source.setPointerCapture(event.pointerId);
  moveGhost(ghost, event.clientX, event.clientY);

  const onMove = (moveEvent) => moveGhost(ghost, moveEvent.clientX, moveEvent.clientY);
  let finished = false;
  const cleanupTimer = window.setTimeout(() => finishDrag(), 5000);

  const finishDrag = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(cleanupTimer);
    source.removeEventListener("pointermove", onMove);
    source.removeEventListener("pointerup", onUp);
    source.removeEventListener("pointercancel", onCancel);
    source.removeEventListener("lostpointercapture", onCancel);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("blur", onCancel);
    ghost.remove();
    if (cancelActiveDrag === finishDrag) cancelActiveDrag = null;
  };

  const onUp = (upEvent) => {
    const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".reveal-slot[data-slot-id]");
    finishDrag();
    if (!target?.dataset.slotId) return;

    const slotId = target.dataset.slotId;
    if (sourceSlotId && sourceSlotId !== slotId) {
      delete state.revealChecks[sourceSlotId];
    }
    state.revealChecks[slotId] = {
      serviceId,
      isCorrect: result.solution?.[slotId] === serviceId
    };
    renderRecap(sessionId);
  };

  const onCancel = () => finishDrag();
  cancelActiveDrag = finishDrag;

  source.addEventListener("pointermove", onMove);
  source.addEventListener("pointerup", onUp);
  source.addEventListener("pointercancel", onCancel);
  source.addEventListener("lostpointercapture", onCancel);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("blur", onCancel);
}

function moveGhost(ghost, x, y) {
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

function getServiceMap() {
  return new Map(state.config.services.map((service) => [service.id, service]));
}

function normalizeSessionCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

function getParticipantId(sessionId, name) {
  const nameKey = normalizeParticipantName(name);
  const storageKey = `az104ParticipantId:${sessionId}:${nameKey}`;
  const participantId = localStorage.getItem(storageKey) || crypto.randomUUID();
  localStorage.setItem(storageKey, participantId);
  return participantId;
}

function normalizeParticipantName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "anonymous";
}

function formatVoteCount(count, total) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : count;
  const voteLabel = safeTotal === 1 ? "vote" : "votes";
  return `${count} of ${safeTotal} ${voteLabel}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function trainerApi(path, options = {}) {
  return api(path, {
    ...options,
    headers: {
      "x-trainer-key": state.trainerKey,
      ...(options.headers || {})
    }
  });
}

function renderError(error) {
  app.innerHTML = `
    <section class="submitted">
      <p class="eyebrow">Something needs attention</p>
      <h1>${escapeHtml(error.message)}</h1>
      <a class="button" href="/trainer">Back to trainer page</a>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
