#!/bin/bash

# Base App Template Upgrade Script
# This script helps merge improvements from the base template into existing apps

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

show_usage() {
    echo "Usage: $0 [TEMPLATE_PATH]"
    echo ""
    echo "Example:"
    echo "  $0 ../base-app-template"
    echo "  $0 https://github.com/company/base-app-template"
}

TEMPLATE_PATH="${1:-../base-app-template}"

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
    exit 0
fi

print_step "Base App Template Upgrade"
echo "Template: $TEMPLATE_PATH"
echo ""

# Check if template exists
if [[ "$TEMPLATE_PATH" == http* ]]; then
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT

    print_step "Cloning template..."
    git clone "$TEMPLATE_PATH" "$TEMP_DIR/template"
    TEMPLATE_PATH="$TEMP_DIR/template"
elif [ ! -d "$TEMPLATE_PATH" ]; then
    print_error "Template path '$TEMPLATE_PATH' does not exist"
    exit 1
fi

# Check for critical updates
print_step "Checking for critical updates..."

UPDATES_FOUND=false

# Check for security updates in auth.py
if ! diff -q backend/auth.py "$TEMPLATE_PATH/backend/auth.py" > /dev/null 2>&1; then
    print_warning "Security updates available in backend/auth.py"
    UPDATES_FOUND=true
fi

# Check for new features
if [ -d "$TEMPLATE_PATH/frontend/lib/features" ] && [ ! -d "frontend/lib/features" ]; then
    print_warning "New feature system available"
    UPDATES_FOUND=true
fi

# Check for updated app-config.ts structure
if ! grep -q "BRANDING_CONFIG" frontend/lib/app-config.ts 2>/dev/null; then
    print_warning "Updated configuration system available"
    UPDATES_FOUND=true
fi

if [ "$UPDATES_FOUND" = false ]; then
    print_success "No critical updates found"
    exit 0
fi

echo ""
read -p "Apply updates? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Cancelled"
    exit 0
fi

# Create backup
print_step "Creating backup..."
git stash push -m "Pre-upgrade backup $(date)" --include-untracked || true

# Apply safe updates
print_step "Applying safe updates..."

# Update documentation
for doc in "BASE_APP_CUSTOMIZATION_GUIDE.md" "FEATURE_DEVELOPMENT_GUIDE.md" "TEMPLATE_UPDATE_STRATEGY.md"; do
    if [ -f "$TEMPLATE_PATH/$doc" ]; then
        cp "$TEMPLATE_PATH/$doc" ./
        print_success "Updated $doc"
    fi
done

# Update utility scripts
if [ -f "$TEMPLATE_PATH/scripts/upgrade-from-template.sh" ]; then
    cp "$TEMPLATE_PATH/scripts/upgrade-from-template.sh" scripts/
    chmod +x scripts/upgrade-from-template.sh
    print_success "Updated upgrade script"
fi

# Update core utilities (safe to replace)
for util in "frontend/lib/storage.ts" "frontend/lib/utils.ts"; do
    if [ -f "$TEMPLATE_PATH/$util" ] && [ -f "$util" ]; then
        if ! diff -q "$util" "$TEMPLATE_PATH/$util" > /dev/null 2>&1; then
            cp "$TEMPLATE_PATH/$util" "$util"
            print_success "Updated $util"
        fi
    fi
done

# Update themed components (usually safe)
for component in "ThemedText.tsx" "ThemedView.tsx" "ThemedTextInput.tsx"; do
    if [ -f "$TEMPLATE_PATH/frontend/components/$component" ]; then
        cp "$TEMPLATE_PATH/frontend/components/$component" "frontend/components/"
        print_success "Updated $component"
    fi
done

# Handle complex updates that need review
print_step "Handling files that need manual review..."

# app-config.ts - save template version for comparison
if [ -f "$TEMPLATE_PATH/frontend/lib/app-config.ts" ]; then
    cp "$TEMPLATE_PATH/frontend/lib/app-config.ts" "frontend/lib/app-config.template.ts"
    print_warning "New app-config.ts saved as app-config.template.ts - please review and merge"
fi

# backend/auth.py - critical security updates
if [ -f "$TEMPLATE_PATH/backend/auth.py" ]; then
    if ! diff -q backend/auth.py "$TEMPLATE_PATH/backend/auth.py" > /dev/null 2>&1; then
        cp "$TEMPLATE_PATH/backend/auth.py" "backend/auth.template.py"
        print_warning "Updated auth.py saved as auth.template.py - SECURITY UPDATE - please review"
    fi
fi

# Feature system - only add if doesn't exist
if [ -d "$TEMPLATE_PATH/frontend/lib/features" ] && [ ! -d "frontend/lib/features" ]; then
    cp -r "$TEMPLATE_PATH/frontend/lib/features" "frontend/lib/"
    print_success "Added new feature system"
fi

# Commit changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    git add .
    git commit -m "Template upgrade from $TEMPLATE_PATH

$(git diff --name-only HEAD~1 HEAD | sed 's/^/- /')"
    print_success "Changes committed"
fi

print_success "Upgrade complete!"
echo ""
print_warning "Manual review needed:"
echo "- frontend/lib/app-config.template.ts"
echo "- backend/auth.template.py (if exists)"
echo ""
echo "Next steps:"
echo "1. Review template files and merge changes"
echo "2. Test your app: yarn test"
echo "3. Remove .template files when done"
