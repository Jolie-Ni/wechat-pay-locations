import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { MerchantService } from '../../../lib/supabase';
import { CreateMerchantRequest, BoundingBox } from '../../../types/merchant';

const createMerchantSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  chain_name: z.string().optional(),
  payment_methods: z.array(z.string()).default(['wechat_pay'])
});

const getBoundsSchema = z.object({
  bbox: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/),
  chain: z.string().optional()
});

const getNearbySchema = z.object({
  lat: z.string().transform(Number),
  lng: z.string().transform(Number),
  radius: z.string().transform(Number).default('5000')
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  
  if (req.method === 'GET') {
    try {
      const { bbox, lat, lng, radius, chain } = req.query;
      
      if (bbox) {
        // Get places within bounding box (for map viewport)
        const validation = getBoundsSchema.safeParse({ bbox, chain });
        if (!validation.success) {
          return res.status(400).json({ error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' });
        }
        
        const [minLng, minLat, maxLng, maxLat] = validation.data.bbox.split(',').map(Number);
        const boundingBox: BoundingBox = { minLng, minLat, maxLng, maxLat };
        
        const merchants = await MerchantService.getMerchantsInBounds(
          boundingBox,
          validation.data.chain
        );
        
        return res.status(200).json({ places: merchants });
        
      } else if (lat && lng) {
        // Get places near a point
        const validation = getNearbySchema.safeParse({ lat, lng, radius });
        if (!validation.success) {
          return res.status(400).json({ error: 'Invalid coordinates' });
        }
        
        const merchants = await MerchantService.getMerchantsNearby(
          validation.data.lat,
          validation.data.lng,
          validation.data.radius
        );
        
        return res.status(200).json({ places: merchants });
        
      } else {
        return res.status(400).json({ 
          error: 'Either bbox or lat/lng parameters are required' 
        });
      }
      
    } catch (error) {
      console.error('Error fetching places:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch places' 
      });
    }
  }
  
  if (req.method === 'POST') {
    try {
      // Create a new manual merchant entry
      const validation = createMerchantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid merchant data',
          details: validation.error.errors
        });
      }
      
      const merchant = await MerchantService.createMerchant(validation.data);
      
      return res.status(201).json({ 
        success: true,
        merchant 
      });
      
    } catch (error) {
      console.error('Error creating merchant:', error);
      return res.status(500).json({ 
        error: 'Failed to create merchant' 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
