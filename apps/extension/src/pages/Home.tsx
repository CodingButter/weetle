import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function Home() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">Weetle Extension</h1>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="bg-card p-6 rounded-lg border border-border">
        <h2 className="text-2xl font-semibold mb-4">Welcome!</h2>
        <p className="text-muted-foreground">
          This is a template browser extension built with:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
          <li>React 19</li>
          <li>TypeScript</li>
          <li>Tailwind CSS v4</li>
          <li>Bun for development</li>
          <li>Elysia backend</li>
          <li>Better Auth</li>
          <li>Prisma ORM</li>
        </ul>
      </div>
    </div>
  );
}
