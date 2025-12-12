# Known Issues - Pre-Production Checklist

**Last Updated:** 2025-12-09

## FOIA Document Analysis Feature (Enhancement 2)

### Status: BLOCKED - Not Production Ready

### Issues to Resolve:

#### 1. Frontend Not Loading FOIA Documents
**Severity:** HIGH
**Location:** `frontend/foia-admin-dashboard.html`
**Symptoms:**
- GET `/api/foia/admin/documents` returns 404
- Auto-login fails with 401 Unauthorized
- Document Review tab shows "Error loading documents"

**Browser Console Errors:**
```
Failed to load resource: the server responded with a status of 401 (Unauthorized)
Failed to load resource: the server responded with a status of 404 (Not Found)
Error loading documents: Error: Failed to load documents
```

**Backend Logs:**
```
✅ Database synced (37 models)
Models: User, Permit, Inspection, Document, Payment, Notification, Workflow,
WorkflowStep, WorkflowExecution, Task, Contact, ContactInteraction, Grant,
GrantApplication, SecureChannel, SecureMessage, ChannelMember, SecurityEvent,
SecurityAlert, PublicComment, TownHallMeeting, Survey, Poll, FoiaRequest,
FoiaDocument, FoiaRedaction, FoiaCommunication, FoiaActivityLog, FoiaReadingRoom,
FoiaTemplate, FoiaExemption, FoiaAIAnalysis, FoiaExtractedEntity, DocumentAnalysis,
DetectedPII, RedactionSuggestion, ExemptionClassification
```

**Investigation Needed:**
- [ ] Verify FOIA routes are properly registered in `src/server.js`
- [ ] Check if `/api/foia/*` routes are being loaded
- [ ] Validate authentication middleware on FOIA endpoints
- [ ] Test API endpoints directly with curl/Postman
- [ ] Check CORS configuration for frontend requests

#### 2. Test Data Successfully Seeded
**Status:** WORKING ✅
**Details:**
- 3 FOIA requests created successfully
- 7 documents created with proper relationships
- Seed script: `backend/seed-foia-documents.js`
- Run with: `node seed-foia-documents.js`

### What's Been Completed:

✅ Database schema migration (4 new tables)
- `DocumentAnalysis` - stores AI classification results
- `DetectedPII` - PII instances with coordinates
- `RedactionSuggestions` - redaction approval workflow
- `ExemptionClassifications` - FOIA exemptions (b1-b9)

✅ Sequelize models created
- All 4 models defined in `/backend/src/models/`
- Relationships configured in `models/index.js`
- Models successfully synced (37 total)

✅ FOIADocumentService implemented
- Document type classification (9 types)
- PII detection (8 types with validation)
- FOIA exemption classification (b1-b9)
- Confidence scoring algorithms
- Luhn credit card validation
- SSN validation with area/group/serial rules

✅ API endpoints created
- GET `/api/foia/admin/documents` - list documents with analysis
- POST `/api/foia/admin/documents/:id/analyze` - analyze document
- GET `/api/foia/admin/documents/:id/analysis` - get analysis results
- POST `/api/foia/admin/documents/:id/apply-redactions` - apply redactions
- POST `/api/foia/admin/documents/batch-analyze` - batch processing

✅ Admin UI created
- Document Review tab added to FOIA dashboard
- Analysis modal with glassmorphism design
- PII detection display with approve/reject buttons
- Exemption classification display
- Processing metrics visualization

✅ Frontend bugs fixed
- Fixed `completedAt` → `completedCount` element ID mismatch
- Fixed template literal quote mismatches
- Fixed nested quote issues in onclick attributes
- Moved authentication to DOMContentLoaded
- Added auto-login functionality

✅ Seed script working
- Fixed enum value errors (request_type, document_type)
- Fixed field name mismatches (fileName → filename)
- Fixed tracking number length constraints
- Fixed uploadedBy to use UUID instead of string

### Files Modified/Created:

**Database:**
- `/backend/src/migrations/20251209-add-document-analysis-tables.js` (NEW)
- `/backend/run-document-migration.js` (NEW)

**Models:**
- `/backend/src/models/DocumentAnalysis.js` (NEW)
- `/backend/src/models/DetectedPII.js` (NEW)
- `/backend/src/models/RedactionSuggestion.js` (NEW)
- `/backend/src/models/ExemptionClassification.js` (NEW)
- `/backend/src/models/index.js` (MODIFIED - added relationships)

**Services:**
- `/backend/src/services/foiaDocumentService.js` (NEW - 500+ lines)

**Routes:**
- `/backend/src/routes/foia.js` (MODIFIED - added 5 new endpoints)

**Frontend:**
- `/frontend/foia-admin-dashboard.html` (MODIFIED - added Document Review tab)
- `/frontend/test-foia.html` (NEW - testing tool)

**Seed Data:**
- `/backend/seed-foia-documents.js` (NEW)

### Next Steps to Fix:

1. **Debug Route Registration**
   - Check if FOIA routes are imported in `src/server.js`
   - Verify route path: should be `app.use('/api/foia', foiaRoutes)`
   - Test endpoints: `curl http://localhost:3000/api/foia/admin/documents -H "Authorization: Bearer <token>"`

2. **Fix Authentication Flow**
   - Verify JWT token generation works
   - Check if token is being stored in localStorage
   - Validate token is being sent in Authorization header
   - Check middleware order in routes

3. **Test End-to-End**
   - Manual login at `/frontend/login.html`
   - Navigate to FOIA dashboard
   - Test Document Review tab
   - Test document analysis flow

4. **Error Handling**
   - Add better error messages in frontend
   - Add console logging for debugging
   - Implement error boundary in UI

---

## Other Issues

### Analytics Service - Column Name Errors
**Severity:** MEDIUM
**Location:** `backend/src/services/analyticsService.js`
**Error:**
```
column "completedAt" does not exist
Hint: Perhaps you meant to reference the column "Task.completed_at"
```

**Fix Required:**
- Update analytics queries to use snake_case column names
- Files: `analyticsService.js` lines referencing `completedAt`, `startedAt`
- Should use: `completed_at`, `started_at`

---

## Testing Checklist Before Production

- [ ] Fix FOIA document loading issue
- [ ] Test document analysis with real PDF files
- [ ] Verify PII detection accuracy
- [ ] Test redaction approval workflow
- [ ] Validate exemption classifications
- [ ] Load test with 100+ documents
- [ ] Security audit of PII handling
- [ ] GDPR compliance review for PII storage
- [ ] Test batch analysis performance
- [ ] Integration testing with existing FOIA workflow

---

## Commands for Quick Testing

```bash
# Rebuild and restart backend
cd /Users/chrisleifel/Govli-AI-v2
docker-compose down
docker-compose up --build

# Seed test data
cd backend
node seed-foia-documents.js

# Test API endpoints
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@govli.ai","password":"admin123"}'

curl http://localhost:3000/api/foia/admin/documents \
  -H "Authorization: Bearer <token>"
```

---

## Technical Debt

1. **OpenAI API Integration**
   - Currently using keyword-based classification
   - Should integrate actual OpenAI API for better accuracy
   - Need to add API key to environment variables

2. **File Storage**
   - Mock file paths currently used
   - Need to implement actual S3/file storage
   - Need to add PDF parsing for real documents

3. **Performance Optimization**
   - Add caching for analysis results
   - Implement background job queue for batch processing
   - Add database indexes for frequently queried fields

4. **Security Enhancements**
   - Add audit logging for PII access
   - Implement role-based access control
   - Add encryption at rest for PII data
   - Add data retention policies
