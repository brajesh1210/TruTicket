import { PageHeader } from "@/components/ui";
import { CreateEventWizard } from "@/components/CreateEventWizard";

/** Create event wizard (PRD screen 16). */
export default function CreateEvent() {
  return (
    <>
      <PageHeader title="Create new event" subtitle="Five steps. Your draft is saved, and nothing goes live until an admin approves it." />
      <CreateEventWizard />
    </>
  );
}
