# Template Update Strategy

When you improve the base template, you'll want to port those changes to existing apps. Here are several strategies, from simple to sophisticated.

## 🎯 **The Challenge**

Once you create apps from the template, they become independent. When you:
- Fix bugs in the base template
- Add new features
- Improve security
- Update dependencies

You need a way to propagate these changes to existing apps.

## 📋 **Strategy 1: Manual Update Checklist (Simple)**

Create a checklist of common updates and manually apply them.

### Implementation

Create `TEMPLATE_UPDATES.md` in the base template:

```markdown
# Template Updates Log

## v1.1.0 - 2024-01-15
### Security Fix: JWT Token Validation
**Files to update in existing apps:**
- `backend/auth.py:45-52` - Updated token validation logic
- `frontend/lib/api.ts:23` - Added token refresh handling

**Steps:**
1. Copy the new `validateToken` function from base template
2. Update environment variables to include `JWT_REFRESH_THRESHOLD`
3. Test authentication flow

### New Feature: Push Notifications
**Files to update:**
- `frontend/lib/features/notifications/` - New notification system
- `frontend/lib/app-config.ts` - Add notification feature flags
- `.env.example` - Add notification service variables

**Steps:**
1. Copy notification feature folder
2. Update app-config.ts with new feature flags
3. Install new dependencies: `expo-notifications`
```

### Usage
```bash
# In your existing app
git log --oneline base-template-v1.0.0..base-template-v1.1.0
# Review TEMPLATE_UPDATES.md
# Apply changes manually
```

## 📋 **Strategy 2: Git-Based Updates (Intermediate)**

Use git to track and merge template changes.

### Implementation

1. **Keep template as upstream remote:**
```bash
# In your app directory
git remote add template https://github.com/yourorg/base-app-template
git fetch template

# Create a template tracking branch
git checkout -b template-updates template/main
git checkout main
```

2. **Update script:**
```bash
#!/bin/bash
# scripts/update-from-template.sh

echo "Fetching latest template changes..."
git fetch template

echo "Current template version:"
git log --oneline -1 template/main

echo "Changes since last update:"
git log --oneline HEAD..template/main

read -p "Apply template updates? (y/N): " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git merge template/main
    echo "Template updates applied! Review conflicts and test thoroughly."
fi
```

### Benefits
✅ See exactly what changed
✅ Git handles merging automatically
✅ Can revert if something breaks

### Drawbacks
❌ Merge conflicts on customized files
❌ May pull unwanted changes
❌ Requires git expertise

## 📋 **Strategy 3: Modular Update System (Advanced)**

Create an update system that can selectively apply changes.

### Implementation

Create `scripts/template-updater.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TemplateUpdater {
  constructor(templatePath, targetPath) {
    this.templatePath = templatePath;
    this.targetPath = targetPath;
    this.updates = this.loadUpdates();
  }

  loadUpdates() {
    const updatesFile = path.join(this.templatePath, 'template-updates.json');
    if (fs.existsSync(updatesFile)) {
      return JSON.parse(fs.readFileSync(updatesFile, 'utf8'));
    }
    return [];
  }

  async applyUpdate(update) {
    console.log(`Applying: ${update.name}`);

    for (const action of update.actions) {
      switch (action.type) {
        case 'copy-file':
          this.copyFile(action.source, action.target);
          break;
        case 'update-config':
          this.updateConfig(action.file, action.changes);
          break;
        case 'run-script':
          this.runScript(action.command);
          break;
        case 'install-deps':
          this.installDependencies(action.dependencies);
          break;
      }
    }
  }

  copyFile(source, target) {
    const sourcePath = path.join(this.templatePath, source);
    const targetPath = path.join(this.targetPath, target);

    if (fs.existsSync(targetPath)) {
      console.log(`  Backing up existing ${target}`);
      fs.copyFileSync(targetPath, `${targetPath}.backup`);
    }

    fs.copyFileSync(sourcePath, targetPath);
    console.log(`  ✅ Copied ${source} -> ${target}`);
  }

  updateConfig(file, changes) {
    const filePath = path.join(this.targetPath, file);
    let content = fs.readFileSync(filePath, 'utf8');

    for (const [key, value] of Object.entries(changes)) {
      const regex = new RegExp(`(${key}\\s*[:=]\\s*)([^,\\n}]+)`, 'g');
      content = content.replace(regex, `$1${JSON.stringify(value)}`);
    }

    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated config in ${file}`);
  }

  installDependencies(deps) {
    console.log(`  Installing dependencies: ${deps.join(', ')}`);
    execSync(`npm install ${deps.join(' ')}`, {
      cwd: path.join(this.targetPath, 'frontend'),
      stdio: 'inherit'
    });
  }

  runScript(command) {
    console.log(`  Running: ${command}`);
    execSync(command, { cwd: this.targetPath, stdio: 'inherit' });
  }
}

// Usage
const updater = new TemplateUpdater(
  '../base-app-template',
  '.'
);

// Apply specific update
const updateId = process.argv[2];
if (updateId) {
  const update = updater.updates.find(u => u.id === updateId);
  if (update) {
    updater.applyUpdate(update);
  } else {
    console.log('Update not found');
  }
} else {
  console.log('Available updates:');
  updater.updates.forEach(u => {
    console.log(`  ${u.id}: ${u.name}`);
  });
}
```

Create `template-updates.json` in base template:

```json
{
  "updates": [
    {
      "id": "auth-security-fix-v1.1.0",
      "name": "JWT Security Fix",
      "version": "1.1.0",
      "description": "Fixes JWT token validation vulnerability",
      "actions": [
        {
          "type": "copy-file",
          "source": "backend/auth.py",
          "target": "backend/auth.py"
        },
        {
          "type": "update-config",
          "file": "frontend/lib/app-config.ts",
          "changes": {
            "JWT_REFRESH_THRESHOLD": 300000
          }
        },
        {
          "type": "run-script",
          "command": "python -m pytest tests/test_auth.py"
        }
      ]
    },
    {
      "id": "push-notifications-v1.2.0",
      "name": "Add Push Notifications Feature",
      "version": "1.2.0",
      "description": "Adds push notification support",
      "actions": [
        {
          "type": "copy-file",
          "source": "frontend/lib/features/notifications",
          "target": "frontend/lib/features/notifications"
        },
        {
          "type": "install-deps",
          "dependencies": ["expo-notifications", "@react-native-async-storage/async-storage"]
        },
        {
          "type": "update-config",
          "file": "frontend/lib/app-config.ts",
          "changes": {
            "enablePushNotifications": false
          }
        }
      ]
    }
  ]
}
```

### Usage
```bash
# See available updates
./scripts/template-updater.js

# Apply specific update
./scripts/template-updater.js auth-security-fix-v1.1.0

# Apply all updates for a version
./scripts/template-updater.js --version 1.2.0
```

## 📋 **Strategy 4: Package-Based Updates (Professional)**

Create npm packages for reusable parts of the template.

### Implementation

1. **Extract core functionality into packages:**
```bash
# Create packages
mkdir packages
cd packages

# Core configuration package
npm init @yourorg/base-app-config
# Feature system package
npm init @yourorg/base-app-features
# Theme system package
npm init @yourorg/base-app-theme
```

2. **Use packages in template:**
```json
{
  "dependencies": {
    "@yourorg/base-app-config": "^1.0.0",
    "@yourorg/base-app-features": "^1.0.0",
    "@yourorg/base-app-theme": "^1.0.0"
  }
}
```

3. **Update apps by updating packages:**
```bash
npm update @yourorg/base-app-config
npm update @yourorg/base-app-features
```

### Benefits
✅ Standard npm update workflow
✅ Semantic versioning
✅ Can pick which updates to apply
✅ Professional approach

### Drawbacks
❌ More complex setup
❌ Need to maintain separate packages
❌ May over-abstract simple concepts

## 🎯 **Recommended Approach**

**For Small Teams/Personal Projects:**
Use **Strategy 2 (Git-based)** with manual conflict resolution.

**For Medium Teams:**
Use **Strategy 3 (Modular Updates)** with selective update application.

**For Large Organizations:**
Use **Strategy 4 (Package-based)** with proper versioning and CI/CD.

## 🛠️ **Implementation in Base Template**

Let me add the Git-based approach to the creation script:

### Modified Creation Script
```bash
# Add this to create-new-app.sh
print_step "Setting up template updates..."
git remote add template "$(git remote get-url origin)"
git branch template-tracking template/main

# Create update script
cat > scripts/update-from-template.sh << 'EOF'
#!/bin/bash
echo "🔄 Checking for template updates..."
git fetch template
git log --oneline HEAD..template/main --grep="feat\\|fix\\|security"
echo ""
read -p "Merge template updates? (y/N): " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git merge template/main
    echo "✅ Updates applied! Please test thoroughly."
fi
EOF
chmod +x scripts/update-from-template.sh
```

### Version Tracking
Add to generated app's README:
```markdown
## 📦 Template Version
This app was created from Base App Template v1.0.0

### Updating from Template
```bash
./scripts/update-from-template.sh
```

Check `CHANGELOG.md` in the base template for breaking changes.
```

## 📝 **Best Practices**

1. **Semantic Versioning**: Use semver for template versions
2. **Changelog**: Maintain detailed changelog with migration notes
3. **Breaking Changes**: Clearly mark breaking changes
4. **Test Updates**: Always test updates in a separate branch
5. **Backup First**: Create backups before applying updates
6. **Feature Flags**: Use feature flags for new functionality
7. **Documentation**: Document all update procedures

This gives you multiple options depending on your team size and complexity needs! 🚀
