// Prints the env lines for the shared admin account.
//   npm run admin:password -- "your password"
// Paste the output into .env.local (local) or the hosting platform's env settings.
// `$` is escaped as `\$` for .env.local only: Next's env loader runs dotenv-expand,
// which would otherwise cut the bcrypt hash short (CLAUDE.md). Platform UIs take the raw hash.
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run admin:password -- "a password of at least 12 characters"');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
console.log(`ADMIN_PASSWORD_HASH=${hash.replaceAll("$", "\\$")}`);
console.log(`# raw hash, for hosting-platform env settings: ${hash}`);
