import express from 'express';
import dotenv from 'dotenv';
import { Queue, Worker } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { mountBullMQMetrics, workerMetrics } from './metrics.js';

dotenv.config();

const app = express();
app.use(express.json());

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = process.env;

const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD,
};

// Separate prefix so these keys do not collide with index.js or index2.js.
const prefix = 'app';

const queuesList = ["emails"];

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const bullQueues = queuesList.map((name) => new Queue(name, { connection, prefix }));
const queues = bullQueues.map((queue) => new BullMQAdapter(queue));

const accounts = [];
let accountId = 1;

function createAccount(input = {}) {
  const id = accountId++;
  const account = {
    accountId: id,
    name: input.name || `User ${id}`,
    email: input.email || `user${id}@example.com`,
  };

  accounts.push(account);

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

  return account;
}

createBullBoard({
  queues,
  serverAdapter,
});

app.get('/', (_req, res) => {
  res.json({
    message: 'Accounts API',
    accounts: '/accounts',
    queues: '/admin/queues',
  });
});

app.get('/accounts', (_req, res) => {
  res.json(accounts);
});

app.post('/accounts', (req, res) => {
  const account = createAccount(req.body);
  res.status(201).json(account);
});

app.use('/admin/queues', serverAdapter.getRouter());
mountBullMQMetrics(app, bullQueues);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.info(`For the UI, open http://localhost:${PORT}/admin/queues`);
  console.info("Make sure Redis is running on port 6379");

  createAccount();
  setInterval(() => createAccount(), 3000);
});

for (const queueName of queuesList) {
  const worker = new Worker(queueName, async (job) => {
    const { to, name, subject } = job.data;
    console.log(`Sending "${subject}" to ${name} <${to}>`);
  }, { connection, prefix, metrics: workerMetrics });

  worker.on('error', (err) => {
    console.error(err);
  });
}
