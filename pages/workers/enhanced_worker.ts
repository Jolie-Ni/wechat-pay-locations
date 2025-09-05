// Enhanced worker following industry best practices
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from 'redis';
import fetch from 'node-fetch';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const QUEUE_KEY = 'wechat-pay:queue';
const RETRY_QUEUE_KEY = 'wechat-pay:retry';
const FAILED_QUEUE_KEY = 'wechat-pay:failed';
const MAX_RETRIES = 3;

interface Job {
  job_id: string;
  phone_e164: string;
  merchant_name?: string;
  script_version?: string;
  retries?: number;
  created_at?: string;
}

class WorkerWithBestPractices {
  private redis = createClient({ url: process.env.REDIS_URL });
  private isShuttingDown = false;

  async start() {
    await this.redis.connect();
    console.log('🚀 Worker started with best practices');
    
    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());

    while (!this.isShuttingDown) {
      try {
        await this.processJob();
      } catch (error) {
        console.error('❌ Worker error:', error);
        await this.sleep(5000); // Wait before retrying
      }
    }
  }

  private async processJob() {
    // Try main queue first, then retry queue
    const result = await this.redis.brPop([QUEUE_KEY, RETRY_QUEUE_KEY], 10);
    
    if (!result) return; // Timeout, continue loop

    const job: Job = JSON.parse(result.element);
    job.retries = job.retries || 0;

    console.log(`📞 Processing job ${job.job_id} (attempt ${job.retries + 1})`);

    try {
      await this.makePhoneCall(job);
      console.log(`✅ Job ${job.job_id} completed successfully`);
      
      // Log success metrics
      await this.logJobMetrics(job, 'success');
      
    } catch (error) {
      console.error(`❌ Job ${job.job_id} failed:`, error);
      await this.handleFailedJob(job, error as Error);
    }
  }

  private async makePhoneCall(job: Job) {
    const headers = {
      'Authorization': `${process.env.BLAND_API_KEY}`,
      'Content-Type': 'application/json'
    };

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
      "pathway_id": "b4696eef-c084-41ad-bf85-f946d69ac808",
      // Add job tracking
      "metadata": {
        "job_id": job.job_id,
        "phone": job.phone_e164
      }
    };

    const response = await fetch('https://api.bland.ai/v1/calls', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bland API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  private async handleFailedJob(job: Job, error: Error) {
    job.retries = (job.retries || 0) + 1;

    if (job.retries < MAX_RETRIES) {
      // Retry with exponential backoff
      const delay = Math.pow(2, job.retries) * 1000; // 2s, 4s, 8s
      console.log(`🔄 Retrying job ${job.job_id} in ${delay}ms`);
      
      setTimeout(async () => {
        await this.redis.lPush(RETRY_QUEUE_KEY, JSON.stringify(job));
      }, delay);
    } else {
      // Move to failed queue for manual inspection
      console.log(`💀 Job ${job.job_id} permanently failed after ${MAX_RETRIES} retries`);
      await this.redis.lPush(FAILED_QUEUE_KEY, JSON.stringify({
        ...job,
        failed_at: new Date().toISOString(),
        error: error.message
      }));
    }

    await this.logJobMetrics(job, 'failed', error);
  }

  private async logJobMetrics(job: Job, status: 'success' | 'failed', error?: Error) {
    // In production, send to monitoring service (DataDog, Sentry, etc.)
    const metrics = {
      job_id: job.job_id,
      status,
      retries: job.retries || 0,
      timestamp: new Date().toISOString(),
      error: error?.message
    };
    
    console.log('📊 Metrics:', metrics);
    // await sendToMonitoring(metrics);
  }

  private async gracefulShutdown() {
    console.log('🛑 Graceful shutdown initiated...');
    this.isShuttingDown = true;
    await this.redis.quit();
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the worker
const worker = new WorkerWithBestPractices();
worker.start().catch(console.error);
