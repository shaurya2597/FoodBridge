import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { initSockets } from './sockets';
import { startDonationExpiryJob } from './services/donationExpiryJob';

const server = http.createServer(app);
initSockets(server);
server.listen(env.PORT, () => {
  console.log(`FoodBridge API running on http://localhost:${env.PORT}/api`);
  startDonationExpiryJob();
});

const shutdown = async () => { await prisma.$disconnect(); server.close(() => process.exit(0)); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
