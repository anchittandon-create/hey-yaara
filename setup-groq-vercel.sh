#!/bin/bash

# ============================================================================
# Vercel Environment Variable Setup - Free TTS/STT with Groq
# ============================================================================
# 
# Sets up free TTS/STT environment variables in Vercel
#
# REQUIREMENTS:
#   1. Vercel API token (get from: https://vercel.com/account/tokens)
#   2. Groq API key (get from: https://console.groq.com)
#   3. curl installed (pre-installed on macOS)
#
# USAGE:
#   bash setup-groq-vercel.sh
#
# ============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_NAME="hey-yaara"
GITHUB_USER="anchittandon-create"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  YAARA - Free TTS/STT Vercel Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found${NC}"
    echo ""
    echo "Install it with:"
    echo "  npm install -g vercel"
    echo ""
    exit 1
fi

# Get API key from user
echo -e "${YELLOW}Step 1: Groq API Key${NC}"
echo "Get your free API key from: ${BLUE}https://console.groq.com${NC}"
echo ""
read -sp "Paste your Groq API key: " GROQ_API_KEY
echo ""

if [ -z "$GROQ_API_KEY" ]; then
    echo -e "${RED}✗ Error: Groq API key is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Setting Environment Variables in Vercel${NC}"
echo ""

# Set environment variables
echo "Setting VITE_LLM_PROVIDER..."
vercel env add VITE_LLM_PROVIDER --value "groq" || echo -e "${YELLOW}⚠️  Could not set VITE_LLM_PROVIDER${NC}"

echo "Setting VITE_LLM_API_KEY..."
vercel env add VITE_LLM_API_KEY --value "$GROQ_API_KEY" || echo -e "${YELLOW}⚠️  Could not set VITE_LLM_API_KEY${NC}"

echo ""
echo -e "${GREEN}✓ Environment variables configured!${NC}"
echo ""
echo "Your environment is now ready for production."
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Deploy your changes: ${YELLOW}git push${NC}"
echo "2. Vercel will automatically build with the new environment variables"
echo "3. Your app will use the free Groq API for conversations"
echo ""
echo -e "${BLUE}ℹ️  To verify settings:${NC}"
echo "  vercel env ls"
echo ""
