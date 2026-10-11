import { MetricsTime } from 'bullmq';

export const workerMetrics = {
  maxDataPoints: MetricsTime.ONE_HOUR,
};

export function mountBullMQMetrics(app, queues) {
  app.get('/metrics', async (_req, res) => {
    const parts = await Promise.all(
      queues.map((queue) => queue.exportPrometheusMetrics()),
    );
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(`${parts.join('\n')}\n`);
  });
}
