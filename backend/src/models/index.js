/**
 * Central Models Index
 * Defines all database models and their relationships
 */

const sequelize = require('../config/sequelize');

// Import all models
const User = require('./User');
const Permit = require('./Permit');
const Inspection = require('./Inspection');
const Document = require('./Document');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Workflow = require('./Workflow');
const WorkflowStep = require('./WorkflowStep');
const WorkflowExecution = require('./WorkflowExecution');
const Task = require('./Task');
const Contact = require('./Contact');
const ContactInteraction = require('./ContactInteraction');
const Grant = require('./Grant');
const GrantApplication = require('./GrantApplication');
const SecureChannel = require('./SecureChannel');
const SecureMessage = require('./SecureMessage');
const ChannelMember = require('./ChannelMember');
const SecurityEvent = require('./SecurityEvent');
const SecurityAlert = require('./SecurityAlert');
const PublicComment = require('./PublicComment');
const TownHallMeeting = require('./TownHallMeeting');
const Survey = require('./Survey');
const Poll = require('./Poll');
const FoiaRequest = require('./FoiaRequest');
const FoiaDocument = require('./FoiaDocument');
const FoiaRedaction = require('./FoiaRedaction');
const FoiaCommunication = require('./FoiaCommunication');
const FoiaActivityLog = require('./FoiaActivityLog');
const FoiaReadingRoom = require('./FoiaReadingRoom');
const FoiaTemplate = require('./FoiaTemplate');
const FoiaExemption = require('./FoiaExemption');
const FoiaAIAnalysis = require('./FoiaAIAnalysis');
const FoiaExtractedEntity = require('./FoiaExtractedEntity');
const DocumentAnalysis = require('./DocumentAnalysis');
const DetectedPII = require('./DetectedPII');
const RedactionSuggestion = require('./RedactionSuggestion');
const ExemptionClassification = require('./ExemptionClassification');

// ============================================================================
// USER RELATIONSHIPS
// ============================================================================

// User has many Permits (as applicant via email matching)
User.hasMany(Permit, {
  foreignKey: 'applicantEmail',
  sourceKey: 'email',
  as: 'permits'
});

// User has many Inspections (as inspector)
User.hasMany(Inspection, {
  foreignKey: 'inspectorId',
  as: 'inspections'
});

// User has many Documents (uploaded by)
User.hasMany(Document, {
  foreignKey: 'uploadedBy',
  as: 'uploadedDocuments'
});

// User has many Payments
User.hasMany(Payment, {
  foreignKey: 'userId',
  as: 'payments'
});

// User has many Notifications
User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications'
});

// User has many Workflows (created by)
User.hasMany(Workflow, {
  foreignKey: 'createdBy',
  as: 'createdWorkflows'
});

// User has many WorkflowExecutions (initiated by)
User.hasMany(WorkflowExecution, {
  foreignKey: 'initiatedBy',
  as: 'initiatedWorkflowExecutions'
});

// User has many Tasks (assigned to)
User.hasMany(Task, {
  foreignKey: 'assignedTo',
  as: 'assignedTasks'
});

// User has many Tasks (completed by)
User.hasMany(Task, {
  foreignKey: 'completedBy',
  as: 'completedTasks'
});

// ============================================================================
// PERMIT RELATIONSHIPS
// ============================================================================

// Permit belongs to User (via email)
Permit.belongsTo(User, {
  foreignKey: 'applicantEmail',
  targetKey: 'email',
  as: 'applicant'
});

// Permit has many Inspections
Permit.hasMany(Inspection, {
  foreignKey: 'permitId',
  as: 'inspections'
});
Inspection.belongsTo(Permit, {
  foreignKey: 'permitId',
  as: 'permit'
});

// Permit has many Documents
Permit.hasMany(Document, {
  foreignKey: 'permitId',
  as: 'documents'
});
Document.belongsTo(Permit, {
  foreignKey: 'permitId',
  as: 'permit'
});

// Permit has many Payments
Permit.hasMany(Payment, {
  foreignKey: 'permitId',
  as: 'payments'
});
Payment.belongsTo(Permit, {
  foreignKey: 'permitId',
  as: 'permit'
});

// Permit has many WorkflowExecutions
Permit.hasMany(WorkflowExecution, {
  foreignKey: 'permitId',
  as: 'workflowExecutions'
});
WorkflowExecution.belongsTo(Permit, {
  foreignKey: 'permitId',
  as: 'permit'
});

// Permit has many Tasks
Permit.hasMany(Task, {
  foreignKey: 'permitId',
  as: 'tasks'
});
Task.belongsTo(Permit, {
  foreignKey: 'permitId',
  as: 'permit'
});

// ============================================================================
// INSPECTION RELATIONSHIPS
// ============================================================================

// Inspection belongs to User (inspector)
Inspection.belongsTo(User, {
  foreignKey: 'inspectorId',
  as: 'inspector'
});

// Inspection has many Documents
Inspection.hasMany(Document, {
  foreignKey: 'inspectionId',
  as: 'documents'
});
Document.belongsTo(Inspection, {
  foreignKey: 'inspectionId',
  as: 'inspection'
});

// ============================================================================
// DOCUMENT RELATIONSHIPS
// ============================================================================

// Document belongs to User (uploaded by)
Document.belongsTo(User, {
  foreignKey: 'uploadedBy',
  as: 'uploader'
});

// ============================================================================
// PAYMENT RELATIONSHIPS
// ============================================================================

// Payment belongs to User
Payment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// ============================================================================
// NOTIFICATION RELATIONSHIPS
// ============================================================================

// Notification belongs to User
Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// ============================================================================
// WORKFLOW RELATIONSHIPS
// ============================================================================

// Workflow has many WorkflowSteps
Workflow.hasMany(WorkflowStep, {
  foreignKey: 'workflowId',
  as: 'steps'
});
WorkflowStep.belongsTo(Workflow, {
  foreignKey: 'workflowId',
  as: 'workflow'
});

// Workflow has many WorkflowExecutions
Workflow.hasMany(WorkflowExecution, {
  foreignKey: 'workflowId',
  as: 'executions'
});
WorkflowExecution.belongsTo(Workflow, {
  foreignKey: 'workflowId',
  as: 'workflow'
});

// Workflow belongs to User (created by)
Workflow.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// ============================================================================
// WORKFLOW EXECUTION RELATIONSHIPS
// ============================================================================

// WorkflowExecution belongs to User (initiated by)
WorkflowExecution.belongsTo(User, {
  foreignKey: 'initiatedBy',
  as: 'initiator'
});

// WorkflowExecution belongs to User (cancelled by)
WorkflowExecution.belongsTo(User, {
  foreignKey: 'cancelledBy',
  as: 'canceller'
});

// WorkflowExecution has current step
WorkflowExecution.belongsTo(WorkflowStep, {
  foreignKey: 'currentStepId',
  as: 'currentStep'
});

// WorkflowExecution has many Tasks
WorkflowExecution.hasMany(Task, {
  foreignKey: 'workflowExecutionId',
  as: 'tasks'
});
Task.belongsTo(WorkflowExecution, {
  foreignKey: 'workflowExecutionId',
  as: 'workflowExecution'
});

// ============================================================================
// TASK RELATIONSHIPS
// ============================================================================

// Task belongs to User (assigned to)
Task.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignee'
});

// Task belongs to User (assigned by)
Task.belongsTo(User, {
  foreignKey: 'assignedBy',
  as: 'assigner'
});

// Task belongs to User (completed by)
Task.belongsTo(User, {
  foreignKey: 'completedBy',
  as: 'completer'
});

// Task belongs to WorkflowStep
Task.belongsTo(WorkflowStep, {
  foreignKey: 'workflowStepId',
  as: 'workflowStep'
});

// Task self-referential relationship (parent-child)
Task.hasMany(Task, {
  foreignKey: 'parentTaskId',
  as: 'subtasks'
});
Task.belongsTo(Task, {
  foreignKey: 'parentTaskId',
  as: 'parentTask'
});

// ============================================================================
// CONTACT RELATIONSHIPS (CRM)
// ============================================================================

// Contact belongs to User (linked account)
Contact.belongsTo(User, {
  foreignKey: 'linkedUserId',
  as: 'linkedUser'
});
User.hasOne(Contact, {
  foreignKey: 'linkedUserId',
  as: 'contactProfile'
});

// Contact has many Permits (via email matching)
Contact.hasMany(Permit, {
  foreignKey: 'applicantEmail',
  sourceKey: 'email',
  as: 'permits'
});
Permit.belongsTo(Contact, {
  foreignKey: 'applicantEmail',
  targetKey: 'email',
  as: 'contact'
});

// Contact has many ContactInteractions
Contact.hasMany(ContactInteraction, {
  foreignKey: 'contactId',
  as: 'interactions'
});
ContactInteraction.belongsTo(Contact, {
  foreignKey: 'contactId',
  as: 'contact'
});

// Contact self-referential (duplicate tracking)
Contact.belongsTo(Contact, {
  foreignKey: 'duplicateOf',
  as: 'primaryContact'
});
Contact.hasMany(Contact, {
  foreignKey: 'duplicateOf',
  as: 'duplicates'
});

// ContactInteraction relationships
ContactInteraction.belongsTo(User, {
  foreignKey: 'handledBy',
  as: 'handler'
});
User.hasMany(ContactInteraction, {
  foreignKey: 'handledBy',
  as: 'handledInteractions'
});

ContactInteraction.belongsTo(Permit, {
  foreignKey: 'permitId',
  as: 'permit'
});

ContactInteraction.belongsTo(Inspection, {
  foreignKey: 'inspectionId',
  as: 'inspection'
});

ContactInteraction.belongsTo(Document, {
  foreignKey: 'documentId',
  as: 'document'
});

ContactInteraction.belongsTo(Payment, {
  foreignKey: 'paymentId',
  as: 'payment'
});

// ============================================================================
// GRANT RELATIONSHIPS
// ============================================================================

// Grant has many GrantApplications
Grant.hasMany(GrantApplication, {
  foreignKey: 'grantId',
  as: 'applications'
});
GrantApplication.belongsTo(Grant, {
  foreignKey: 'grantId',
  as: 'grant'
});

// Grant belongs to User (created by)
Grant.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});
User.hasMany(Grant, {
  foreignKey: 'createdBy',
  as: 'createdGrants'
});

// GrantApplication belongs to User (applicant)
GrantApplication.belongsTo(User, {
  foreignKey: 'applicantId',
  as: 'applicant'
});
User.hasMany(GrantApplication, {
  foreignKey: 'applicantId',
  as: 'grantApplications'
});

// GrantApplication belongs to User (decision made by)
GrantApplication.belongsTo(User, {
  foreignKey: 'decisionMadeBy',
  as: 'decisionMaker'
});

// GrantApplication belongs to WorkflowExecution
GrantApplication.belongsTo(WorkflowExecution, {
  foreignKey: 'workflowExecutionId',
  as: 'workflowExecution'
});
WorkflowExecution.hasOne(GrantApplication, {
  foreignKey: 'workflowExecutionId',
  as: 'grantApplication'
});

// ============================================================================
// SECUREMESH RELATIONSHIPS
// ============================================================================

// SecureChannel belongs to User (created by and owner)
SecureChannel.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});
SecureChannel.belongsTo(User, {
  foreignKey: 'ownerId',
  as: 'owner'
});
User.hasMany(SecureChannel, {
  foreignKey: 'createdBy',
  as: 'createdChannels'
});
User.hasMany(SecureChannel, {
  foreignKey: 'ownerId',
  as: 'ownedChannels'
});

// SecureChannel has many SecureMessages
SecureChannel.hasMany(SecureMessage, {
  foreignKey: 'channelId',
  as: 'messages'
});
SecureMessage.belongsTo(SecureChannel, {
  foreignKey: 'channelId',
  as: 'channel'
});

// SecureChannel has many ChannelMembers
SecureChannel.hasMany(ChannelMember, {
  foreignKey: 'channelId',
  as: 'members'
});
ChannelMember.belongsTo(SecureChannel, {
  foreignKey: 'channelId',
  as: 'channel'
});

// SecureMessage belongs to User (sender)
SecureMessage.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});
User.hasMany(SecureMessage, {
  foreignKey: 'senderId',
  as: 'sentMessages'
});

// SecureMessage self-referential (parent-child for threads)
SecureMessage.hasMany(SecureMessage, {
  foreignKey: 'parentMessageId',
  as: 'replies'
});
SecureMessage.belongsTo(SecureMessage, {
  foreignKey: 'parentMessageId',
  as: 'parentMessage'
});

// ChannelMember belongs to User
ChannelMember.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});
User.hasMany(ChannelMember, {
  foreignKey: 'userId',
  as: 'channelMemberships'
});

// ChannelMember belongs to User (invited by)
ChannelMember.belongsTo(User, {
  foreignKey: 'invitedBy',
  as: 'inviter'
});

// ChannelMember has last read message
ChannelMember.belongsTo(SecureMessage, {
  foreignKey: 'lastReadMessageId',
  as: 'lastReadMessage'
});

// ============================================================================
// SECURITY OPERATIONS RELATIONSHIPS
// ============================================================================

// SecurityEvent belongs to Users
SecurityEvent.belongsTo(User, {
  foreignKey: 'sourceUser',
  as: 'sourceUserProfile'
});
SecurityEvent.belongsTo(User, {
  foreignKey: 'targetUser',
  as: 'targetUserProfile'
});
SecurityEvent.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignee'
});
User.hasMany(SecurityEvent, {
  foreignKey: 'sourceUser',
  as: 'triggeredEvents'
});

// SecurityEvent self-referential (parent-child)
SecurityEvent.hasMany(SecurityEvent, {
  foreignKey: 'parentEventId',
  as: 'childEvents'
});
SecurityEvent.belongsTo(SecurityEvent, {
  foreignKey: 'parentEventId',
  as: 'parentEvent'
});

// SecurityAlert belongs to Users
SecurityAlert.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignee'
});
SecurityAlert.belongsTo(User, {
  foreignKey: 'acknowledgedBy',
  as: 'acknowledger'
});
SecurityAlert.belongsTo(User, {
  foreignKey: 'escalatedTo',
  as: 'escalationTarget'
});
User.hasMany(SecurityAlert, {
  foreignKey: 'assignedTo',
  as: 'assignedAlerts'
});

// SecurityAlert self-referential (parent-child)
SecurityAlert.hasMany(SecurityAlert, {
  foreignKey: 'parentAlertId',
  as: 'childAlerts'
});
SecurityAlert.belongsTo(SecurityAlert, {
  foreignKey: 'parentAlertId',
  as: 'parentAlert'
});

// ============================================================================
// PUBLIC ENGAGEMENT RELATIONSHIPS
// ============================================================================

// PublicComment belongs to User (if authenticated)
PublicComment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});
User.hasMany(PublicComment, {
  foreignKey: 'userId',
  as: 'publicComments'
});

// PublicComment belongs to User (moderated by)
PublicComment.belongsTo(User, {
  foreignKey: 'moderatedBy',
  as: 'moderator'
});

// PublicComment self-referential (parent-child for threading)
PublicComment.hasMany(PublicComment, {
  foreignKey: 'parentCommentId',
  as: 'replies'
});
PublicComment.belongsTo(PublicComment, {
  foreignKey: 'parentCommentId',
  as: 'parentComment'
});

// TownHallMeeting belongs to User (host)
TownHallMeeting.belongsTo(User, {
  foreignKey: 'hostUserId',
  as: 'host'
});
User.hasMany(TownHallMeeting, {
  foreignKey: 'hostUserId',
  as: 'hostedMeetings'
});

// Survey belongs to User (owner)
Survey.belongsTo(User, {
  foreignKey: 'ownerId',
  as: 'owner'
});
User.hasMany(Survey, {
  foreignKey: 'ownerId',
  as: 'surveys'
});

// Poll belongs to User (owner)
Poll.belongsTo(User, {
  foreignKey: 'ownerId',
  as: 'owner'
});
User.hasMany(Poll, {
  foreignKey: 'ownerId',
  as: 'polls'
});

// ============================================================================
// FOIA RELATIONSHIPS
// ============================================================================

// FoiaRequest belongs to User (requester, assigned to, created by, updated by)
FoiaRequest.belongsTo(User, {
  foreignKey: 'requesterId',
  as: 'requester'
});
User.hasMany(FoiaRequest, {
  foreignKey: 'requesterId',
  as: 'foiaRequests'
});

FoiaRequest.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignedStaff'
});
User.hasMany(FoiaRequest, {
  foreignKey: 'assignedTo',
  as: 'assignedFoiaRequests'
});

FoiaRequest.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

FoiaRequest.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

// FoiaRequest has many FoiaDocuments
FoiaRequest.hasMany(FoiaDocument, {
  foreignKey: 'requestId',
  as: 'documents'
});
FoiaDocument.belongsTo(FoiaRequest, {
  foreignKey: 'requestId',
  as: 'request'
});

// FoiaRequest has many FoiaCommunications
FoiaRequest.hasMany(FoiaCommunication, {
  foreignKey: 'requestId',
  as: 'communications'
});
FoiaCommunication.belongsTo(FoiaRequest, {
  foreignKey: 'requestId',
  as: 'request'
});

// FoiaRequest has many FoiaActivityLogs
FoiaRequest.hasMany(FoiaActivityLog, {
  foreignKey: 'requestId',
  as: 'activityLogs'
});
FoiaActivityLog.belongsTo(FoiaRequest, {
  foreignKey: 'requestId',
  as: 'request'
});

// FoiaRequest has many FoiaReadingRoom entries
FoiaRequest.hasMany(FoiaReadingRoom, {
  foreignKey: 'requestId',
  as: 'readingRoomEntries'
});
FoiaReadingRoom.belongsTo(FoiaRequest, {
  foreignKey: 'requestId',
  as: 'request'
});

// FoiaDocument belongs to User (uploaded by, redacted by, created by, updated by)
FoiaDocument.belongsTo(User, {
  foreignKey: 'uploadedBy',
  as: 'uploader'
});
User.hasMany(FoiaDocument, {
  foreignKey: 'uploadedBy',
  as: 'uploadedFoiaDocuments'
});

FoiaDocument.belongsTo(User, {
  foreignKey: 'redactedBy',
  as: 'redactor'
});

FoiaDocument.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

FoiaDocument.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

// FoiaDocument has many FoiaRedactions
FoiaDocument.hasMany(FoiaRedaction, {
  foreignKey: 'documentId',
  as: 'redactions'
});
FoiaRedaction.belongsTo(FoiaDocument, {
  foreignKey: 'documentId',
  as: 'document'
});

// FoiaDocument has many FoiaActivityLogs
FoiaDocument.hasMany(FoiaActivityLog, {
  foreignKey: 'documentId',
  as: 'activityLogs'
});
FoiaActivityLog.belongsTo(FoiaDocument, {
  foreignKey: 'documentId',
  as: 'document'
});

// FoiaRedaction belongs to User (reviewed by, created by, updated by)
FoiaRedaction.belongsTo(User, {
  foreignKey: 'reviewedBy',
  as: 'reviewer'
});
User.hasMany(FoiaRedaction, {
  foreignKey: 'reviewedBy',
  as: 'reviewedRedactions'
});

FoiaRedaction.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

FoiaRedaction.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

// FoiaCommunication belongs to User (sender, created by, updated by)
FoiaCommunication.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});
User.hasMany(FoiaCommunication, {
  foreignKey: 'senderId',
  as: 'sentFoiaCommunications'
});

FoiaCommunication.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

FoiaCommunication.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

// FoiaCommunication belongs to FoiaTemplate
FoiaCommunication.belongsTo(FoiaTemplate, {
  foreignKey: 'templateId',
  as: 'template'
});
FoiaTemplate.hasMany(FoiaCommunication, {
  foreignKey: 'templateId',
  as: 'communications'
});

// FoiaActivityLog belongs to User (actor)
FoiaActivityLog.belongsTo(User, {
  foreignKey: 'actorId',
  as: 'actor'
});
User.hasMany(FoiaActivityLog, {
  foreignKey: 'actorId',
  as: 'foiaActivities'
});

// FoiaReadingRoom belongs to User (created by, updated by, published by)
FoiaReadingRoom.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

FoiaReadingRoom.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

FoiaReadingRoom.belongsTo(User, {
  foreignKey: 'publishedBy',
  as: 'publisher'
});
User.hasMany(FoiaReadingRoom, {
  foreignKey: 'publishedBy',
  as: 'publishedReadingRoomEntries'
});

// FoiaTemplate belongs to User (created by, updated by)
FoiaTemplate.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});
User.hasMany(FoiaTemplate, {
  foreignKey: 'createdBy',
  as: 'createdFoiaTemplates'
});

FoiaTemplate.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

// ============================================================================
// FOIA AI ANALYSIS RELATIONSHIPS
// ============================================================================

// FoiaAIAnalysis belongs to FoiaRequest
FoiaAIAnalysis.belongsTo(FoiaRequest, {
  foreignKey: 'requestId',
  as: 'request'
});
FoiaRequest.hasMany(FoiaAIAnalysis, {
  foreignKey: 'requestId',
  as: 'aiAnalyses'
});

// FoiaAIAnalysis has many FoiaExtractedEntities
FoiaAIAnalysis.hasMany(FoiaExtractedEntity, {
  foreignKey: 'analysisId',
  as: 'extractedEntities'
});
FoiaExtractedEntity.belongsTo(FoiaAIAnalysis, {
  foreignKey: 'analysisId',
  as: 'analysis'
});

// Document Analysis Relationships
FoiaDocument.hasOne(DocumentAnalysis, {
  foreignKey: 'documentId',
  as: 'analysis'
});
DocumentAnalysis.belongsTo(FoiaDocument, {
  foreignKey: 'documentId',
  as: 'document'
});

// DocumentAnalysis has many DetectedPII
DocumentAnalysis.hasMany(DetectedPII, {
  foreignKey: 'analysisId',
  as: 'detectedPII'
});
DetectedPII.belongsTo(DocumentAnalysis, {
  foreignKey: 'analysisId',
  as: 'analysis'
});

// DetectedPII has one RedactionSuggestion
DetectedPII.hasOne(RedactionSuggestion, {
  foreignKey: 'piiId',
  as: 'redactionSuggestion'
});
RedactionSuggestion.belongsTo(DetectedPII, {
  foreignKey: 'piiId',
  as: 'pii'
});

// RedactionSuggestion belongs to User (reviewer)
RedactionSuggestion.belongsTo(User, {
  foreignKey: 'reviewedBy',
  as: 'reviewer'
});

// DocumentAnalysis has many ExemptionClassifications
DocumentAnalysis.hasMany(ExemptionClassification, {
  foreignKey: 'analysisId',
  as: 'exemptions'
});
ExemptionClassification.belongsTo(DocumentAnalysis, {
  foreignKey: 'analysisId',
  as: 'analysis'
});

// ============================================================================
// EXPORT ALL MODELS
// ============================================================================

module.exports = {
  sequelize,
  User,
  Permit,
  Inspection,
  Document,
  Payment,
  Notification,
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  Task,
  Contact,
  ContactInteraction,
  Grant,
  GrantApplication,
  SecureChannel,
  SecureMessage,
  ChannelMember,
  SecurityEvent,
  SecurityAlert,
  PublicComment,
  TownHallMeeting,
  Survey,
  Poll,
  FoiaRequest,
  FoiaDocument,
  FoiaRedaction,
  FoiaCommunication,
  FoiaActivityLog,
  FoiaReadingRoom,
  FoiaTemplate,
  FoiaExemption,
  FoiaAIAnalysis,
  FoiaExtractedEntity,
  DocumentAnalysis,
  DetectedPII,
  RedactionSuggestion,
  ExemptionClassification
};
