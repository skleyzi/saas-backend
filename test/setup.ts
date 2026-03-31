import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';

export default function globalSetup() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test.local') });
  execSync('pnpm prisma migrate deploy', { env: process.env });
}
