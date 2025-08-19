# WeChat Pay Locations Finder

A web application to find businesses that accept WeChat Pay, featuring automatic syncing of major chain stores like 99 Ranch Market and H Mart, plus manual location additions.

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + PostGIS)
- **Maps**: Google Maps JavaScript API
- **Data Source**: Google Places API + Manual entries
- **Deployment**: Vercel (frontend) + Supabase (database)

## Features

- 🗺️ Interactive map showing all WeChat Pay accepting businesses
- 🏪 Automatic syncing of major chain stores (99 Ranch, H Mart)
- ➕ Manual addition of local businesses
- 📍 Geospatial search (by map bounds or nearby)
- 🔄 Periodic data updates via cron jobs
- 📱 Responsive design

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo>
cd wechat-pay-locations
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the migration files:
   - Run `sql/001_create_merchants_table.sql`
   - Run `sql/002_create_functions.sql`
3. Get your project URL and anon key from Settings > API

### 3. Set Up Google APIs

1. Go to Google Cloud Console
2. Enable these APIs:
   - Maps JavaScript API
   - Places API
3. Create API keys:
   - One for frontend (Maps JavaScript API)
   - One for backend (Places API)
4. Restrict the keys appropriately for security

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Fill in:
- Supabase URL and anon key
- Google Maps and Places API keys
- A random secret for cron job security

### 5. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see the app.

## Data Management

### Initial Data

The database is seeded with a few sample locations. You can add more manually through the API.

### Automatic Syncing

Set up periodic syncing of chain stores:

1. **Manual sync** (for testing):
```bash
npm run sync-stores
```

2. **Automatic sync** (in production):
   - Use Vercel Cron or GitHub Actions
   - Call `POST /api/cron/sync-stores` with Authorization header
   - Recommended: weekly sync to stay updated

### Adding Manual Locations

```bash
curl -X POST http://localhost:3000/api/places \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Restaurant",
    "address": "123 Main St, City, CA",
    "lat": 37.7749,
    "lng": -122.4194,
    "payment_methods": ["wechat_pay"]
  }'
```

## API Endpoints

- `GET /api/places?bbox=minLng,minLat,maxLng,maxLat` - Get places in map bounds
- `GET /api/places?lat=37.7&lng=-122.4&radius=5000` - Get places nearby
- `POST /api/places` - Add manual location
- `POST /api/cron/sync-stores` - Trigger chain store sync (requires auth)

## Database Schema

The `merchants` table stores:
- Location data (name, address, coordinates)
- Source tracking (manual vs Google Places API)
- Chain information (99 Ranch, H Mart, etc.)
- Business details (payment methods, hours)
- Sync metadata (last updated, active status)

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Database (Supabase)

Already hosted - just run the SQL migrations in your Supabase project.

### Periodic Sync

**Option A: Vercel Cron**
```javascript
// vercel.json
{
  "crons": [{
    "path": "/api/cron/sync-stores",
    "schedule": "0 6 * * 1"  // Weekly Monday 6AM
  }]
}
```

**Option B: GitHub Actions**
See `.github/workflows/sync-stores.yml` (create this file)

## Contributing

1. Add new chain configurations in `lib/google-places.ts`
2. Update the database schema in `sql/` directory
3. Add new manual locations via the API or database directly

## Cost Estimation

- Google Places API: ~$1/month for weekly syncing of major chains
- Supabase: Free tier supports this use case
- Vercel: Free tier sufficient for most usage
- Google Maps: Pay per load, reasonable for moderate traffic

Total estimated cost: $1-5/month for a personal project.
