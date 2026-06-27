import bcrypt from 'bcryptjs';
import { connectDatabases } from '../config/db.js';
import { env } from '../config/env.js';
import { getUserModel } from '../modules/auth/user.model.js';
import { ensureRoles } from '../modules/auth/service.js';

const USERS = [
  {
    username: 'mis.dev',
    fullName: 'MIS Developer',
    email: 'mis@bcvs.local',
    password: 'Password123!',
    role: 'developer',
  },
  {
    username: 'registrar.head',
    fullName: 'Registrar Head',
    email: 'registrar@bcvs.local',
    password: 'Password123!',
    role: 'super_admin',
  },
  {
    username: 'staff.admin',
    fullName: 'Staff Admin',
    email: 'admin@bcvs.local',
    password: 'Password123!',
    role: 'admin',
  },
  {
    username: 'cashier.user',
    fullName: 'Cashier User',
    email: 'cashier@bcvs.local',
    password: 'Password123!',
    role: 'cashier',
  },
];

await connectDatabases();
await ensureRoles();

const User = getUserModel();

for (const item of USERS) {
  const existing = await User.findOne({ email: item.email.toLowerCase() });

  if (existing) {
    console.log(`skip: ${item.email}`);
    continue;
  }

  const passwordHash = await bcrypt.hash(item.password, Number(env.bcryptSaltRounds || 10));

  await User.create({
    kind: 'web',
    role: item.role,
    username: item.username,
    fullName: item.fullName,
    email: item.email.toLowerCase(),
    password: passwordHash,
    isActive: true,
  });

  console.log(`created: ${item.email} (${item.role})`);
}

console.log('seed complete');
process.exit(0);
