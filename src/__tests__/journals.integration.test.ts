import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---- createJournal ----

describe("createJournal", () => {
  it("creates journal and adds creator to access list", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const journal = await mutationResolvers.createJournal(null, { title: "My Log" }, ctx);
    expect(journal.title).toBe("My Log");
    expect(journal.accessList).toHaveLength(1);
    expect(journal.accessList[0].userEmail).toBe(user.email);
  });

  it("sets as default when it is the first journal", async () => {
    const user = await createTestUser();
    const journal = await mutationResolvers.createJournal(null, { title: "First" }, makeCtx(user));
    expect(journal.defaultForUserId).toBe(user.id);
  });

  it("does NOT override existing default on second journal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const first = await mutationResolvers.createJournal(null, { title: "First" }, ctx);
    const second = await mutationResolvers.createJournal(null, { title: "Second" }, ctx);
    expect(first.defaultForUserId).toBe(user.id);
    expect(second.defaultForUserId).toBeNull();
  });

  it("rejects linking to both goal and project", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const project = await mutationResolvers.addProject(null, { title: "P" }, ctx);
    await expect(
      mutationResolvers.createJournal(null, { title: "J", linkedGoalId: goal.id, linkedProjectId: project.id }, ctx)
    ).rejects.toThrow();
  });
});

// ---- journals query ----

describe("journals query", () => {
  it("returns only journals the current user has access to", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const bob = await createTestUser({ email: "bob@example.com" });
    await mutationResolvers.createJournal(null, { title: "Alice's log" }, makeCtx(alice));
    await mutationResolvers.createJournal(null, { title: "Bob's log" }, makeCtx(bob));
    const aliceJournals = await queryResolvers.journals(null, {}, makeCtx(alice));
    expect(aliceJournals).toHaveLength(1);
    expect(aliceJournals[0].title).toBe("Alice's log");
  });

  it("excludes archived journals by default", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    await mutationResolvers.archiveJournal(null, { id: j.id }, ctx);
    const visible = await queryResolvers.journals(null, {}, ctx);
    expect(visible).toHaveLength(0);
    const withArchived = await queryResolvers.journals(null, { includeArchived: true }, ctx);
    expect(withArchived).toHaveLength(1);
  });

  it("includes shared journals where user was added by another user", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const bob = await createTestUser({ email: "bob@example.com", discoverableByEmail: true });
    const ctxAlice = makeCtx(alice);
    const journal = await mutationResolvers.createJournal(null, { title: "Shared" }, ctxAlice);
    await mutationResolvers.addJournalAccess(null, { journalId: journal.id, email: bob.email }, ctxAlice);
    const bobJournals = await queryResolvers.journals(null, {}, makeCtx(bob));
    expect(bobJournals).toHaveLength(1);
    expect(bobJournals[0].title).toBe("Shared");
  });
});

// ---- addJournalAccess ----

describe("addJournalAccess", () => {
  it("adds a discoverable user to the access list", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const bob = await createTestUser({ email: "bob@example.com", discoverableByEmail: true });
    const ctxAlice = makeCtx(alice);
    const journal = await mutationResolvers.createJournal(null, { title: "J" }, ctxAlice);
    const updated = await mutationResolvers.addJournalAccess(null, { journalId: journal.id, email: bob.email }, ctxAlice);
    expect(updated.accessList.map((a: any) => a.userEmail)).toContain(bob.email);
  });

  it("rejects adding a non-discoverable user with 'no user found'", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const bob = await createTestUser({ email: "bob@example.com" }); // discoverableByEmail = false by default
    const ctxAlice = makeCtx(alice);
    const journal = await mutationResolvers.createJournal(null, { title: "J" }, ctxAlice);
    await expect(
      mutationResolvers.addJournalAccess(null, { journalId: journal.id, email: bob.email }, ctxAlice)
    ).rejects.toThrow("No user found");
  });

  it("rejects adding a non-existent email with the same error", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const ctxAlice = makeCtx(alice);
    const journal = await mutationResolvers.createJournal(null, { title: "J" }, ctxAlice);
    await expect(
      mutationResolvers.addJournalAccess(null, { journalId: journal.id, email: "ghost@example.com" }, ctxAlice)
    ).rejects.toThrow("No user found");
  });

  it("is idempotent when email already on access list", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const bob = await createTestUser({ email: "bob@example.com", discoverableByEmail: true });
    const ctxAlice = makeCtx(alice);
    const journal = await mutationResolvers.createJournal(null, { title: "J" }, ctxAlice);
    await mutationResolvers.addJournalAccess(null, { journalId: journal.id, email: bob.email }, ctxAlice);
    const updated = await mutationResolvers.addJournalAccess(null, { journalId: journal.id, email: bob.email }, ctxAlice);
    expect(updated.accessList).toHaveLength(2); // alice + bob, not alice + bob + bob
  });
});

// ---- removeJournalAccess ----

describe("removeJournalAccess", () => {
  it("removes a member from the access list", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const bob = await createTestUser({ email: "bob@example.com", discoverableByEmail: true });
    const ctxAlice = makeCtx(alice);
    const journal = await mutationResolvers.createJournal(null, { title: "J" }, ctxAlice);
    await mutationResolvers.addJournalAccess(null, { journalId: journal.id, email: bob.email }, ctxAlice);
    const updated = await mutationResolvers.removeJournalAccess(null, { journalId: journal.id, email: bob.email }, ctxAlice);
    expect(updated.accessList.map((a: any) => a.userEmail)).not.toContain(bob.email);
  });

  it("rejects removing the last member", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const ctx = makeCtx(alice);
    const journal = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    await expect(
      mutationResolvers.removeJournalAccess(null, { journalId: journal.id, email: alice.email }, ctx)
    ).rejects.toThrow("last member");
  });
});

// ---- archiveJournal / deleteJournal ----

describe("archiveJournal + deleteJournal", () => {
  it("archives a journal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    const archived = await mutationResolvers.archiveJournal(null, { id: j.id }, ctx);
    expect(archived.isArchived).toBe(true);
  });

  it("cannot delete a non-archived journal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    await expect(
      mutationResolvers.deleteJournal(null, { id: j.id }, ctx)
    ).rejects.toThrow("archived");
  });

  it("deletes an archived journal and cascades entries", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    await mutationResolvers.createEntry(null, { journalId: j.id, body: "note" }, ctx);
    await mutationResolvers.archiveJournal(null, { id: j.id }, ctx);
    await mutationResolvers.deleteJournal(null, { id: j.id }, ctx);
    const found = await prisma.journal.findUnique({ where: { id: j.id } });
    expect(found).toBeNull();
    const entries = await prisma.journalEntry.findMany({ where: { journalId: j.id } });
    expect(entries).toHaveLength(0);
  });

  it("blocks access from a user not on the access list", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const eve = await createTestUser({ email: "eve@example.com" });
    const journal = await mutationResolvers.createJournal(null, { title: "Private" }, makeCtx(alice));
    await expect(
      mutationResolvers.archiveJournal(null, { id: journal.id }, makeCtx(eve))
    ).rejects.toThrow("Not found");
  });
});

// ---- setDefaultJournal ----

describe("setDefaultJournal", () => {
  it("changes the default journal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const first = await mutationResolvers.createJournal(null, { title: "First" }, ctx);
    const second = await mutationResolvers.createJournal(null, { title: "Second" }, ctx);
    await mutationResolvers.setDefaultJournal(null, { journalId: second.id }, ctx);
    const firstNow = await prisma.journal.findUnique({ where: { id: first.id } });
    const secondNow = await prisma.journal.findUnique({ where: { id: second.id } });
    expect(firstNow?.defaultForUserId).toBeNull();
    expect(secondNow?.defaultForUserId).toBe(user.id);
  });
});

// ---- entries ----

describe("createEntry / updateEntry / archiveEntry", () => {
  it("creates an entry in chronological order", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    await mutationResolvers.createEntry(null, { journalId: j.id, body: "first" }, ctx);
    await mutationResolvers.createEntry(null, { journalId: j.id, body: "second" }, ctx);
    const entries = await queryResolvers.journalEntries(null, { journalId: j.id }, ctx);
    expect(entries[0].body).toBe("first");
    expect(entries[1].body).toBe("second");
  });

  it("updates entry body", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    const entry = await mutationResolvers.createEntry(null, { journalId: j.id, body: "old" }, ctx);
    const updated = await mutationResolvers.updateEntry(null, { id: entry.id, body: "new" }, ctx);
    expect(updated.body).toBe("new");
  });

  it("archives an entry (hides by default)", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "J" }, ctx);
    const entry = await mutationResolvers.createEntry(null, { journalId: j.id, body: "private" }, ctx);
    await mutationResolvers.archiveEntry(null, { id: entry.id }, ctx);
    const visible = await queryResolvers.journalEntries(null, { journalId: j.id }, ctx);
    expect(visible).toHaveLength(0);
    const withArchived = await queryResolvers.journalEntries(null, { journalId: j.id, includeArchived: true }, ctx);
    expect(withArchived).toHaveLength(1);
  });

  it("non-member cannot create entries", async () => {
    const alice = await createTestUser({ email: "alice@example.com" });
    const eve = await createTestUser({ email: "eve@example.com" });
    const j = await mutationResolvers.createJournal(null, { title: "Private" }, makeCtx(alice));
    await expect(
      mutationResolvers.createEntry(null, { journalId: j.id, body: "intrusion" }, makeCtx(eve))
    ).rejects.toThrow("Not found");
  });
});

// ---- addQuickEntry ----

describe("addQuickEntry", () => {
  it("uses the default journal when no journalId provided", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j = await mutationResolvers.createJournal(null, { title: "Default Journal" }, ctx);
    const entry = await mutationResolvers.addQuickEntry(null, { body: "quick thought" }, ctx);
    expect(entry.journalId).toBe(j.id);
    expect(entry.body).toBe("quick thought");
  });

  it("throws if no default journal and no journalId", async () => {
    const user = await createTestUser();
    await expect(
      mutationResolvers.addQuickEntry(null, { body: "quick thought" }, makeCtx(user))
    ).rejects.toThrow("No default journal");
  });

  it("writes to a specified journal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const j1 = await mutationResolvers.createJournal(null, { title: "Main" }, ctx);
    const j2 = await mutationResolvers.createJournal(null, { title: "Work" }, ctx);
    const entry = await mutationResolvers.addQuickEntry(null, { body: "work note", journalId: j2.id }, ctx);
    expect(entry.journalId).toBe(j2.id);
  });
});

// ---- updateDiscoverability ----

describe("updateDiscoverability", () => {
  it("sets discoverableByEmail to true", async () => {
    const user = await createTestUser();
    await mutationResolvers.updateDiscoverability(null, { discoverableByEmail: true }, makeCtx(user));
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.discoverableByEmail).toBe(true);
  });

  it("sets discoverableByEmail back to false", async () => {
    const user = await createTestUser({ discoverableByEmail: true });
    await mutationResolvers.updateDiscoverability(null, { discoverableByEmail: false }, makeCtx(user));
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.discoverableByEmail).toBe(false);
  });
});
