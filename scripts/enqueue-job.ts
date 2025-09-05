import dotenv from 'dotenv';
import path from 'path';
import { Queue } from '@upstash/queue';
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

// Load .env.local file explicitly
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Create Redis client AFTER env vars are loaded
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function enqueueJob(phone_e164: string, merchant_name: string, script_version: string = 'v1') {
  
  const queue = new Queue({ redis });
  
  try {
    console.log('Connected to Upstash Redis');

    // Create a test job
    const job = {
      job_id: uuidv4(),
      phone_e164,
      merchant_name,
      script_version
    };

    // Add job to the queue using Upstash Queue
    await queue.sendMessage(job);
    
    console.log('✅ Job enqueued successfully:');
    console.log(JSON.stringify(job, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Allow command line arguments for custom phone/merchant
const phone = process.argv[2] || '+14155720542';
const merchant = process.argv[3] || 'Test Merchant via Queue';

console.log(`🚀 Enqueuing job for ${phone} at ${merchant}...`);
enqueueJob(phone, merchant).catch(console.error);
