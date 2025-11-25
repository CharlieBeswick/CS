/**
 * Check and fix admin role for user
 * This script will:
 * 1. List all users
 * 2. Check if cmbict@gmail.com exists
 * 3. Update role to ADMIN if needed
 * 4. Show what the auth route will do on next login
 */

const prisma = require('../lib/prisma');
const { adminEmails } = require('../config/admin');

async function checkAndFix() {
  try {
    console.log('=== Admin Role Check & Fix ===\n');
    console.log('Admin emails from config:', adminEmails);
    console.log('');
    
    // List all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        googleSub: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`Total users in database: ${allUsers.length}\n`);
    
    if (allUsers.length === 0) {
      console.log('⚠️  No users found in database.');
      console.log('   This means you need to sign in at least once to create your user record.');
      console.log('   Once you sign in, the auth route will automatically set your role to ADMIN');
      console.log('   because your email (cmbict@gmail.com) is in the admin whitelist.\n');
    } else {
      console.log('Users in database:');
      allUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email}`);
        console.log(`     Role: ${user.role}`);
        console.log(`     Created: ${user.createdAt.toISOString()}`);
        console.log('');
      });
      
      // Check for admin email
      const adminEmail = 'cmbict@gmail.com';
      const user = allUsers.find(u => u.email === adminEmail);
      
      if (user) {
        console.log(`✅ Found user: ${adminEmail}`);
        console.log(`   Current role: ${user.role}`);
        
        if (user.role !== 'ADMIN') {
          console.log(`   ⚠️  Role is ${user.role}, updating to ADMIN...`);
          const updated = await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' },
          });
          console.log(`   ✅ Updated! New role: ${updated.role}`);
        } else {
          console.log(`   ✅ Already has ADMIN role`);
        }
      } else {
        console.log(`❌ User ${adminEmail} not found in database.`);
        console.log('   You need to sign in first to create your user record.');
        console.log('   After signing in, your role will be set to ADMIN automatically.');
      }
    }
    
    console.log('\n=== Next Steps ===');
    console.log('1. Make sure your server is running with the updated auth route');
    console.log('2. Sign out completely (if signed in)');
    console.log('3. Sign back in - your role should be set to ADMIN automatically');
    console.log('4. Try accessing /admin again\n');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkAndFix();

