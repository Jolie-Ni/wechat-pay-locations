import type { NextApiRequest, NextApiResponse } from 'next';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from 'redis';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const QUEUE_KEY = 'wechat-pay:queue';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redis = createClient({ url: process.env.REDIS_URL });
  
  try {
    await redis.connect();
    
    // Non-blocking pop - process one job if available
    const result = await redis.brPop(QUEUE_KEY, 1); // 1 second timeout
    
    if (!result) {
      await redis.quit();
      return res.status(200).json({ message: 'No jobs in queue' });
    }

    const payload = result.element;
    const job = JSON.parse(payload as string) as {
      job_id: string;
      phone_e164: string;
      merchant_name?: string;
      script_version?: string;
    };

    // Process the job (same logic as worker)
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
      "pathway_id": "b4696eef-c084-41ad-bf85-f946d69ac808"
    };

    const blandResp = await fetch('https://api.bland.ai/v1/calls', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });

    await redis.quit();

    if (!blandResp.ok) {
      const text = await blandResp.text();
      return res.status(500).json({ 
        error: 'Bland API error', 
        details: text,
        job_id: job.job_id 
      });
    }

    const blandResult = await blandResp.json();

    return res.status(200).json({ 
      success: true, 
      job_id: job.job_id,
      job_data: job,
      bland_response: blandResult,
      message: 'Job processed successfully' 
    });

  } catch (error) {
    await redis.quit();
    console.error('Processing error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
