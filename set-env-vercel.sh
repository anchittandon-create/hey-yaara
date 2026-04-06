#!/bin/bash

# ============================================================================
# Vercel Environment Variable Setup Script
# ============================================================================
# 
# Sets VITE_ELEVENLABS_AGENT_ID in your Vercel project
#
# REQUIREMENTS:
#   1. Vercel API token (get from: https://vercel.com/account/tokens)
#   2. ElevenLabs Agent ID (get from: https://elevenlabs.io/app/conversational-ai)
#   3. curl installed (pre-installed on macOS)
#
# USAGE:
#   bash set-env-vercel.sh <vercel-token> <agent-id>
#
# EXAMPLE:
#   bash set-env-vercel.sh 'VercelToken_xxxxxxxxxxxxx' 'agent_xxxxxxxxxxxxx'
#
# ============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_NAME="hey-yaara"
GITHUB_USER="anchittandon-create"
GITHUB_REPO="hey-yaara"

print_help() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  VERCEL ENVIRONMENT SETUP HELP${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "STEP 1: Get Vercel API Token"
  echo "  1. Go to: https://vercel.com/account/tokens"
  echo "  2. Click 'Create Token'"
  echo "  3. Name: hey-yaara-setup"
  echo "  4. Expiration: 7 days"
  echo "  5. Copy the token"
  echo ""
  echo "STEP 2: Get ElevenLabs Agent ID"
  echo "  1. Go to: https://elevenlabs.io/app/conversational-ai"
  echo "  2. Click on your agent (Yaara)"
  echo "  3. Copy the Agent ID from URL or details"
  echo ""
  echo "STEP 3: Run this script"
  echo "  bash set-env-vercel.sh '<VERCEL_TOKEN>' '<AGENT_ID>'"
  echo ""
  echo -e "${YELLOW}EXAMPLE:${NC}"
  echo "  bash set-env-vercel.sh 'VercelToken_xxx' 'agent_xxx'"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Check arguments
if [ $# -lt 2 ]; then
  print_help
  exit 1
fi

VERCEL_TOKEN=$1
AGENT_ID=$2

# Validate inputs
if [ -z "$VERCEL_TOKEN" ] || [ -z "$AGENT_ID" ]; then
  echo -e "${RED}❌ Error: Token or Agent ID is empty${NC}"
  print_help
  exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ VERCEL SETUP ━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Project: $PROJECT_NAME"
echo "   Agent ID: $AGENT_ID"
echo "   Token: ${VERCEL_TOKEN:0:20}..."
echo ""

# Step 1: Get project ID from Vercel
echo -e "${YELLOW}🔍 Fetching project details from Vercel...${NC}"

PROJECT_INFO=$(curl -s -X GET \
  "https://api.vercel.com/v9/projects?search=$PROJECT_NAME" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json")

PROJECT_ID=$(echo "$PROJECT_INFO" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ Could not find Vercel project: $PROJECT_NAME${NC}"
  echo ""
  echo "Possible solutions:"
  echo "1. Check your Vercel token is correct"
  echo "2. Make sure token has project access"
  echo "3. Verify project name is spelled correctly"
  echo ""
  echo "Project info response:"
  echo "$PROJECT_INFO" | head -20
  exit 1
fi

echo -e "${GREEN}✅ Found project: $PROJECT_ID${NC}"
echo ""

# Step 2: Set environment variable
echo -e "${YELLOW}🔧 Setting VITE_ELEVENLABS_AGENT_ID...${NC}"

RESPONSE=$(curl -s -X POST \
  "https://api.vercel.com/v11/projects/$PROJECT_ID/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "VITE_ELEVENLABS_AGENT_ID",
    "value": "'$AGENT_ID'",
    "target": ["production", "preview", "development"],
    "type": "plain"
  }')

# Check if successful
if echo "$RESPONSE" | grep -q '"key":"VITE_ELEVENLABS_AGENT_ID"'; then
  echo -e "${GREEN}✅ Environment variable set successfully!${NC}"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ NEXT STEPS ━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "🔄 Redeploy your project to apply the changes:"
  echo ""
  echo -e "${YELLOW}Option 1: Auto-deploy (recommended)${NC}"
  echo "   git add ."
  echo "   git commit -m 'Set VITE_ELEVENLABS_AGENT_ID'"
  echo "   git push"
  echo ""
  echo -e "${YELLOW}Option 2: Manual redeploy${NC}"
  echo "   1. Go to https://vercel.com/dashboard"
  echo "   2. Select '$PROJECT_NAME'"
  echo "   3. Click 'Redeploy'"
  echo ""
  echo -e "${YELLOW}Option 3: Using Vercel CLI${NC}"
  echo "   vercel redeploy"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
else
  echo -e "${RED}❌ Failed to set environment variable${NC}"
  echo ""
  echo "Response:"
  echo "$RESPONSE" | head -20
  echo ""
  echo "Troubleshooting:"
  echo "1. Verify Vercel token has correct permissions"
  echo "2. Check token is not expired"
  echo "3. Ensure project name matches exactly"
  exit 1
fi
