/**
 * Sanitize user input before passing to LLM APIs.
 * Prevents prompt injection by removing common attack patterns
 * while preserving legitimate Korean medical terms.
 */

// Patterns commonly used in prompt injection attacks
const INJECTION_PATTERNS = [
  /ignore\s*(all\s*)?(previous|above|prior)\s*(instructions|prompts|context)/gi,
  /disregard\s*(all\s*)?(previous|above|prior)/gi,
  /you\s*are\s*now\s*/gi,
  /act\s*as\s*(if|a|an)\s*/gi,
  /new\s*instructions?\s*:/gi,
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
  /\[INST\]/gi,
  /<<\s*SYS\s*>>/gi,
  /```(system|assistant|user)/gi,
  /\{\{.*\}\}/g,             // template injection {{...}}
  /<\/?script/gi,            // XSS attempts
  /<\/?iframe/gi,
];

export function sanitizeForLLM(input: string): string {
  let sanitized = input.trim();

  // Remove injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove control characters (except newline, tab)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Collapse excessive whitespace
  sanitized = sanitized.replace(/\s{3,}/g, '  ');

  return sanitized.trim();
}

/**
 * Wrap user input with clear delimiters so the LLM knows it's user content.
 * This is the recommended defense against prompt injection.
 */
export function wrapUserInput(input: string): string {
  const sanitized = sanitizeForLLM(input);
  return `[사용자 입력 시작]\n${sanitized}\n[사용자 입력 끝]`;
}
