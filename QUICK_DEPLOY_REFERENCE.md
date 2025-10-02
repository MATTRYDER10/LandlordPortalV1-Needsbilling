# Quick Railway Deploy Reference

## 🚀 Quick Deploy Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Deploy to Railway"
git push origin main
```

### 2. Railway Setup
1. New Project → Deploy from GitHub → Select PropertyGooseApp
2. Create **2 services** from same repo

### 3. Backend Service Config

**Settings:**
- Root Directory: `/backend`
- Build: `npm run build`
- Start: `npm start`

**Environment Variables:**
```bash
SUPABASE_URL=https://spaetpdmlqfygsxiawul.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
PORT=3001
NODE_ENV=production
FRONTEND_URL=<will-add-after-frontend-deploys>
```

### 4. Frontend Service Config

**Settings:**
- Root Directory: `/frontend`
- Build: `npm run build`
- Start: `npm run preview -- --host 0.0.0.0 --port $PORT`

**Environment Variables:**
```bash
VITE_API_URL=<backend-railway-url>
VITE_SUPABASE_URL=https://spaetpdmlqfygsxiawul.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
NODE_ENV=production
```

### 5. Update FRONTEND_URL
After frontend deploys, copy its URL and add to backend env vars:
```bash
FRONTEND_URL=https://propertygoose-frontend-production.up.railway.app
```

### 6. Supabase CORS Update
Add to Supabase Auth → URL Configuration:
- Site URL: `<frontend-railway-url>`
- Redirect URLs: `<frontend-railway-url>/**`

## 📋 Supabase Keys Location
Dashboard → Project Settings → API
- **anon/public** key → Frontend
- **service_role** key → Backend (keep secret!)

## ✅ Test Checklist
- [ ] Backend health check: `<backend-url>/health`
- [ ] Frontend loads
- [ ] Can register new account
- [ ] Can login
- [ ] Can create reference

## 🔧 Troubleshooting

**CORS Error:**
- Check FRONTEND_URL in backend
- Check Supabase URL configuration

**500 on Signup:**
- Check database trigger is installed
- Run `fixed-signup-trigger-v3.sql` in Supabase

**Build Fails:**
- Check Railway logs
- Verify package.json scripts
- Check node version (Railway uses Node 18+)

## 📱 Your URLs

After deploy, save these:
- **Frontend**: `https://propertygoose-frontend-production.up.railway.app`
- **Backend**: `https://propertygoose-backend-production.up.railway.app`
