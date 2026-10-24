import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL || "";
const usePostgres = Boolean(process.env.VERCEL) || /^postgres(ql)?:\/\//i.test(url);
const schema = usePostgres ? "prisma/schema.prisma" : "prisma/schema.sqlite.prisma";

const result = spawnSync("npx", ["prisma", "generate", "--schema", schema], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
