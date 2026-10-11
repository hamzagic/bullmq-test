import Bull from 'bull';
import dotenv from 'dotenv';

dotenv.config();

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = process.env;
const redisOptions = {
  redis: { host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD },
}

// Define the queue
const burgerQueue = new Bull('burger', redisOptions);

// Register process
burgerQueue.process((payload, done) => {
  console.log("Preparing the burger...");
  setTimeout(() => {
    console.log("Burger ready!");
    done();
  }, 4000);
});

// Add a job to the queue
burgerQueue.add({
  bun: 1,
  cheese: true,
  toppings: ['lettuce', 'tomato', 'onion'],
});

// Define the job (process)
// burgerQueue.process(async (job) => {
//   console.log(`Processing job ${job.id}`);
//   return 'Burger is ready';
// });

// Add a job to the queue
// burgerQueue.add({});