// src/scheduler.ts
import cron from "node-cron";

export type ScheduledJob = ReturnType<typeof cron.schedule>;

export function scheduleJob(date: Date, callback: () => void): ScheduledJob {
  const minute = date.getMinutes();
  const hour = date.getHours();
  
  return cron.schedule(
    `${minute} ${hour} * * *`,
    callback,
    {
      scheduled: true,
      timezone: "UTC" // You can make this configurable via parameter if needed
    }
  );
}
