// PreToolUse hook for the `testing` subagent: blocks Bash commands that write
// to the project or change git state. Exit code 2 blocks the call and sends
// stderr back to the agent.
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0);
  }

  // Allow harmless redirections before checking for writes.
  const cleaned = cmd
    .replace(/\d?>&\d/g, "")
    .replace(/\d?>\s*\/dev\/null/g, "")
    .replace(/\d?>\s*nul\b/gi, "");

  const rules = [
    [/\bgit\s+(commit|checkout|switch|stash|reset|restore|add|rm|mv|clean|push|pull|merge|rebase|cherry-pick|revert|tag|apply|am)\b/, "git que cambia estado"],
    [/\b(rm|rmdir|mv|cp|touch|mkdir|chmod|tee|truncate)\s/, "comando que escribe archivos"],
    [/\bsed\s+(-[a-zA-Z]*i|--in-place)/, "sed -i"],
    [/>/, "redirección a archivo"],
    [/\b(npm|pnpm|yarn)\s+(i|install|add|remove|uninstall|update|ci)\b/, "cambio de dependencias"],
    [/--fix\b|--write\b/, "autocorrección (--fix/--write)"],
    [/\bnpm\s+run\s+(deploy|preview)\b/, "deploy"],
    [/\bplaywright\s+(test|install)\b|\bnpm\s+run\s+e2e(?!:local)\b/, "e2e solo con npm run e2e:local (comprueba que Supabase es local)"],
    [/\be2e:local\b.*\s(-u|--update-snapshots)\b/, "actualizar snapshots escribe archivos"],
    [/(^|[;&|(]\s*)(npx\s+)?supabase\s+(?!status\b)\S/, "supabase solo admite status en testing"],
    [/\b(Set-Content|Out-File|Add-Content|Remove-Item|New-Item|Move-Item|Copy-Item)\b/i, "cmdlet que escribe"],
  ];

  for (const [re, why] of rules) {
    if (re.test(cleaned)) {
      process.stderr.write(
        `Bloqueado (${why}): testing solo lee y comprueba. Comando: ${cmd}\n`,
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
