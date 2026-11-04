// Manual Socket.IO check: node scripts/watch-order.js <jwt> [orderId]
// Prints every live order event your account is allowed to receive.
const { io } = require('socket.io-client');
const [token, orderId] = process.argv.slice(2);
if (!token) { console.error('Usage: node scripts/watch-order.js <jwt> [orderId]'); process.exit(1); }

const socket = io(process.env.API_ORIGIN || 'http://localhost:5000', { auth: { token }, transports: ['websocket'] });
socket.on('connect', () => {
  console.log('connected as', socket.id);
  if (orderId) socket.emit('order:subscribe', { orderId }, (r) => console.log('subscribe ->', r));
});
socket.on('connect_error', (e) => { console.error('connection refused:', e.message); process.exit(1); });
for (const ev of ['order:placed', 'order:status', 'order:payment']) socket.on(ev, (p) => console.log(ev, JSON.stringify(p)));
