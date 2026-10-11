import { type Equation, type Expr } from "./ast";
import { lex, ParseError, type Token } from "./lexer";
import { FUNCTIONS } from "./operationRegistry";

class Parser {
  i = 0;
  constructor(private t: Token[]) {}
  peek() {
    return this.t[this.i];
  }
  next() {
    return this.t[this.i++];
  }
  isOp(v: string) {
    const k = this.peek();
    return k.type === "op" && k.value === v;
  }
  expect(v: string, msg: string) {
    if (!this.isOp(v)) throw new ParseError(msg, this.peek().pos);
    this.next();
  }
  expr(): Expr {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().value === "+" ? "add" : "sub";
      left = { kind: "binary", op, left, right: this.term() };
    }
    return left;
  }
  term(): Expr {
    let left = this.unary();
    while (this.isOp("*") || this.isOp("/")) {
      const op = this.next().value === "*" ? "mul" : "div";
      left = { kind: "binary", op, left, right: this.unary() };
    }
    return left;
  }
  unary(): Expr {
    if (this.isOp("-")) {
      this.next();
      return { kind: "neg", arg: this.unary() };
    }
    if (this.isOp("+")) {
      this.next();
      return this.unary();
    }
    return this.power();
  }
  power(): Expr {
    const base = this.primary();
    if (this.isOp("^")) {
      this.next();
      return { kind: "binary", op: "pow", left: base, right: this.unary() };
    }
    return base;
  }
  primary(): Expr {
    const k = this.peek();
    if (k.type === "num") {
      this.next();
      return { kind: "num", value: parseFloat(k.value) };
    }
    if (k.type === "ident") {
      this.next();
      if (this.isOp("(")) {
        if (!FUNCTIONS.includes(k.value))
          throw new ParseError(`"${k.value}" isn't a known function. Try one of: ${FUNCTIONS.join(", ")}.`, k.pos);
        this.next();
        const arg = this.expr();
        this.expect(")", `Missing ")" to close ${k.value}(`);
        return { kind: "call", fn: k.value, arg };
      }
      if (FUNCTIONS.includes(k.value))
        throw new ParseError(`"${k.value}" is a function — write it with parentheses, like ${k.value}(x).`, k.pos);
      return { kind: "var", name: k.value };
    }
    if (this.isOp("(")) {
      this.next();
      const e = this.expr();
      this.expect(")", 'Missing a closing ")"');
      return e;
    }
    if (k.type === "eof") throw new ParseError("The equation ends too early — something is missing after the last operator.", k.pos);
    throw new ParseError(`Didn't expect "${k.value}" here.`, k.pos);
  }
}

export function parseExpression(src: string): Expr {
  const p = new Parser(lex(src));
  const e = p.expr();
  if (p.peek().type !== "eof") throw new ParseError(`Didn't expect "${p.peek().value}" here.`, p.peek().pos);
  return e;
}

export function parseEquation(src: string, line = 0): Equation {
  const tokens = lex(src);
  if (!tokens.some((t) => t.type === "op" && t.value === "="))
    throw new ParseError("Each line needs a name and an equals sign, like  y = x * w", 0);
  const p = new Parser(tokens);
  const name = p.next();
  if (name.type !== "ident") throw new ParseError("Start the line with the name you're defining, like  y = …", name.pos);
  if (FUNCTIONS.includes(name.value)) throw new ParseError(`"${name.value}" is a function name and can't be used as a variable.`, name.pos);
  p.expect("=", 'Expected "=" right after the name.');
  if (p.peek().type === "eof") throw new ParseError("Nothing after the equals sign yet.", p.peek().pos);
  const expr = p.expr();
  if (p.peek().type !== "eof") {
    const k = p.peek();
    throw new ParseError(k.value === "=" ? "Only one equals sign per line." : `Didn't expect "${k.value}" here.`, k.pos);
  }
  return { target: name.value, expr, source: src, line };
}
