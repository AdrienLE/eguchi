#!/bin/bash

# Railway Deployment Helper Script
# This script helps prepare your app for Railway deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo -e "${BLUE}🚂 Railway Deployment Helper${NC}"
echo "This script will help prepare your app for Railway deployment."
echo ""

# Check if we're in the right directory
if [ ! -f "railway.json" ] || [ ! -f "requirements.txt" ]; then
    print_error "This doesn't appear to be a Base App directory"
    print_error "Make sure you're in the root directory with railway.json and requirements.txt"
    exit 1
fi

# Check if git repo exists
if [ ! -d ".git" ]; then
    print_error "This directory is not a git repository"
    print_error "Initialize git and push to GitHub/GitLab before deploying to Railway"
    exit 1
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    print_warning "Railway CLI not found. Install it with:"
    echo "npm install -g @railway/cli"
    echo "or visit: https://docs.railway.app/cli/installation"
    echo ""
    read -p "Continue without Railway CLI? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_step "Checking project configuration..."

# Check for required environment variables
print_step "Checking environment configuration..."

if [ ! -f ".env.example" ]; then
    print_warning "No .env.example file found"
else
    print_success "Environment template found"
fi

# Check frontend build configuration
if [ ! -f "frontend/package.json" ]; then
    print_error "Frontend package.json not found"
    exit 1
fi

if ! grep -q "build:production" frontend/package.json; then
    print_error "Frontend build:production script not found in package.json"
    exit 1
fi

print_success "Frontend build configuration OK"

# Check backend health endpoint
if ! grep -q "/health" backend/main.py; then
    print_error "Health endpoint not found in backend/main.py"
    print_error "Railway needs a health check endpoint"
    exit 1
fi

print_success "Backend health endpoint found"

# Test frontend build
print_step "Testing frontend build..."
cd frontend

if [ ! -f "yarn.lock" ]; then
    print_warning "No yarn.lock found, installing dependencies..."
    yarn install
fi

print_step "Building frontend for production..."
if ! yarn build:production; then
    print_error "Frontend build failed"
    print_error "Fix build errors before deploying"
    exit 1
fi

print_success "Frontend build successful"
cd ..

print_step "Pre-deployment checklist:"
echo ""

# Interactive checklist
checklist_items=(
    "Environment variables configured in .env.local"
    "Auth0 application created and configured"
    "AWS S3 bucket created (if using file uploads)"
    "OpenAI API key obtained (if using AI features)"
    "Code pushed to GitHub/GitLab/Bitbucket"
    "Database migration plan ready (if switching from SQLite)"
)

all_checked=true
for item in "${checklist_items[@]}"; do
    read -p "✓ $item (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        all_checked=false
    fi
done

if [ "$all_checked" = false ]; then
    print_warning "Complete the checklist items before deploying"
    exit 1
fi

print_success "Pre-deployment checks complete!"
echo ""

print_step "Next steps for Railway deployment:"
echo ""
echo "1. 🚂 Create Railway Project:"
echo "   - Go to https://railway.app"
echo "   - Click 'New Project' → 'Deploy from GitHub repo'"
echo "   - Select your repository"
echo ""

echo "2. 🔧 Configure Single Service:"
echo "   - Service name: your-app (or any name)"
echo "   - Root directory: leave empty"
echo "   - Railway will automatically:"
echo "     • Install Python & Node.js dependencies"
echo "     • Build frontend with yarn build:production"
echo "     • Start FastAPI server serving both API and frontend"
echo ""

echo "3. ⚙️ Add Environment Variables:"
echo "   - Add all variables from .env.example"
echo "   - EXPO_PUBLIC_API_URL: same as your Railway service URL"
echo "   - Add PostgreSQL database (optional)"
echo ""

echo "4. 🔒 Configure Auth0:"
echo "   - Update callback URLs with Railway service domain"
echo "   - Add CORS origins for Railway service domain"
echo ""

echo "5. 🌍 Optional - Custom Domain:"
echo "   - yourdomain.com → Your Railway service"
echo "   - Update EXPO_PUBLIC_API_URL to match"
echo ""

print_success "Ready for Railway deployment!"
echo ""
echo -e "${BLUE}📖 Full guide: RAILWAY_DEPLOYMENT_GUIDE.md${NC}"
echo -e "${BLUE}🔧 Template docs: BASE_APP_CUSTOMIZATION_GUIDE.md${NC}"

# If Railway CLI is available, offer to create project
if command -v railway &> /dev/null; then
    echo ""
    read -p "Create Railway project now with CLI? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Creating Railway project..."
        railway login
        railway project new
        print_success "Railway project created! Continue setup in the Railway dashboard."
    fi
fi
