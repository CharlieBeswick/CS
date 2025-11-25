/**
 * Script to update user role to ADMIN
 * Run with: node scripts/update-admin-role.js
 */

const prisma = require('../lib/prisma');

async function updateAdminRole() {
  try {
    const email = 'cmbict@gmail.com';
    
    console.log(`Looking for user ${email}...`);
    
    // First, try to find the user
    let user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      console.log('❌ User not found in database.');
      console.log('📋 Listing all users:');
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, role: true },
      });
      console.log(allUsers);
      console.log('\n💡 You need to sign in first to create your user record.');
      await prisma.$disconnect();
      process.exit(1);
    }
    
    console.log(`Found user: ${user.email} (current role: ${user.role})`);
    console.log(`Updating to ADMIN role...`);
    
    user = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });
    
    console.log('✅ Success! User updated:', {
      id: user.id,
      email: user.email,
      role: user.role,
    });
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

updateAdminRole();
