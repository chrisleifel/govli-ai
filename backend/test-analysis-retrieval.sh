#!/bin/bash
TOKEN=$(cat /tmp/token.txt)
DOC_ID="b3a2d431-c513-4c12-a476-d1fb98836260"

echo "Testing GET /api/foia/admin/documents/$DOC_ID/analysis"
curl -s -X GET "http://localhost:3000/api/foia/admin/documents/$DOC_ID/analysis" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
