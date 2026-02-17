export interface ClassificationResult {
  type: string;
  confidence: number;
  method: "explicit" | "keyword" | "pattern" | "default";
  matchedKeywords?: string[];
}

export interface ClassificationInput {
  explicitType?: string;
  message?: string;
  context?: Record<string, unknown>;
}

interface KeywordConfig {
  keywords: string[];
  weight: number;
}

const TASK_KEYWORDS: Record<string, KeywordConfig> = {
  research: {
    keywords: [
      "research",
      "find",
      "search",
      "look up",
      "investigate",
      "explore",
      "discover",
      "gather",
      "information",
    ],
    weight: 1.0,
  },
  code: {
    keywords: ["code", "write", "implement", "create", "build", "develop", "program"],
    weight: 1.0,
  },
  refactor: {
    keywords: ["refactor", "restructure", "reorganize", "clean", "improve", "simplify", "optimize"],
    weight: 1.2,
  },
  debug: {
    keywords: ["debug", "fix", "bug", "error", "issue", "problem", "troubleshoot", "broken"],
    weight: 1.2,
  },
  analyze: {
    keywords: ["analyze", "review", "examine", "assess", "evaluate", "check", "audit"],
    weight: 1.0,
  },
  test: {
    keywords: ["test", "spec", "verify", "validate", "ensure", "write test", "add test"],
    weight: 1.2,
  },
};

export class TaskTypeClassifier {
  classify(input: ClassificationInput): ClassificationResult {
    if (input.explicitType) {
      return {
        type: input.explicitType,
        confidence: 1.0,
        method: "explicit",
      };
    }

    if (input.message) {
      const keywordResult = this.detectFromKeywords(input.message);
      if (keywordResult) {
        return keywordResult;
      }
    }

    return {
      type: "concurrent",
      confidence: 0.5,
      method: "default",
    };
  }

  private detectFromKeywords(message: string): ClassificationResult | null {
    const normalized = message.toLowerCase();
    const scores = new Map<string, { score: number; matches: string[] }>();

    for (const [type, config] of Object.entries(TASK_KEYWORDS)) {
      const matches: string[] = [];
      let score = 0;

      for (const keyword of config.keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
          matches.push(keyword);
          score += config.weight;

          const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, "i");
          if (regex.test(message)) {
            score += 0.5;
          }
        }
      }

      if (matches.length > 0) {
        scores.set(type, { score, matches });
      }
    }

    let bestType: string | null = null;
    let bestScore = 0;
    let bestMatches: string[] = [];

    for (const [type, data] of scores) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestType = type;
        bestMatches = data.matches;
      }
    }

    if (!bestType || bestScore < 1.0) {
      return null;
    }

    const confidence = Math.min(bestScore / 3, 1.0);

    return {
      type: this.mapToWorkflowType(bestType),
      confidence,
      method: "keyword",
      matchedKeywords: bestMatches,
    };
  }

  private mapToWorkflowType(taskType: string): string {
    const mapping: Record<string, string> = {
      research: "concurrent",
      analyze: "concurrent",
      code: "iterative",
      refactor: "pipeline",
      debug: "iterative",
      test: "pipeline",
    };
    return mapping[taskType] ?? "concurrent";
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
