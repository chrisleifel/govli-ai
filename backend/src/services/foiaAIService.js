/**
 * FOIA AI Service
 * Intelligent analysis of FOIA requests using pattern matching and NLP techniques
 */

const { FoiaAIAnalysis, FoiaExtractedEntity, FoiaRequest } = require('../models');
const { Op } = require('sequelize');

class FOIAAIService {
  constructor() {
    // Entity patterns for detection
    this.entityPatterns = {
      SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
      PHONE: /\b(\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
      EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      DATE: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g,
      MONEY: /\$[\d,]+(\.\d{2})?/g,
      CASE_NUMBER: /\b(case|file|docket|incident)[\s#-]*\d+[-\w]*/gi,
      ADDRESS: /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/gi
    };

    // Department keyword mapping
    this.departmentKeywords = {
      police: ['police', 'officer', 'arrest', 'incident', 'crime', 'patrol', 'detective', 'investigation', 'dispatch', '911'],
      building: ['permit', 'construction', 'building', 'inspection', 'zoning', 'code', 'violation', 'safety'],
      finance: ['budget', 'expenditure', 'contract', 'payment', 'invoice', 'procurement', 'bid', 'purchase', 'vendor'],
      hr: ['employee', 'salary', 'personnel', 'hiring', 'termination', 'benefits', 'job', 'staff', 'payroll'],
      legal: ['lawsuit', 'litigation', 'attorney', 'legal', 'settlement', 'claim', 'counsel'],
      clerk: ['meeting', 'minutes', 'agenda', 'resolution', 'ordinance', 'council', 'commission'],
      parks: ['park', 'recreation', 'facility', 'playground', 'maintenance', 'events'],
      public_works: ['road', 'water', 'sewer', 'infrastructure', 'utilities', 'maintenance', 'repair']
    };
  }

  /**
   * Analyze a FOIA request text comprehensively
   */
  async analyzeRequest(text, context = {}) {
    const startTime = Date.now();

    try {
      // 1. Extract entities
      const entities = this.extractEntities(text);

      // 2. Identify relevant departments
      const departments = this.identifyDepartments(text);

      // 3. Analyze scope and complexity
      const scopeAnalysis = this.analyzeScope(text, entities, departments);

      // 4. Find similar requests
      const similarRequests = await this.findSimilarRequests(text);

      // 5. Estimate fees and timeline
      const estimates = this.calculateEstimates(scopeAnalysis, departments);

      // 6. Generate suggestions
      const suggestions = this.generateSuggestions(text, scopeAnalysis);

      const processingTime = Date.now() - startTime;

      // Save analysis to database
      const analysis = await FoiaAIAnalysis.create({
        analysisType: 'comprehensive',
        inputText: text,
        analysisResult: {
          entities,
          departments,
          scopeAnalysis,
          similarRequests,
          estimates,
          suggestions
        },
        confidenceScore: this.calculateOverallConfidence(entities, departments, scopeAnalysis),
        modelVersion: 'v1.0',
        processingTimeMs: processingTime
      });

      // Save extracted entities
      for (const entity of entities) {
        await FoiaExtractedEntity.create({
          analysisId: analysis.id,
          entityType: entity.type,
          entityValue: entity.value,
          startPosition: entity.start,
          endPosition: entity.end,
          confidence: entity.confidence,
          contextSnippet: entity.context
        });
      }

      return {
        analysisId: analysis.id,
        entities,
        suggestedDepartments: departments,
        scopeAnalysis,
        similarRequests,
        feeEstimate: estimates.fee,
        processingTimeEstimate: estimates.timeline,
        suggestions
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extract entities from text using pattern matching
   */
  extractEntities(text) {
    const entities = [];

    // Pattern-based extraction
    for (const [type, pattern] of Object.entries(this.entityPatterns)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.95,
          method: 'pattern',
          context: this.getContext(text, match.index, 50)
        });
      }
    }

    // Basic NER for names and organizations
    const nerEntities = this.basicNER(text);
    entities.push(...nerEntities);

    return this.deduplicateEntities(entities);
  }

  /**
   * Basic Named Entity Recognition using heuristics
   */
  basicNER(text) {
    const entities = [];

    // Detect names (Title Case pattern)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      if (!this.isCommonPhrase(match[1])) {
        entities.push({
          type: 'PERSON',
          value: match[1],
          start: match.index,
          end: match.index + match[1].length,
          confidence: 0.7,
          method: 'heuristic',
          context: this.getContext(text, match.index, 50)
        });
      }
    }

    // Detect organizations
    const orgIndicators = ['Inc', 'LLC', 'Corp', 'Ltd', 'Company', 'Department', 'Office', 'Agency', 'Association'];
    for (const indicator of orgIndicators) {
      const orgPattern = new RegExp(`\\b([A-Z][\\w\\s]+)\\s+${indicator}\\.?\\b`, 'g');
      while ((match = orgPattern.exec(text)) !== null) {
        entities.push({
          type: 'ORG',
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.85,
          method: 'pattern',
          context: this.getContext(text, match.index, 50)
        });
      }
    }

    return entities;
  }

  /**
   * Identify relevant departments based on keywords
   */
  identifyDepartments(text) {
    const scores = {};
    const lowerText = text.toLowerCase();

    for (const [dept, keywords] of Object.entries(this.departmentKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          // Weight longer keywords more heavily
          score += matches.length * (keyword.length > 5 ? 2 : 1);
        }
      }
      if (score > 0) {
        scores[dept] = score;
      }
    }

    // Normalize and sort
    const maxScore = Math.max(...Object.values(scores), 1);
    return Object.entries(scores)
      .map(([dept, score]) => ({
        id: dept,
        name: this.formatDepartmentName(dept),
        relevanceScore: Math.round((score / maxScore) * 100) / 100,
        matchedKeywords: this.getMatchedKeywords(lowerText, this.departmentKeywords[dept])
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);
  }

  /**
   * Analyze scope, complexity, and detect ambiguities
   */
  analyzeScope(text, entities, departments) {
    const wordCount = text.split(/\s+/).length;
    const hasDateRange = /from|between|during|since|through|to\s+\d/i.test(text);
    const hasMultiple = /all|every|any|complete|entire|comprehensive/i.test(text);
    const departmentCount = departments.length;

    // Complexity scoring (0-1)
    let complexityScore = 0;
    complexityScore += wordCount > 100 ? 0.2 : wordCount > 50 ? 0.1 : 0;
    complexityScore += hasDateRange ? 0.1 : 0.2; // No date range is actually MORE complex
    complexityScore += hasMultiple ? 0.3 : 0;
    complexityScore += departmentCount > 2 ? 0.2 : departmentCount > 1 ? 0.1 : 0;
    complexityScore += entities.length > 5 ? 0.2 : entities.length > 3 ? 0.1 : 0;
    complexityScore = Math.min(complexityScore, 1);

    // Document volume estimation
    const baseEstimate = hasMultiple ? 200 : 50;
    const multiplier = departmentCount > 1 ? departmentCount * 0.7 : 1;

    // Ambiguity detection
    const ambiguities = [];

    if (/all\s+(communications?|correspondence|emails?)/i.test(text)) {
      ambiguities.push({
        issue: '"All communications" is very broad and may result in thousands of documents',
        suggestion: 'Consider specifying: emails only, or include texts/calls? Specific date range?',
        severity: 'high'
      });
    }

    if (/any|all/i.test(text) && !hasDateRange) {
      ambiguities.push({
        issue: 'No date range specified for a broad request',
        suggestion: 'Adding a date range (e.g., "from January 2024 to June 2024") will significantly speed up processing',
        severity: 'medium'
      });
    }

    const personEntities = entities.filter(e => e.type === 'PERSON');
    if (personEntities.length > 1) {
      ambiguities.push({
        issue: `Multiple people mentioned: ${personEntities.map(e => e.value).join(', ')}`,
        suggestion: 'Clarify which person\'s records you need, or confirm you need records for all mentioned individuals',
        severity: 'medium'
      });
    }

    if (wordCount < 20) {
      ambiguities.push({
        issue: 'Request is very brief and may lack necessary detail',
        suggestion: 'Consider adding more context about what specific records or information you\'re seeking',
        severity: 'low'
      });
    }

    return {
      estimatedDocuments: {
        min: Math.round(baseEstimate * multiplier * 0.5),
        max: Math.round(baseEstimate * multiplier * 2)
      },
      estimatedTimeframe: hasDateRange ? 'specified' : 'unspecified',
      complexityScore: Math.round(complexityScore * 100) / 100,
      ambiguities,
      hasDateRange,
      departmentCount,
      wordCount
    };
  }

  /**
   * Calculate fee and timeline estimates
   */
  calculateEstimates(scopeAnalysis, departments) {
    const { estimatedDocuments, complexityScore } = scopeAnalysis;
    const avgDocs = (estimatedDocuments.min + estimatedDocuments.max) / 2;

    // Fee estimation (configurable per jurisdiction)
    const searchFee = departments.length * 15; // $15 per department
    const reviewFee = avgDocs * 0.10; // $0.10 per page review
    const copyFee = avgDocs * 0.05; // $0.05 per page copy

    const feeEstimate = {
      min: Math.max(0, Math.round(searchFee + reviewFee * 0.3)),
      max: Math.round(searchFee + reviewFee + copyFee),
      factors: [
        `${departments.length} department(s) to search`,
        `Estimated ${estimatedDocuments.min}-${estimatedDocuments.max} documents`,
        'Review and redaction fees may apply',
        'First 2 hours of staff time may be free'
      ]
    };

    // Timeline estimation (business days)
    const baseDays = 10; // Standard FOIA response time
    const complexityDays = Math.round(complexityScore * 10);
    const volumeDays = Math.round(avgDocs / 100) * 2;
    const deptDays = departments.length > 2 ? 5 : 0;

    const totalDays = baseDays + complexityDays + volumeDays + deptDays;

    const timeline = {
      days: totalDays,
      businessDays: totalDays,
      calendarDays: Math.round(totalDays * 1.4), // Account for weekends
      confidence: complexityScore < 0.5 ? 0.85 : 0.65,
      factors: [
        `Base response time: ${baseDays} days`,
        complexityScore > 0.5 ? `Complex request: +${complexityDays} days` : null,
        volumeDays > 0 ? `High volume: +${volumeDays} days` : null,
        deptDays > 0 ? `Multiple departments: +${deptDays} days` : null
      ].filter(Boolean)
    };

    return { fee: feeEstimate, timeline };
  }

  /**
   * Find similar past requests using text similarity
   */
  async findSimilarRequests(text) {
    try {
      // Extract key terms (simple approach - words > 4 chars)
      const keyTerms = text
        .toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 4)
        .slice(0, 10);

      if (keyTerms.length === 0) return [];

      // Search for requests containing these terms
      const similarRequests = await FoiaRequest.findAll({
        where: {
          status: {
            [Op.in]: ['released', 'closed']  // Only valid completed statuses
          },
          [Op.or]: keyTerms.map(term => ({
            [Op.or]: [
              { subject: { [Op.iLike]: `%${term}%` } },
              { description: { [Op.iLike]: `%${term}%` } }
            ]
          }))
        },
        attributes: ['id', 'trackingNumber', 'subject', 'status', 'dateSubmitted', 'dateCompleted'],
        limit: 5,
        order: [['dateCompleted', 'DESC']]
      });

      return similarRequests.map(req => ({
        id: req.id,
        trackingNumber: req.trackingNumber,
        title: req.subject,
        similarity: 0.7, // Placeholder - would use actual similarity scoring
        hasPublicRecords: req.status === 'released'
      }));
    } catch (error) {
      console.error('Error finding similar requests:', error);
      return [];
    }
  }

  /**
   * Generate helpful suggestions for the requester
   */
  generateSuggestions(text, scopeAnalysis) {
    const suggestions = [];

    if (!scopeAnalysis.hasDateRange) {
      suggestions.push('Add a specific date range to narrow your request');
    }

    if (scopeAnalysis.ambiguities.length > 0) {
      suggestions.push('Review and clarify the ambiguities identified above');
    }

    if (scopeAnalysis.complexityScore > 0.7) {
      suggestions.push('Consider breaking this into multiple smaller requests for faster processing');
    }

    if (scopeAnalysis.wordCount < 30) {
      suggestions.push('Provide more detail about what specific information you\'re seeking');
    }

    return suggestions;
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(entities, departments, scopeAnalysis) {
    let confidence = 0.5; // Base confidence

    // More entities = higher confidence in understanding
    confidence += Math.min(entities.length * 0.05, 0.2);

    // Clear department match = higher confidence
    if (departments.length > 0 && departments[0].relevanceScore > 0.7) {
      confidence += 0.2;
    }

    // Fewer ambiguities = higher confidence
    confidence += Math.max(0, 0.3 - (scopeAnalysis.ambiguities.length * 0.1));

    return Math.min(Math.round(confidence * 100) / 100, 1.0);
  }

  /**
   * Helper: Get context around a match
   */
  getContext(text, position, radius) {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    return text.substring(start, end).trim();
  }

  /**
   * Helper: Check if text is a common phrase (not a name)
   */
  isCommonPhrase(text) {
    const common = [
      'The City', 'Public Records', 'City Council', 'Board Meeting',
      'United States', 'New York', 'Los Angeles', 'Freedom of Information'
    ];
    return common.some(phrase => text.includes(phrase));
  }

  /**
   * Helper: Deduplicate entities
   */
  deduplicateEntities(entities) {
    const seen = new Set();
    return entities.filter(e => {
      const key = `${e.type}:${e.value}:${e.start}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Helper: Format department name
   */
  formatDepartmentName(dept) {
    const names = {
      police: 'Police Department',
      building: 'Building & Safety',
      finance: 'Finance Department',
      hr: 'Human Resources',
      legal: 'Legal / City Attorney',
      clerk: 'City Clerk',
      parks: 'Parks & Recreation',
      public_works: 'Public Works'
    };
    return names[dept] || dept.charAt(0).toUpperCase() + dept.slice(1);
  }

  /**
   * Helper: Get matched keywords for a department
   */
  getMatchedKeywords(text, keywords) {
    return keywords.filter(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(text);
    }).slice(0, 3);
  }
}

module.exports = new FOIAAIService();
