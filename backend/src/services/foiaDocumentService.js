/**
 * FOIA Document Classification & Redaction Service
 * Handles automatic document type detection, PII identification,
 * and FOIA exemption classification
 */

const {
  DocumentAnalysis,
  DetectedPII,
  RedactionSuggestion,
  ExemptionClassification,
  FoiaDocument
} = require('../models');

class FOIADocumentService {
  constructor() {
    // Document type classification keywords
    this.documentTypeSignatures = {
      invoice: ['invoice', 'bill', 'amount due', 'payment terms', 'invoice number', 'total amount', 'account number'],
      email: ['from:', 'to:', 'subject:', 'sent:', 'cc:', 'bcc:', 'reply-to:', '@'],
      memo: ['memorandum', 'memo', 'to:', 'from:', 'date:', 're:', 'subject:'],
      report: ['executive summary', 'findings', 'recommendations', 'analysis', 'conclusion', 'methodology'],
      contract: ['agreement', 'whereas', 'party of the first part', 'terms and conditions', 'hereby agree', 'signature'],
      letter: ['dear', 'sincerely', 'yours truly', 'best regards', 'respectfully'],
      form: ['please fill out', 'section', 'part', 'checkbox', 'signature', 'date signed'],
      minutes: ['meeting minutes', 'attendees', 'agenda', 'motion carried', 'adjourned'],
      policy: ['policy', 'procedure', 'guidelines', 'shall', 'must', 'required', 'prohibited']
    };

    // PII detection patterns
    this.piiPatterns = {
      SSN: {
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
        confidence: 0.95
      },
      PHONE: {
        regex: /\b(\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
        confidence: 0.90
      },
      EMAIL: {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        confidence: 0.95
      },
      CREDIT_CARD: {
        regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        confidence: 0.85
      },
      DRIVERS_LICENSE: {
        regex: /\b[A-Z]{1,2}\d{5,8}\b/g,
        confidence: 0.70
      },
      DOB: {
        regex: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g,
        confidence: 0.75
      },
      ADDRESS: {
        regex: /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way)\b/gi,
        confidence: 0.80
      },
      ZIP_CODE: {
        regex: /\b\d{5}(-\d{4})?\b/g,
        confidence: 0.75
      }
    };

    // FOIA Exemption classifications
    this.exemptionClassifiers = {
      b1: {
        name: 'National Security',
        keywords: ['classified', 'top secret', 'confidential', 'national security', 'defense', 'intelligence'],
        confidence: 0.85
      },
      b2: {
        name: 'Internal Personnel Rules',
        keywords: ['internal', 'personnel', 'administrative', 'housekeeping', 'routine'],
        confidence: 0.70
      },
      b3: {
        name: 'Statutory Exemption',
        keywords: ['exempt by statute', 'prohibited by law', 'statute prohibits'],
        confidence: 0.80
      },
      b4: {
        name: 'Trade Secrets',
        keywords: ['trade secret', 'proprietary', 'confidential business', 'commercial', 'competitive'],
        confidence: 0.75
      },
      b5: {
        name: 'Deliberative Process',
        keywords: ['draft', 'deliberative', 'predecisional', 'attorney-client', 'work product', 'privileged'],
        confidence: 0.80
      },
      b6: {
        name: 'Personal Privacy',
        keywords: ['personal privacy', 'private information', 'medical records', 'personnel file'],
        confidence: 0.85
      },
      b7: {
        name: 'Law Enforcement',
        keywords: ['investigation', 'law enforcement', 'criminal', 'ongoing investigation', 'confidential source'],
        confidence: 0.75
      },
      b8: {
        name: 'Financial Institutions',
        keywords: ['financial institution', 'bank examination', 'regulatory'],
        confidence: 0.70
      },
      b9: {
        name: 'Geological Information',
        keywords: ['geological', 'geophysical', 'well', 'oil', 'gas'],
        confidence: 0.70
      }
    };
  }

  /**
   * Analyze a document for type, PII, and exemptions
   */
  async analyzeDocument(documentId, text, options = {}) {
    const startTime = Date.now();

    try {
      // Get or create analysis record
      let analysis = await DocumentAnalysis.findOne({ where: { documentId } });

      if (!analysis) {
        analysis = await DocumentAnalysis.create({
          documentId,
          processingStatus: 'processing'
        });
      } else {
        await analysis.update({ processingStatus: 'processing' });
      }

      // 1. Classify document type
      const documentType = this.classifyDocumentType(text);

      // 2. Detect PII
      const detectedPII = await this.detectPII(text, analysis.id);

      // 3. Classify exemptions
      const exemptions = await this.classifyExemptions(text, analysis.id);

      // 4. Generate redaction suggestions
      const redactionSuggestions = await this.generateRedactionSuggestions(detectedPII);

      // Update analysis with results
      await analysis.update({
        documentType: documentType.type,
        typeConfidence: documentType.confidence,
        pageCount: options.pageCount || 1,
        processingStatus: 'completed',
        metadata: {
          processingTimeMs: Date.now() - startTime,
          piiCount: detectedPII.length,
          exemptionCount: exemptions.length,
          redactionCount: redactionSuggestions.length
        }
      });

      return {
        analysisId: analysis.id,
        documentType,
        detectedPII,
        exemptions,
        redactionSuggestions,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Document analysis error:', error);
      throw error;
    }
  }

  /**
   * Classify document type based on content analysis
   */
  classifyDocumentType(text) {
    const lowercaseText = text.toLowerCase();
    const scores = {};

    // Calculate match scores for each document type
    for (const [type, keywords] of Object.entries(this.documentTypeSignatures)) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (lowercaseText.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }
      scores[type] = matchCount / keywords.length;
    }

    // Find best match
    let bestType = 'other';
    let bestScore = 0.2; // Minimum threshold

    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return {
      type: bestType,
      confidence: Math.min(bestScore, 1.0),
      scores
    };
  }

  /**
   * Detect PII in document text
   */
  async detectPII(text, analysisId) {
    const detected = [];

    for (const [piiType, config] of Object.entries(this.piiPatterns)) {
      const matches = text.matchAll(config.regex);

      for (const match of matches) {
        const value = match[0];
        const startPos = match.index;
        const endPos = startPos + value.length;

        // Extract context (50 chars before and after)
        const contextStart = Math.max(0, startPos - 50);
        const contextEnd = Math.min(text.length, endPos + 50);
        const context = text.substring(contextStart, contextEnd);

        // Additional validation for some PII types
        let confidence = config.confidence;
        if (piiType === 'CREDIT_CARD') {
          confidence = this.validateCreditCard(value) ? config.confidence : 0.50;
        } else if (piiType === 'SSN') {
          confidence = this.validateSSN(value) ? config.confidence : 0.70;
        }

        // Create PII record
        const pii = await DetectedPII.create({
          analysisId,
          piiType,
          value: this.hashSensitiveValue(value), // Store hashed for security
          pageNumber: 1, // TODO: Calculate from text position
          coordinates: null, // TODO: Calculate from OCR data if available
          confidence,
          context
        });

        detected.push({
          id: pii.id,
          type: piiType,
          value: '***REDACTED***', // Don't return actual value
          position: { start: startPos, end: endPos },
          confidence,
          context: context.replace(value, '***')
        });
      }
    }

    return detected;
  }

  /**
   * Classify potential FOIA exemptions
   */
  async classifyExemptions(text, analysisId) {
    const lowercaseText = text.toLowerCase();
    const exemptions = [];

    for (const [exemptionType, config] of Object.entries(this.exemptionClassifiers)) {
      let matchCount = 0;
      const matchedKeywords = [];

      for (const keyword of config.keywords) {
        if (lowercaseText.includes(keyword.toLowerCase())) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      const confidence = (matchCount / config.keywords.length) * config.confidence;

      if (confidence > 0.3) { // Threshold for suggestion
        const exemption = await ExemptionClassification.create({
          analysisId,
          exemptionType,
          exemptionName: config.name,
          confidence: Math.min(confidence, 1.0),
          reasoning: `Detected keywords: ${matchedKeywords.join(', ')}`,
          pageReferences: [1], // TODO: Track page numbers
          status: 'suggested'
        });

        exemptions.push({
          id: exemption.id,
          type: exemptionType,
          name: config.name,
          confidence: exemption.confidence,
          reasoning: exemption.reasoning
        });
      }
    }

    return exemptions;
  }

  /**
   * Generate redaction suggestions for detected PII
   */
  async generateRedactionSuggestions(detectedPII) {
    const suggestions = [];

    for (const pii of detectedPII) {
      // Determine redaction method based on PII type
      let redactionMethod = 'black_box';
      let reason = `Protect ${pii.type}`;

      if (pii.type === 'EMAIL' || pii.type === 'PHONE') {
        redactionMethod = 'replace';
        reason = `${pii.type} constitutes personal contact information`;
      } else if (pii.type === 'SSN' || pii.type === 'CREDIT_CARD') {
        redactionMethod = 'black_box';
        reason = `${pii.type} is highly sensitive personal information`;
      } else if (pii.type === 'ADDRESS') {
        redactionMethod = 'black_box';
        reason = 'Home address may reveal personal privacy information';
      }

      const suggestion = await RedactionSuggestion.create({
        piiId: pii.id,
        status: 'suggested',
        redactionMethod,
        reason
      });

      suggestions.push({
        id: suggestion.id,
        piiId: pii.id,
        piiType: pii.type,
        method: redactionMethod,
        reason,
        status: 'suggested'
      });
    }

    return suggestions;
  }

  /**
   * Apply approved redactions to a document
   */
  async applyRedactions(analysisId, approvedRedactionIds) {
    // This would integrate with a PDF processing library
    // For MVP, we'll just update the status

    for (const redactionId of approvedRedactionIds) {
      await RedactionSuggestion.update(
        { status: 'approved' },
        { where: { id: redactionId } }
      );
    }

    return {
      success: true,
      approvedCount: approvedRedactionIds.length,
      message: 'Redactions approved. Apply to document using PDF processor.'
    };
  }

  /**
   * Get analysis results for a document
   */
  async getAnalysisResults(documentId) {
    const analysis = await DocumentAnalysis.findOne({
      where: { documentId },
      include: [
        {
          model: DetectedPII,
          as: 'detectedPII',
          include: [{
            model: RedactionSuggestion,
            as: 'redactionSuggestion'
          }]
        },
        {
          model: ExemptionClassification,
          as: 'exemptions'
        }
      ]
    });

    if (!analysis) {
      return null;
    }

    return {
      analysisId: analysis.id,
      documentType: analysis.documentType,
      typeConfidence: analysis.typeConfidence,
      processingStatus: analysis.processingStatus,
      detectedPII: analysis.detectedPII.map(pii => ({
        id: pii.id,
        type: pii.piiType,
        confidence: pii.confidence,
        pageNumber: pii.pageNumber,
        redactionSuggestion: pii.redactionSuggestion
      })),
      exemptions: analysis.exemptions.map(ex => ({
        id: ex.id,
        type: ex.exemptionType,
        name: ex.exemptionName,
        confidence: ex.confidence,
        reasoning: ex.reasoning,
        status: ex.status
      })),
      metadata: analysis.metadata
    };
  }

  // Helper methods

  validateCreditCard(number) {
    // Basic Luhn algorithm check
    const digits = number.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  validateSSN(ssn) {
    const parts = ssn.split('-');
    if (parts.length !== 3) return false;

    const area = parseInt(parts[0]);
    const group = parseInt(parts[1]);
    const serial = parseInt(parts[2]);

    // Basic validation rules
    if (area === 0 || area === 666 || area >= 900) return false;
    if (group === 0 || serial === 0) return false;

    return true;
  }

  hashSensitiveValue(value) {
    // Simple hash for storage (in production, use crypto.createHash)
    return `***${value.slice(0, 2)}...${value.slice(-2)}***`;
  }
}

module.exports = new FOIADocumentService();
