#!/bin/bash

# ============================================================================
# VITE_ELEVENLABS_AGENT_ID Setup - One-Click Solution
# ============================================================================
#
# This script helps you complete the ElevenLabs setup for Yaara
#
# What it does:
#   1. Guides you to get Vercel API token
#   2. Guides you to get ElevenLabs Agent ID
#   3. Sets environment variable in Vercel
#   4. Triggers redeploy
#
# Usage: bash setup-vercel-agent.sh
#
# ============================================================================

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_banner() {
  clear
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║     YAARA - ElevenLabs Agent Setup for Vercel                  ║"
  echo "║     💬 Talk to Yaara - Conversation Setup                      ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

step_one() {
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}STEP 1: Get Your Vercel API Token${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "📝 Instructions:"
  echo "  1. Open: https://vercel.com/account/tokens"
  echo "  2. Click 'Create Token'"
  echo "  3. Name: hey-yaara-setup"
  echo "  4. Expiration: 7 days (or longer)"
  echo "  5. Scope: Full Account (or select 'hey-yaara' project)"
  echo "  6. Click 'Create'"
  echo "  7. COPY the token immediately"
  echo ""
  echo -e "${GREEN}✓ Your token starts with: ${YELLOW}VercelToken_${NC}"
  echo ""
  read -p "Paste your Vercel token here: " VERCEL_TOKEN
  
  if [ -z "$VERCEL_TOKEN" ]; then
    echo -e "${RED}❌ No token provided${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Token received${NC}"
}

step_two() {
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}STEP 2: Get Your ElevenLabs Agent ID${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "📝 Instructions:"
  echo "  1. Open: https://elevenlabs.io/app/conversational-ai"
  echo "  2. Find and click on 'Yaara' agent"
  echo "  3. Look for 'Agent ID' in the details"
  echo "  4. COPY the Agent ID"
  echo ""
  echo -e "${GREEN}✓ Your Agent ID format: ${YELLOW}agent_xxxxxxxxxxxxx${NC}"
  echo ""
  read -p "Paste your ElevenLabs Agent ID here: " AGENT_ID
  
  if [ -z "$AGENT_ID" ]; then
    echo -e "${RED}❌ No Agent ID provided${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Agent ID received${NC}"
}

deploy() {
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}STEP 3: Setting Environment Variable in Vercel${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  PROJECT="hey-yaara"
  
  echo "🔍 Finding your project in Vercel..."
  PROJECT_INFO=$(curl -s -X GET \
    "https://api.vercel.com/v9/projects?search=$PROJECT" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json")
  
  PROJECT_ID=$(echo "$PROJECT_INFO" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Could not find project '$PROJECT'${NC}"
    echo ""
    echo "Make sure:"
    echo "  1. Your Vercel token is correct"
    echo "  2. You have access to the hey-yaara project"
    echo "  3. The token has not expired"
    echo ""
    echo "Debug: First 100 chars of response:"
    echo "$PROJECT_INFO" | head -c 100
    exit 1
  fi
  
  echo -e "${GREEN}✅ Found project: $PROJECT_ID${NC}"
  echo ""
  echo "🔧 Setting VITE_ELEVENLABS_AGENT_ID..."
  
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
  
  if echo "$RESPONSE" | grep -q '"key":"VITE_ELEVENLABS_AGENT_ID"'; then
    echo -e "${GREEN}✅ Environment variable set successfully!${NC}"
  else
    echo -e "${RED}❌ Failed to set variable${NC}"
    echo "$RESPONSE"
    exit 1
  fi
}

redeploy() {
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}STEP 4: Redeploy Your Project${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Choose how to redeploy:"
  echo ""
  echo "  1️⃣  Git push (auto-deploys) - RECOMMENDED"
  echo "     git add ."
  echo "     git commit -m 'Set VITE_ELEVENLABS_AGENT_ID'"
  echo "     git push"
  echo ""
  echo "  2️⃣  Manual redeploy"
  echo "     Visit: https://vercel.com/dashboard"
  echo "     Click hey-yaara project → Redeploy"
  echo ""
  echo "  3️⃣  Using Vercel CLI"
  echo "     vercel redeploy"
  echo ""
  read -p "Press enter after redeploying..."
}

success() {
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    ✅ SETUP COMPLETE!                          ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${GREEN}What's been set up:${NC}"
  echo "  ✅ VITE_ELEVENLABS_AGENT_ID environment variable"
  echo "  ✅ Applied to: Production, Preview, and Development"
  echo "  ✅ Ready for redeployment"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. Redeploy your project (see STEP 4 above)"
  echo "  2. Wait 2-5 minutes for deployment"
  echo "  3. Visit your Vercel deployment"
  echo "  4. Go to 'Talk to Yaara' page"
  echo "  5. Click 'Talk to Yaara' button"
  echo "  6. Enjoy! 🎉"
  echo ""
}

# Main flow
show_banner
step_one
step_two
deploy
redeploy
success
