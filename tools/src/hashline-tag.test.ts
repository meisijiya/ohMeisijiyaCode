import { test, expect } from "bun:test";
import { tagLines, validateTag, CID_CHARSET } from "./hashline-tag";

test("CID_CHARSET contains 16 chars", () => {
  expect(CID_CHARSET).toHaveLength(16);
  expect(CID_CHARSET).toBe("ZPMQVRWSNKTXJBYH");
});

test("tagLines assigns 2-char CID to each line", () => {
  const content = "line 1\nline 2\nline 3";
  const tagged = tagLines(content);
  expect(tagged).toHaveLength(3);
  expect(tagged[0]).toMatch(/^1#..\| line 1$/);
  expect(tagged[1]).toMatch(/^2#..\| line 2$/);
  expect(tagged[2]).toMatch(/^3#..\| line 3$/);
});

test("validateTag accepts correct tag", () => {
  const content = "hello world";
  const tagged = tagLines(content);
  expect(validateTag(tagged[0], content)).toBe(true);
});

test("validateTag rejects stale tag (file changed)", () => {
  const original = "hello world";
  const tagged = tagLines(original);
  const modified = "goodbye world";
  expect(validateTag(tagged[0], modified)).toBe(false);
});

test("same content produces same CID", () => {
  const a = tagLines("test content");
  const b = tagLines("test content");
  expect(a[0].split("#")[1].split("|")[0]).toBe(b[0].split("#")[1].split("|")[0]);
});

test("different content produces different CID", () => {
  const a = tagLines("test content A");
  const b = tagLines("test content B");
  const cidA = a[0].split("#")[1].split("|")[0];
  const cidB = b[0].split("#")[1].split("|")[0];
  expect(cidA).not.toBe(cidB);
});
