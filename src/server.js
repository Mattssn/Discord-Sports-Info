import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import { startBot, client } from './bot.js';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

function checkAuth(req, res, next) {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) return next();
  const provided = req.headers['x-dashboard-token'] || req.query.token;
  if (provided === token) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/status', checkAuth, (req, res) => {
  const ready = client && typeof client.isReady === 'function' ? client.isReady() : !!client?.user;
  res.json({ ready, user: client?.user?.tag ?? null });
});

app.post('/api/message', checkAuth, async (req, res) => {
  const { channelId, message } = req.body;
  if (!channelId || !message) return res.status(400).json({ error: 'channelId and message required' });
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.send) return res.status(404).json({ error: 'Channel not found or not sendable' });
    const sent = await channel.send(message);
    res.json({ success: true, id: sent.id });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', socket => {
  socket.emit('status', { ready: client?.user ? true : false, user: client?.user?.tag ?? null });
});

async function start() {
  await startBot();
  server.listen(PORT, () => console.log(`Dashboard listening on http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
