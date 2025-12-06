/**
 * Demo Data Seeder
 * Populates database with realistic sample data for demonstrations
 */

const { sequelize, User, Permit, Inspection, Document, Payment, Notification, Contact, ContactInteraction, Grant, GrantApplication, Task, Workflow, WorkflowExecution, WorkflowStep } = require('../models');

async function seedDemoData() {
  console.log('🌱 Seeding demo data...');

  try {
    // Create demo users
    console.log('👥 Creating demo users...');

    const demoUsers = [];

    // Admin user
    const adminUser = await User.findOrCreate({
      where: { email: 'demo.admin@govli.ai' },
      defaults: {
        email: 'demo.admin@govli.ai',
        password: 'Demo123$',
        name: 'Demo Administrator',
        role: 'admin',
        phone: '555-0100',
        address: '123 Government Plaza, Demo City, DC 20001'
      }
    });
    demoUsers.push(adminUser[0]);

    // Staff users
    const staff1 = await User.findOrCreate({
      where: { email: 'demo.staff@govli.ai' },
      defaults: {
        email: 'demo.staff@govli.ai',
        password: 'Demo123$',
        name: 'Sarah Johnson',
        role: 'staff',
        phone: '555-0101',
        address: '456 City Hall Ave, Demo City, DC 20001'
      }
    });
    demoUsers.push(staff1[0]);

    // Inspector
    const inspector = await User.findOrCreate({
      where: { email: 'demo.inspector@govli.ai' },
      defaults: {
        email: 'demo.inspector@govli.ai',
        password: 'Demo123$',
        name: 'Michael Chen',
        role: 'inspector',
        phone: '555-0102',
        address: '789 Inspection Blvd, Demo City, DC 20001'
      }
    });
    demoUsers.push(inspector[0]);

    // Citizen users
    const citizens = [];
    const citizenData = [
      { name: 'James Wilson', email: 'james.wilson@example.com', phone: '555-0201' },
      { name: 'Maria Garcia', email: 'maria.garcia@example.com', phone: '555-0202' },
      { name: 'Robert Taylor', email: 'robert.taylor@example.com', phone: '555-0203' },
      { name: 'Jennifer Lee', email: 'jennifer.lee@example.com', phone: '555-0204' },
      { name: 'David Brown', email: 'david.brown@example.com', phone: '555-0205' }
    ];

    for (const citizen of citizenData) {
      const user = await User.findOrCreate({
        where: { email: citizen.email },
        defaults: {
          email: citizen.email,
          password: 'Demo123$',
          name: citizen.name,
          role: 'citizen',
          phone: citizen.phone,
          address: `${Math.floor(Math.random() * 9999)} Main St, Demo City, DC 20001`
        }
      });
      citizens.push(user[0]);
    }

    console.log(`✅ Created ${demoUsers.length + citizens.length} demo users`);

    // Create demo permits
    console.log('📋 Creating demo permits...');

    const permitTypes = ['Building', 'Zoning', 'Business License', 'Special Event', 'Demolition'];
    const permitStatuses = ['submitted', 'under_review', 'approved', 'rejected', 'issued'];

    const permits = [];
    for (let i = 0; i < 15; i++) {
      const citizen = citizens[i % citizens.length];
      const permit = await Permit.create({
        type: permitTypes[i % permitTypes.length],
        status: permitStatuses[i % permitStatuses.length],
        applicantName: citizen.name,
        applicantEmail: citizen.email,
        propertyAddress: `${1000 + i * 100} Demo Street, Demo City, DC 20001`,
        projectDescription: `Demo ${permitTypes[i % permitTypes.length]} permit application for property development`
      });
      permits.push(permit);
    }

    console.log(`✅ Created ${permits.length} demo permits`);

    // Create demo inspections
    console.log('🔍 Creating demo inspections...');

    const inspectionTypes = ['Safety', 'Electrical', 'Plumbing', 'Structural', 'Final'];
    const inspectionStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'failed'];

    for (let i = 0; i < 10; i++) {
      await Inspection.create({
        permitId: permits[i].id,
        type: inspectionTypes[i % inspectionTypes.length],
        status: inspectionStatuses[i % inspectionStatuses.length],
        inspectorId: inspector[0].id,
        scheduledDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)), // Spread over next 10 days
        notes: `Demo inspection notes for ${inspectionTypes[i % inspectionTypes.length]} inspection`,
        result: i % 2 === 0 ? 'passed' : (i % 3 === 0 ? 'failed' : null)
      });
    }

    console.log(`✅ Created 10 demo inspections`);

    // Create demo payments
    console.log('💰 Creating demo payments...');

    const paymentStatuses = ['pending', 'completed', 'failed', 'refunded'];
    const paymentTypes = ['permit_fee', 'inspection_fee', 'renewal_fee', 'late_fee'];

    for (let i = 0; i < 12; i++) {
      await Payment.create({
        userId: citizens[i % citizens.length].id,
        permitId: permits[i % permits.length].id,
        amount: Math.floor(Math.random() * 500) + 50,
        status: paymentStatuses[i % paymentStatuses.length],
        paymentMethod: i % 2 === 0 ? 'credit_card' : 'ach',
        paymentType: paymentTypes[i % paymentTypes.length],
        transactionId: `DEMO-${Date.now()}-${i}`,
        paidAt: i % 4 === 0 ? new Date() : null
      });
    }

    console.log(`✅ Created 12 demo payments`);

    // Create demo contacts (CRM)
    console.log('📇 Creating demo contacts...');

    const contactStatuses = ['active', 'inactive', 'archived'];

    const contacts = [];
    const contactData = [
      { firstName: 'John', lastName: 'Smith', organization: 'Acme Construction LLC', type: 'business', phone: '555-1001', email: 'contact@acmeconstruction.com' },
      { firstName: 'Sarah', lastName: 'Green', organization: 'Green Energy Solutions', type: 'vendor', phone: '555-1002', email: 'info@greenenergy.com' },
      { firstName: 'Michael', lastName: 'Thompson', organization: 'State Environmental Agency', type: 'government', phone: '555-1003', email: 'contact@state-env.gov' },
      { firstName: 'Lisa', lastName: 'Rodriguez', organization: 'Community Development Corp', type: 'business', phone: '555-1004', email: 'info@commdev.org' },
      { firstName: 'David', lastName: 'Anderson', organization: 'Local Business Association', type: 'business', phone: '555-1005', email: 'admin@localbiz.org' }
    ];

    for (let i = 0; i < contactData.length; i++) {
      const contact = await Contact.create({
        firstName: contactData[i].firstName,
        lastName: contactData[i].lastName,
        organization: contactData[i].organization,
        contactType: contactData[i].type,
        email: contactData[i].email,
        phone: contactData[i].phone,
        status: contactStatuses[i % contactStatuses.length],
        address: `${1000 + i * 200} Business Parkway, Demo City, DC 20001`,
        notes: `Demo ${contactData[i].type} contact`,
        tags: ['demo', contactData[i].type]
      });
      contacts.push(contact);

      // Add interactions
      await ContactInteraction.create({
        contactId: contact.id,
        handledBy: staff1[0].id,
        type: 'email',
        subject: 'Initial Contact',
        content: 'Demo interaction - initial outreach',
        completedDate: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000)
      });
    }

    console.log(`✅ Created ${contacts.length} demo contacts with interactions`);

    // Create demo grants
    console.log('🎁 Creating demo grants...');

    const grants = [];
    const grantData = [
      { title: 'Small Business Development Grant', grantNumber: 'SBDG-2025-001', agencyName: 'Economic Development Agency', amount: 50000, category: 'economic_development' },
      { title: 'Community Infrastructure Fund', grantNumber: 'CIF-2025-002', agencyName: 'Infrastructure Department', amount: 100000, category: 'infrastructure' },
      { title: 'Green Initiative Grant', grantNumber: 'GIG-2025-003', agencyName: 'Environmental Protection Agency', amount: 25000, category: 'environment' },
      { title: 'Historic Preservation Fund', grantNumber: 'HPF-2025-004', agencyName: 'Cultural Affairs Department', amount: 75000, category: 'other' }
    ];

    for (let idx = 0; idx < grantData.length; idx++) {
      const grantInfo = grantData[idx];
      const grant = await Grant.create({
        grantNumber: grantInfo.grantNumber,
        title: grantInfo.title,
        agencyName: grantInfo.agencyName,
        description: `Demo grant for ${grantInfo.category} projects`,
        estimatedTotalFunding: grantInfo.amount,
        awardCeiling: grantInfo.amount,
        category: grantInfo.category,
        closeDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: 'open',
        eligibilityRequirements: 'Demo eligibility requirements for this grant opportunity'
      });
      grants.push(grant);

      // Create some applications
      for (let i = 0; i < 2; i++) {
        const applicantContact = contacts[i % contacts.length];
        const appNumber = `APP-${grantInfo.grantNumber}-${String(i + 1).padStart(3, '0')}`;
        await GrantApplication.create({
          grantId: grant.id,
          applicantId: adminUser[0].id, // Use admin user as applicant since applicantId references Users table
          applicationNumber: appNumber,
          projectTitle: `Demo Project for ${grantInfo.title}`,
          projectDescription: 'Comprehensive demo project description for demonstration purposes',
          requestedAmount: Math.floor(grantInfo.amount * 0.7),
          status: i % 2 === 0 ? 'submitted' : 'in_review',
          submittedDate: new Date()
        });
      }
    }

    console.log(`✅ Created ${grants.length} demo grants with applications`);

    // Create demo notifications
    console.log('🔔 Creating demo notifications...');

    for (let i = 0; i < 8; i++) {
      await Notification.create({
        userId: citizens[i % citizens.length].id,
        type: i % 2 === 0 ? 'permit_update' : 'payment_reminder',
        title: i % 2 === 0 ? 'Permit Status Update' : 'Payment Due',
        message: i % 2 === 0
          ? 'Your permit application has been updated'
          : 'You have a pending payment due',
        isRead: i % 3 === 0,
        priority: i % 4 === 0 ? 'high' : 'normal'
      });
    }

    console.log(`✅ Created 8 demo notifications`);

    // Create demo tasks
    console.log('✅ Creating demo tasks...');

    const taskPriorities = ['low', 'normal', 'high', 'urgent'];
    const taskStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

    for (let i = 0; i < 10; i++) {
      await Task.create({
        title: `Demo Task ${i + 1}: Review Application`,
        description: `Demo task for reviewing permit application #${i + 1}`,
        assignedTo: i % 2 === 0 ? staff1[0].id : inspector[0].id,
        priority: taskPriorities[i % taskPriorities.length],
        status: taskStatuses[i % taskStatuses.length],
        dueDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)),
        relatedEntityType: 'permit',
        relatedEntityId: permits[i % permits.length].id
      });
    }

    console.log(`✅ Created 10 demo tasks`);

    console.log('\n✅ Demo data seeding complete!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${demoUsers.length + citizens.length}`);
    console.log(`   Permits: ${permits.length}`);
    console.log(`   Inspections: 10`);
    console.log(`   Payments: 12`);
    console.log(`   Contacts: ${contacts.length}`);
    console.log(`   Grants: ${grants.length}`);
    console.log(`   Grant Applications: ${grants.length * 2}`);
    console.log(`   Notifications: 8`);
    console.log(`   Tasks: 10`);
    console.log('\n🔑 Demo Login Credentials:');
    console.log('   Admin: demo.admin@govli.ai / Demo123$');
    console.log('   Staff: demo.staff@govli.ai / Demo123$');
    console.log('   Inspector: demo.inspector@govli.ai / Demo123$');
    console.log('   Citizens: james.wilson@example.com / Demo123$ (and others)');

    return true;
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoData()
    .then(() => {
      console.log('\n✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedDemoData;
