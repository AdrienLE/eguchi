# New App Setup Guide

This guide walks you through creating a new app from the Base App template and configuring it for your project.

## Creating a New App

### 1. Run the Creation Script

From the base app directory:

```bash
./scripts/create-new-app.sh -n "My Awesome App" -p com.company.myapp -c "My Company"
```

**Options:**
- `-n, --name`: App name (required)
- `-p, --package`: Package name (e.g., com.company.app)
- `-d, --display`: Display name (defaults to app name)
- `-c, --company`: Company name
- `-e, --email`: Author email
- `-s, --scheme`: URL scheme (defaults to lowercase app name)
- `-t, --target`: Target directory (defaults to app name)

### 2. Navigate to Your New App

```bash
cd ../my-awesome-app  # or whatever directory you specified
```

## Essential Configuration Steps

### 🔗 Step 1: Set Your Production URL

**CRITICAL:** The template creates your app with placeholder URLs that must be replaced.

Replace all instances of `REPLACE_WITH_PROD_URL` with your actual production URL:

```bash
# Replace with your actual production URL
find . -type f \( -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.sh" -o -name "*.md" \) \
  -not -path "./node_modules/*" \
  -exec sed -i '' 's|REPLACE_WITH_PROD_URL|https://your-production-url.com|g' {} \;
```

**Example:**
```bash
find . -type f \( -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.sh" -o -name "*.md" \) \
  -not -path "./node_modules/*" \
  -exec sed -i '' 's|REPLACE_WITH_PROD_URL|https://myapp.railway.app|g' {} \;
```

This will update:
- `frontend/eas.json` - Build configuration
- `frontend/app.json` - Expo configuration
- `frontend/lib/config.ts` - App configuration
- `scripts/build-prod.sh` - Production build script
- `scripts/dev.sh` - Development script
- Documentation files

### 🔐 Step 2: Configure Authentication

1. **Set up Auth0 (or your preferred provider):**
   - Create a new Auth0 application
   - Note your Domain, Client ID, and Audience

2. **Update environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Auth0 credentials
   ```

3. **Configure Auth0 URLs:**
   In your Auth0 dashboard, add these URLs:

   **Allowed Callback URLs:**
   ```
   yourappscheme://redirect,
   http://localhost:8081,
   https://127.0.0.1:8000,
   https://your-production-url.com
   ```

   **Allowed Logout URLs:**
   ```
   yourappscheme://redirect,
   http://localhost:8081,
   https://127.0.0.1:8000,
   https://your-production-url.com
   ```

### 📱 Step 3: Update App Branding

1. **Replace app icons:**
   ```
   frontend/assets/images/icon.png
   frontend/assets/images/adaptive-icon.png
   frontend/assets/images/splash-icon.png
   frontend/assets/images/favicon.ico
   ```

2. **Customize app colors:**
   Edit `frontend/lib/app-config.ts` and modify the `UI_CONFIG.theme.colors` section.

### 🏗️ Step 4: Install Dependencies

```bash
# Frontend
cd frontend
yarn install

# Backend (from project root)
pip install -r requirements.txt
```

### 🚀 Step 5: Test Your App

```bash
# Start development server
./scripts/dev.sh ios    # or android/web
```

## Deployment Setup

### Backend Deployment

1. **Choose a hosting platform:**
   - Railway (recommended)
   - Render
   - Heroku
   - AWS/GCP/Azure

2. **Deploy your backend**
3. **Update the production URL** (if you haven't already)

### Frontend Deployment

#### Mobile Apps
```bash
# Build for iOS
./scripts/build-prod.sh ios

# Build for Android
./scripts/build-prod.sh android
```

#### Web App
The web version is served by your backend at `/` when you deploy.

## Advanced Configuration

### Feature Flags

Enable/disable features in `frontend/lib/app-config.ts`:

```typescript
export const FEATURE_FLAGS = {
  enableAuth: true,
  enableProfilePictures: true,
  enablePushNotifications: false,
  // ... more features
};
```

### Environment-Specific Configuration

The app supports three environments:
- **Development**: Local development
- **Staging**: Pre-production testing
- **Production**: Live app

Configure each in `frontend/lib/config.ts`.

### Custom Styling

Modify the theme in `frontend/lib/app-config.ts`:
- Colors
- Typography
- Spacing
- Border radius
- Layout dimensions

## Template Updates

To receive updates from the base template:

```bash
./scripts/update-from-template.sh
```

This will:
1. Fetch latest template changes
2. Show available updates
3. Merge updates (with conflict resolution if needed)
4. Create backup branches for safety

## Troubleshooting

### Common Issues

1. **"REPLACE_WITH_PROD_URL" appears in app:**
   - You forgot Step 1! Run the find/replace command above.

2. **Auth0 callback URL errors:**
   - Check that your Auth0 app has the correct callback URLs
   - Verify your URL scheme in `app.json` matches Auth0 configuration

3. **Build failures:**
   - Ensure all dependencies are installed
   - Check that your production URL is properly configured
   - Verify environment variables are set

4. **Icons not updating:**
   - Replace all icon files in `frontend/assets/images/`
   - Clear Expo cache: `npx expo start --clear`

### Getting Help

1. Check the base template documentation:
   - `BASE_APP_CUSTOMIZATION_GUIDE.md`
   - `FEATURE_DEVELOPMENT_GUIDE.md`
   - `TESTING.md`

2. Review the example configurations in `.env.example`

3. Check the template's GitHub issues/discussions

## Checklist

Before launching your app:

- [ ] Replaced all `REPLACE_WITH_PROD_URL` instances
- [ ] Configured Auth0 with correct callback URLs
- [ ] Updated app icons and branding
- [ ] Set up backend deployment
- [ ] Tested all core features
- [ ] Configured app store metadata
- [ ] Set up analytics/crash reporting (if enabled)
- [ ] Tested production builds on real devices
- [ ] Set up CI/CD pipelines (optional)

## Next Steps

1. **Customize features** based on your app's needs
2. **Add your business logic** in the appropriate feature modules
3. **Design your screens** using the provided components
4. **Set up backend API endpoints** for your specific use case
5. **Configure app store listings** when ready to publish

Remember: This template provides a solid foundation, but you'll need to customize it for your specific app requirements!
