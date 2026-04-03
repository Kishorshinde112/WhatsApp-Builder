import { db } from "@workspace/db";
import {
  contactsTable,
  contactListsTable,
  contactListMembersTable,
  campaignsTable,
  campaignContactsTable,
  messagesTable,
  messageEventsTable,
  providerConfigsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+55" + digits.slice(1);
  if (!digits.startsWith("55") && digits.length <= 11) return "+55" + digits;
  return "+" + digits;
}

async function seed() {
  console.log("Seeding database...");

  await db.execute(sql`TRUNCATE TABLE message_events, messages, campaign_contacts, campaigns, contact_list_members, contact_lists, contacts, provider_configs RESTART IDENTITY CASCADE`);

  const contactNames = [
    "Ana Souza", "Bruno Lima", "Carla Mendes", "Daniel Costa", "Elisa Ferreira",
    "Felipe Rocha", "Gabriela Nunes", "Henrique Alves", "Isabela Pinto", "João Santos",
    "Karen Oliveira", "Luca Barbosa", "Mariana Gomes", "Natan Freitas", "Olivia Carvalho",
    "Pedro Martins", "Quiteria Ramos", "Rafael Moraes", "Sandra Campos", "Thiago Vieira",
    "Ursula Faria", "Victor Borges", "Wendy Silva", "Xavier Torres", "Yasmin Castro",
    "Zara Ribeiro", "Aldo Pereira", "Beatriz Lopes", "Caio Cunha", "Davi Azevedo",
    "Erica Medeiros", "Flavio Correia", "Giovanna Brandão", "Heitor Machado", "Ingrid Teixeira",
    "Julio Fernandes", "Karina Nascimento", "Leonardo Cardoso", "Melissa Andrade", "Nelson Araujo",
    "Ophelia Sousa", "Paulo Melo", "Quezia Dias", "Ricardo Guerra", "Sofia Cavalcante",
    "Tatiana Monteiro", "Ulysses Rezende", "Valentina Brito", "Wilson Figueiredo", "Xuxa Paiva",
    "Amanda Corrêa", "Bernardo Lima", "Cecília Ramos", "Diego Ferreira", "Eduarda Neves",
    "Fábio Leal", "Grace Rodrigues", "Hugo Azevedo", "Iara Moura", "Jonas Telles",
    "Letícia Guimarães", "Marcelo Viana", "Natália Barbosa", "Oscar Pereira", "Priscila Santos",
    "Rogério Matos", "Simone Faria", "Tobias Cunha", "Úrsula Dantas", "Vitor Campos",
    "Walquíria Nunes", "Yago Ribeiro", "Zenaide Costa", "Alexandre Carmo", "Bianca Rocha",
    "Cristiano Alves", "Débora Peixoto", "Evandro Melo", "Fernanda Gomes", "Gustavo Araújo",
  ];

  const phones = contactNames.map((_, i) => {
    const num = 11900000001 + i;
    return `+55${num}`;
  });

  const contacts = await db.insert(contactsTable).values(
    contactNames.map((name, i) => ({
      name,
      phone: phones[i],
      normalizedPhone: normalizePhone(phones[i]),
      email: `${name.split(" ")[0].toLowerCase()}@example.com`,
      tags: i % 3 === 0 ? ["vip"] : i % 3 === 1 ? ["lead"] : [],
      customFields: {},
      validationStatus: i === 7 || i === 19 ? "invalid" : "valid",
    }))
  ).returning();

  console.log(`Created ${contacts.length} contacts`);

  const [listAll, listVip, listLeads] = await db.insert(contactListsTable).values([
    { name: "All Customers", description: "Complete customer database", contactCount: contactNames.length },
    { name: "VIP Customers", description: "High-value customers", contactCount: 0 },
    { name: "Leads", description: "Potential new customers", contactCount: 0 },
  ]).returning();

  await db.insert(contactListMembersTable).values(
    contacts.map((c) => ({ listId: listAll.id, contactId: c.id }))
  ).onConflictDoNothing();

  const vipContacts = contacts.filter((_, i) => i % 3 === 0);
  if (vipContacts.length > 0) {
    await db.insert(contactListMembersTable).values(
      vipContacts.map((c) => ({ listId: listVip.id, contactId: c.id }))
    ).onConflictDoNothing();
    await db.update(contactListsTable).set({ contactCount: vipContacts.length })
      .where(sql`id = ${listVip.id}`);
  }

  const leadContacts = contacts.filter((_, i) => i % 3 === 1);
  if (leadContacts.length > 0) {
    await db.insert(contactListMembersTable).values(
      leadContacts.map((c) => ({ listId: listLeads.id, contactId: c.id }))
    ).onConflictDoNothing();
    await db.update(contactListsTable).set({ contactCount: leadContacts.length })
      .where(sql`id = ${listLeads.id}`);
  }

  console.log("Created 3 contact lists with members");

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const campaigns = await db.insert(campaignsTable).values([
    {
      name: "Black Friday Promo",
      template: "Olá {{name}}! Aproveite nossos descontos exclusivos de Black Friday. Acesse: https://exemplo.com/bf",
      status: "completed",
      provider: "mock",
      listId: listAll.id,
      dryRun: "false",
      delaySeconds: 3,
      totalContacts: 80,
      queuedCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 63,
      failedCount: 11,
      noAccountCount: 6,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(13),
    },
    {
      name: "Welcome VIP Members",
      template: "Bem-vindo ao clube VIP, {{name}}! Você agora tem acesso a benefícios exclusivos.",
      status: "completed",
      provider: "mock",
      listId: listVip.id,
      dryRun: "false",
      delaySeconds: 5,
      totalContacts: 17,
      queuedCount: 0,
      sentCount: 0,
      deliveredCount: 2,
      readCount: 14,
      failedCount: 1,
      noAccountCount: 0,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(6),
    },
    {
      name: "Monthly Newsletter - April",
      template: "Olá {{name}}, veja as novidades de Abril! Clique aqui: https://exemplo.com/april",
      status: "running",
      provider: "mock",
      listId: listAll.id,
      dryRun: "false",
      delaySeconds: 5,
      totalContacts: 80,
      queuedCount: 22,
      sentCount: 5,
      deliveredCount: 10,
      readCount: 38,
      failedCount: 5,
      noAccountCount: 0,
      createdAt: daysAgo(1),
      updatedAt: new Date(),
    },
    {
      name: "Leads Re-engagement (Dry Run)",
      template: "Oi {{name}}! Sentimos sua falta. Confira o que preparamos para você.",
      status: "completed",
      provider: "mock",
      listId: listLeads.id,
      dryRun: "true",
      delaySeconds: 2,
      totalContacts: 17,
      queuedCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 17,
      failedCount: 0,
      noAccountCount: 0,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      name: "Summer Collection Launch",
      template: "{{name}}, a coleção de verão chegou! Seja o primeiro a conferir.",
      status: "draft",
      provider: "mock",
      listId: null,
      dryRun: "false",
      delaySeconds: 5,
      totalContacts: 0,
      queuedCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      noAccountCount: 0,
      createdAt: daysAgo(0),
      updatedAt: new Date(),
    },
    {
      name: "Weekend Flash Sale",
      template: "{{name}}, oferta relâmpago só esse fim de semana! Aproveite 30% OFF com cupom FLASH30.",
      status: "paused",
      provider: "mock",
      listId: listAll.id,
      dryRun: "false",
      delaySeconds: 5,
      totalContacts: 50,
      queuedCount: 22,
      sentCount: 5,
      deliveredCount: 14,
      readCount: 8,
      failedCount: 1,
      noAccountCount: 0,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      name: "Easter Special Offer",
      template: "Feliz Páscoa, {{name}}! Temos uma surpresa especial pra você — até 50% OFF na linha Easter Collection.",
      status: "cancelled",
      provider: "mock",
      listId: listVip.id,
      dryRun: "false",
      delaySeconds: 5,
      totalContacts: 17,
      queuedCount: 0,
      sentCount: 5,
      deliveredCount: 4,
      readCount: 3,
      failedCount: 1,
      noAccountCount: 0,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
  ]).returning();

  const campCompleted1 = campaigns[0];
  const campCompleted2 = campaigns[1];
  const campRunning = campaigns[2];
  const campDryRun = campaigns[3];
  const campDraft = campaigns[4];
  const campPaused = campaigns[5];
  const campCancelled = campaigns[6];

  console.log(`Created ${campaigns.length} campaigns`);

  const msgStatuses = ["read", "read", "read", "read", "delivered", "sent", "failed", "noAccount"] as const;
  const camp1Contacts = contacts;

  const camp1Messages = await db.insert(messagesTable).values(
    camp1Contacts.map((c, i) => {
      const status = msgStatuses[i % msgStatuses.length];
      return {
        campaignId: campCompleted1.id,
        contactId: c.id,
        externalMessageId: `ext-bf-${i + 1}`,
        provider: "mock",
        requestPayload: { to: c.normalizedPhone, body: `Olá ${c.name}! Aproveite nossos descontos exclusivos de Black Friday.` },
        responsePayload: { messageId: `ext-bf-${i + 1}` },
        lastStatus: status,
        errorMessage: status === "failed" ? "Message delivery failed: network timeout" : null,
        retryCount: status === "failed" ? 1 : 0,
        createdAt: daysAgo(13),
        updatedAt: daysAgo(13),
      };
    })
  ).returning();

  await db.insert(campaignContactsTable).values(
    camp1Contacts.map((c, i) => {
      const status = msgStatuses[i % msgStatuses.length];
      return {
        campaignId: campCompleted1.id,
        contactId: c.id,
        renderedMessage: `Olá ${c.name}! Aproveite nossos descontos exclusivos de Black Friday. Acesse: https://exemplo.com/bf`,
        status,
        queuedAt: daysAgo(14),
        sentAt: daysAgo(13),
        deliveredAt: ["delivered", "read"].includes(status) ? daysAgo(13) : null,
        readAt: status === "read" ? daysAgo(13) : null,
        failedAt: ["failed", "noAccount"].includes(status) ? daysAgo(13) : null,
      };
    })
  );

  const msgEvents: Array<{
    messageId: number;
    status: string;
    description: string | null;
    createdAt: Date;
  }> = [];
  for (const msg of camp1Messages) {
    msgEvents.push({ messageId: msg.id, status: "queued", description: null, createdAt: daysAgo(14) });
    msgEvents.push({ messageId: msg.id, status: "sent", description: "Delivered to WhatsApp API", createdAt: daysAgo(13) });
    if (msg.lastStatus === "delivered" || msg.lastStatus === "read") {
      msgEvents.push({ messageId: msg.id, status: "delivered", description: "Device confirmed delivery", createdAt: daysAgo(13) });
    }
    if (msg.lastStatus === "read") {
      msgEvents.push({ messageId: msg.id, status: "read", description: "Message opened by recipient", createdAt: daysAgo(12) });
    }
    if (msg.lastStatus === "failed") {
      msgEvents.push({ messageId: msg.id, status: "failed", description: "Message delivery failed: network timeout", createdAt: daysAgo(13) });
    }
    if (msg.lastStatus === "noAccount") {
      msgEvents.push({ messageId: msg.id, status: "noAccount", description: "Recipient has no WhatsApp account", createdAt: daysAgo(13) });
    }
  }

  if (msgEvents.length > 0) {
    await db.insert(messageEventsTable).values(msgEvents.map((e) => ({
      messageId: e.messageId,
      status: e.status,
      description: e.description,
      eventPayload: {},
      createdAt: e.createdAt,
    })));
  }

  console.log(`Created ${camp1Messages.length} messages for campaign 1 with events`);

  const vipContacts2 = contacts.slice(0, 17);
  const camp2Messages = await db.insert(messagesTable).values(
    vipContacts2.map((c, i) => {
      const status = i < 14 ? "read" : i < 16 ? "delivered" : "failed";
      return {
        campaignId: campCompleted2.id,
        contactId: c.id,
        externalMessageId: `ext-vip-${i + 1}`,
        provider: "mock",
        requestPayload: { to: c.normalizedPhone, body: `Bem-vindo ao clube VIP, ${c.name}!` },
        responsePayload: { messageId: `ext-vip-${i + 1}` },
        lastStatus: status,
        errorMessage: status === "failed" ? "Invalid number" : null,
        retryCount: 0,
        createdAt: daysAgo(6),
        updatedAt: daysAgo(6),
      };
    })
  ).returning();

  await db.insert(campaignContactsTable).values(
    vipContacts2.map((c, i) => {
      const status = i < 14 ? "read" : i < 16 ? "delivered" : "failed";
      return {
        campaignId: campCompleted2.id,
        contactId: c.id,
        renderedMessage: `Bem-vindo ao clube VIP, ${c.name}! Você agora tem acesso a benefícios exclusivos.`,
        status,
        queuedAt: daysAgo(7),
        sentAt: daysAgo(6),
        deliveredAt: ["delivered", "read"].includes(status) ? daysAgo(6) : null,
        readAt: status === "read" ? daysAgo(5) : null,
        failedAt: status === "failed" ? daysAgo(6) : null,
      };
    })
  );

  console.log(`Created ${camp2Messages.length} messages for campaign 2`);

  const runningContacts = contacts.slice(0, 58);
  const runningMessages = await db.insert(messagesTable).values(
    runningContacts.map((c, i) => {
      const status = i < 38 ? "read" : i < 48 ? "delivered" : i < 53 ? "sent" : "failed";
      return {
        campaignId: campRunning.id,
        contactId: c.id,
        externalMessageId: `ext-apr-${i + 1}`,
        provider: "mock",
        requestPayload: { to: c.normalizedPhone, body: `Olá ${c.name}, veja as novidades de Abril!` },
        responsePayload: { messageId: `ext-apr-${i + 1}` },
        lastStatus: status,
        errorMessage: status === "failed" ? "Delivery timeout" : null,
        retryCount: 0,
        createdAt: daysAgo(1),
        updatedAt: new Date(),
      };
    })
  ).returning();

  await db.insert(campaignContactsTable).values(
    contacts.map((c, i) => {
      const isProcessed = i < 58;
      const status = !isProcessed ? "queued" : i < 38 ? "read" : i < 48 ? "delivered" : i < 53 ? "sent" : "failed";
      return {
        campaignId: campRunning.id,
        contactId: c.id,
        renderedMessage: `Olá ${c.name}, veja as novidades de Abril! Clique aqui: https://exemplo.com/april`,
        status,
        queuedAt: daysAgo(1),
        sentAt: isProcessed ? daysAgo(1) : null,
        deliveredAt: isProcessed && ["delivered", "read"].includes(status) ? daysAgo(1) : null,
        readAt: isProcessed && status === "read" ? new Date() : null,
        failedAt: isProcessed && status === "failed" ? daysAgo(1) : null,
      };
    })
  );

  console.log(`Created ${runningMessages.length} messages for running campaign`);

  const dryRunContacts = contacts.slice(0, 17);
  const dryRunMessages = await db.insert(messagesTable).values(
    dryRunContacts.map((c, i) => ({
      campaignId: campDryRun.id,
      contactId: c.id,
      externalMessageId: `ext-dr-${i + 1}`,
      provider: "mock",
      requestPayload: { to: c.normalizedPhone, body: `Oi ${c.name}! Sentimos sua falta.` },
      responsePayload: { messageId: `ext-dr-${i + 1}` },
      lastStatus: "read" as string,
      errorMessage: null,
      retryCount: 0,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    }))
  ).returning();

  await db.insert(campaignContactsTable).values(
    dryRunContacts.map((c) => ({
      campaignId: campDryRun.id,
      contactId: c.id,
      renderedMessage: `Oi ${c.name}! Sentimos sua falta. Confira o que preparamos para você.`,
      status: "read" as string,
      queuedAt: daysAgo(3),
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      readAt: daysAgo(3),
      failedAt: null,
    }))
  );

  const dryRunEvents: Array<{ messageId: number; status: string; description: string | null; createdAt: Date }> = [];
  for (const msg of dryRunMessages) {
    dryRunEvents.push({ messageId: msg.id, status: "queued", description: null, createdAt: daysAgo(3) });
    dryRunEvents.push({ messageId: msg.id, status: "sent", description: "Dry-run: simulated send", createdAt: daysAgo(3) });
    dryRunEvents.push({ messageId: msg.id, status: "delivered", description: "Dry-run: simulated delivery", createdAt: daysAgo(3) });
    dryRunEvents.push({ messageId: msg.id, status: "read", description: "Dry-run: simulated read", createdAt: daysAgo(3) });
  }
  if (dryRunEvents.length > 0) {
    await db.insert(messageEventsTable).values(dryRunEvents.map((e) => ({
      messageId: e.messageId, status: e.status, description: e.description, eventPayload: {}, createdAt: e.createdAt,
    })));
  }

  console.log(`Created ${dryRunMessages.length} messages for dry-run campaign`);

  const pausedContacts = contacts.slice(0, 28);
  const pausedStatuses = ["read", "read", "read", "delivered", "delivered", "sent", "failed"] as const;
  const pausedMessages = await db.insert(messagesTable).values(
    pausedContacts.map((c, i) => {
      const status = pausedStatuses[i % pausedStatuses.length];
      return {
        campaignId: campPaused.id,
        contactId: c.id,
        externalMessageId: `ext-flash-${i + 1}`,
        provider: "mock",
        requestPayload: { to: c.normalizedPhone, body: `${c.name}, oferta relâmpago! 30% OFF com cupom FLASH30.` },
        responsePayload: { messageId: `ext-flash-${i + 1}` },
        lastStatus: status as string,
        errorMessage: status === "failed" ? "Network unreachable" : null,
        retryCount: status === "failed" ? 1 : 0,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(1),
      };
    })
  ).returning();

  await db.insert(campaignContactsTable).values(
    contacts.map((c, i) => {
      const isProcessed = i < 28;
      const status = !isProcessed ? "queued" : pausedStatuses[i % pausedStatuses.length] as string;
      return {
        campaignId: campPaused.id,
        contactId: c.id,
        renderedMessage: `${c.name}, oferta relâmpago só esse fim de semana! Aproveite 30% OFF com cupom FLASH30.`,
        status,
        queuedAt: daysAgo(2),
        sentAt: isProcessed ? daysAgo(2) : null,
        deliveredAt: isProcessed && ["delivered", "read"].includes(status) ? daysAgo(2) : null,
        readAt: isProcessed && status === "read" ? daysAgo(1) : null,
        failedAt: isProcessed && status === "failed" ? daysAgo(2) : null,
      };
    })
  );

  const pausedEvents: Array<{ messageId: number; status: string; description: string | null; createdAt: Date }> = [];
  for (const msg of pausedMessages) {
    pausedEvents.push({ messageId: msg.id, status: "queued", description: null, createdAt: daysAgo(2) });
    pausedEvents.push({ messageId: msg.id, status: "sent", description: "Delivered to WhatsApp API", createdAt: daysAgo(2) });
    if (msg.lastStatus === "delivered" || msg.lastStatus === "read") {
      pausedEvents.push({ messageId: msg.id, status: "delivered", description: "Device confirmed delivery", createdAt: daysAgo(2) });
    }
    if (msg.lastStatus === "read") {
      pausedEvents.push({ messageId: msg.id, status: "read", description: "Message opened by recipient", createdAt: daysAgo(1) });
    }
    if (msg.lastStatus === "failed") {
      pausedEvents.push({ messageId: msg.id, status: "failed", description: "Network unreachable", createdAt: daysAgo(2) });
    }
  }
  if (pausedEvents.length > 0) {
    await db.insert(messageEventsTable).values(pausedEvents.map((e) => ({
      messageId: e.messageId, status: e.status, description: e.description, eventPayload: {}, createdAt: e.createdAt,
    })));
  }

  console.log(`Created ${pausedMessages.length} messages for paused campaign`);

  const cancelledContacts = contacts.slice(0, 13);
  const cancelledStatuses = ["read", "read", "delivered", "sent", "failed"] as const;
  const cancelledMessages = await db.insert(messagesTable).values(
    cancelledContacts.map((c, i) => {
      const status = cancelledStatuses[i % cancelledStatuses.length];
      return {
        campaignId: campCancelled.id,
        contactId: c.id,
        externalMessageId: `ext-easter-${i + 1}`,
        provider: "mock",
        requestPayload: { to: c.normalizedPhone, body: `Feliz Páscoa, ${c.name}! Até 50% OFF na linha Easter Collection.` },
        responsePayload: { messageId: `ext-easter-${i + 1}` },
        lastStatus: status as string,
        errorMessage: status === "failed" ? "User blocked sender" : null,
        retryCount: 0,
        createdAt: daysAgo(5),
        updatedAt: daysAgo(4),
      };
    })
  ).returning();

  await db.insert(campaignContactsTable).values(
    cancelledContacts.map((c, i) => {
      const status = cancelledStatuses[i % cancelledStatuses.length] as string;
      return {
        campaignId: campCancelled.id,
        contactId: c.id,
        renderedMessage: `Feliz Páscoa, ${c.name}! Temos uma surpresa especial — até 50% OFF na linha Easter Collection.`,
        status,
        queuedAt: daysAgo(5),
        sentAt: daysAgo(5),
        deliveredAt: ["delivered", "read"].includes(status) ? daysAgo(4) : null,
        readAt: status === "read" ? daysAgo(4) : null,
        failedAt: status === "failed" ? daysAgo(5) : null,
      };
    })
  );

  const cancelledEvents: Array<{ messageId: number; status: string; description: string | null; createdAt: Date }> = [];
  for (const msg of cancelledMessages) {
    cancelledEvents.push({ messageId: msg.id, status: "queued", description: null, createdAt: daysAgo(5) });
    cancelledEvents.push({ messageId: msg.id, status: "sent", description: "Delivered to WhatsApp API", createdAt: daysAgo(5) });
    if (msg.lastStatus === "delivered" || msg.lastStatus === "read") {
      cancelledEvents.push({ messageId: msg.id, status: "delivered", description: "Device confirmed delivery", createdAt: daysAgo(4) });
    }
    if (msg.lastStatus === "read") {
      cancelledEvents.push({ messageId: msg.id, status: "read", description: "Message opened by recipient", createdAt: daysAgo(4) });
    }
    if (msg.lastStatus === "failed") {
      cancelledEvents.push({ messageId: msg.id, status: "failed", description: "User blocked sender", createdAt: daysAgo(5) });
    }
  }
  if (cancelledEvents.length > 0) {
    await db.insert(messageEventsTable).values(cancelledEvents.map((e) => ({
      messageId: e.messageId, status: e.status, description: e.description, eventPayload: {}, createdAt: e.createdAt,
    })));
  }

  console.log(`Created ${cancelledMessages.length} messages for cancelled campaign`);

  await db.insert(providerConfigsTable).values({
    providerName: "mock",
    baseUrl: null,
    instanceId: null,
    apiToken: null,
    webhookSecret: null,
    isActive: "true",
  }).onConflictDoNothing();

  const totalMessages = camp1Messages.length + camp2Messages.length + runningMessages.length
    + dryRunMessages.length + pausedMessages.length + cancelledMessages.length;

  console.log("Created provider config");
  console.log("\nSeed complete!");
  console.log(`  - ${contacts.length} contacts`);
  console.log("  - 3 contact lists");
  console.log(`  - ${campaigns.length} campaigns (completed x2, running, dry-run, draft, paused, cancelled)`);
  console.log(`  - ${totalMessages} messages with event histories`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
