#!/bin/bash

# Setup script for Olocus Protocol Documentation
# This script initializes the Docusaurus documentation site

set -e

echo "🚀 Setting up Olocus Protocol Documentation..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Navigate to docs setup directory
cd docs-setup

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating directory structure..."
mkdir -p docs/getting-started
mkdir -p docs/concepts
mkdir -p docs/architecture
mkdir -p docs/data-models
mkdir -p docs/core
mkdir -p docs/extensions
mkdir -p docs/implementation
mkdir -p docs/api
mkdir -p src/pages
mkdir -p static/img

# Run initial sync
echo "🔄 Syncing documentation from Codeberg..."
cd ..
node scripts/sync-protocol-docs.js

# Build the documentation
echo "🏗️ Building documentation site..."
cd docs-setup
npm run build

# Copy to main docs folder
echo "📋 Copying built documentation..."
cd ..
rm -rf docs
cp -r docs-setup/build docs

echo "✅ Documentation setup complete!"
echo ""
echo "To run the development server:"
echo "  cd docs-setup && npm start"
echo ""
echo "To build for production:"
echo "  cd docs-setup && npm run build"
echo ""
echo "To sync latest from Codeberg:"
echo "  node scripts/sync-protocol-docs.js"
echo ""
echo "The documentation will be available at: https://olocus.com/docs/"