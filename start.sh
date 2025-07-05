#!/bin/bash

# Debug: Show current directory and its contents
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

# Debug: Show node_modules contents
echo "node_modules contents:"
ls -la node_modules

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Set permissions for uploads directory
chmod 777 uploads

# Debug: Show environment
echo "Node version:"
node --version
echo "NPM version:"
npm --version

# Start the backend server
node server.js 