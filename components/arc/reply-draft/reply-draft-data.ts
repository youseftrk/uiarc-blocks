export type ReplyDraftTone = "friendly" | "concise" | "formal";
export type ReplyDraftLength = "short" | "medium" | "long";

export interface ReplyDraftMessage {
  id?: string;
  from: {
    name: string;
    email: string;
    avatar?: string;
  };
  to?: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export interface ReplyDraftSuggestion {
  id: string;
  label: string;
}

export interface ReplyDraftRequest {
  message: ReplyDraftMessage;
  tone: ReplyDraftTone;
  length: ReplyDraftLength;
  suggestion?: ReplyDraftSuggestion;
  mode: "draft" | "rewrite";
  previous: string;
  signal: AbortSignal;
}

export const replyDraftSampleMessage: ReplyDraftMessage = {
  id: "msg-renewal-sso",
  from: {
    name: "Diane Foster",
    email: "diane.foster@haldenlogistics.com",
  },
  to: "me",
  subject: "Renewal call next week and an SSO question",
  body: [
    "Hi Ryan,",
    "Thanks for the updated quote. Before we sign the renewal for 180 seats, could we move Wednesday's call to Thursday afternoon? Our IT lead also wants to confirm that SAML SSO with Okta is included on the Business plan.",
    "Best,\nDiane",
  ].join("\n\n"),
  receivedAt: "9:14 AM",
};

export const replyDraftSampleSuggestions: ReplyDraftSuggestion[] = [
  { id: "thursday", label: "Thursday works" },
  { id: "friday", label: "Suggest Friday" },
  { id: "daniel", label: "Loop in Daniel" },
];

const DRAFTS: Record<
  string,
  Record<ReplyDraftTone, Record<ReplyDraftLength, string>>
> = {
  thursday: {
    friendly: {
      short:
        "Hi Diane,\n\nThursday afternoon works great — I'll move the invite to 2:00 PM. Yes, SAML SSO with Okta is included on Business.\n\nBest,\nRyan",
      medium:
        "Hi Diane,\n\nThursday afternoon works great for me! I'll move our invite to Thursday at 2:00 PM and send over the updated link. Yes, SAML SSO with Okta is included on the Business plan, and I'd be happy to share our Okta setup guide with your IT lead beforehand.\n\nBest,\nRyan",
      long:
        "Hi Diane,\n\nThanks so much for getting back to me! Moving our call to Thursday afternoon works great on my end — I've updated the calendar invite to Thursday at 2:00 PM so we have plenty of time to walk through the 180-seat renewal.\n\nI can also confirm that SAML SSO with Okta is fully included on the Business plan at no extra cost. If your IT lead wants a head start, I can send over our Okta configuration guide and a sandbox workspace before we meet.\n\nBest,\nRyan",
    },
    concise: {
      short:
        "Hi Diane,\n\nThursday at 2:00 PM works. SAML SSO with Okta is included on Business.\n\nBest,\nRyan",
      medium:
        "Hi Diane,\n\nThursday at 2:00 PM works, updated invite sent. SAML SSO with Okta is included on the Business plan. I can share the Okta setup guide if useful.\n\nBest,\nRyan",
      long:
        "Hi Diane,\n\nThursday at 2:00 PM works — I've updated the invite for our 180-seat renewal review.\n\nSAML SSO with Okta is included on the Business plan with no add-on fee. Let me know if your IT lead would like our Okta setup guide ahead of the call.\n\nBest,\nRyan",
    },
    formal: {
      short:
        "Dear Diane,\n\nThursday afternoon is convenient; I have rescheduled our call for 2:00 PM. I confirm that SAML SSO with Okta is included in the Business plan.\n\nSincerely,\nRyan",
      medium:
        "Dear Diane,\n\nThank you for your note. Thursday afternoon works well, and I have moved our renewal call to 2:00 PM. I can also confirm that SAML SSO with Okta is included in the Business plan. Please let me know if your IT lead would like our technical documentation in advance.\n\nSincerely,\nRyan",
      long:
        "Dear Diane,\n\nThank you for reviewing the updated renewal quote for 180 seats. I am pleased to accommodate the schedule change and have moved our meeting to Thursday at 2:00 PM.\n\nRegarding your IT lead's question, SAML SSO with Okta is included as a standard feature on the Business plan. I would be glad to provide our Okta integration guide prior to our discussion.\n\nSincerely,\nRyan",
    },
  },
  friday: {
    friendly: {
      short:
        "Hi Diane,\n\nThursday afternoon is packed on my end — could we do Friday at 11:00 AM instead? Yes, SAML SSO with Okta is included on Business.\n\nBest,\nRyan",
      medium:
        "Hi Diane,\n\nThursday afternoon is a bit tight on my calendar — would Friday at 11:00 AM work instead? On the IT question, yes, SAML SSO with Okta is included on the Business plan, and I can send over the setup guide right away.\n\nBest,\nRyan",
      long:
        "Hi Diane,\n\nThanks for reaching out! Thursday afternoon is completely booked for me, so could we shift our renewal call to Friday at 11:00 AM? If another time on Friday suits you better, just let me know and I'll make it work.\n\nGood news for your IT lead as well: SAML SSO with Okta is included on the Business plan. I'll attach our Okta setup guide so they can review it ahead of Friday.\n\nBest,\nRyan",
    },
    concise: {
      short:
        "Hi Diane,\n\nThursday is full — does Friday at 11:00 AM work? SAML SSO with Okta is included on Business.\n\nBest,\nRyan",
      medium:
        "Hi Diane,\n\nThursday afternoon is booked on my end. Could we meet Friday at 11:00 AM instead? SAML SSO with Okta is included on the Business plan.\n\nBest,\nRyan",
      long:
        "Hi Diane,\n\nThursday afternoon is fully booked, so I'd like to propose Friday at 11:00 AM for our 180-seat renewal call.\n\nTo confirm for your IT lead: SAML SSO with Okta is included on the Business plan. Happy to send the Okta guide ahead of time.\n\nBest,\nRyan",
    },
    formal: {
      short:
        "Dear Diane,\n\nUnfortunately Thursday afternoon is unavailable. Would Friday at 11:00 AM be suitable? SAML SSO with Okta is included in the Business plan.\n\nSincerely,\nRyan",
      medium:
        "Dear Diane,\n\nThank you for your message. I have prior commitments on Thursday afternoon and would like to propose Friday at 11:00 AM instead. I can confirm that SAML SSO with Okta is included in the Business plan.\n\nSincerely,\nRyan",
      long:
        "Dear Diane,\n\nThank you for the update regarding the 180-seat renewal. Due to existing commitments on Thursday afternoon, might we reschedule our call to Friday at 11:00 AM?\n\nAdditionally, I confirm that SAML SSO with Okta is included in the Business plan, and I can forward our Okta setup documentation to your IT lead ahead of our conversation.\n\nSincerely,\nRyan",
    },
  },
  daniel: {
    friendly: {
      short:
        "Hi Diane,\n\nThursday afternoon works! I'll loop in Daniel, our solutions engineer, to walk your IT lead through Okta SAML SSO on Business.\n\nBest,\nRyan",
      medium:
        "Hi Diane,\n\nThursday at 2:00 PM works great. SAML SSO with Okta is included on the Business plan, and I'm looping in Daniel from our solutions team so he can answer any Okta setup questions directly with your IT lead on the call.\n\nBest,\nRyan",
      long:
        "Hi Diane,\n\nThursday afternoon works great — I've moved our invite to 2:00 PM. Yes, SAML SSO with Okta is included on the Business plan.\n\nI'm also copying Daniel, our solutions engineer, so he can join us on Thursday and walk your IT lead through the Okta configuration and SCIM options if helpful.\n\nBest,\nRyan",
    },
    concise: {
      short:
        "Hi Diane,\n\nThursday at 2:00 PM works. SAML SSO with Okta is included on Business — looping in Daniel for any IT questions.\n\nBest,\nRyan",
      medium:
        "Hi Diane,\n\nThursday at 2:00 PM works, invite updated. SAML SSO with Okta is included on Business. I've looped in Daniel from solutions engineering to help your IT lead.\n\nBest,\nRyan",
      long:
        "Hi Diane,\n\nThursday at 2:00 PM works — I've moved the renewal call and added Daniel, our solutions engineer.\n\nSAML SSO with Okta is included on the Business plan, and Daniel can walk your IT lead through setup during the call.\n\nBest,\nRyan",
    },
    formal: {
      short:
        "Dear Diane,\n\nThursday at 2:00 PM is confirmed. SAML SSO with Okta is included in the Business plan, and I have copied Daniel to assist your IT lead.\n\nSincerely,\nRyan",
      medium:
        "Dear Diane,\n\nThursday at 2:00 PM works well, and I have updated the calendar invitation. SAML SSO with Okta is included in the Business plan; I am also looping in Daniel, our solutions engineer, to address any technical questions from your IT lead.\n\nSincerely,\nRyan",
      long:
        "Dear Diane,\n\nThank you for your note. I have rescheduled our 180-seat renewal call to Thursday at 2:00 PM.\n\nI confirm that SAML SSO with Okta is included in the Business plan. I have included Daniel from our solutions engineering team on this thread so he can assist your IT lead with the Okta integration details.\n\nSincerely,\nRyan",
    },
  },
};

export async function simulateReplyDraft(
  request: ReplyDraftRequest,
): Promise<string> {
  const delay = request.mode === "rewrite" ? 260 : 220;
  await new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, delay);
    request.signal.addEventListener("abort", () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  const key = request.suggestion?.id && DRAFTS[request.suggestion.id]
    ? request.suggestion.id
    : "thursday";
  return DRAFTS[key][request.tone][request.length];
}
