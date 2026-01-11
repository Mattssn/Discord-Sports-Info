async function getStatus() {
  const res = await fetch('/api/status');
  return res.json();
}

async function sendMessage(channelId, message) {
  const res = await fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, message })
  });
  return res.json();
}

function updateStatusUI(data) {
  const el = document.getElementById('statusText');
  if (!data) return (el.textContent = 'No data');
  el.textContent = data.ready ? `Online as ${data.user}` : 'Offline';
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  updateStatusUI({ ready: false, user: null });
  try {
    const s = await getStatus();
    updateStatusUI(s);
  } catch (err) {
    updateStatusUI(null);
  }
});

document.getElementById('sendBtn').addEventListener('click', async () => {
  const channelId = document.getElementById('channelId').value.trim();
  const message = document.getElementById('messageText').value;
  const resultEl = document.getElementById('sendResult');
  resultEl.textContent = 'Sending...';
  try {
    const r = await sendMessage(channelId, message);
    if (r.success) resultEl.textContent = `Sent (${r.id})`;
    else resultEl.textContent = `Error: ${r.error || JSON.stringify(r)}`;
  } catch (err) {
    resultEl.textContent = `Request failed: ${err.message}`;
  }
});

// initial load
(async () => {
  try {
    const s = await getStatus();
    updateStatusUI(s);
  } catch (err) {
    updateStatusUI(null);
  }
})();
