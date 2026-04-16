#!/bin/bash
# Test that all prerequisites are configured

echo "=== Renovate Monitor Setup Test ==="
echo ""

# Test 1: gog auth
echo "1. Checking gog (Google Workspace) auth..."
if command -v gog &> /dev/null; then
    ACCOUNTS=$(gog auth list 2>/dev/null)
    if [ -n "$ACCOUNTS" ]; then
        echo "   ✓ gog installed and authenticated"
        echo "   Accounts: $ACCOUNTS"
    else
        echo "   ✗ gog installed but no accounts found"
        echo "   Run: gog auth login derek.roberts@gmail.com"
    fi
else
    echo "   ✗ gog not found in PATH"
fi
echo ""

# Test 2: gh auth
echo "2. Checking gh (GitHub) auth..."
if command -v gh &> /dev/null; then
    GH_STATUS=$(gh auth status 2>&1)
    if echo "$GH_STATUS" | grep -q "Logged in"; then
        echo "   ✓ gh installed and authenticated"
        echo "   $(echo "$GH_STATUS" | grep "Logged in" | head -1)"
    else
        echo "   ✗ gh installed but not authenticated"
        echo "   Run: gh auth login"
    fi
else
    echo "   ✗ gh not found in PATH"
fi
echo ""

# Test 3: openclaw
echo "3. Checking openclaw..."
if command -v openclaw &> /dev/null; then
    echo "   ✓ openclaw installed"
    openclaw --version 2>/dev/null || echo "   (version check failed)"
else
    echo "   ✗ openclaw not found in PATH"
fi
echo ""

# Test 4: Gmail search test
echo "4. Testing Gmail search (will search for 5 emails)..."
if command -v gog &> /dev/null; then
    RESULT=$(gog gmail search --account derek.roberts@gmail.com --query "from:\"Mend Renovate\"" --limit 5 2>/dev/null)
    if [ -n "$RESULT" ]; then
        COUNT=$(echo "$RESULT" | grep -c "message_id" || echo "0")
        echo "   ✓ Gmail search working (found $COUNT emails)"
    else
        echo "   ⚠ No results or search failed"
    fi
else
    echo "   ✗ Cannot test (gog not available)"
fi
echo ""

# Test 5: GitHub access test
echo "5. Testing GitHub access..."
if command -v gh &> /dev/null; then
    # Try to view a bcgov repo (read-only test)
    if gh repo view bcgov/bcgov-abc-party 2>/dev/null | head -1; then
        echo "   ✓ Can read bcgov repos"
    else
        echo "   ⚠ Could not read bcgov repo (may not exist or no access)"
    fi
else
    echo "   ✗ Cannot test (gh not available)"
fi
echo ""

echo "=== Test Complete ==="
echo ""
echo "To install cron jobs, run: ./setup-cron.sh"
echo "To test manually, run: node orchestrator.js full"
