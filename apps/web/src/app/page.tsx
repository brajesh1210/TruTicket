/**
 * Customer Web — Home / Explore
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#09090D] text-[#F5F5F7] p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">TruTicket</h1>
        <p className="text-gray-400 mt-2">Fair access. Genuine tickets. Controlled resale.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Event cards would go here — shadcn/ui components */}
        <div className="col-span-3 bg-[#12121A] p-6 rounded-xl border border-[#2A2A3A]">
          <h2 className="text-xl font-semibold text-white mb-4">Featured Events</h2>
          <p className="text-gray-400">Event cards will render here. Connect to Supabase to fetch live events.</p>
        </div>
      </section>
    </div>
  );
}