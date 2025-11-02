# Railway Deployment Guide

This guide will help you deploy your Base App (backend API + frontend static site) to Railway.

## 🚀 Quick Overview

Your app will be deployed as **a single Railway service**:
- **FastAPI Backend** - Serves both API endpoints AND the built frontend as static files
- **Frontend** - Built during deployment and served by FastAPI at the root path (`/`)

## 📋 Prerequisites

- Railway account (free tier available)
- Your app pushed to a Git repository (GitHub, GitLab, or Bitbucket)
- Environment variables configured

## 🔧 Single Service Deployment

### Step 1: Create Railway Service

1. **Login to Railway**: https://railway.app
2. **Create New Project**: Click "New Project"
3. **Deploy from GitHub**: Select "Deploy from GitHub repo"
4. **Select Repository**: Choose your base app repository
5. **Configure Service**:
   - **Service Name**: `your-app` (or any name you prefer)
   - **Build Path**: Leave empty (root directory)
   - **Start Command**: Will be auto-detected from `railway.json`

Railway will automatically:
- Use Nixpacks with a virtual environment to avoid permission issues
- Install Python dependencies in an isolated virtual environment
- Install frontend dependencies and build the React app
- Start the FastAPI server which serves both API and frontend

### Step 2: Configure Environment Variables

In your Railway service, add these environment variables:

#### Required Variables
```bash
# Database (Railway will auto-provide PostgreSQL if you add it)
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Auth0 Configuration (if using authentication)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-identifier
AUTH0_CLIENT_ID=your-client-id

# AWS S3 (if using file uploads)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# OpenAI (if using AI features)
OPENAI_API_KEY=your-openai-key

# Frontend Configuration (for build process)
EXPO_PUBLIC_ENVIRONMENT=production

# Environment
RAILWAY_ENVIRONMENT=production
```

**Important**: The frontend environment variables (like `EXPO_PUBLIC_API_URL`) should point to the **same Railway service URL** since the backend serves the frontend.

### Step 3: Add Database (Optional)

1. **Add PostgreSQL**: In your project, click "Add Service" → "Database" → "PostgreSQL"
2. **Environment Variables**: Railway will automatically set `DATABASE_URL`
3. **Update Code**: Modify `backend/database.py` to use PostgreSQL instead of SQLite:

```python
# In backend/database.py, replace SQLite with:
import os
from sqlalchemy import create_engine

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL or "sqlite:///./app.db")
```

### Step 4: Deploy Your App

1. **Deploy**: Railway will automatically deploy when you push to your repo
2. **Check Build Logs**: Monitor both frontend build and backend startup
3. **Test Health**: Visit `https://your-service.railway.app/health`
4. **Test Frontend**: Visit `https://your-service.railway.app/` (root URL)
5. **Test API**: Visit `https://your-service.railway.app/api/` endpoints

## 🔗 Custom Domains (Optional)

### Add Custom Domain
1. **Go to Settings**: In your Railway service settings
2. **Add Domain**: Click "Custom Domain"
3. **Configure**: Add `yourdomain.com` or `app.yourdomain.com`
4. **Update Environment**: Update `EXPO_PUBLIC_API_URL` to use your custom domain

## 🔒 Auth0 Configuration

Update your Auth0 application settings:

### Backend API (Machine to Machine)
- **Allowed Callback URLs**: Not needed
- **Allowed Web Origins**: Your Railway service domain
- **Allowed Origins (CORS)**: Your Railway service domain

### Frontend SPA
- **Allowed Callback URLs**:
  - `https://your-service.railway.app/`
  - `https://yourdomain.com/` (if using custom domain)
- **Allowed Logout URLs**: Same as callback URLs
- **Allowed Web Origins**: Same as callback URLs

## 📊 Database Migration

If switching from SQLite to PostgreSQL:

### Option 1: Fresh Start
Just deploy - tables will be created automatically.

### Option 2: Migrate Data
1. **Export SQLite**: `sqlite3 app.db .dump > backup.sql`
2. **Convert to PostgreSQL**: Use tools like `sqlite3-to-postgres`
3. **Import**: Connect to Railway PostgreSQL and import

## 📁 File Structure for Railway

Your repository should have this structure:
```
your-app/
├── nixpacks.toml           # Nixpacks configuration with virtual environment
├── railway.json            # Railway deployment config
├── requirements.txt        # Python dependencies
├── backend/                # Backend code
│   ├── main.py
│   └── ...
├── frontend/               # Frontend code
│   ├── package.json
│   ├── yarn.lock
│   ├── app.json
│   └── ...
```

## 🚨 Troubleshooting

### Backend Issues

**Build Fails**
- Check `requirements.txt` has all dependencies
- Verify Python version compatibility in logs

**Health Check Fails**
- Ensure `/health` endpoint returns 200
- Check `railway.json` healthcheck path

**Database Connection Issues**
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running

### Frontend Issues

**Build Fails**
- Check `NODE_ENV` is not set to development
- Verify all dependencies in `package.json`
- Check `frontend/nixpacks.toml` configuration

**API Calls Fail**
- Verify `EXPO_PUBLIC_API_URL` points to your backend
- Check CORS settings in FastAPI
- Ensure Auth0 configuration matches

**Static Files Not Found**
- Verify build outputs to `dist/` directory
- Check serve command is correct: `npx serve -s dist -l $PORT`

## 💡 Railway Tips

### Cost Optimization
- **Free Tier**: $5/month credit, enough for small apps
- **Sleep Mode**: Services sleep after inactivity (free tier)
- **Upgrade**: Pay-as-you-use for production apps

### Monitoring
- **Logs**: View real-time logs in Railway dashboard
- **Metrics**: Monitor CPU, memory, network usage
- **Alerts**: Set up notifications for downtime

### Environment Management
- **Staging**: Create separate Railway project for staging
- **Variables**: Use Railway's environment variable management
- **Secrets**: Store sensitive data in Railway variables, not code

## 🔄 Continuous Deployment

Railway automatically deploys when you push to your connected Git branch:

1. **Push Code**: `git push origin main`
2. **Auto Deploy**: Railway detects changes and rebuilds
3. **Health Check**: Railway checks health endpoints
4. **Live**: New version goes live automatically

### Branch Deployments
- **Main Branch**: Production deployment
- **Staging Branch**: Connect staging Railway project to staging branch
- **Preview**: Create temporary deployments for feature branches

## 📝 Post-Deployment Checklist

### Backend
- [ ] `/health` endpoint returns 200
- [ ] Database connection working
- [ ] Auth0 JWT validation working
- [ ] File uploads working (if using S3)
- [ ] All API endpoints accessible

### Frontend
- [ ] App loads correctly
- [ ] Authentication flow works
- [ ] API calls succeed
- [ ] No console errors
- [ ] Mobile responsive design works

### Production
- [ ] Custom domains configured (if using)
- [ ] SSL certificates active
- [ ] Auth0 URLs updated
- [ ] Environment variables secured
- [ ] Monitoring/alerts set up

## 🆘 Getting Help

### Railway Support
- **Documentation**: https://docs.railway.app
- **Discord**: Railway Community Discord
- **Support**: help@railway.app

### Base App Template
- **Issues**: Create issue in your base template repository
- **Documentation**: Check `BASE_APP_CUSTOMIZATION_GUIDE.md`

---

🎉 **You're Done!** Your Base App is now running on Railway with automatic deployments, monitoring, and scaling.
