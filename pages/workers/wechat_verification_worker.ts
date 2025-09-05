// worker.ts
import dotenv from 'dotenv';
import path from 'path';
import { Queue } from '@upstash/queue';
import { Redis } from '@upstash/redis';

// Load .env.local file explicitly
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

const redis = new Redis({
  url: `${process.env.UPSTASH_REDIS_REST_URL}`,
  token: `${process.env.UPSTASH_REDIS_REST_TOKEN}`,
});

const queue = new Queue({ redis });
// const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Worker started. Waiting for jobs...');

  // Upstash Queue API - polls for messages
  const message = await queue.receiveMessage();
  if (!message) {
    console.log('No jobs in queue');
    return;
  }

  const job = message.body as {
    job_id: string;
    phone_e164: string;
    merchant_name?: string;
    script_version?: string;
  };

  // Headers  
  const headers = {
    'Authorization': `${process.env.BLAND_API_KEY}`, 
  };

  // Fire the Bland AI call. Adjust fields to match your Bland account.
  // Most platforms support a "metadata" or "webhook_variables" field. We pass job_id and phone for idempotency.

  const data = {
    "phone_number": job.phone_e164,
    "voice": "June",
    "wait_for_greeting": true,
    "record": true,
    "answered_by_enabled": true,
    "noise_cancellation": false,
    "interruption_threshold": 100,
    "block_interruptions": false,
    "max_duration": 12,
    "model": "base",
    "language": "en",
    "background_track": "office",
    "endpoint": "https://api.bland.ai",
    "voicemail_action": "hangup",
    "analysis_schema": {
      "accept_wechat_pay": "boolean"
    },
    "pathway_id": "b4696eef-c084-41ad-bf85-f946d69ac808"
  }

  const blandResp = await fetch('https://api.bland.ai/v1/calls', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!blandResp.ok) {
    const text = await blandResp.text();
    console.error('Bland API error:', text);
    process.exit(1); // fail fast for MVP
  }

  await blandResp.json();

  console.log('Call placed. Webhook will finalize the result.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
