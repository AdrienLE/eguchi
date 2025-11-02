#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Checking for template updates...${NC}"
echo ""

# Check if template remote exists
if ! git remote | grep -q "^template$"; then
    echo -e "${RED}❌ Template remote not found${NC}"
    echo "To add it manually:"
    echo "  git remote add template <template-repo-url>"
    exit 1
fi

# Fetch latest template changes
git fetch template

# Show current versions
echo -e "${BLUE}📋 Version Information:${NC}"
echo "  Current app: $(git log --oneline -1)"
echo "  Template: $(git log --oneline -1 template/main)"
echo ""

# Show available updates
UPDATES=$(git log --oneline HEAD..template/main)
if [ -z "$UPDATES" ]; then
    echo -e "${GREEN}✅ Your app is up to date with the template!${NC}"
    exit 0
fi

echo -e "${YELLOW}📦 Available updates:${NC}"
echo "$UPDATES"
echo ""

# Show changes summary
echo -e "${BLUE}📝 Changes summary:${NC}"
git log --oneline HEAD..template/main --grep="feat\|fix\|security\|breaking" --color=always
echo ""

read -p "Merge template updates? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔄 Applying updates...${NC}"

    # Create backup branch
    BACKUP_BRANCH="backup-before-template-update-$(date +%Y%m%d-%H%M%S)"
    git checkout -b "$BACKUP_BRANCH"
    git checkout main

    echo "Created backup branch: $BACKUP_BRANCH"

    # Attempt merge
    if git merge template/main; then
        echo -e "${GREEN}✅ Updates applied successfully!${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Important next steps:${NC}"
        echo "1. Review changes: git log --oneline $BACKUP_BRANCH..HEAD"
        echo "2. Test your app thoroughly"
        echo "3. Update dependencies: cd frontend && yarn install"
        echo "4. Run tests: yarn test"
        echo "5. If everything works, delete backup: git branch -D $BACKUP_BRANCH"
    else
        echo -e "${RED}❌ Merge conflicts detected${NC}"
        echo "Resolve conflicts manually, then:"
        echo "  git add ."
        echo "  git commit"
        echo ""
        echo "Or abort the merge:"
        echo "  git merge --abort"
        echo "  git checkout $BACKUP_BRANCH"
    fi
else
    echo -e "${YELLOW}⏭️  Updates skipped${NC}"
fi
