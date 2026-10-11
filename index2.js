import express from 'express';
import dotenv from 'dotenv';
import { Queue, Worker } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { mountBullMQMetrics, workerMetrics } from './metrics.js';

dotenv.config();

const app = express();

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = process.env;

const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD,
};

// Separate prefix so these keys do not collide with the Bull queue in index.js.
const prefix = 'bullmq';

// create a new queue and add it to the queues list
const queuesList = ["emails"];

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const bullQueues = queuesList.map((name) => new Queue(name, { connection, prefix }));
const queues = bullQueues.map((queue) => new BullMQAdapter(queue));

let accountId = 1;

function queueWelcomeEmail() {
  const id = accountId++;
  const account = {
    accountId: id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  };

  for (const queue of bullQueues) {
    queue.add('welcome-email', {
      type: "welcome-email",
      to: account.email,
      name: account.name,
      accountId: account.accountId,
      subject: "Your account is ready",
    }, {
      delay: 5000,
    });
    console.log(`Queued welcome email for ${account.email}`);
  }
}

createBullBoard({
  queues,
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
mountBullMQMetrics(app, bullQueues);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.info(`For the UI, open http://localhost:${PORT}/admin/queues`);
  console.info("Make sure Redis is running on port 6379");

  queueWelcomeEmail();
  setInterval(queueWelcomeEmail, 3000);
});

for (const queueName of queuesList) {
  const worker = new Worker(queueName, async (job) => {
    const { to, name, subject } = job.data;
    console.log(`Sending "${subject}" to ${name} <${to}>`);
    // send the email here
  }, { connection, prefix, metrics: workerMetrics });

  worker.on('error', (err) => {
    console.error(err);
  });
}
