# Code Formatting Setup

This project uses aggressive code formatting to maintain consistent code style:

- **Python**: [Black](https://black.readthedocs.io/) (100 character line length)
- **JavaScript/TypeScript**: [Prettier](https://prettier.io/) (100 character line width)

## Quick Setup

Run the setup script to install and configure everything:

```bash
./scripts/setup-formatting.sh
```

This will:
1. Install Black and pre-commit for Python
2. Install Prettier for frontend
3. Set up pre-commit hooks to run formatting automatically
4. Run initial formatting on all files

## Manual Setup

### Python Dependencies
```bash
pip install black pre-commit
```

### Frontend Dependencies
```bash
cd frontend
yarn install  # Prettier is in devDependencies
```

### Pre-commit Hooks
```bash
pre-commit install
```

## Usage

### Format Everything
```bash
# Format all code (Python + Frontend)
npm run format

# Check formatting without changes
npm run format:check
```

### Format Python Only
```bash
# Format Python files
black backend/ scripts/ tests/
npm run format:python

# Check Python formatting
black --check backend/ scripts/ tests/
```

### Format Frontend Only
```bash
# Format JS/TS files
cd frontend && yarn format
npm run format:frontend

# Check frontend formatting
cd frontend && yarn format:check
```

## Automatic Formatting

Once set up, formatting runs automatically:

- **On commit**: Pre-commit hooks format staged files
- **In IDE**: Configure your editor to run formatters on save

## Configuration

### Black (Python)
Configuration in `pyproject.toml`:
```toml
[tool.black]
line-length = 100
target-version = ['py311']
```

### Prettier (JS/TS)
Configuration in `frontend/.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Pre-commit
Configuration in `.pre-commit-config.yaml` - runs Black and Prettier automatically on commit.

## IDE Integration

### VS Code
Install extensions:
- Python: Black Formatter
- JS/TS: Prettier - Code formatter

Add to `settings.json`:
```json
{
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```
