# Bull and BullMQ study app

A small Node.js app that queues a welcome email for each new account, waits 5 seconds, then processes it. The same idea is implemented three ways: with Bull, with BullMQ, and as an Express API that also exposes a few account routes.

Queue state is visible in Bull Board. Redis, Prometheus, Loki, and Grafana run in Docker.

## Prerequisites

- Node.js
- Docker

## Run the infrastructure

From the project root:

```bash
docker compose up -d
npm install
```

Redis is required before any of the Node processes. Grafana, Prometheus, and Loki start with the same Compose file.

Copy the environment variables if you do not already have a `.env` file:

```
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=password
PORT=3000
```

`REDIS_PASSWORD` must match the Redis password in `docker-compose.yml` (`password`).

## Run one Node app

Only one of these can listen on port 3000 at a time.

```bash
node index.js    # Bull
node index2.js   # BullMQ
node index3.js   # BullMQ inside an Express API
```

Then open http://localhost:3000/admin/queues.

`index3.js` also serves the API:

- `GET /` lists the routes.
- `GET /accounts` returns accounts created in this process.
- `POST /accounts` creates an account and queues its welcome email. Optional JSON body: `{ "name": "Ana", "email": "ana@example.com" }`.

## How a job moves

Each process adds one welcome-email job as soon as it starts, then another every 3 seconds. `index3.js` does the same thing when `POST /accounts` is called.

The job is stored in Redis with a 5 second delay. In Bull Board it shows on the **Delayed** tab. When the delay ends, the worker takes it and logs:

```text
Sending "Your account is ready" to User 1 <user1@example.com>
```

The job then moves to **Completed**. **Waiting** stays empty while a worker is running, because the worker picks the job up as soon as the delay ends.

Bull and BullMQ keep separate Redis keys, so the three files do not share a queue:

| File | Library | Redis prefix | Worker |
|---|---|---|---|
| `index.js` | `bull` | `bull` (library default) | `queue.process()` |
| `index2.js` | `bullmq` | `bullmq` | `new Worker()` |
| `index3.js` | `bullmq` | `app` | `new Worker()` |

Bull Board is mounted at `/admin/queues` in all three. `ExpressAdapter` turns the Bull Board handlers into Express routes. `createBullBoard` attaches the queue list to that adapter.

## Ports

| Port | Service | Use it for |
|---|---|---|
| 3000 | Node app | API, Bull Board, and `/metrics` |
| 3001 | Grafana | Metrics and logs |
| 6379 | Redis | Queue storage |
| 9090 | Prometheus | Direct access; Grafana already queries it |
| 3100 | Loki | Direct access; Grafana already queries it |
| 9121 | Redis exporter | Prometheus scrape target |

For metrics and container logs, use Grafana at http://localhost:3001. Prometheus and Loki are the stores behind it. You do not need to open 9090 or 3100 to explore data.

Grafana signs you in anonymously as an admin. The login `admin` / `admin` also works.

In **Explore**:

- Data source **Prometheus**, query `redis_up`. A value of `1` means Prometheus can read Redis.
- Data source **Prometheus**, query `bullmq_job_count`. This is the BullMQ queue from `index2.js` or `index3.js`.
- Data source **Loki**, query `{container="redis"}`. This is Redis container output collected by Promtail.

The **BullMQ** dashboard at http://localhost:3001/d/bullmq shows jobs by state. Prometheus scrapes `http://localhost:3000/metrics` while `index2.js` or `index3.js` is running. `index.js` uses Bull, so it does not publish these metrics.
