/**
 * Script to ensure user has ADMIN role
 * This will update the role in the database directly
 */

// Set DATABASE_URL before loading Prisma
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

const prisma = require('../lib/prisma');
const { adminEmails } = require('../config/admin');

async function fixAdminRoles() {
  try {
    console.log('Checking admin emails from config:', adminEmails);
    
    // Update all users whose emails are in the admin whitelist
    for (const email of adminEmails) {
      console.log(`\nProcessing: ${email}`);
      
      const user = await prisma.user.findUnique({
        where: { email },
      });
      
      if (!user) {
        console.log(`  ❌ User not found. They need to sign in first.`);
        continue;
      }
      
      console.log(`  Found user: ${user.email}`);
      console.log(`  Current role: ${user.role}`);
      
      if (user.role !== 'ADMIN') {
        console.log(`  ⚠️  Updating role from ${user.role} to ADMIN...`);
        
        const updated = await prisma.user.update({
          where: { email },
          data: { role: 'ADMIN' },
        });
        
        console.log(`  ✅ Updated! New role: ${updated.role}`);
      } else {
        console.log(`  ✅ Already has ADMIN role`);
      }
    }
    
    // Also list all users for debugging
    console.log('\n--- All Users in Database ---');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    if (allUsers.length === 0) {
      console.log('No users found in database.');
    } else {
      allUsers.forEach(user => {
        console.log(`  ${user.email} - Role: ${user.role} (Created: ${user.createdAt.toISOString()})`);
      });
    }
    
    await prisma.$disconnect();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixAdminRoles();

