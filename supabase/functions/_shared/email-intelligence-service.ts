import { createJsonChatCompletion } from "./ai-provider.ts";
import { buildEmailIntelligenceMessages, inferContextualCta } from "./email-intelligence-prompts.ts";
import type { EmailGenerationRequest, EmailIntelligenceOutput } from "./email-intelligence-types.ts";

const emptyOutput: EmailIntelligenceOutput = {
  analysis: {
    intent: "",
    tone: "",
    hooks: [],
    pain_points: [],
  },
  strategy: {
    summary: "",
    personalization_used: [],
    why_it_should_work: [],
    next_best_action: "",
  },
  subject_lines: [],
  email: "",
  score: {
    personalization: 0,
    clarity: 0,
    persuasion: 0,
    overall: 0,
  },
  analytics: {
    readability: 0,
    cta_strength: 0,
    spam_risk: 0,
    response_likelihood: 0,
    indicators: [],
  },
  grounding: {
    confidence: 0,
    status: "review",
    sources: [],
    ignored_categories: [],
    potential_claims: [],
  },
  quality: {
    overall: 0,
    dimensions: [],
  },
  readability: {
    word_count: 0,
    reading_time_seconds: 0,
    reading_level: "Business",
    paragraphs: 0,
    average_sentence_length: 0,
  },
  validation: {
    attempts: 0,
    regenerated: false,
    status: "passed",
    unsupported_claims_removed: [],
  },
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 5);
}

function asScore(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const clichePatterns: Array<{ pattern: RegExp; label: string; replacement: string }> = [
  { pattern: /\bi am confident that\b/gi, label: "I am confident", replacement: "I believe" },
  { pattern: /\bi am excited to\b/gi, label: "I am excited", replacement: "I look forward to" },
  { pattern: /\bi hope this email finds you well\.?\s*/gi, label: "I hope this email finds you well", replacement: "" },
  { pattern: /\bthank you for your consideration\.?/gi, label: "Thank you for your consideration", replacement: "Thank you for your time." },
  { pattern: /\bplease do not hesitate to\b/gi, label: "Please do not hesitate", replacement: "Please feel free to" },
  { pattern: /\bi would be thrilled to\b/gi, label: "I would be thrilled", replacement: "I would welcome the chance to" },
];

function detectCliches(value: string) {
  const found: string[] = [];
  for (const item of clichePatterns) {
    if (item.pattern.test(value)) found.push(item.label);
    item.pattern.lastIndex = 0;
  }
  return [...new Set(found)];
}

function cleanCliches(value: string) {
  return clichePatterns.reduce((current, item) => {
    item.pattern.lastIndex = 0;
    return current.replace(item.pattern, item.replacement);
  }, value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

function fixCommonTypos(value: string) {
  return value
    .replace(/\bSenir\b/g, "Senior")
    .replace(/\bsenir\b/g, "senior")
    .replace(/\bSenoir\b/g, "Senior")
    .replace(/\bsenoir\b/g, "senior")
    .replace(/\bFronted\b/g, "Frontend")
    .replace(/\bfronted\b/g, "frontend");
}

function softenCommandStyleCtas(value: string, input: EmailGenerationRequest) {
  if (input.language === "ar") return value;
  const professionalTone = !["casual", "friendly"].includes(input.tone ?? "");
  if (!professionalTone) return value;

  return value
    .replace(/\bSchedule an interview\.?$/gim, "I would welcome the opportunity to discuss my application.")
    .replace(/\bContact me to discuss\.?$/gim, "I would be glad to discuss this further.")
    .replace(/\bReply with your availability\.?$/gim, "Would you be open to sharing a time that works for you?")
    .replace(/\bLet me know if you need anything else\.?$/gim, "Please let me know if I can provide anything further.");
}

function polishGeneratedText(value: string, input: EmailGenerationRequest) {
  return softenCommandStyleCtas(fixCommonTypos(cleanCliches(value)), input);
}

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("AI returned invalid JSON");
    return JSON.parse(text.slice(start, end + 1));
  }
}

function normalizeOutput(raw: unknown): EmailIntelligenceOutput {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const analysis = source.analysis && typeof source.analysis === "object"
    ? source.analysis as Record<string, unknown>
    : {};
  const score = source.score && typeof source.score === "object"
    ? source.score as Record<string, unknown>
    : {};
  const strategy = source.strategy && typeof source.strategy === "object"
    ? source.strategy as Record<string, unknown>
    : {};
  const analytics = source.analytics && typeof source.analytics === "object"
    ? source.analytics as Record<string, unknown>
    : {};

  const output: EmailIntelligenceOutput = {
    analysis: {
      intent: asString(analysis.intent),
      tone: asString(analysis.tone),
      hooks: asStringArray(analysis.hooks),
      pain_points: asStringArray(analysis.pain_points),
    },
    strategy: {
      summary: asString(strategy.summary),
      personalization_used: asStringArray(strategy.personalization_used),
      why_it_should_work: asStringArray(strategy.why_it_should_work),
      next_best_action: asString(strategy.next_best_action),
    },
    subject_lines: asStringArray(source.subject_lines),
    email: asString(source.email),
    score: {
      personalization: asScore(score.personalization),
      clarity: asScore(score.clarity),
      persuasion: asScore(score.persuasion),
      overall: asScore(score.overall),
    },
    analytics: {
      readability: asScore(analytics.readability),
      cta_strength: asScore(analytics.cta_strength),
      spam_risk: asScore(analytics.spam_risk),
      response_likelihood: asScore(analytics.response_likelihood),
      indicators: asStringArray(analytics.indicators),
    },
    grounding: emptyOutput.grounding,
    quality: emptyOutput.quality,
    readability: emptyOutput.readability,
    validation: emptyOutput.validation,
  };

  if (!output.email && typeof source.body === "string") output.email = asString(source.body);
  if (output.subject_lines.length === 0 && typeof source.subject === "string") {
    output.subject_lines = [asString(source.subject)].filter(Boolean);
  }

  const scores = output.score;
  if (!scores.overall && (scores.personalization || scores.clarity || scores.persuasion)) {
    scores.overall = Math.round((scores.personalization + scores.clarity + scores.persuasion) / 3);
  }

  if (!output.email) throw new Error("AI response did not include an email");
  if (output.subject_lines.length === 0) output.subject_lines = ["Following up"];
  if (!output.analysis.tone) output.analysis.tone = "professional";
  if (!output.strategy.summary) output.strategy.summary = "This draft focuses the message around a clear purpose and next step.";
  if (!output.strategy.next_best_action) output.strategy.next_best_action = "Send the email after checking any missing names or dates.";

  return output;
}

function scoreFallbackEmail(email: string, cta: string) {
  const words = email.split(/\s+/).filter(Boolean);
  const sentences = email.split(/[.!?؟]+/).filter((part) => part.trim());
  const avgWords = words.length / Math.max(1, sentences.length);
  const hasCta = cta.trim().length > 0 || /\b(call|meet|reply|confirm|send|review|schedule|let me know)\b/i.test(email);
  const spamWords = ["guaranteed", "free money", "act now", "limited time", "risk-free", "winner"];
  const spamHits = spamWords.filter((word) => email.toLowerCase().includes(word)).length;

  const output: EmailIntelligenceOutput = {
    readability: Math.max(35, Math.min(95, Math.round(100 - Math.max(0, avgWords - 16) * 3))),
    cta_strength: hasCta ? 72 : 35,
    spam_risk: Math.min(90, spamHits * 25 + (email.includes("!!!") ? 20 : 0)),
    response_likelihood: hasCta ? 62 : 42,
    indicators: [
      hasCta ? "Clear next step included" : "CTA could be stronger",
      avgWords <= 20 ? "Readable sentence length" : "Some sentences may be long",
      spamHits === 0 ? "Low spam-language risk" : "Contains promotional phrasing",
    ],
  };
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasSourceValue(email: string, value?: string) {
  const normalized = normalizeForMatch(value ?? "");
  return normalized.length > 2 && normalizeForMatch(email).includes(normalized);
}

function compactClaim(value: string) {
  return normalizeForMatch(value)
    .replace(/\b(?:i|we|my|our|the|a|an|to|for|with|of|and|in|on|at)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function claimDirectlySupported(claim: string, source: string) {
  const normalizedClaim = normalizeForMatch(claim);
  if (normalizedClaim.length > 3 && source.includes(normalizedClaim)) return true;

  const compact = compactClaim(claim);
  if (compact.length > 6 && source.includes(compact)) return true;

  const terms = compact.split(/\s+/).filter((term) => term.length > 3);
  if (terms.length < 3) return false;
  const supportedTerms = terms.filter((term) => source.includes(term)).length;
  return supportedTerms >= Math.ceil(terms.length * 0.85);
}

function sourceText(input: EmailGenerationRequest) {
  const profile = input.profile ?? {};
  return normalizeForMatch([
    input.senderRole,
    input.recipientRole,
    input.purpose,
    input.keyPoints,
    input.incomingEmail,
    input.cta,
    input.context,
    input.signature,
    profile.fullName,
    profile.jobTitle,
    profile.company,
    profile.companyWebsite,
    profile.industry,
    profile.country,
    profile.preferredSignature,
  ].filter(Boolean).join("\n"));
}

function buildGroundingAudit(email: string, input: EmailGenerationRequest) {
  const profile = input.profile ?? {};
  const source = sourceText(input);
  const findings: Array<{ text: string; reason: string; recommendation: string }> = [];
  const addFinding = (text: string, reason: string, recommendation = "Remove this claim or replace it with a fact you provided.") => {
    if (!findings.some((finding) => finding.text === text)) findings.push({ text, reason, recommendation });
  };

  const emailNumbers = email.match(/\b\d+(?:[.,]\d+)?(?:%|\+)?\b/g) ?? [];
  for (const number of emailNumbers) {
    if (!source.includes(number.toLowerCase())) addFinding(number, "This number was not found in the provided facts.", "Remove the number or provide a source for it.");
  }

  const riskyClaims: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(?:i have led|i led|led the team|led a team|leading (?:the|a)?\s*team|team lead)\b[^.!?\n]*/gi, label: "Leadership claim" },
    { pattern: /\b(?:i managed|managed a team|management of|managed the team)\b[^.!?\n]*/gi, label: "Management claim" },
    { pattern: /\b(?:i built|i developed|i delivered|i created)\b[^.!?\n]*/gi, label: "Project or achievement claim" },
    { pattern: /\b(?:in my current role|currently (?:work|working)|my role at)\b[^.!?\n]*/gi, label: "Current-role claim" },
    { pattern: /\b(?:increased|improved|reduced|grew|achieved)\b[^.!?\n]*/gi, label: "Outcome claim" },
    { pattern: /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:years?|yrs?)\s+(?:of\s+)?experience\b[^.!?\n]*/gi, label: "Years-of-experience claim" },
    { pattern: /\b(?:certified|certification|certificate)\b[^.!?\n]*/gi, label: "Certification claim" },
    { pattern: /\b(?:award|awarded|winner|recognized|recognised)\b[^.!?\n]*/gi, label: "Award or recognition claim" },
    { pattern: /\b(?:promoted|promotion)\b[^.!?\n]*/gi, label: "Promotion claim" },
    { pattern: /\b(?:clients?|customers?)\s+(?:including|such as|like)\b[^.!?\n]*/gi, label: "Client claim" },
    { pattern: /\b(?:built|developed|shipped|launched|implemented)\s+(?:a|an|the)?\s*(?:saas|platform|dashboard|app|application|system|feature|product|products)\b[^.!?\n]*/gi, label: "Technical accomplishment claim" },
    { pattern: /\b(?:saas products?|software products?|digital products?|production systems?)\b[^.!?\n]*/gi, label: "Product experience claim" },
  ];

  for (const claim of riskyClaims) {
    const matches = email.match(claim.pattern) ?? [];
    if (matches.length > 0) {
      for (const match of matches) {
        if (!claimDirectlySupported(match, source)) addFinding(match.trim(), `${claim.label} was not found in the provided facts.`);
      }
    }
  }

  const currentCompanyClaims = email.match(/\b(?:current role|role)\s+at\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/g) ?? [];
  for (const claim of currentCompanyClaims) {
    const company = claim.replace(/^.*?\bat\s+/i, "").trim();
    if (company && !source.includes(normalizeForMatch(company))) {
      addFinding(claim, "The named company was not found in the provided facts.", "Remove the company reference or add it to your profile or prompt.");
    }
  }

  const companyReferences = email.match(/\b(?:at|with|from)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){1,3})/g) ?? [];
  for (const claim of companyReferences) {
    const company = claim.replace(/^.*?\b(?:at|with|from)\s+/i, "").trim();
    if (company && !source.includes(normalizeForMatch(company))) {
      addFinding(claim, "This company reference was not found in the provided facts.", "Remove the company reference or add it to your profile or prompt.");
    }
  }

  const overstatedQualifications = email.match(/\b(?:expert|world-class|proven track record|extensive experience|industry-leading)\b[^.!?\n]*/gi) ?? [];
  for (const claim of overstatedQualifications) {
    const claimTerms = normalizeForMatch(claim).split(/\s+/).filter((term) => term.length > 4);
    if (!claimTerms.some((term) => source.includes(term))) {
      addFinding(claim.trim(), "This qualification may overstate the supplied experience.", "Use the exact level of experience provided in your prompt instead.");
    }
  }

  const sources: Array<{ label: string; detail: string }> = [];
  if (input.purpose || input.senderRole || input.recipientRole || input.cta) sources.push({ label: "User prompt", detail: "Purpose, recipient, role, or requested action" });
  if (input.keyPoints) sources.push({ label: "Key points", detail: "Facts provided for this email" });
  if (input.context || input.incomingEmail) sources.push({ label: "Additional context", detail: input.mode === "reply" ? "Incoming email and context" : "Context provided for this email" });
  if ([profile.fullName, profile.jobTitle, profile.company, profile.industry].some((value) => hasSourceValue(email, value))) {
    sources.push({ label: "Account profile", detail: "Relevant profile detail found in the draft" });
  }
  if (input.signature && hasSourceValue(email, input.signature)) sources.push({ label: "Signature", detail: "Provided signature included unchanged" });

  const ignoredCategories = [
    "Current responsibilities",
    "Projects and achievements",
    "Leadership and management",
    "Metrics and results",
    "Years of experience",
    "Certifications and awards",
    "Clients and business outcomes",
  ];
  const confidence = Math.max(35, 100 - findings.length * 20);

  return {
    confidence,
    status: findings.length === 0 ? "grounded" as const : "review" as const,
    sources,
    ignored_categories: ignoredCategories,
    potential_claims: findings.slice(0, 5),
  };
}

type QualityKey = "grammar" | "structure" | "tone" | "length" | "grounding" | "cta" | "signature" | "readability";
type QualityDimension = {
  key: QualityKey;
  label: string;
  score: number;
  reasons: string[];
  suggestion?: string;
};

function buildReadabilityStats(email: string) {
  const words = email.split(/\s+/).filter(Boolean);
  const sentences = email.split(/[.!?؟]+/).filter((part) => part.trim());
  const paragraphs = email.split(/\n\s*\n/).filter((part) => part.trim());
  const averageSentenceLength = words.length / Math.max(1, sentences.length);
  const readingLevel = averageSentenceLength <= 12
    ? "Simple" as const
    : averageSentenceLength <= 20
      ? "Business" as const
      : "Advanced" as const;

  return {
    word_count: words.length,
    reading_time_seconds: Math.max(15, Math.round((words.length / 200) * 60)),
    reading_level: readingLevel,
    paragraphs: paragraphs.length,
    average_sentence_length: Math.round(averageSentenceLength),
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function targetWordRange(length?: string) {
  if (length === "short") return [60, 120] as const;
  if (length === "long") return [220, 400] as const;
  return [120, 220] as const;
}

function hasCta(email: string, requestedCta?: string) {
  if (requestedCta?.trim() && hasSourceValue(email, requestedCta)) return true;
  return /\b(would you|could you|would it|could we|please|let me know|reply|discuss|schedule|confirm|share your thoughts|hear your thoughts)\b/i.test(email);
}

function requestedCtaFor(input: EmailGenerationRequest) {
  const cta = inferContextualCta(input);
  return cta === "ask for the most logical next step based on the context" ? input.cta : cta;
}

function outputIncludesRequestedSignature(email: string, signature?: string) {
  const requested = normalizeForMatch(signature ?? "");
  if (!requested) return false;
  const normalizedEmail = normalizeForMatch(email);
  if (normalizedEmail.includes(requested)) return true;

  const requestedLines = (signature ?? "").split(/\r?\n/).map((line) => normalizeForMatch(line)).filter((line) => line.length > 2);
  if (requestedLines.length === 0) return false;
  return requestedLines.every((line) => normalizedEmail.includes(line));
}

function hasAnySignatureBlock(email: string) {
  const tail = email.split(/\r?\n/).slice(-4).join("\n");
  return /\b(best regards|kind regards|regards|sincerely|thank you|thanks|warmly)\b/i.test(tail);
}

function assessToneFit(email: string, tone?: string) {
  const words = email.split(/\s+/).filter(Boolean).length;
  const normalized = email.toLowerCase();
  const contractions = /\b(?:i'm|i've|we're|we've|don't|can't|it's|that's)\b/.test(normalized);

  if (tone === "executive" || tone === "concise") {
    return words <= 180 ? 95 : Math.max(45, 95 - Math.round((words - 180) / 3));
  }
  if (tone === "formal") return contractions ? 78 : 93;
  if (tone === "friendly" || tone === "casual") return contractions ? 92 : 84;
  if (tone === "apologetic") return /\b(sorry|apolog(?:y|ise|ize)|regret)\b/i.test(email) ? 92 : 78;
  if (tone === "persuasive" || tone === "sales") return hasCta(email) ? 90 : 74;
  return 88;
}

function buildQualityAssessment(
  email: string,
  input: EmailGenerationRequest,
  grounding: ReturnType<typeof buildGroundingAudit>,
) {
  const readability = buildReadabilityStats(email);
  const words = readability.word_count;
  const paragraphs = readability.paragraphs;
  const averageSentenceLength = readability.average_sentence_length;
  const [minimumWords, maximumWords] = targetWordRange(input.length);
  const endsCleanly = /[.!?؟]$/.test(email.trim().split(/\n/).filter(Boolean).at(-1) ?? "");
  const mechanicsPenalty = (email.match(/(?:!!+|\?\?+|\.\.\.)/g) ?? []).length * 8;
  const cliches = detectCliches(email);
  const clichePenalty = cliches.length * 8;
  const grammarScore = clampScore(100 - mechanicsPenalty - (endsCleanly ? 0 : 8));
  const structureScore = clampScore(
    (paragraphs.length >= 2 ? 45 : 28) +
    (words >= 30 ? 30 : 18) +
    (averageSentenceLength >= 7 && averageSentenceLength <= 24 ? 25 : 12),
  );
  const lengthScore = words < minimumWords
    ? clampScore(100 - (minimumWords - words) * 1.2)
    : words > maximumWords
      ? clampScore(100 - (words - maximumWords) * 0.7)
      : 100;
  const toneScore = assessToneFit(email, input.tone);
  const ctaScore = hasCta(email, requestedCtaFor(input)) ? 92 : 52;
  const signatureScore = input.signature?.trim()
    ? (outputIncludesRequestedSignature(email, input.signature) ? 100 : 40)
    : (hasAnySignatureBlock(email) ? 90 : 65);
  const readabilityScore = clampScore(100 - Math.max(0, averageSentenceLength - 16) * 3 - (paragraphs.length <= 1 ? 8 : 0) - clichePenalty);

  const dimensions: QualityDimension[] = [
    { key: "grammar", label: "Grammar", score: grammarScore, reasons: mechanicsPenalty ? ["Avoid repeated punctuation for a cleaner finish."] : ["Clean punctuation and sentence endings."], suggestion: mechanicsPenalty ? "Replace repeated punctuation with one clear sentence ending." : undefined },
    { key: "structure", label: "Structure", score: structureScore, reasons: [paragraphs.length >= 2 ? "Content is split into readable paragraphs." : "The draft is compact but could use clearer paragraph breaks.", averageSentenceLength <= 24 ? "Sentence length is easy to follow." : "Some sentences are long."], suggestion: paragraphs.length < 2 ? "Split the main idea and CTA into separate paragraphs." : undefined },
    { key: "tone", label: "Tone consistency", score: toneScore, reasons: [`The draft is checked against the requested ${input.tone || "professional"} tone.`], suggestion: toneScore < 80 ? "Adjust vocabulary and length to better match the selected tone." : undefined },
    { key: "length", label: "Length", score: lengthScore, reasons: [`${words} words; target is ${minimumWords}-${maximumWords}.`], suggestion: lengthScore < 85 ? `Bring the draft closer to ${minimumWords}-${maximumWords} words.` : undefined },
    { key: "grounding", label: "Grounded", score: grounding.confidence, reasons: grounding.status === "grounded" ? ["No unsupported claims were detected."] : ["Potential unsupported claims need review."], suggestion: grounding.status === "review" ? "Remove or verify the highlighted claims before sending." : undefined },
    { key: "cta", label: "CTA", score: ctaScore, reasons: [ctaScore >= 80 ? "A clear next step is present." : "The email needs a more explicit next step."], suggestion: ctaScore < 80 ? "End with one specific, low-friction next step." : undefined },
    { key: "signature", label: "Signature", score: signatureScore, reasons: [input.signature?.trim() ? (signatureScore === 100 ? "Provided signature is included in the final output." : "Provided signature was not detected in the final output.") : (signatureScore >= 80 ? "A professional sign-off is present." : "No clear sign-off was detected.")], suggestion: input.signature?.trim() && signatureScore < 100 ? "Add the requested signature before sending." : undefined },
    { key: "readability", label: "Readability", score: readabilityScore, reasons: [`Average sentence length is ${Math.round(averageSentenceLength)} words.`, cliches.length ? `Template-like phrases detected: ${cliches.join(", ")}.` : "No common AI email clichés detected."], suggestion: cliches.length ? "Replace stock phrases with context-specific wording." : readabilityScore < 80 ? "Shorten the longest sentence for easier scanning." : undefined },
  ];
  const weights: Record<QualityKey, number> = { grammar: 0.15, structure: 0.15, tone: 0.15, length: 0.1, grounding: 0.25, cta: 0.1, signature: 0.05, readability: 0.05 };
  const overall = clampScore(dimensions.reduce((total, dimension) => total + dimension.score * weights[dimension.key], 0));

  return { overall, dimensions };
}

function applyQualityAssessment(
  output: EmailIntelligenceOutput,
  input: EmailGenerationRequest,
  grounding: ReturnType<typeof buildGroundingAudit>,
) {
  const clichesBeforeCleanup = detectCliches(output.email);
  output = {
    ...output,
    email: polishGeneratedText(output.email, input),
    subject_lines: output.subject_lines.map(fixCommonTypos),
  };
  grounding = buildGroundingAudit(output.email, input);
  const quality = buildQualityAssessment(output.email, input, grounding);
  const dimension = (key: QualityKey) => quality.dimensions.find((item) => item.key === key)?.score ?? 0;
  const personalization = clampScore(Math.min(100, grounding.sources.length * 25 + (input.profile?.company || input.profile?.jobTitle ? 10 : 0)));

  return {
    ...output,
    grounding,
    quality,
    strategy: buildStrategyDetails(output.strategy, output.email, input, grounding),
    score: {
      personalization,
      clarity: Math.round((dimension("structure") + dimension("readability")) / 2),
      persuasion: Math.round((dimension("cta") + dimension("tone")) / 2),
      overall: quality.overall,
    },
    analytics: {
      ...output.analytics,
      readability: dimension("readability"),
      cta_strength: dimension("cta"),
      response_likelihood: Math.round((dimension("cta") + dimension("grounding") + dimension("tone")) / 3),
      indicators: [
        ...output.analytics.indicators,
        clichesBeforeCleanup.length ? `Varied stock phrases: ${clichesBeforeCleanup.join(", ")}` : "Checked for common AI email clichés",
      ].slice(0, 5),
    },
    readability: buildReadabilityStats(output.email),
    revision: buildRevisionSummary(output.email, input),
  };
}

function repeatedPhraseCount(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3);
  const counts = new Map<string, number>();
  for (const word of normalized) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 2).length;
}

function buildRevisionSummary(email: string, input: EmailGenerationRequest) {
  if (!input.refine || !input.previousBody?.trim()) return undefined;

  const previous = input.previousBody.trim();
  const previousWords = previous.split(/\s+/).filter(Boolean).length;
  const currentWords = email.split(/\s+/).filter(Boolean).length;
  const changes: string[] = [];

  if (currentWords < previousWords - 8) changes.push("Made the draft more concise");
  if (currentWords > previousWords + 8) changes.push("Added supporting detail");
  if (repeatedPhraseCount(email) < repeatedPhraseCount(previous) || detectCliches(email).length < detectCliches(previous).length) changes.push("Removed repetitive wording");
  if (hasCta(email, requestedCtaFor(input)) && !hasCta(previous, requestedCtaFor(input))) changes.push("Strengthened the call to action");

  const requestedChange: Record<string, string> = {
    shorter: "Focused the message on the essentials",
    longer: "Expanded the message with more context",
    formal: "Shifted to a more formal tone",
    casual: "Shifted to a more conversational tone",
    executive: "Made the message more executive and direct",
    persuasive: "Made the message more persuasive",
    concise: "Simplified the wording",
    recruiter: "Adapted the wording for a recruiter audience",
    investor: "Adapted the wording for an investor audience",
    sales: "Adapted the wording for a sales audience",
    british: "Adjusted spelling and phrasing for British English",
    american: "Adjusted spelling and phrasing for American English",
    friendlier: "Made the tone friendlier",
    warmer: "Added warmth while keeping the message professional",
    confident: "Made the wording more confident",
    simpler_english: "Simplified the language",
    more_natural: "Made the wording more natural",
    follow_up: "Turned the message into a polite follow-up",
    direct: "Made the main point more direct",
    polite: "Made the request more polite",
    ats_friendly: "Made supplied role and skill terms easier to scan",
    ceo: "Adapted the message for an executive audience",
    sales_pitch: "Adapted the message into a focused sales pitch",
    customer_support: "Adapted the message for customer support",
    networking: "Adapted the message for professional networking",
  };
  const requested = requestedChange[input.refine];
  if (requested && !changes.includes(requested)) changes.unshift(requested);
  if (input.refine === "shorter") changes.unshift("Shortened the introduction", "Simplified the closing");
  if (input.refine === "concise" || input.refine === "simpler_english") changes.unshift("Simplified the wording");
  if (input.refine === "more_natural") changes.unshift("Replaced template-like phrasing");

  return { changes: [...new Set(changes)].slice(0, 4) };
}

function countProvidedFacts(input: EmailGenerationRequest) {
  const keyPointFacts = input.keyPoints?.split(/\r?\n|[•]/).map((item) => item.trim()).filter(Boolean).length ?? 0;
  const directFacts = [input.senderRole, input.recipientRole, input.purpose, input.cta, input.context].filter(Boolean).length;
  const profile = input.profile ?? {};
  const profileFacts = [profile.fullName, profile.jobTitle, profile.company, profile.industry].filter(Boolean).length;
  return keyPointFacts + directFacts + profileFacts;
}

function writingStyleForTone(tone?: string) {
  const styles: Record<string, string> = {
    executive: "Brief and decision-oriented",
    concise: "Direct and easy to scan",
    formal: "Respectful and structured",
    friendly: "Warm and approachable",
    persuasive: "Credible and benefit-led",
    apologetic: "Accountable and constructive",
    sales: "Relevant and low-pressure",
    recruiter: "Credible and candidate-focused",
    investor: "Commercially aware and restrained",
  };
  return styles[tone ?? ""] ?? "Clear and professional";
}

function buildStrategyDetails(
  strategy: EmailIntelligenceOutput["strategy"],
  email: string,
  input: EmailGenerationRequest,
  grounding: ReturnType<typeof buildGroundingAudit>,
) {
  const words = email.split(/\s+/).filter(Boolean).length;
  const readingSeconds = Math.max(15, Math.round((words / 200) * 60));
  const factsUsed = Math.max(grounding.sources.length, countProvidedFacts(input));

  return {
    ...strategy,
    tone: input.tone || strategy.tone || "professional",
    goal: input.purpose || strategy.goal || "Communicate the requested message",
    audience: input.recipientRole || strategy.audience || "Recipient",
    primary_cta: input.cta || strategy.next_best_action,
    writing_style: writingStyleForTone(input.tone),
    facts_used: factsUsed,
    estimated_reading_time_seconds: readingSeconds,
  };
}

function fallbackEmail(input: EmailGenerationRequest): EmailIntelligenceOutput {
  const isArabic = input.language === "ar";
  const purpose = input.purpose?.trim() || (isArabic ? "متابعة الموضوع" : "follow up on this topic");
  const recipient = input.recipientRole?.trim() || (isArabic ? "الفريق" : "the team");
  const sender = input.senderRole?.trim();
  const keyPoints = input.keyPoints?.trim();
  const context = input.context?.trim();
  const cta = input.cta?.trim() || (isArabic ? "أخبرني بالخطوة التالية المناسبة." : inferContextualCta(input));
  const signature = input.signature?.trim();
  const client = input.clientContext ?? {};
  const clientFacts = [
    client.clientName ? `${isArabic ? "العميل" : "Client"}: ${client.clientName}` : "",
    client.company ? `${isArabic ? "الشركة" : "Company"}: ${client.company}` : "",
    client.project ? `${isArabic ? "المشروع" : "Project"}: ${client.project}` : "",
    client.service ? `${isArabic ? "الخدمة" : "Service"}: ${client.service}` : "",
    client.projectStatus ? `${isArabic ? "الحالة" : "Status"}: ${client.projectStatus}` : "",
    client.amount ? `${isArabic ? "المبلغ" : "Amount"}: ${client.amount}` : "",
    client.deadline ? `${isArabic ? "الموعد النهائي" : "Deadline"}: ${client.deadline}` : "",
    client.importantFacts || "",
  ].filter(Boolean).join("\n");

  const subject = isArabic
    ? `متابعة بخصوص ${purpose}`
    : `Following up on ${purpose}`;

  const email = isArabic
    ? [
        `مرحبًا ${recipient}،`,
        "",
        `أكتب إليكم بخصوص ${purpose}.`,
        sender ? `بصفتي ${sender}، أود توضيح النقاط الأساسية بطريقة مباشرة ومنظمة.` : "",
        keyPoints ? `النقاط المهمة:\n${keyPoints}` : "",
        context ? `للسياق:\n${context}` : "",
        clientFacts ? `التفاصيل المؤكدة:\n${clientFacts}` : "",
        cta,
        "",
        signature || "مع خالص التحية،",
      ].filter(Boolean).join("\n")
    : [
        `Hi ${recipient},`,
        "",
        `I'm reaching out about ${purpose}.`,
        sender ? `As ${sender}, I want to keep this clear, specific, and easy to act on.` : "",
        keyPoints ? `Key points:\n${keyPoints}` : "",
        context ? `Context:\n${context}` : "",
        clientFacts ? `Confirmed details:\n${clientFacts}` : "",
        cta,
        "",
        signature || "Best regards,",
      ].filter(Boolean).join("\n");

  const analytics = scoreFallbackEmail(email, cta);

  const output: EmailIntelligenceOutput = {
    analysis: {
      intent: purpose,
      tone: input.tone || "professional",
      hooks: keyPoints ? [keyPoints.split(/\r?\n/)[0]].filter(Boolean) : [],
      pain_points: input.incomingEmail ? ["Needs a clear, actionable reply"] : [],
    },
    strategy: {
      summary: isArabic
        ? "تم بناء الرسالة حول الهدف الأساسي مع دعوة واضحة لاتخاذ إجراء."
        : "The message is built around the main goal with a clear next action.",
      personalization_used: [
        sender ? `Sender role: ${sender}` : "",
        input.recipientRole ? `Recipient: ${input.recipientRole}` : "",
        input.profile?.company ? `Company: ${input.profile.company}` : "",
      ].filter(Boolean),
      why_it_should_work: isArabic
        ? ["تركز على سياق محدد", "تقلل الغموض", "تنتهي بخطوة عملية"]
        : ["It uses the provided context", "It keeps the ask clear", "It avoids unsupported claims"],
      next_best_action: cta,
    },
    subject_lines: [
      subject,
      isArabic ? `خطوة تالية بخصوص ${purpose}` : `Next step on ${purpose}`,
      isArabic ? `تنسيق سريع حول ${purpose}` : `Quick alignment on ${purpose}`,
    ],
    email,
    score: {
      personalization: sender || input.recipientRole || context ? 55 : 35,
      clarity: 70,
      persuasion: input.cta ? 55 : 40,
      overall: 60,
    },
    analytics,
    grounding: buildGroundingAudit(email, input),
    quality: emptyOutput.quality,
    readability: emptyOutput.readability,
  };
  return applyQualityAssessment(output, input, output.grounding);
}

type GroundingAudit = ReturnType<typeof buildGroundingAudit>;
type ValidationStatus = NonNullable<EmailIntelligenceOutput["validation"]>["status"];

const maxValidationAttempts = 2;

function validationClaims(grounding: GroundingAudit) {
  return grounding.potential_claims.map((claim) => claim.text).filter(Boolean);
}

function withValidation(
  output: EmailIntelligenceOutput,
  attempts: number,
  status: ValidationStatus,
  unsupportedClaimsRemoved: string[],
) {
  return {
    ...output,
    validation: {
      attempts,
      regenerated: attempts > 1 || status === "fallback_used",
      status,
      unsupported_claims_removed: [...new Set(unsupportedClaimsRemoved)].slice(0, 8),
    },
    analytics: {
      ...output.analytics,
      indicators: [
        ...output.analytics.indicators,
        status === "passed"
          ? `Fact validation passed${attempts > 1 ? ` after ${attempts} attempts` : ""}`
          : "Conservative fallback used after fact validation",
      ].slice(0, 5),
    },
  };
}

function buildValidationRetryMessages(
  input: EmailGenerationRequest,
  output: EmailIntelligenceOutput,
  grounding: GroundingAudit,
) {
  return [
    ...buildEmailIntelligenceMessages(input),
    {
      role: "assistant" as const,
      content: JSON.stringify({
        subject_lines: output.subject_lines,
        email: output.email,
      }),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "regenerate_after_fact_validation_failed",
        validation_errors: grounding.potential_claims,
        fact_consistency_rule: "Before returning the email, review every factual statement. For each one ask whether it can be directly supported by the user's input, profile, or uploaded files. If not, rewrite it into a neutral statement or remove it.",
        instruction: [
          "Regenerate the complete JSON response.",
          "Remove or neutralize every unsupported claim listed in validation_errors.",
          "Do not paraphrase unsupported claims into softer claims.",
          "Use only verified_facts from the original request.",
          "Never invent experience, achievements, responsibilities, projects, metrics, or business outcomes.",
          "When in doubt, choose accuracy over persuasion.",
          "If a detail is missing, write a more general sentence instead of guessing.",
        ].join(" "),
      }),
    },
  ];
}

async function generateValidatedWithAi(input: EmailGenerationRequest) {
  let messages = buildEmailIntelligenceMessages(input);
  const removedClaims: string[] = [];

  for (let attempt = 1; attempt <= maxValidationAttempts; attempt += 1) {
    const raw = await createJsonChatCompletion(messages, { temperature: attempt === 1 ? 0.35 : 0.2 });
    const output = normalizeOutput(extractJson(raw));
    const cleanedOutput = {
      ...output,
      email: polishGeneratedText(output.email, input),
      subject_lines: output.subject_lines.map(fixCommonTypos),
    };
    const grounding = buildGroundingAudit(cleanedOutput.email, input);

    if (grounding.status === "grounded") {
      return withValidation(applyQualityAssessment(cleanedOutput, input, grounding), attempt, "passed", removedClaims);
    }

    removedClaims.push(...validationClaims(grounding));
    if (attempt < maxValidationAttempts) messages = buildValidationRetryMessages(input, cleanedOutput, grounding);
  }

  return withValidation(fallbackEmail(input), maxValidationAttempts + 1, "fallback_used", removedClaims);
}

export async function generateEmailIntelligence(input: EmailGenerationRequest): Promise<EmailIntelligenceOutput> {
  try {
    return await generateValidatedWithAi(input);
  } catch (error) {
    if (error instanceof Error && [
      "RateLimitError",
      "BillingError",
      "ModelNotFoundError",
      "AiRequestError",
      "AiProviderError",
    ].includes(error.name)) {
      console.error("AI provider unavailable, using deterministic fallback", error.name, error.message);
      return withValidation(fallbackEmail(input), 1, "fallback_used", []);
    }

    console.error("AI validation loop failed, using deterministic fallback", error);
    return withValidation(fallbackEmail(input), 1, "fallback_used", []);
  }
}
