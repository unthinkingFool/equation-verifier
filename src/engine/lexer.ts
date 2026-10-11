export type TokenType = "num" | "ident" | "op" | "eof";
export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message);
  }
}

const OPS = new Set(["+", "-", "*", "/", "^", "(", ")", "="]);

export function lex(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ParseError(`"${c}" doesn't start a valid number`, i);
      tokens.push({ type: "num", value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ type: "ident", value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (c === "*" && src[i + 1] === "*") {
      tokens.push({ type: "op", value: "^", pos: i });
      i += 2;
      continue;
    }
    if (OPS.has(c)) {
      tokens.push({ type: "op", value: c, pos: i });
      i++;
      continue;
    }
    throw new ParseError(`The character "${c}" isn't something I understand here`, i);
  }
  tokens.push({ type: "eof", value: "", pos: src.length });
  return tokens;
}
