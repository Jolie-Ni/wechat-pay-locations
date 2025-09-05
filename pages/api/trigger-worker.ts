import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract parameters from request body or use defaults
    const {
      phone_e164 = '+14155720542',
      merchant_name = 'Jolie Testing',
      script_version = 'v1'
    } = req.body;

    const job = {
      job_id: uuidv4(),
      phone_e164,
      merchant_name,
      script_version
    };

    // Headers  
    const headers = {
      'Authorization': `${process.env.BLAND_API_KEY}`,
      'Content-Type': 'application/json'
    };

    // Fire the Bland AI call
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

    if (!blandResp.ok) {
      const text = await blandResp.text();
      console.error('Bland API error:', text);
      return res.status(500).json({ 
        error: 'Bland API error', 
        details: text,
        job_id: job.job_id 
      });
    }

    const result = await blandResp.json();

    console.log('Call placed successfully:', result);
    
    return res.status(200).json({ 
      success: true, 
      job_id: job.job_id,
      bland_response: result,
      message: 'Call placed. Webhook will finalize the result.' 
    });

  } catch (error) {
    console.error('Worker error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
