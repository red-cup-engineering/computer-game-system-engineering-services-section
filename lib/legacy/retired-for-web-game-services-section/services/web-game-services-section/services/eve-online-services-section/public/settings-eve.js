// EVE Assist — the wallet-ledger-export page. Split out of the generic
// settings page (public/settings.js, now the engine's) because exporting a
// beancount/hledger wallet ledger is EVE Assist's own capability, not
// something every Assist application has (GET /api/ledger/export is
// this package's own domain route — src/application.mjs — not a generic
// engine route). Reuses the engine's shared app.js for the header/identity
// and formatting helpers, same as every other EVE Assist page.

import { escapeHtml, initHeader } from "/app.js";

const ledgerBeancountButton = document.getElementById("ledger-download-beancount");
const ledgerHledgerButton = document.getElementById("ledger-download-hledger");
const ledgerMessage = document.getElementById("ledger-form-message");

function setFormMessage(text, variant) {
  ledgerMessage.textContent = text ?? "";
  ledgerMessage.className = `form-message ${variant === "error" ? "form-message-error" : variant === "ok" ? "form-message-ok" : ""}`.trim();
}

function filenameFromDisposition(header, fallback) {
  const match = /filename="?([^"; ]+)"?/i.exec(header ?? "");
  return match ? match[1] : fallback;
}

async function downloadLedger(format, button) {
  const fallbackName = `eve-wallet.${format === "beancount" ? "beancount" : "journal"}`;
  button.disabled = true;
  setFormMessage("Preparing export…");
  try {
    const res = await fetch(`/api/ledger/export?${new URLSearchParams({ format })}`, {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "text/plain" },
    });
    if (res.status === 401) {
      window.location.replace("/");
      return;
    }
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      setFormMessage(errorBody.error ?? `Export failed (HTTP ${res.status}).`, "error");
      return;
    }
    const blob = await res.blob();
    const filename = filenameFromDisposition(res.headers.get("content-disposition"), fallbackName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFormMessage(`Downloaded ${filename}.`, "ok");
  } catch (err) {
    setFormMessage(`Export failed: ${escapeHtml(err.message)}`, "error");
  } finally {
    button.disabled = false;
  }
}

ledgerBeancountButton.addEventListener("click", () => downloadLedger("beancount", ledgerBeancountButton));
ledgerHledgerButton.addEventListener("click", () => downloadLedger("hledger", ledgerHledgerButton));

initHeader({ requireAuth: true });
