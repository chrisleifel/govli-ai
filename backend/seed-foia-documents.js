/**
 * Seed FOIA Documents for Testing Document Analysis
 */

const sequelize = require('./src/config/sequelize');
const { FoiaRequest, FoiaDocument, User } = require('./src/models');
const { v4: uuidv4 } = require('uuid');

async function seedDocuments() {
  console.log('🌱 Seeding FOIA documents for testing...');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Find admin user
    const adminUser = await User.findOne({ where: { email: 'admin@govli.ai' } });
    if (!adminUser) {
      console.error('❌ Admin user not found. Please run demo seed first.');
      process.exit(1);
    }

    // Create test FOIA requests
    console.log('Creating test FOIA requests...');

    const randomNum = Math.floor(Math.random() * 10000);
    const request1 = await FoiaRequest.create({
      id: uuidv4(),
      trackingNumber: `FOIA-DOC-${randomNum}1`,
      requesterName: 'John Smith',
      requesterEmail: 'john.smith@example.com',
      requesterPhone: '555-123-4567',
      requesterType: 'citizen',
      requestType: 'financial',
      subject: 'Financial Records Request',
      description: 'Requesting all financial records related to city budget for 2024',
      status: 'records_gathering',
      priority: 'normal',
      dateSubmitted: new Date('2025-01-15'),
      dateDue: new Date('2025-02-14'),
      assignedStaffId: adminUser.id
    });

    const request2 = await FoiaRequest.create({
      id: uuidv4(),
      trackingNumber: `FOIA-DOC-${randomNum}2`,
      requesterName: 'Jane Doe',
      requesterEmail: 'jane.doe@example.com',
      requesterPhone: '555-987-6543',
      requesterType: 'media',
      requestType: 'personnel',
      subject: 'Personnel Records Request',
      description: 'Requesting employment records for city employees',
      status: 'processing',
      priority: 'high',
      dateSubmitted: new Date('2025-01-20'),
      dateDue: new Date('2025-02-19'),
      assignedStaffId: adminUser.id
    });

    const request3 = await FoiaRequest.create({
      id: uuidv4(),
      trackingNumber: `FOIA-DOC-${randomNum}3`,
      requesterName: 'Bob Johnson',
      requesterEmail: 'bob.j@example.com',
      requesterType: 'citizen',
      requestType: 'contracts',
      subject: 'Contract Documents',
      description: 'Requesting all contracts with vendor ABC Corp',
      status: 'redaction',
      priority: 'normal',
      dateSubmitted: new Date('2025-01-25'),
      dateDue: new Date('2025-02-24'),
      assignedStaffId: adminUser.id
    });

    console.log('✅ Created 3 FOIA requests');

    // Create test documents
    console.log('Creating test documents...');

    const documents = [
      {
        requestId: request1.id,
        filename: 'Budget_Report_2024.pdf',
        fileType: 'application/pdf',
        fileSize: 524288,
        filePath: '/uploads/foia/budget_report_2024.pdf',
        uploadedBy: adminUser.id,
        documentType: 'responsive'
      },
      {
        requestId: request1.id,
        filename: 'Financial_Summary_Q4.pdf',
        fileType: 'application/pdf',
        fileSize: 312456,
        filePath: '/uploads/foia/financial_summary_q4.pdf',
        uploadedBy: adminUser.id,
        documentType: 'responsive'
      },
      {
        requestId: request2.id,
        filename: 'Employee_Roster_2024.pdf',
        fileType: 'application/pdf',
        fileSize: 456789,
        filePath: '/uploads/foia/employee_roster_2024.pdf',
        uploadedBy: adminUser.id,
        documentType: 'responsive'
      },
      {
        requestId: request2.id,
        filename: 'Personnel_Memo_Internal.pdf',
        fileType: 'application/pdf',
        fileSize: 234567,
        filePath: '/uploads/foia/personnel_memo.pdf',
        uploadedBy: adminUser.id,
        documentType: 'responsive'
      },
      {
        requestId: request3.id,
        filename: 'ABC_Corp_Contract_2023.pdf',
        fileType: 'application/pdf',
        fileSize: 678901,
        filePath: '/uploads/foia/abc_contract_2023.pdf',
        uploadedBy: adminUser.id,
        documentType: 'responsive'
      },
      {
        requestId: request3.id,
        filename: 'Invoice_ABC_Corp_Dec2023.pdf',
        fileType: 'application/pdf',
        fileSize: 145678,
        filePath: '/uploads/foia/invoice_abc_dec2023.pdf',
        uploadedBy: adminUser.id,
        documentType: 'responsive'
      },
      {
        requestId: request3.id,
        filename: 'Email_Thread_ABC_Contract.pdf',
        fileType: 'application/pdf',
        fileSize: 98765,
        filePath: '/uploads/foia/email_thread_abc.pdf',
        uploadedBy: adminUser.id,
        documentType: 'responsive'
      }
    ];

    for (const docData of documents) {
      await FoiaDocument.create({
        id: uuidv4(),
        ...docData,
        uploadedAt: new Date()
      });
    }

    console.log(`✅ Created ${documents.length} test documents`);

    console.log('\n🎉 Seed complete!');
    console.log('\n📋 Summary:');
    console.log(`   - 3 FOIA requests created`);
    console.log(`   - 7 documents created`);
    console.log(`   - Documents are ready for analysis`);
    console.log('\n🔗 Access the FOIA Admin Dashboard:');
    console.log('   http://localhost:8080/foia-admin-dashboard.html');
    console.log('\n💡 Click the "Document Review" tab to analyze documents');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedDocuments();
