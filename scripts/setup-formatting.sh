#!/bin/bash

# Setup script for formatting tools
set -e

echo "🔧 Setting up formatting tools..."

# Install Python dependencies
echo "📦 Installing Python formatting tools..."
pip install black pre-commit

# Install frontend dependencies
echo "📦 Installing frontend formatting tools..."
cd frontend
yarn install
cd ..

# Install pre-commit hooks
echo "🪝 Installing pre-commit hooks..."
pre-commit install

# Run initial formatting
echo "🎨 Running initial formatting..."
echo "  - Formatting Python files with Black..."
black backend/ scripts/ tests/ --check --diff || black backend/ scripts/ tests/

echo "  - Formatting frontend files with Prettier..."
cd frontend
yarn format
cd ..

echo "✅ Formatting setup complete!"
echo ""
echo "📝 Available commands:"
echo "  Python:"
echo "    black backend/ scripts/ tests/     # Format Python files"
echo "    black --check backend/             # Check Python formatting"
echo ""
echo "  Frontend:"
echo "    cd frontend && yarn format         # Format JS/TS files"
echo "    cd frontend && yarn format:check   # Check JS/TS formatting"
echo ""
echo "  Pre-commit hooks will now run automatically on every commit!"
