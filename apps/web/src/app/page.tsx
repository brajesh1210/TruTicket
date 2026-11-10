import { redirect } from "next/navigation";

/** Public landing pages are not in the 18-screen count (PLAN §4). Root goes to the organiser portal. */
export default function Home() {
  redirect("/organiser");
}
