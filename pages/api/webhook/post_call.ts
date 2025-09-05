// pages/api/webhooks/bland.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {

    const payload = req.body;
    const { metadata, call_status, transcript } = payload;
    const { job_id, phone_e164 } = metadata;

    // Process the verification result directly
    await processVerificationResult({
      job_id,
      phone_e164,
      call_status,
      transcript,
      completed_at: new Date().toISOString()
    });

    // Respond quickly to Bland AI
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to avoid retries for unrecoverable errors
    res.status(200).json({ error: 'Processing failed' });
  }
}

async function processVerificationResult(result: {
  job_id: string;
  phone_e164: string;
  call_status: string;
  transcript?: string;
  completed_at: string;
}) {
  // Update verification status in database
  // Parse transcript for WeChat Pay acceptance
  // Update merchant verification status
  // Send notifications if needed
  console.log(result.transcript);
}