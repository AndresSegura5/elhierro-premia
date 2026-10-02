import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const projectRef = "xbkojjftmyqzbpuoptqh";
const credentialsPath = resolve(process.cwd(), ".data", "credenciales-supabase.md");
const lookupKeyPath = resolve(process.cwd(), ".data", "public-lookup-hmac-preview.txt");

const credentials = readFileSync(credentialsPath, "utf8");
const passwords = [...credentials.matchAll(/`([^`\s]+)`/g)];
const databasePassword = passwords.at(-1)?.[1];

if (!databasePassword) {
  throw new Error("No se pudo leer la contraseña local de Supabase preview.");
}

const databaseUrl = new URL("postgresql://aws-0-eu-west-1.pooler.supabase.com:6543/postgres");
databaseUrl.username = `postgres.${projectRef}`;
databaseUrl.password = databasePassword;
databaseUrl.searchParams.set("sslmode", "require");

const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  COUPON_LOOKUP_HMAC_KEY: readFileSync(lookupKeyPath, "utf8").trim(),
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

const nextCli = resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  env: environment,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
