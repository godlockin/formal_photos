#!/bin/bash

# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=formal-photos

# Add all changes to git
git add .

# Commit changes
git commit -m "Deploy to Cloudflare Pages"

# Push changes
git push
