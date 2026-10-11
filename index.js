import express from 'express';
import dotenv from 'dotenv';
import Queue from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

dotenv.config();

const app = express();

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = process.env;

// redis connection options
const redisOptions = {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
  },
};

// create a new queue and add it to the queues list
const queuesList = ["emails"];

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const bullQueues = queuesList.map((name) => new Queue(name, redisOptions));
const queues = bullQueues.map((queue) => new BullAdapter(queue));

let accountId = 1;

function queueWelcomeEmail() {
  const id = accountId++;
  const account = {
    accountId: id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  };

  for (const queue of bullQueues) {
    queue.add({
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.info(`For the UI, open http://localhost:${PORT}/admin/queues`);
  console.info("Make sure Redis is running on port 6379");

  queueWelcomeEmail();
  setInterval(queueWelcomeEmail, 3000);
});

for (const queue of bullQueues) {
  queue.process(async (job) => {
      const { to, name, subject } = job.data;
      console.log(`Sending "${subject}" to ${name} <${to}>`);
      // send the email here
  });
}
