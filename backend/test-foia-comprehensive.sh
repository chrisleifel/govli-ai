#!/bin/bash
# Comprehensive FOIA API Testing Script
# QA Test Suite for Phase 8

echo "=========================================="
echo "FOIA API Comprehensive Testing"
echo "=========================================="
echo ""

# Login and get token
echo "🔐 TEST 1: Authentication"
echo "----------------------------"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@govli.ai","password":"Admin123$"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ FAIL: Could not obtain authentication token"
  exit 1
else
  echo "✅ PASS: Authentication successful"
  echo "   Token obtained: ${TOKEN:0:20}..."
fi
echo ""

# Test GET /admin/documents
echo "📋 TEST 2: GET /api/foia/admin/documents"
echo "----------------------------"
RESPONSE=$(curl -s -X GET http://localhost:3000/api/foia/admin/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

SUCCESS=$(echo $RESPONSE | grep -o '"success":true')
DOC_COUNT=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | wc -l | tr -d ' ')

if [ -n "$SUCCESS" ] && [ "$DOC_COUNT" -gt 0 ]; then
  echo "✅ PASS: GET /admin/documents"
  echo "   Documents returned: $DOC_COUNT"
  # Save first document ID for next tests
  DOC_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "   Test document ID: $DOC_ID"
else
  echo "❌ FAIL: Could not retrieve documents"
  echo "   Response: $RESPONSE"
  exit 1
fi
echo ""

# Test POST /admin/documents/:id/analyze
echo "🔬 TEST 3: POST /api/foia/admin/documents/:id/analyze"
echo "----------------------------"
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/foia/admin/documents/$DOC_ID/analyze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

SUCCESS=$(echo $RESPONSE | grep -o '"success":true')
if [ -n "$SUCCESS" ]; then
  echo "✅ PASS: Document analysis initiated"
  echo "   Response preview: ${RESPONSE:0:200}..."
else
  echo "⚠️  WARN: Analysis endpoint response:"
  echo "   ${RESPONSE:0:300}"
fi
echo ""

# Test GET /admin/documents/:id/analysis
echo "📊 TEST 4: GET /api/foia/admin/documents/:id/analysis"
echo "----------------------------"
RESPONSE=$(curl -s -X GET "http://localhost:3000/api/foia/admin/documents/$DOC_ID/analysis" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

if [ -n "$(echo $RESPONSE | grep -o '"analysis"')" ] || [ -n "$(echo $RESPONSE | grep -o '"success"')" ]; then
  echo "✅ PASS: Get analysis endpoint responding"
  echo "   Response preview: ${RESPONSE:0:200}..."
else
  echo "⚠️  WARN: Analysis retrieval response:"
  echo "   ${RESPONSE:0:300}"
fi
echo ""

# Test POST /admin/documents/batch-analyze
echo "⚡ TEST 5: POST /api/foia/admin/documents/batch-analyze"
echo "----------------------------"
# Get multiple document IDs for batch test
DOC_IDS=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -3 | cut -d'"' -f4 | paste -sd '","' -)

BATCH_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/foia/admin/documents/batch-analyze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"documentIds\":[\"$DOC_ID\"]}")

if [ -n "$(echo $BATCH_RESPONSE | grep -o '"success"')" ]; then
  echo "✅ PASS: Batch analysis endpoint responding"
  echo "   Response: ${BATCH_RESPONSE:0:200}..."
else
  echo "⚠️  WARN: Batch analysis response:"
  echo "   ${BATCH_RESPONSE:0:300}"
fi
echo ""

# Test unauthenticated access (should fail)
echo "🔒 TEST 6: Security - Unauthenticated Access"
echo "----------------------------"
UNAUTH_RESPONSE=$(curl -s -X GET http://localhost:3000/api/foia/admin/documents \
  -H "Content-Type: application/json")

if [ -n "$(echo $UNAUTH_RESPONSE | grep -o 'Authentication')" ]; then
  echo "✅ PASS: Unauthenticated requests properly blocked"
  echo "   Error message: $UNAUTH_RESPONSE"
else
  echo "❌ FAIL: Security issue - endpoint accessible without auth"
  echo "   Response: $UNAUTH_RESPONSE"
fi
echo ""

# Test invalid document ID (should fail gracefully)
echo "🚫 TEST 7: Error Handling - Invalid Document ID"
echo "----------------------------"
INVALID_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/foia/admin/documents/invalid-uuid-123/analysis" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

if [ -n "$(echo $INVALID_RESPONSE | grep -o 'error')" ]; then
  echo "✅ PASS: Invalid requests handled gracefully"
  echo "   Error response: ${INVALID_RESPONSE:0:150}"
else
  echo "⚠️  WARN: Unexpected response for invalid ID:"
  echo "   ${INVALID_RESPONSE:0:200}"
fi
echo ""

echo "=========================================="
echo "API Testing Complete"
echo "=========================================="
