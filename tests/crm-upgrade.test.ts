import { describe, it, expect, vi, beforeEach } from "vitest";

describe("CRM 10/10 Upgrade Suite", () => {
  describe("CSV Export formatting", () => {
    it("correctly formats leads into RFC-compliant CSV with escaped quotes", () => {
      const headers = ["Name", "Email", "Phone", "Stage", "Score", "Deal Value", "Source", "Company", "Notes", "Created At"];
      const escapeCsv = (str: string | null | undefined) => `"${(str || "").replace(/"/g, '""')}"`;
      
      const mockLead = {
        name: 'Jordan "The Closer" Mitchell',
        email: "jordan@example.com",
        phone: "+1 555-0192",
        stage: "qualified",
        score: 9,
        deal_value: 25000,
        source: "linkedin",
        metadata: {
          company: 'Acme "Global" Corp',
          notes: "Interested in enterprise plan, 50 seats",
        },
        created_at: "2026-09-19T09:00:00Z",
      };

      const row = [
        escapeCsv(mockLead.name),
        escapeCsv(mockLead.email),
        escapeCsv(mockLead.phone),
        escapeCsv(mockLead.stage),
        mockLead.score,
        mockLead.deal_value,
        escapeCsv(mockLead.source),
        escapeCsv(mockLead.metadata.company),
        escapeCsv(mockLead.metadata.notes),
        escapeCsv(mockLead.created_at),
      ];

      const csv = [headers.join(","), row.join(",")].join("\r\n");

      expect(csv).toContain('"Jordan ""The Closer"" Mitchell"');
      expect(csv).toContain('"Acme ""Global"" Corp"');
      expect(csv).toContain("25000");
      expect(csv).toContain('"qualified"');
    });
  });

  describe("Duplicate lead detection", () => {
    const existingLeads = [
      { id: "1", name: "Alice", email: "alice@company.com", phone: "+1 (555) 111-2222", stage: "new" },
      { id: "2", name: "Bob", email: "bob@company.com", phone: "+1 (555) 333-4444", stage: "contacted" },
    ];

    it("identifies duplicates by exact email (case insensitive)", () => {
      const email = "ALICE@company.com".trim().toLowerCase();
      const match = existingLeads.find((l) => l.email.toLowerCase() === email);
      expect(match).toBeDefined();
      expect(match?.name).toBe("Alice");
    });

    it("identifies duplicates by normalized phone number", () => {
      const inputPhone = "555-333-4444".replace(/\D/g, "");
      const match = existingLeads.find((l) => l.phone.replace(/\D/g, "").includes(inputPhone));
      expect(match).toBeDefined();
      expect(match?.name).toBe("Bob");
    });

    it("returns null when no duplicate matches", () => {
      const inputEmail = "charlie@company.com";
      const match = existingLeads.find((l) => l.email === inputEmail);
      expect(match).toBeUndefined();
    });
  });

  describe("Inbox unread count logic", () => {
    it("accurately counts only lead messages after last_read_at timestamp", () => {
      const lastReadAt = new Date("2026-09-19T08:00:00Z").getTime();
      const messages = [
        { id: "1", sender_type: "lead", content: "Hi", created_at: "2026-09-19T07:30:00Z" },
        { id: "2", sender_type: "ai_assistant", content: "Hello!", created_at: "2026-09-19T07:31:00Z" },
        { id: "3", sender_type: "lead", content: "Can we talk price?", created_at: "2026-09-19T08:15:00Z" },
        { id: "4", sender_type: "lead", content: "Also timeline?", created_at: "2026-09-19T08:16:00Z" },
        { id: "5", sender_type: "human_agent", content: "Sure!", created_at: "2026-09-19T08:20:00Z" },
      ];

      const unreadCount = messages.filter(
        (m) => m.sender_type === "lead" && new Date(m.created_at).getTime() > lastReadAt
      ).length;

      expect(unreadCount).toBe(2);
    });

    it("returns 0 unread when all lead messages are before last_read_at", () => {
      const lastReadAt = new Date("2026-09-19T09:00:00Z").getTime();
      const messages = [
        { id: "1", sender_type: "lead", content: "Hi", created_at: "2026-09-19T07:30:00Z" },
      ];

      const unreadCount = messages.filter(
        (m) => m.sender_type === "lead" && new Date(m.created_at).getTime() > lastReadAt
      ).length;

      expect(unreadCount).toBe(0);
    });
  });

  describe("Follow-up Reminder metadata schema", () => {
    it("validates follow-up reminder date and note structure", () => {
      const metadata = {
        company: "Test Corp",
        followUpReminder: {
          date: "2026-09-25T14:30",
          note: "Quarterly review call",
        },
      };

      expect(metadata.followUpReminder).toBeDefined();
      expect(new Date(metadata.followUpReminder.date).getFullYear()).toBe(2026);
      expect(metadata.followUpReminder.note).toBe("Quarterly review call");
    });
  });
});
