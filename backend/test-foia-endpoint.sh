#!/bin/bash
# Login and test FOIA endpoint
echo "Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@govli.ai","password":"Admin123$"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Testing /api/foia/admin/documents..."
curl -X GET http://localhost:3000/api/foia/admin/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
