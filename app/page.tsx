import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PublicDashboard from "@/components/public-dashboard";
import { requireAppUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// Tizim hozircha faqat administrator uchun ochiq: tizimga kirmagan yoki
// admin bo'lmagan foydalanuvchini boshi berk sahifa o'rniga login sahifasiga yuboramiz.
async function isAdminVisitor() {
  const incoming = await headers();
  const request = new Request("http://internal/", {
    headers: {
      cookie: incoming.get("cookie") ?? "",
      "user-agent": incoming.get("user-agent") ?? "",
    },
  });
  try {
    const user = await requireAppUser(request);
    return user.role === "admin";
  } catch {
    return false;
  }
}

export default async function Home() {
  if (!(await isAdminVisitor())) redirect("/login");
  return <PublicDashboard />;
}
