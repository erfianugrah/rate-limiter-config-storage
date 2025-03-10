#!/bin/bash

# This script syncs the compiled JavaScript code back to the src/ directory
# This is a temporary measure during the transition from JavaScript to TypeScript

echo "🔄 Syncing compiled TypeScript to JavaScript directory..."

# Make sure the dist directory exists
if [ ! -d "./dist" ]; then
  echo "❌ Error: The dist directory doesn't exist. Run 'npm run build' first."
  exit 1
fi

# Ensure the src directory exists
mkdir -p ./src

# Copy structure from src-ts to src
echo "📝 Copying compiled JavaScript code to src/ directory..."

# Find all .js files and copy them in a single operation for better performance
find ./dist -name "*.js" | while read -r file; do
  # Get relative path
  relative_path=${file#./dist/}
  # Create directory structure
  mkdir -p "./src/$(dirname "$relative_path")"
  # Copy file
  cp "$file" "./src/$relative_path"
done

echo "🎉 Sync complete! JavaScript files have been updated."
echo "ℹ️  Note: src/ contains compiled code from src-ts/ - make changes in src-ts/ only."