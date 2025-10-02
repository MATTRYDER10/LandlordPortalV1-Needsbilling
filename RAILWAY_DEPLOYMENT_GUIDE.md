# Railway Deployment Guide for PropertyGoose

## Prerequisites
- GitHub repository pushed with latest changes
- Supabase project set up with database tables
- Railway account (free tier works)

## Step 1: Push to GitHub

```bash
cd /Users/craigryder/Documents/GitHub/PropertyGooseApp

# Add all changes
git add .

# Commit
git commit -m "Fix TypeScript errors and add Railway deployment config"

# Push
git push origin main
```

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your **PropertyGooseApp** repository
5. Railway will detect it's a monorepo

## Step 3: Configure Backend Service

### Create Backend Service:
1. In Railway project, click **"+ New"** → **"Service"**
2. Select your GitHub repo again
3. Configure:
   - **Name**: `propertygoose-backend`
   - **Root Directory**: `/backend`
   - Railway will auto-detect Node.js

### Backend Environment Variables:

Click on the backend service → **Variables** tab → Add these:

```bash
# Supabase Configuration
SUPABASE_URL=https://spaetpdmlqfygsxiawul.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Port (Railway provides this automatically, but set fallback)
PORT=3001

# Node Environment
NODE_ENV=production
```

**Where to find your keys:**
- Go to Supabase Dashboard → Project Settings → API
- Copy the `service_role` key (NOT the anon key)

### Backend Settings:
- **Build Command**: (auto-detected) `npm run build`
- **Start Command**: (auto-detected) `npm start`
- Railway will assign a public URL like: `https://propertygoose-backend-production.up.railway.app`

**Copy this backend URL - you'll need it for the frontend!**

## Step 4: Configure Frontend Service

### Create Frontend Service:
1. Click **"+ New"** → **"Service"**
2. Select your GitHub repo
3. Configure:
   - **Name**: `propertygoose-frontend`
   - **Root Directory**: `/frontend`

### Frontend Environment Variables:

Click on the frontend service → **Variables** tab → Add these:

```bash
# Backend API URL (use the URL from your backend service)
VITE_API_URL=https://propertygoose-backend-production.up.railway.app

# Supabase Configuration
VITE_SUPABASE_URL=https://spaetpdmlqfygsxiawul.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Node Environment
NODE_ENV=production
```

**Where to find your keys:**
- Go to Supabase Dashboard → Project Settings → API
- Copy the `anon` `public` key

### Frontend Settings:
- **Build Command**: `npm run build`
- **Start Command**: `npm run preview -- --host 0.0.0.0 --port $PORT`

## Step 5: Configure Supabase CORS

Your frontend will have a Railway URL like: `https://propertygoose-frontend-production.up.railway.app`

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Add to **Site URL**: `https://propertygoose-frontend-production.up.railway.app`
3. Add to **Redirect URLs**:
   - `https://propertygoose-frontend-production.up.railway.app/**`
   - `https://propertygoose-frontend-production.up.railway.app/reset-password`

## Step 6: Update Backend CORS

The backend needs to allow requests from your frontend URL.

1. Go to your backend service in Railway
2. Add environment variable:
```bash
FRONTEND_URL=https://propertygoose-frontend-production.up.railway.app
```

3. Update `backend/src/server.ts` to use this:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
```

## Step 7: Deploy!

1. Both services should auto-deploy after configuration
2. Check logs in Railway dashboard for any errors
3. Visit your frontend URL to test

## Common Issues & Solutions

### Issue: "Failed to fetch"
- **Solution**: Check CORS settings in both backend and Supabase

### Issue: Backend crashes on startup
- **Solution**: Verify all environment variables are set correctly
- Check Railway logs for specific error messages

### Issue: Frontend shows wrong API URL
- **Solution**: Rebuild frontend with correct `VITE_API_URL`
- Railway → Frontend Service → Deployments → Redeploy

### Issue: Database connection fails
- **Solution**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Make sure you're using the SERVICE ROLE key for backend (not anon key)

## Monitoring

### Check Logs:
- Railway Dashboard → Select Service → **Logs** tab
- View real-time logs for debugging

### Check Metrics:
- Railway Dashboard → Select Service → **Metrics** tab
- Monitor CPU, memory, and request stats

## Updating Your App

Railway auto-deploys on every push to `main`:

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Railway automatically deploys!
```

## Cost Estimate

Railway Free Tier includes:
- $5 free credit per month
- Unlimited projects
- Both services should fit within free tier for development

## Final Checklist

- [ ] Backend deployed and running
- [ ] Frontend deployed and running
- [ ] Environment variables configured for both services
- [ ] Supabase CORS configured
- [ ] Backend CORS configured
- [ ] Database trigger working (signup test)
- [ ] Both URLs are HTTPS
- [ ] Can create an account
- [ ] Can log in
- [ ] Can create references

## Your URLs

After deployment, you'll have:

- **Frontend**: `https://propertygoose-frontend-production.up.railway.app`
- **Backend**: `https://propertygoose-backend-production.up.railway.app`

Save these URLs for future reference!
