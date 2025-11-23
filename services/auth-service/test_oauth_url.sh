#!/bin/bash

echo "=== Testing OAuth Login URL ==="
echo ""

# Get the redirect location
LOCATION=$(curl -s -I http://localhost:3002/auth/login 2>&1 | grep -i "^location:" | cut -d' ' -f2- | tr -d '\r')

if [ -z "$LOCATION" ]; then
    echo "❌ ERROR: Could not get redirect URL. Is auth-service running?"
    echo "   Run: cd auth-service && go run cmd/main.go"
    exit 1
fi

echo "✅ OAuth URL generated:"
echo ""
echo "$LOCATION" | sed 's/&/\n  /g'
echo ""
echo "=== Verification Checklist ==="
echo ""

# Check for required scope
if echo "$LOCATION" | grep -q "api%3A%2F%2Facademy-dev%2FGeneralAccess"; then
    echo "✅ Custom scope included: api://academy-dev/GeneralAccess"
else
    echo "❌ MISSING custom scope: api://academy-dev/GeneralAccess"
fi

# Check redirect URI
if echo "$LOCATION" | grep -q "redirect_uri=http%3A%2F%2Flocalhost%3A3002%2Fauth%2Fcallback"; then
    echo "✅ Redirect URI correct: http://localhost:3002/auth/callback"
    echo ""
    echo "⚠️  IMPORTANT: Have you updated this in Azure AD?"
    echo "   Go to: Azure Portal → App Registrations → Authentication"
    echo "   Current redirect URI in Azure AD should be:"
    echo "   http://localhost:3002/auth/callback"
else
    echo "❌ Redirect URI mismatch"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Ensure Azure AD redirect URI is: http://localhost:3002/auth/callback"
echo "2. Clear all cookies in browser"
echo "3. Visit: http://localhost:5173"
echo "4. Click login"
echo ""
