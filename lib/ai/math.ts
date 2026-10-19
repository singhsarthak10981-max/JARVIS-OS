/**
 * Small, dependency-free arithmetic evaluator used by the local intelligence
 * core. Never uses `eval` / `Function` — input is tokenised and parsed with a
 * shunting-yard into RPN, then evaluated with a stack.
 */

const PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "%": 2,
  "^": 3,
};

function tokenize(expression: string): string[] | null {
  const tokens: string[] = [];
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];
    if (char === " ") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let number = "";
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        number += expression[i++];
      }
      if (Number.isNaN(Number(number))) return null;
      tokens.push(number);
      continue;
    }
    if (char === "x" || char === "X") {
      tokens.push("*");
      i++;
      continue;
    }
    if (char in PRECEDENCE || char === "(" || char === ")") {
      tokens.push(char);
      i++;
      continue;
    }
    return null;
  }
  return tokens;
}

function toRpn(tokens: string[]): string[] | null {
  const output: string[] = [];
  const operators: string[] = [];

  for (const token of tokens) {
    if (/^[0-9.]+$/.test(token)) {
      output.push(token);
      continue;
    }
    if (token === "(") {
      operators.push(token);
      continue;
    }
    if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") {
        output.push(operators.pop() as string);
      }
      if (operators.pop() !== "(") return null;
      continue;
    }
    const precedence = PRECEDENCE[token];
    if (precedence === undefined) return null;
    while (operators.length) {
      const top = operators[operators.length - 1];
      if (top === "(") break;
      const topPrecedence = PRECEDENCE[top];
      if (topPrecedence > precedence) {
        output.push(operators.pop() as string);
      } else {
        break;
      }
    }
    operators.push(token);
  }

  while (operators.length) {
    const operator = operators.pop() as string;
    if (operator === "(") return null;
    output.push(operator);
  }

  return output;
}

function evaluateRpn(rpn: string[]): number | null {
  const stack: number[] = [];

  for (const token of rpn) {
    if (/^[0-9.]+$/.test(token)) {
      stack.push(Number(token));
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;

    switch (token) {
      case "+":
        stack.push(a + b);
        break;
      case "-":
        stack.push(a - b);
        break;
      case "*":
        stack.push(a * b);
        break;
      case "/":
        if (b === 0) return null;
        stack.push(a / b);
        break;
      case "%":
        if (b === 0) return null;
        stack.push(a % b);
        break;
      case "^":
        stack.push(a ** b);
        break;
      default:
        return null;
    }
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) return null;
  return stack[0];
}

/** Returns true when the string is safe, purely arithmetic input. */
export function looksLikeMath(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  if (!/\d/.test(trimmed)) return false;
  if (!/[+\-*/%^xX]/.test(trimmed)) return false;
  return /^[0-9+\-*/%^().xX\s]+$/.test(trimmed);
}

export function evaluateMath(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/^\s*(what('s| is)|calculate|compute|solve)\s+/i, "")
    .replace(/[?=]+\s*$/, "");
  const tokens = tokenize(cleaned);
  if (!tokens || tokens.length === 0) return null;
  const rpn = toRpn(tokens);
  if (!rpn) return null;
  return evaluateRpn(rpn);
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return Number(value.toFixed(6)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}
