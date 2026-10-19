"use client";

import { useEffect } from "react";

const HIDDEN_NOTICES = new Set([
  "관리자 승인 대기 중인 계정입니다.",
  "가입 신청이 접수되었습니다. 현재 관리자 승인 대기 중입니다.",
]);

function sanitizeText(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (HIDDEN_NOTICES.has(trimmed)) return "";
  return value.replace(/모의\s*/g, "");
}

function sanitize(root = document.body) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node);
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const current = textNode.nodeValue || "";
    const next = sanitizeText(current);
    if (next !== current) textNode.nodeValue = next;
  });
}

export default function VipCopyGuard() {
  useEffect(() => {
    sanitize();

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") {
          const current = record.target.nodeValue || "";
          const next = sanitizeText(current);
          if (next !== current) record.target.nodeValue = next;
          continue;
        }

        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const current = node.nodeValue || "";
            const next = sanitizeText(current);
            if (next !== current) node.nodeValue = next;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            sanitize(node);
          }
        });
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
