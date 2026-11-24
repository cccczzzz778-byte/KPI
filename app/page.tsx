import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PublicDashboard from "@/components/public-dashboard";
import { requireAppUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// Umumiy dashboard faqat administrator uchun. Baholovchi o'z baholash sahifasiga,
// tizimga kirmagan foydalanuvchi login sahifasiga yuboriladi.
async function visitorRole() {
  const incoming = await headers();
  const request = new Request("http://internal/", {
    headers: {
      cookie: incoming.get("cookie") ?? "",
      "user-agent": incoming.get("user-agent") ?? "",
    },
  });
  try {
    const user = await requireAppUser(request);
    return String(user.role || "");
  } catch {
    return "";
  }
}

export default async function Home() {
  const role = await visitorRole();
  if (role === "evaluator") redirect("/evaluator");
  if (role !== "admin") redirect("/login");
  return <PublicDashboard />;
}
